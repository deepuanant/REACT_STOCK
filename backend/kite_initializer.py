import os
from kiteconnect import KiteConnect, KiteTicker
from access_token import get_access_token
from utils.http_request import KiteApp
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def initialize_kite():
    # Determine the authentication method
    auth_method = os.getenv('AUTH_METHOD')

    if auth_method == 'API':
        # API-based authentication
        access_token = get_access_token()
        api_key = os.getenv("API_KEY")
        kite = KiteConnect(api_key=api_key)
        kite.set_access_token(access_token)
        kws = KiteTicker(api_key, access_token)
    elif auth_method == 'ENCTOKEN':
        # ENCTOKEN-based authentication
        enctoken = os.getenv('ENCTOKEN')
        user_id = os.getenv('USERID')
        kite = KiteApp(enctoken=enctoken)
        kws = KiteTicker("FNOLense", enctoken + "&user_id=" + user_id)
    else:
        raise ValueError("Invalid AUTH_METHOD specified in .env")

    return kite, kws
