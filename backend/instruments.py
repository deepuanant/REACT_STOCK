import requests
import dateutil.parser
import os
import pickle
from datetime import datetime, timedelta

def fetch_instruments(exchange=None):
    response = requests.get("https://api.kite.trade/instruments")
    data = response.text.split("\n")
    headers = data[0].split(",")
    exchange_index = headers.index("exchange")

    instruments = []
    for row in data[1:-1]:
        columns = row.split(",")
        if exchange is None or exchange == columns[exchange_index]:
            instruments.append({
                'instrument_token': int(columns[0]),
                'exchange_token': columns[1],
                'tradingsymbol': columns[2],
                'name': columns[3],
                'expiry': dateutil.parser.parse(columns[5]).date() if columns[5] != "" else None,
                'strike': float(columns[6]),
                'tick_size': float(columns[7]),
                'lot_size': int(columns[8]),
                'instrument_type': columns[9],
                'segment': columns[10],
                'exchange': columns[11]
            })
    return instruments

def save_to_cache(data, cache_file):
    with open(cache_file, 'wb') as f:
        pickle.dump(data, f)

def load_from_cache(cache_file):
    with open(cache_file, 'rb') as f:
        return pickle.load(f)

def is_cache_valid(cache_file, expiration_time):
    if not os.path.exists(cache_file):
        return False

    file_modified_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
    if datetime.now() - file_modified_time > expiration_time:
        return False

    return True

def fetch_and_cache_instruments(exchange=None, cache_file="instruments_cache.pkl"):
    instruments_data = fetch_instruments(exchange)
    save_to_cache(instruments_data, cache_file)
    return instruments_data
