# Overview

Atlas Stream Processing allows you to read, write, and transform data in and out of MongoDB in real-time.  The purpose of this repository is to show how Atlas Stream Processing can be used to:

1. Stream data into MongoDB from Apache Kafka sources (using a sample stream; no outside Kafka connection required)
2. Transform data in realtime before it is loaded into a collection
3. Use window functions to aggregate groups of data that you store in other collections
4. Enrich your data with data requested from external APIs

# The Scenario

This repository uses a sample Apache Kafka stream containing information about about solar generators.  The events will be JSON and take the following format:

```json
{
  device_id: 'device_8',
  group_id: 7,
  timestamp: '2024-08-12T21:41:01.788+00:00',
  max_watts: 450,
  event_type: 0,
  obs: {
    watts: 252,
    temp: 17
  }
}
```

It will then three stream processors that will handle the data.

## convert_to_farenheit

This processor takes the records from the sample Kafka stream, converts the temperature readings from celsius to farenheit, and writes them to a collection called equipment_logs.

![convert_to_farenheit flowchart](./diagrams/convert_to_farenheit.png)

## generate_maintenance_windows

This processor reads the change streams from the equipment_logs collection with the farenheit data, records the min, max, and averages of watts and temperature in addition to the total record count for each device every 30 seconds, and then writes that to a collection called maintenance_windows.

![generate_maintenance_windows flowchart](./diagrams/generate_maintenance_windows.png)

## generate_maintenance_tickets

This processor reads the change streams from the maintenance windows collection, detects if any device is averaging less than 400 watts in a 30 second window, and if so, creates a maintenance ticket in the maintenance_tickets collection.  Additionally, it uses weather data for each device to set the priority of the ticket.  It does this by looking up the the location of a device it needs to generate a ticket for and sending that location data to the open-meteo weather api to get the weather forecast for that location.  If the weather is currently or forecasted to be severe, or if the minimum temperature from the device is less than 42, the severity of the ticket is set to urgent.

![generate_maintenance_tickets flowchart](./diagrams/generate_maintenance_tickets.png)


# What You Need

In order to set this up, you'll need access to an Atlas account that includes:

1. An Atlas Cluster you can write to
2. A stream processing workspace you can connect to

# Setup

## Setup Your Local Environment

### Create Connections

In your Atlas stream processing workspace, you need to create the following three collections:

1. **A sample stream connection called "sample_stream_solar"**  
   This connection mimics a Kafka topic connection streaming solar generator wattage and temperature IoT data.

2. **An Atlas database connection called "my_solar_db"**  
   This is where we will create the collections we will be writing data to.

3. **An Atlas database connection called "open-meteo"**  
   URL: `https://api.open-meteo.com/v1/forecast`  
   We will use this free API to get weather forecasts for the maintenance generators.

### Setup Your Local Environment

In the repository you have this in, run the following two commands to set up your environment and install all needed packages:

```bash
npm init -y
npm install dotenv mongodb
```

You will then need to create a .env file with information about your MongoDB cluster and stream processing workspace.  The file .env_example has all values you need to provide.

# How to Use This Repository

1. **To seed the admin data collection and create stream processors**  
   ```bash
   node main.js --setup
   ```

2. **To start the processors**
   ```bash
   node main.js --start_processors
   ```
You will be able to see the processed records in your collections.  Navigate to your collections in the Atlas UI to your ingested records.

3. **To stop the processors**
```bash
node main.js --stop_processors
```

4. **To drop the processors**
```bash
node main.js --drop_processors
```