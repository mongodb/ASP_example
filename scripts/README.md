# Overview
These scripts are designed to assist in starting and stopping all stream processors in a target SPI. 

## .env
The .env file contains the configuration to use in each script. This includes the Atlas APIKey (Public and Private Key,) The Project ID where the Stream Processing Instance is, and the name of the Stream Processing Instance

1. An API Key for the given Atlas Project is required. To create the API Key follow the Atlas Documentation here: 
https://www.mongodb.com/docs/atlas/configure-api-access/#add-project-access-from-a-project 
2. To find the Project ID navigate the to Project Overview in the Atlas Project UI to copy it.
3. Use the name of the Stream Processing Instance

```
ATLAS_USERNAME=apublickey
ATLAS_API_KEY=PRIVATE-API-KEY-HERE
ATLAS_PROJECT_ID=99094e559e0116665622598F
ATLAS_STREAM_INSTANCE=MYSPI
```

## startAll.py
```
usage: startAll.py [-h] [--startAtOperationTime STARTATOPERATIONTIME]

Start all MongoDB Atlas Stream Processors in a Stream Processing Instance

options:
  -h, --help            show this help message and exit
  --startAtOperationTime STARTATOPERATIONTIME
                        Optional ISO 8601 date string to start change stream source processors at. Format: YYYY-MM-DDTHH:MM:SS.sssZ

python3 startAll.py --startAtOperationTime "2025-01-21T19:25:18.262Z"
python3 startAll.py 
```

**--startAtOperationTime** is only used for Stream Processors whose $source reads from a changestream. This allows the processors to start from the specific ISODATE string in the change stream. This can be useful for recovery needs.

## stopAll.py
```
usage: stopAll.py [-h] [--sleep SLEEP]

Stop MongoDB Atlas Stream Processors.

options:
  -h, --help     show this help message and exit
  --sleep SLEEP  Sleep time in seconds between checks. If omitted, the script runs only once.

python3 stopAll.py
python3 stopAll.py --sleep 30

```
