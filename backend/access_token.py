import os
import sys
import json
import datetime
from kiteconnect import KiteConnect
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fetch API credentials from environment variables
api_key = os.getenv("API_KEY")
api_secret = os.getenv("API_SECRET")

if not api_key or not api_secret:
    print("API Key and Secret not found in environment variables.")
    sys.exit()

# Define the path for the AccessToken directory within the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
access_token_dir = os.path.join(backend_dir, "AccessToken")
access_token_file = os.path.join(access_token_dir, f"{datetime.datetime.now().date()}.json")

def generate_access_token():
    print("Trying Log In...")
    kite = KiteConnect(api_key=api_key)
    print("Login url : ", kite.login_url())
    request_tkn = input("Login and enter your 'request token' here : ")
    try:
        access_token = kite.generate_session(request_tkn, api_secret=api_secret)['access_token']
        os.makedirs(access_token_dir, exist_ok=True)
        with open(access_token_file, "w") as f:
            json.dump(access_token, f)
        print("Login successful...")
        return access_token
    except Exception as e:
        print(f"Login Failed {{{e}}}")
        sys.exit()

# Function to get access token
def get_access_token():
    if os.path.exists(access_token_file):
        with open(access_token_file, "r") as f:
            return json.load(f)
    else:
        return generate_access_token()
