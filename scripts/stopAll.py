import requests
from requests.auth import HTTPDigestAuth
import json
import sys
import time
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


def stop_stream_processor(username, api_key, project_id, stream_instance, processor_name):
    """Stops a specific stream processor."""
    url = f"https://cloud.mongodb.com/api/atlas/v2/groups/{project_id}/streams/{stream_instance}/processor/{processor_name}:stop"
    headers = {
        "Accept": "application/vnd.atlas.2024-05-30+json",
        "Content-Type": "application/json",
    }
    auth = HTTPDigestAuth(username, api_key)

    try:
        response = requests.post(url, headers=headers, auth=auth)
        response.raise_for_status()
        print(f"Processor '{processor_name}' stopped successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Error stopping processor '{processor_name}': {e}")
        print(f"Response content: {response.text}")
    except Exception as e:
        print(f"Unexpected Error stopping processor: {e}")



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

    # Argument parsing
    parser = argparse.ArgumentParser(description="Stop MongoDB Atlas Stream Processors.")
    parser.add_argument("--sleep", type=int, help="Sleep time in seconds between checks.  If omitted, the script runs only once.")
    args = parser.parse_args()

    sleep_time = args.sleep

    # Determine if the script should run in a loop or just once
    run_loop = sleep_time is not None

    while True:
        processors = get_atlas_stream_processors(username, api_key, project_id, stream_instance)

        if processors:
            print(f"Found processors: {processors}")  # Print the (name, state) tuples
            for name, state in processors:
                if state == "STARTED":
                    stop_stream_processor(username, api_key, project_id, stream_instance, name)
        else:
            print("Failed to retrieve stream processors.")

        if not run_loop:
            break  # Exit after one iteration if no sleep time is specified

        print(f"Sleeping for {sleep_time} seconds...")
        time.sleep(sleep_time)



if __name__ == "__main__":
    main()
