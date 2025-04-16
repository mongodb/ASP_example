import argparse
from kafka import KafkaProducer
from scapy.all import *
import time
import json

# parse command line arguments
parser = argparse.ArgumentParser(description='Capture network packets and publish to Kafka')
parser.add_argument('--bootstrap-servers', dest='bootstrap_servers', required=True,
                    help='List of Kafka bootstrap servers (comma-separated)')
parser.add_argument('--topic', dest='topic', required=True, help='Name of the Kafka topic to publish to')
parser.add_argument('--device', dest='device', required=True, help='Name of the network device to capture on')
parser.add_argument('--producer-interval', dest='producer_interval', type=int, default=600,
                    help='Interval in seconds to recreate the Kafka producer')
args = parser.parse_args()

# define a function to create a Kafka producer
def create_producer():
    return KafkaProducer(bootstrap_servers=args.bootstrap_servers.split(','))

# start sniffing for packets and publish to Kafka
producer = create_producer()
last_producer_time = time.time()
sniff_count = 0

def handle_packet(packet):
    global producer, last_producer_time, sniff_count
    if not TCP in packet:
        return
    sniff_count += 1
    packet_data = {
        'src_ip': packet[IP].src,
        'src_port': packet[TCP].sport,
        'dst_ip': packet[IP].dst,
        'dst_port': packet[TCP].dport,
        'timestamp': packet.time
    }
    producer.send(args.topic, json.dumps(packet_data).encode('utf-8'))

    if time.time() - last_producer_time >= args.producer_interval:
        producer.close()
        producer = create_producer()
        last_producer_time = time.time()
        print(f'Recreated Kafka producer after sniffing {sniff_count} packets')

sniff(iface=args.device, prn=handle_packet, store=0)

