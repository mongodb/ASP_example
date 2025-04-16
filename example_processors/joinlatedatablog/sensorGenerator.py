from confluent_kafka import Producer
import json
import time

# Kafka topics
TEMPERATURE_TOPIC = 'temperature'
HUMIDITY_TOPIC = 'humidity'

# Configuration for Confluent Cloud
conf = {
    'bootstrap.servers': 'YOURBOOTSTRAPSERVERS',
    'security.protocol': 'SASL_SSL',
    'sasl.mechanisms': 'PLAIN',
    'sasl.username': 'YOURAPIKEY',  # API key
    'sasl.password': 'YOURAPISECRET'  # API secret
}

# Create producer instance
producer = Producer(conf)

# Callback for producer confirmation
def acked(err, msg):
    if err is not None:
        print(f"Failed to deliver message: {err}")
    else:
        print(f"Message produced to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}")

# Batch 1
batch_1 = [
    {"sensorIdGroup": 1, "humidity": 100, "timestamp": "2024-11-04T20:00:00.000"},
    {"sensorIdGroup": 2, "humidity": 25, "timestamp": "2024-11-04T20:00:09.000"},
    {"sensorIdGroup": 1, "temperature": 70, "timestamp": "2024-11-04T20:00:01.000"},
    {"sensorIdGroup": 2, "temperature": 3, "timestamp": "2024-11-04T20:00:03.000"},
    {"sensorIdGroup": 3, "temperature": 20, "timestamp": "2024-11-04T20:00:03.000"}
]

# Batch 2
batch_2 = [
    {"sensorIdGroup": 4, "humidity": 100, "timestamp": "2024-11-04T20:01:50.000"},
    {"sensorIdGroup": 5, "humidity": 25, "timestamp": "2024-11-04T20:01:49.000"},
    {"sensorIdGroup": 4, "temperature": 70, "timestamp": "2024-11-04T20:01:55.000"},
    {"sensorIdGroup": 5, "temperature": 3, "timestamp": "2024-11-04T20:01:43.000"},
    {"sensorIdGroup": 5, "temperature": 2, "timestamp": "2024-11-04T20:01:42.000"},
    {"sensorIdGroup": 5, "temperature": 4, "timestamp": "2024-11-04T20:01:44.000"},
    {"sensorIdGroup": 6, "temperature": -4, "timestamp": "2024-11-04T20:01:33.000"},
    {"sensorIdGroup": 6, "humidity": 60, "timestamp": "2024-11-04T20:01:59.000"},
]

#batch 3
batch_3 = [
        {"sensorIdGroup": 3, "humidity": 55, "timestamp": "2024-11-04T20:00:09.000"}
]

def send_batch(batch):
    for record in batch:
        if "temperature" in record:
            topic = TEMPERATURE_TOPIC
        elif "humidity" in record:
            topic = HUMIDITY_TOPIC
        else:
            continue  # Skip if neither temperature nor humidity is present
        
        # Convert record to JSON format
        producer.produce(topic, value=json.dumps(record), callback=acked)
        print(f"Sent to {topic}: {record}")
        
    # Wait for all messages in the batch to be sent
    producer.flush()

# Send the first batch
send_batch(batch_1)

# Wait 5 seconds before sending the second batch
time.sleep(5)

# Send the second batch
send_batch(batch_2)

# Wait 5 seconds before sending the third batch
time.sleep(5)

# Send the second batch
send_batch(batch_3)
