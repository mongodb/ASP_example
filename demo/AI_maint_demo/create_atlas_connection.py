import os
import requests
from requests.auth import HTTPDigestAuth
import pprint

# Environment variables
ATLAS_USER = os.environ["ATLAS_USER"]
ATLAS_USER_KEY = os.environ["ATLAS_USER_KEY"]
INSTANCE = os.environ["ATLAS_INSTANCE"]
GROUP = os.environ["ATLAS_GROUP"]
ATLAS_DB = os.environ["MONGODB_DB"]
ATLAS_COLL = os.environ["MONGODB_COLLECTION"]

# Base URL
base_url = "https://cloud.mongodb.com/api/atlas/v2/"

# Authentication
auth = HTTPDigestAuth(ATLAS_USER, ATLAS_USER_KEY)

# Headers
headers = {
    'Accept': 'application/vnd.atlas.2024-05-30+json',
    'Content-Type': 'application/json'
}

data = {}

# URL and response for POST request
response = requests.post(base_url + url, auth=auth, headers=headers, json=data)
pprint.pprint(response.json())
