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

shutdown_event = threading.Event()  # For graceful shutdown if needed


class SegmentPriorityManager:
    def __init__(self):
        self.kite, _ = initialize_kite()  # For reference
        self.central_storage = {}

        # {ws_id: kws_instance}
        self.connections = {}

        # Zerodha constraints
        self.SYMBOLS_PER_CONNECTION = 3000
        self.max_websockets = 3

    ################################################################
    #               INSTRUMENT SEGREGATION
    ################################################################
    def segment_priority_filter(self, instruments):
        """
        Returns two lists: priority_instruments, rotation_instruments
        """
        priority_instruments = []
        rotation_instruments = []

        for instr in instruments:
            # Example rule: segment in ['INDICES', 'NFO-FUT'] => priority
            if instr['segment'] in ['INDICES', 'NFO-FUT']:
                priority_instruments.append(instr)
            elif instr['segment'] in ['NSE', 'NFO-OPT']:
                rotation_instruments.append(instr)

        return priority_instruments, rotation_instruments

    ################################################################
    #               KITE TICK / CONNECTION HANDLERS
    ################################################################
    def on_ticks(self, ws_id, ticks):
        # Store ticks data in central_storage
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
        # Remove from connections dict if it still exists
        if ws_id in self.connections:
            del self.connections[ws_id]

    def on_error(self, ws_id, ws, code, reason):
        # Optional: If you want to see any errors
        print(f"WebSocket {ws_id} error: {code} - {reason}")

    def create_websocket(self, ws_id, is_priority=False):
        """
        Creates a Kite WebSocket client (does NOT immediately subscribe).
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

        # Store reference
        self.connections[ws_id] = kws
        return kws

    ################################################################
    #                 STARTING AND MANAGING STREAMING
    ################################################################
    def start_streaming(self, instruments):
        """
        Main entry: creates up to 3 WebSockets:
          - #1 for priority + (optional leftover rotation)
          - #2 and #3 for the remainder of rotation
        """
        priority_instruments, all_rotation_instruments = self.segment_priority_filter(instruments)

        priority_tokens = [i['instrument_token'] for i in priority_instruments]
        rotation_tokens = [i['instrument_token'] for i in all_rotation_instruments]

        # 1) Create Priority WebSocket (#1)
        ws1 = self.create_websocket(ws_id=1, is_priority=True)
        time.sleep(1)  # wait for on_connect

        # (A) Always subscribe to priority tokens
        count_priority = len(priority_tokens)
        if count_priority > self.SYMBOLS_PER_CONNECTION:
            print("ERROR: Too many priority tokens (>3000). Please reduce them.")
            return

        leftover_capacity = self.SYMBOLS_PER_CONNECTION - count_priority
        leftover_tokens_for_ws1 = []

        # (B) If leftover capacity is positive, take that many from rotation_tokens
        if leftover_capacity > 0 and rotation_tokens:
            # e.g., if leftover_capacity=2165, we take min(2165, len(rotation_tokens))
            chunk_size = min(leftover_capacity, len(rotation_tokens))
            leftover_tokens_for_ws1 = rotation_tokens[:chunk_size]
            # remove them from the global rotation list
            rotation_tokens = rotation_tokens[chunk_size:]

        # Subscribe Priority + leftover tokens on #1
        if ws1:
            combined_ws1_tokens = priority_tokens + leftover_tokens_for_ws1
            ws1.subscribe(combined_ws1_tokens)
            ws1.set_mode(ws1.MODE_FULL, combined_ws1_tokens)
            print(f"WebSocket 1 subscribed to {len(priority_tokens)} priority + {len(leftover_tokens_for_ws1)} leftover rotation tokens (total {len(combined_ws1_tokens)}).")

        # 2) Split REMAINING rotation tokens for websockets #2 and #3
        #    The leftover tokens for #1 are no longer in rotation_tokens
        #    because we popped them out already.
        tokens_ws2, tokens_ws3 = self._split_list_in_half(rotation_tokens)

        ws2 = self.create_websocket(ws_id=2, is_priority=False)
        ws3 = self.create_websocket(ws_id=3, is_priority=False)
        time.sleep(1)

        # Subscribe initial batch for WS2
        if ws2 and tokens_ws2:
            initial2 = tokens_ws2[:self.SYMBOLS_PER_CONNECTION]
            ws2.subscribe(initial2)
            ws2.set_mode(ws2.MODE_FULL, initial2)
            print(f"Rotation WebSocket 2 subscribed to {len(initial2)} tokens initially.")

        # Subscribe initial batch for WS3
        if ws3 and tokens_ws3:
            initial3 = tokens_ws3[:self.SYMBOLS_PER_CONNECTION]
            ws3.subscribe(initial3)
            ws3.set_mode(ws3.MODE_FULL, initial3)
            print(f"Rotation WebSocket 3 subscribed to {len(initial3)} tokens initially.")

        # 3) Start rotation threads
        #    - One thread for leftover rotation on WS1 (optional)
        #    - One thread each for WS2, WS3

        if leftover_tokens_for_ws1:
            t1 = threading.Thread(
                target=self.manage_rotation_ws1,
                args=(1, priority_tokens, leftover_tokens_for_ws1),
                daemon=True
            )
            t1.start()

        if tokens_ws2:
            t2 = threading.Thread(
                target=self.manage_rotation,
                args=(2, tokens_ws2),
                daemon=True
            )
            t2.start()

        if tokens_ws3:
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
    #    ROTATION #1:  Priority + leftover rotation on the SAME WS
    ################################################################

    def manage_rotation_ws1(self, ws_id, priority_tokens, rotation_tokens):
        """
        WebSocket #1 is always subscribed to `priority_tokens`, 
        but we rotate a subset of NSE tokens (rotation_tokens) in leftover capacity.

        The process:
          - We keep priority always subscribed
          - We rotate unsub/subscribe only for the 'rotating' subset
          - Combined subscription = priority_tokens + current_batch_of_rotation
        """

        kws = self.connections.get(ws_id)
        if not kws:
            print("No WebSocket #1 found. Cannot rotate leftover on #1.")
            return

        token_deque = deque(rotation_tokens)

        # Track the last rotation subset we subscribed
        last_rotation_batch = None
        permanent_set = set(priority_tokens)  # keep them always

        while not shutdown_event.is_set():
            # Double-check if the WS is still open
            kws = self.connections.get(ws_id)
            if not kws:
                print("WebSocket #1 no longer available. Stopping rotation.")
                break

            total_rotation = len(token_deque)
            if total_rotation == 0:
                time.sleep(10)
                continue

            leftover_capacity = self.SYMBOLS_PER_CONNECTION - len(priority_tokens)
            if leftover_capacity <= 0:
                # Nothing to rotate if no leftover capacity
                time.sleep(10)
                continue

            # Step 1: Unsubscribe the last rotation batch (if any)
            if last_rotation_batch:
                try:
                    kws.unsubscribe(last_rotation_batch)
                    time.sleep(1)  # small gap
                except Exception as e:
                    print(f"[WS1] Unsubscribe leftover error: {e}")

            # Step 2: Rotate a chunk from the deque
            rotate_step = min(300, total_rotation)  # or any chunk size
            token_deque.rotate(-rotate_step)

            # Step 3: New rotation batch is up to leftover_capacity
            new_rotation_batch = list(token_deque)[:leftover_capacity]

            # Step 4: Subscribe to priority + new rotation batch
            combined_list = priority_tokens + new_rotation_batch
            try:
                kws.subscribe(combined_list)
                kws.set_mode(kws.MODE_FULL, combined_list)
                last_rotation_batch = new_rotation_batch
                print(f"WebSocket #1 rotated leftover batch of {len(new_rotation_batch)} tokens (plus {len(priority_tokens)} priority).")
            except Exception as e:
                print(f"[WS1] Subscribe leftover error: {e}")

            time.sleep(10)  # rotate again after 60 seconds

    ################################################################
    #    ROTATION #2, #3:  Standard rotation for full 3000 tokens
    ################################################################

    def manage_rotation(self, ws_id, tokens):
        """
        Standard rotation for websockets #2 or #3.
        They do not have permanent tokens, so we rotate the entire set.
        """
        if not tokens:
            return

        token_deque = deque(tokens)
        last_batch = None

        while not shutdown_event.is_set():
            kws = self.connections.get(ws_id)
            if not kws:
                print(f"WebSocket {ws_id} no longer available. Stopping rotation.")
                break

            total_tokens = len(token_deque)
            if total_tokens <= self.SYMBOLS_PER_CONNECTION:
                # No real rotation if all fit in one batch
                time.sleep(10)
                continue

            # Unsubscribe old
            if last_batch:
                try:
                    kws.unsubscribe(last_batch)
                    time.sleep(1)
                except Exception as e:
                    print(f"[WS {ws_id}] Unsubscribe error: {e}")

            # Rotate a chunk
            rotate_step = min(300, total_tokens)  # or whatever chunk you want
            token_deque.rotate(-rotate_step)

            new_batch = list(token_deque)[:self.SYMBOLS_PER_CONNECTION]

            try:
                kws.subscribe(new_batch)
                kws.set_mode(kws.MODE_FULL, new_batch)
                last_batch = new_batch
                print(f"WebSocket {ws_id} unsubscribed old, subscribed new set of {len(new_batch)} tokens.")
            except Exception as e:
                print(f"[WS {ws_id}] Subscribe error: {e}")

            time.sleep(10)


################################################################
#                         FLASK ROUTES
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
#                       MAIN ENTRY POINT
################################################################
if __name__ == '__main__':
    cache_file = "instruments_cache.pkl"
    if is_cache_valid(cache_file, timedelta(hours=24)):
        instruments = load_from_cache(cache_file)
    else:
        instruments = fetch_and_cache_instruments()

    manager = SegmentPriorityManager()
    manager.start_streaming(instruments)

    # Disable reloader to avoid double-launch
    # If you want debug logs but no reloader, do debug=True, use_reloader=False
    socketio.run(app, debug=True, use_reloader=False, host='127.0.0.1', port=5000)
