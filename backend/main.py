import os
import time
import threading
from collections import deque
from datetime import timedelta

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO

from kite_initializer import initialize_kite
from instruments import (
    fetch_and_cache_instruments,
    load_from_cache,
    is_cache_valid
)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# If you ever want to stop all rotation threads gracefully:
shutdown_event = threading.Event()


class SegmentPriorityManager:
    def __init__(self):
        # Just to initialize once
        self.kite, _ = initialize_kite()

        # Central storage for all ticks
        self.central_storage = {}

        # Dictionary tracking active websockets: {ws_id: kws_instance}
        self.connections = {}

        # Zerodha constraints
        self.SYMBOLS_PER_CONNECTION = 3000
        self.max_websockets = 3  # In practice, cannot exceed 3 with Zerodha

    ################################################################
    #               INSTRUMENT SEGREGATION
    ################################################################

    def segment_priority_filter(self, instruments):
        """
        Splits instruments into two groups:
          - Priority: e.g. 'segment' in ['INDICES', 'NFO-FUT']
          - Rotation: everything else
        Adjust to your business needs.
        """
        priority_instruments = []
        rotation_instruments = []

        for instr in instruments:
            if instr['segment'] in ['INDICES', 'NFO-FUT']:
                priority_instruments.append(instr)
            else:
                rotation_instruments.append(instr)

        return priority_instruments, rotation_instruments

    ################################################################
    #              KITE WEBSOCKET EVENT HANDLERS
    ################################################################

    def on_ticks(self, ws_id, ticks):
        """Handle inbound tick data from Kite WebSocket."""
        for tick in ticks:
            token = tick['instrument_token']
            last_price = tick.get('last_price', 0.0)
            ohlc = tick.get('ohlc') or {}
            close_price = ohlc.get('close', last_price)
            change = tick.get('change', 0.0)

            self.central_storage[token] = {
                'change': round(change, 2),
                'instrument_token': token,
                'last_price': last_price,
                'net_change': round(last_price - close_price, 2),
            }

        # Broadcast to all Socket.IO clients
        socketio.emit('FromAPI', self.central_storage)

    def on_connect(self, ws_id, ws, response, is_priority):
        ctype = "Priority" if is_priority else "Rotation"
        print(f"{ctype} WebSocket {ws_id} connected.")

    def on_close(self, ws_id, ws, code, reason):
        print(f"WebSocket {ws_id} closed: {code} - {reason}")
        # Remove it from the dictionary so next time we see it's missing
        if ws_id in self.connections:
            del self.connections[ws_id]

    def on_error(self, ws_id, ws, code, reason):
        print(f"WebSocket {ws_id} error: {code} - {reason}")

    ################################################################
    #              CREATE / ENSURE WEBSOCKET CONNECTED
    ################################################################

    def create_websocket(self, ws_id, is_priority=False):
        """
        Creates a new Kite WebSocket instance, attaches handlers,
        connects in a separate thread, and stores in self.connections.
        """
        kite, kws = initialize_kite()

        def _on_ticks(ws, ticks):
            self.on_ticks(ws_id, ticks)

        def _on_connect(ws, response):
            self.on_connect(ws_id, ws, response, is_priority)

        def _on_close(ws, code, reason):
            self.on_close(ws_id, ws, code, reason)

        def _on_error(ws, code, reason):
            self.on_error(ws_id, ws, code, reason)

        kws.on_ticks = _on_ticks
        kws.on_connect = _on_connect
        kws.on_close = _on_close
        kws.on_error = _on_error

        # Connect in a separate thread
        kws.connect(threaded=True)
        self.connections[ws_id] = kws
        return kws

    def ensure_ws_connected(self, ws_id, is_priority=False, max_retries=3):
        """
        If 'ws_id' is not in self.connections or was closed,
        try to recreate it (up to `max_retries`).
        Returns the (existing or new) kws instance, or None if fails.
        """
        attempts = 0
        while not shutdown_event.is_set():
            kws = self.connections.get(ws_id)
            if kws:
                # Already have a WebSocket
                return kws

            print(f"[ensure_ws_connected] Attempting to connect WS {ws_id}, is_priority={is_priority}, attempt={attempts+1}")
            try:
                self.create_websocket(ws_id, is_priority=is_priority)
                # Allow a moment for on_connect
                time.sleep(2)
                kws = self.connections.get(ws_id)
                if kws:
                    return kws
            except Exception as e:
                print(f"[ensure_ws_connected] Error creating WS {ws_id}: {e}")

            attempts += 1
            if attempts >= max_retries:
                print(f"[ensure_ws_connected] Failed to reconnect WS {ws_id} after {max_retries} attempts.")
                return None

            time.sleep(2)

        return None

    ################################################################
    #               MAIN START STREAMING LOGIC
    ################################################################

    def start_streaming(self, instruments):
        """
        1) Segregate priority vs rotation
        2) Setup WebSocket #1 for either
           (a) all priority + leftover rotation
           (b) or 3000 priority if >3000, pushing overflow to rotation
        3) Setup WS #2 + #3 for the remaining rotation
        4) Launch rotation threads with automatic reconnect
        """
        priority_instruments, rotation_instruments = self.segment_priority_filter(instruments)
        priority_tokens = [i['instrument_token'] for i in priority_instruments]
        rotation_tokens = [i['instrument_token'] for i in rotation_instruments]

        # Create / ensure WebSocket #1
        ws1 = self.ensure_ws_connected(ws_id=1, is_priority=True)
        time.sleep(2)  # short pause

        if not ws1:
            print("ERROR: Could not initialize WebSocket #1. Aborting streaming.")
            return

        count_priority = len(priority_tokens)
        if count_priority <= self.SYMBOLS_PER_CONNECTION:
            # CASE A: All priority fits in a single WS
            leftover_capacity = self.SYMBOLS_PER_CONNECTION - count_priority
            leftover_tokens_for_ws1 = []

            if leftover_capacity > 0 and rotation_tokens:
                # Take leftover_capacity from rotation
                chunk_size = min(leftover_capacity, len(rotation_tokens))
                leftover_tokens_for_ws1 = rotation_tokens[:chunk_size]
                rotation_tokens = rotation_tokens[chunk_size:]

            combined_ws1_tokens = priority_tokens + leftover_tokens_for_ws1
            # Subscribe them
            ws1.subscribe(combined_ws1_tokens)
            ws1.set_mode(ws1.MODE_FULL, combined_ws1_tokens)
            print(f"WS1 subscribed to {len(priority_tokens)} priority + {len(leftover_tokens_for_ws1)} leftover (total {len(combined_ws1_tokens)}).")

            # If leftover tokens used, start rotation on WS1
            if leftover_tokens_for_ws1:
                t1 = threading.Thread(
                    target=self.manage_rotation_ws1,
                    args=(1, priority_tokens, leftover_tokens_for_ws1),
                    daemon=True
                )
                t1.start()

        else:
            # CASE B: Priority > 3000
            # 1) Put the first 3000 on WS1
            # 2) Overflow merges into rotation
            ws1_priority = priority_tokens[:self.SYMBOLS_PER_CONNECTION]
            overflow_priority = priority_tokens[self.SYMBOLS_PER_CONNECTION:]  # the excess
            rotation_tokens = overflow_priority + rotation_tokens  # push to rotation

            ws1.subscribe(ws1_priority)
            ws1.set_mode(ws1.MODE_FULL, ws1_priority)
            print(f"WS1 subscribed to 3000 priority. Overflow {len(overflow_priority)} merged into rotation.")

        # Now handle rotation tokens with WS2, WS3
        tokens_ws2, tokens_ws3 = self._split_list_in_half(rotation_tokens)

        ws2 = self.ensure_ws_connected(ws_id=2, is_priority=False)
        ws3 = self.ensure_ws_connected(ws_id=3, is_priority=False)
        time.sleep(2)

        if ws2 and tokens_ws2:
            init2 = tokens_ws2[:self.SYMBOLS_PER_CONNECTION]
            ws2.subscribe(init2)
            ws2.set_mode(ws2.MODE_FULL, init2)
            print(f"Rotation WS2 subscribed to {len(init2)} tokens initially.")

            # Start rotation thread
            t2 = threading.Thread(
                target=self.manage_rotation,
                args=(2, tokens_ws2),
                daemon=True
            )
            t2.start()

        if ws3 and tokens_ws3:
            init3 = tokens_ws3[:self.SYMBOLS_PER_CONNECTION]
            ws3.subscribe(init3)
            ws3.set_mode(ws3.MODE_FULL, init3)
            print(f"Rotation WS3 subscribed to {len(init3)} tokens initially.")

            # Start rotation thread
            t3 = threading.Thread(
                target=self.manage_rotation,
                args=(3, tokens_ws3),
                daemon=True
            )
            t3.start()

    def _split_list_in_half(self, lst):
        half = len(lst) // 2
        return (lst[:half], lst[half:])

    ################################################################
    #            ROTATION #1: Priority + leftover on WS1
    ################################################################

    def manage_rotation_ws1(self, ws_id, priority_tokens, rotation_tokens):
        """
        If priority <= 3000, leftover capacity on WS1 can rotate some rotation tokens,
        while always keeping the priority tokens subscribed.
        Uses automatic reconnection each loop.
        """
        token_deque = deque(rotation_tokens)
        last_rotation_batch = None

        while not shutdown_event.is_set():
            kws = self.ensure_ws_connected(ws_id, is_priority=True)
            if not kws:
                # Could not reconnect => stop
                print(f"WebSocket #{ws_id} leftover rotation giving up.")
                break

            leftover_capacity = self.SYMBOLS_PER_CONNECTION - len(priority_tokens)
            if leftover_capacity <= 0:
                time.sleep(10)
                continue

            if not token_deque:
                time.sleep(10)
                continue

            # 1) Unsubscribe last leftover batch
            if last_rotation_batch:
                try:
                    kws.unsubscribe(last_rotation_batch)
                    time.sleep(1)
                except Exception as e:
                    print(f"[WS1 leftover] Unsubscribe error: {e}")

            # 2) Rotate a chunk
            rotate_step = min(300, len(token_deque))
            token_deque.rotate(-rotate_step)

            # 3) Take up to leftover_capacity
            new_rotation_batch = list(token_deque)[:leftover_capacity]
            combined_list = priority_tokens + new_rotation_batch

            # 4) Subscribe
            try:
                kws.subscribe(combined_list)
                kws.set_mode(kws.MODE_FULL, combined_list)
                last_rotation_batch = new_rotation_batch
                print(f"WS1 leftover: rotated {len(new_rotation_batch)} tokens + {len(priority_tokens)} priority.")
            except Exception as e:
                print(f"[WS1 leftover] Subscribe error: {e}")

            time.sleep(10)

    ################################################################
    #            ROTATION #2, #3: Standard rotation
    ################################################################

    def manage_rotation(self, ws_id, tokens):
        """
        Standard rotation for websockets #2 or #3, with auto-reconnect.
        They do not have permanent tokens, so we rotate the entire 'tokens' set.
        """
        if not tokens:
            return

        token_deque = deque(tokens)
        last_batch = None

        while not shutdown_event.is_set():
            kws = self.ensure_ws_connected(ws_id, is_priority=False)
            if not kws:
                # Could not reconnect => stop
                print(f"WebSocket {ws_id} rotation giving up (no connection).")
                break

            total_tokens = len(token_deque)
            if total_tokens <= self.SYMBOLS_PER_CONNECTION:
                # No real rotation if everything fits at once
                time.sleep(10)
                continue

            # 1) Unsubscribe old
            if last_batch:
                try:
                    kws.unsubscribe(last_batch)
                    time.sleep(1)
                except Exception as e:
                    print(f"[WS {ws_id}] Unsubscribe error: {e}")

            # 2) Rotate chunk
            rotate_step = min(300, total_tokens)
            token_deque.rotate(-rotate_step)

            # 3) Subscribe new
            new_batch = list(token_deque)[:self.SYMBOLS_PER_CONNECTION]
            try:
                kws.subscribe(new_batch)
                kws.set_mode(kws.MODE_FULL, new_batch)
                last_batch = new_batch
                print(f"WS {ws_id} rotated batch of {len(new_batch)} tokens.")
            except Exception as e:
                print(f"[WS {ws_id}] Subscribe error: {e}")

            time.sleep(10)


################################################################
#                      FLASK ROUTES
################################################################

@app.route('/config.json')
def get_config():
    directory = os.path.join(app.root_path, '../')
    try:
        response = send_from_directory(directory, 'config.json')
        response.headers['Cache-Control'] = 'no-store'
        return response
    except FileNotFoundError:
        app.logger.error("config.json not found in directory: " + directory)
        return jsonify(error="File not found"), 404


@app.route('/api/ticks')
def get_all_ticks():
    return jsonify(manager.central_storage)


################################################################
#                     MAIN ENTRY POINT
################################################################

if __name__ == '__main__':
    cache_file = "instruments_cache.pkl"
    if is_cache_valid(cache_file, timedelta(hours=24)):
        instruments = load_from_cache(cache_file)
    else:
        instruments = fetch_and_cache_instruments()

    manager = SegmentPriorityManager()
    manager.start_streaming(instruments)

    # Turn on debug logs, but disable the reloader to avoid double-spawning
    socketio.run(app, debug=True, use_reloader=False, host='127.0.0.1', port=5000)
