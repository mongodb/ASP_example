import random
import json
import time
import os  # Import os module to read environment variables
from openai import OpenAI  # Import OpenAI client
from pymongo import MongoClient  # Import MongoClient from pymongo
from dotenv import load_dotenv  # Import load_dotenv from dotenv
from datetime import datetime, timedelta

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPEN_AI_KEY"))

# MongoDB connection details
MONGO_URI = f"mongodb+srv://{os.getenv('MONGODB_USERNAME')}:{os.getenv('MONGODB_PASSWORD')}@{os.getenv('MONGODB_CLUSTER')}/?retryWrites=true&w=majority"
MONGO_DB = os.getenv("MONGODB_DB")
MONGO_COLLECTION = os.getenv("MONGODB_COLLECTION")

print(MONGO_URI)

# List of heavy equipment types and machine IDs
MACHINE_TYPES = ["CAT-980L Loader", "CAT-D8T Dozer", "CAT-336 Excavator", "CAT-745 Articulated Truck"]
MACHINE_IDS = ["CAT-980L-" + str(i) for i in range(1, 6)] + \
              ["CAT-D8T-" + str(i) for i in range(1, 6)] + \
              ["CAT-336-" + str(i) for i in range(1, 6)] + \
              ["CAT-745-" + str(i) for i in range(1, 6)]

# Random sensor value generators
def get_hydraulic_pressure():
    return round(random.uniform(1500, 3000), 2)

def get_temperature():
    return round(random.uniform(80, 180), 2)

def get_vibration():
    return round(random.uniform(0.1, 5.0), 2)

def get_maintenance_history():
    history_options = [
        "Hydraulic pump replacement",
        "Oil change",
        "Engine overhaul",
        "Track replacement",
        "Brake system check",
        "Hydraulic fluid top-up",
        "Filter replacement",
        "Cooling system flush",
        "Transmission service",
        "Battery replacement"
    ]
    history = []
    num_records = random.randint(1, 5)
    for _ in range(num_records):
        record_date = datetime.now() - timedelta(days=random.randint(0, 365*5))  # Random date within the last 5 years
        record = {
            "date": record_date.strftime("%Y-%m-%d"),
            "description": random.choice(history_options)
        }
        history.append(record)
    history.sort(key=lambda x: x["date"])  # Sort by date
    return history

def get_engine_hours():
    return random.randint(1000, 10000)

def get_year_of_manufacture():
    return random.randint(2000, 2022)

# Generate an issue report using OpenAI with enhanced variability
def generate_issue_report(machine_type, sensor_data, engine_hours, year_of_manufacture):
    """Uses OpenAI API to generate realistic heavy equipment issue reports with enhanced variability."""
    scenarios = [
        "The machine has been operating under heavy load for extended periods.",
        "The machine was recently serviced but is showing unusual behavior.",
        "The machine is operating in extreme weather conditions.",
        "The machine has been idle for a long time and was recently restarted.",
        "The machine is being used for a new type of task it hasn't performed before.",
        "The machine is experiencing fuel lockup issues.",
        "The machine's diesel fuel appears to be contaminated.",
        "The machine's tracks are stuck and not moving properly.",
        "The machine is overheating due to hot weather conditions.",
        "The machine is showing signs of hydraulic fluid leakage."
    ]
    scenario = random.choice(scenarios)

    instructions = f"""
    You are a field technician logging an issue for a {machine_type}. 
    The machine's sensor data indicates the following:
    
    - Hydraulic Pressure: {sensor_data['hydraulic_pressure']} psi
    - Temperature: {sensor_data['temperature']} °F
    - Vibration Level: {sensor_data['vibration']} m/s²
    - Engine Hours: {engine_hours}
    - Year of Manufacture: {year_of_manufacture}
    
    Scenario: {scenario}
    
    Based on this, describe a potential issue in 1-2 sentences, as a field technician would report it.
    Use real world examples from the web and Caterpillar's service manuals to make it realistic.
    Vary the voice of the results to reflect a cranky tech or someone doing simple routine work.
    """

    try:
        response = client.responses.create(
            model="gpt-4o",
            input=instructions,
        )
        return response.output_text.strip()
    except Exception as e:
        print(f"Error with OpenAI API: {e}")
        return "Machine performance is fluctuating, possible issue detected."

# Generate a log entry using LLM
def generate_machine_log():
    machine_type = random.choice(MACHINE_TYPES)
    machine_id = random.choice(MACHINE_IDS)
    
    sensor_data = {
        "hydraulic_pressure": get_hydraulic_pressure(),
        "temperature": get_temperature(),
        "vibration": get_vibration()
    }

    engine_hours = get_engine_hours()
    year_of_manufacture = get_year_of_manufacture()

    # Get an issue report from LLM
    issue_report = generate_issue_report(machine_type, sensor_data, engine_hours, year_of_manufacture)

    log_entry = {
        "machine_id": machine_id,
        "machine_type": machine_type,
        "engine_hours": engine_hours,
        "year_of_manufacture": year_of_manufacture,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "issue_report": issue_report,
        "sensor_data": sensor_data,
        "maintenance_history": get_maintenance_history()
    }
    
    return log_entry

# Save logs to MongoDB
def save_logs_to_mongodb(num_logs=10):
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB]
    collection = db[MONGO_COLLECTION]
    
    for i in range(num_logs):
        log = generate_machine_log()
        collection.insert_one(log)
        print(f"✅ Log {i+1} inserted into collection '{MONGO_COLLECTION}' in database '{MONGO_DB}'")

# Stream logs to console (simulate Kafka/MQTT streaming)
def stream_logs(interval=2):
    """Simulates streaming logs every 'interval' seconds."""
    while True:
        log_entry = generate_machine_log()
        print(json.dumps(log_entry, indent=4))
        time.sleep(interval)

# Run the script (Choose one)
if __name__ == "__main__":
    # Save 10 logs to MongoDB
    save_logs_to_mongodb(num_logs=30)

    # OR: Stream logs indefinitely (like a real-time Kafka stream)
    #stream_logs(interval=2)