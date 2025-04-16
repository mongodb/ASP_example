import requests
from requests.auth import HTTPDigestAuth
import json
import sys
import os
from dotenv import load_dotenv
import argparse

# Load environment variables from .env file
load_dotenv()

def get_atlas_stream_processors(username, api_key, project_id, stream_instance):
    """Retrieves stream processors and returns a list of (name, state) tuples."""
    url = f"https://cloud.mongodb.com/api/atlas/v2/groups/{project_id}/streams/{stream_instance}/processors"
    headers = {
        "Accept": "application/vnd.atlas.2024-05-30+json",
        "Content-Type": "application/json",
    }
    auth = HTTPDigestAuth(username, api_key)

    try:
        response = requests.get(url, headers=headers, auth=auth)
        response.raise_for_status()
        data = response.json()
        # Extract processor name and state
        return [(processor['name'], processor['state']) for processor in data['results']]
    except requests.exceptions.RequestException as e:
        print(f"An error occurred during the request: {e}")
        if 'response' in locals():  # Check if response exists
            print(f"Response content: {response.text}")
        return None
    except (ValueError, KeyError) as e:
        print(f"Error processing JSON response: {e}")
        if 'response' in locals():
            print(f"Response content: {response.text}")
        return None
    except Exception as e:
        print(f"Unexpected Error {e}")
        return None


def start_stream_processor(username, api_key, project_id, stream_instance, processor_name, start_at_time=None):
    """Starts a specific stream processor, optionally at a specific time.

    Args:
        username: Atlas username.
        api_key: Atlas API key.
        project_id: Atlas project ID.
        stream_instance:  Stream instance name.
        processor_name: Name of the processor to start.
        start_at_time: Optional ISO 8601 date string.  If provided, change stream source
            processors will be started at this time.  Format: YYYY-MM-DDTHH:MM:SS.sssZ
    """
    url = f"https://cloud.mongodb.com/api/atlas/v2/groups/{project_id}/streams/{stream_instance}/processor/{processor_name}:start"
    headers = {
        "Accept": "application/vnd.atlas.2024-05-30+json",
        "Content-Type": "application/json",
    }
    auth = HTTPDigestAuth(username, api_key)

    data = {}
    if start_at_time:
        data["startAtOperationTime"] = {"$date": start_at_time}  # Wrap the date string

    try:
        # Use json.dumps() to serialize the data only when there's data to send
        response = requests.post(url, headers=headers, auth=auth, data=json.dumps(data) if data else None)
        response.raise_for_status()
        print(f"Processor '{processor_name}' started successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Error starting processor '{processor_name}': {e}")
        print(f"Response content: {response.text}")
    except Exception as e:
        print(f"Unexpected Error starting processor: {e}")



def main():
    # Retrieve configuration from environment variables
    username = os.getenv("ATLAS_USERNAME")
    api_key = os.getenv("ATLAS_API_KEY")
    project_id = os.getenv("ATLAS_PROJECT_ID")
    stream_instance = os.getenv("ATLAS_STREAM_INSTANCE")

    # Validate that all required environment variables are set
    if not all([username, api_key, project_id, stream_instance]):
        print("Error: Missing required environment variables.")
        print("Please set ATLAS_USERNAME, ATLAS_API_KEY, ATLAS_PROJECT_ID, and ATLAS_STREAM_INSTANCE.")
        sys.exit(1)

    # --- Argument Parsing ---
    parser = argparse.ArgumentParser(description="Start MongoDB Atlas Stream Processors.")
    parser.add_argument("--startAtOperationTime", type=str,
                        help="Optional ISO 8601 date string to start change stream source processors at. Format: YYYY-MM-DDTHH:MM:SS.sssZ")
    args = parser.parse_args()
    # --- End Argument Parsing ---

    processors = get_atlas_stream_processors(username, api_key, project_id, stream_instance)

    if processors:
        print(f"Found processors: {processors}")
        for name, state in processors:
            if state != "STARTED": # Check state before starting
                start_stream_processor(username, api_key, project_id, stream_instance, name, args.startAtOperationTime)
            else:
                print(f"Processor '{name}' is already STARTED, skipping.") # Print message indicating a skip
    else:
        print("Failed to retrieve stream processors.")


if __name__ == "__main__":
    main()
