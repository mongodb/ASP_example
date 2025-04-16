from confluent_kafka import Producer, KafkaError
import json
import random
import string

# Set your Kafka bootstrap servers and security settings
bootstrap_servers = '.....'
sasl_mechanism = 'PLAIN'  # Adjust based on your Kafka security settings
security_protocol = 'SASL_SSL'
sasl_plain_username = '....'
sasl_plain_password = '.....'

# Set the Kafka topic to produce messages to
topic = 'topic_0'

# Create a Kafka producer configuration with SASL_SSL and PLAIN settings
conf = {
    'bootstrap.servers': bootstrap_servers,
    'security.protocol': security_protocol,
    'sasl.mechanism': sasl_mechanism,
    'sasl.username': sasl_plain_username,
    'sasl.password': sasl_plain_password,
}

# Create a Kafka producer instance
producer = Producer(conf)

# Function to generate a random JSON document of a specified size
def generate_json_document(size_kb):
    data = {
        '_id': ''.join(random.choices(string.ascii_letters + string.digits, k=10)),
        'data': ''.join(random.choices(string.ascii_letters + string.digits, k=size_kb * 1024 - 20))
    }
    return json.dumps(data)

# Target transfer size in bytes (4 GB)
target_size_bytes = 4 * 1024 * 1024 * 1024

# Size of each JSON document (20 KB)
document_size_kb = 20

# Print progress every 10 messages
progress_interval = 10

# Flush interval (every 1000 messages)
flush_interval = 1000

try:
    total_sent_bytes = 0
    total_messages_sent = 0

    while total_sent_bytes < target_size_bytes:
        # Generate a JSON document
        json_document = generate_json_document(document_size_kb)

        # Produce the JSON document to the Kafka topic with key set to None
        producer.produce(topic, key=None, value=json_document)

        # Update the total sent bytes and messages
        total_sent_bytes += len(json_document)
        total_messages_sent += 1

        # Print progress every 10 messages
        if total_messages_sent % progress_interval == 0:
            progress_percent = (total_sent_bytes / target_size_bytes) * 100
            print(f"Progress: {progress_percent:.2f}% - Total Sent: {total_sent_bytes / (1024 * 1024):.2f} MB")

        # Flush after every 1000 messages
        if total_messages_sent % flush_interval == 0:
            producer.flush()

    # Wait for any outstanding messages to be delivered and delivery reports received
    producer.flush()

except KeyboardInterrupt:
    pass

finally:
    # Close the Kafka producer
    producer.close()
