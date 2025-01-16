import os
from datetime import timedelta
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from instruments import *  # Assuming this contains helper functions like is_cache_valid, load_from_cache, etc.
from kite_initializer import initialize_kite  # Assuming this initializes the Kite API
import threading

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize Kite Connect
kite, _ = initialize_kite()

# Centralized storage for tick data
central_storage = {}

# Route to serve config.json
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

# Function to get instruments from cache or API
def get_instruments_from_cache(cache_file="instruments_cache.pkl", expiration_time=timedelta(hours=24)):
    if is_cache_valid(cache_file, expiration_time):
        print("Loading data from cache")
        return load_from_cache(cache_file)
    else:
        print("Cache is not valid, fetching data from API")
        return fetch_and_cache_instruments()

# Function to filter instruments
def filter_instruments(instruments, exchange, indices_name=None):
    if indices_name:
        return [instrument for instrument in instruments if instrument['exchange'] == exchange and instrument['tradingsymbol'] == indices_name]
    return [instrument for instrument in instruments if instrument['exchange'] == exchange]

# Fetch and define tokens
instruments = get_instruments_from_cache()
nse_indices = filter_instruments(instruments, 'NSE')
sensex_instrument = filter_instruments(instruments, 'BSE', 'SENSEX')[0]  # Fetch SENSEX instrument
tokens = [instrument['instrument_token'] for instrument in nse_indices]
print("Tokens length: ", len(tokens))
tokens.append(sensex_instrument['instrument_token'])  # Add SENSEX token

# Function to create Kite ticker instance
def create_kite_ticker_instance(tokens_batch):
    kite, kws = initialize_kite()

    def on_ticks(ws, ticks):
        for tick in ticks:
            instrument_token = tick['instrument_token']
            last_price = tick['last_price']
            change = round(tick['change'], 2)
            close = tick['ohlc']['close']
            net_change = round(last_price - close, 2)

            # Update centralized storage
            central_storage[instrument_token] = {
                'change': change,
                'instrument_token': instrument_token,
                'last_price': last_price,
                'net_change': net_change,
            }
            
        # print("Central storage length: ", len(central_storage))
        socketio.emit('FromAPI', central_storage)

    def on_connect(ws, response):
        print(f"WebSocket: Connected for tokens batch {tokens_batch[:5]}...")
        kws.subscribe(tokens_batch)
        kws.set_mode(kws.MODE_FULL, tokens_batch)

    kws.on_ticks = on_ticks
    kws.on_connect = on_connect
    kws.connect(threaded=True)

# Function to start tickers for token batches
def start_tickers(tokens, batch_size=4000):
    token_batches = [tokens[i:i + batch_size] for i in range(0, len(tokens), batch_size)]
    for batch in token_batches:
        threading.Thread(target=create_kite_ticker_instance, args=(batch,)).start()

# Start WebSocket connections for all token batches
print("tokens length: ", len(tokens))
start_tickers(tokens)

# API endpoint to get all tick data
@app.route('/api/ticks')
def get_all_ticks():
    # Return all data from the centralized storage
    return jsonify(central_storage)

@socketio.on('connect')
def test_connect():
    print('Client connected')

@socketio.on('disconnect')
def test_disconnect():
    print('Client disconnected')

if __name__ == '__main__':
    # Detect environment
    environment = os.getenv("FLASK_ENV", "development")

    if environment == "development":
        # Use Werkzeug for development
        socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
    else:
        # Use eventlet for production
        try:
            import eventlet
            eventlet.monkey_patch()
            socketio.run(app, host="0.0.0.0", port=5000, debug=False)
        except ImportError:
            raise RuntimeError(
                "For production, install 'eventlet' or 'gevent' as a production server."
            )
