import os
import json
from pymongo import MongoClient
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPEN_AI_KEY"))

# MongoDB connection details
MONGO_URI = f"mongodb+srv://{os.getenv('MONGODB_USERNAME')}:{os.getenv('MONGODB_PASSWORD')}@{os.getenv('MONGODB_CLUSTER')}/?retryWrites=true&w=majority"
MONGO_DB = os.getenv("MONGODB_DB")
MONGO_COLLECTION = os.getenv("MONGODB_COLLECTION")

# Connect to MongoDB
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
collection = db[MONGO_COLLECTION]

# Fetch machine logs from MongoDB
machine_logs = list(collection.find())

# Analyze machine logs using OpenAI
def analyze_machine_log(log):
    instructions = f"""
    You are an expert heavy equipment diagnostics AI. 
    Analyze the machine issue report and sensor data. 
    Determine the most likely root causes and assign probability scores to each based on the evidence provided. 
    Use probability distributions where applicable. 

    Output all of your response in structured JSON and only in JSON. 
    Format with 'machine_id', 'issue_report', 'cause', 'probability', and 'confidence_level' and other keys as needed.

    Machine Issue Report: {log['issue_report']}
    Sensor Data: {json.dumps(log['sensor_data'], indent=4)}
    Engine Hours: {log['engine_hours']}
    Year of Manufacture: {log['year_of_manufacture']}
    Maintenance History: {json.dumps(log['maintenance_history'], indent=4)}
    """

    try:
        response = client.responses.create(
            model="gpt-4o",
            input=instructions,
        )
        return response.output_text.strip()
    except Exception as e:
        print(f"Error with OpenAI API: {e}")
        return None

# Analyze each machine log and print the results
for log in machine_logs:
    analysis = analyze_machine_log(log)
    if analysis:
        print(f"Analysis for Machine ID {log['machine_id']}:\n{analysis}\n")

# Save the analysis results back to MongoDB (optional)
def save_analysis_to_mongodb(log_id, analysis):
    collection.update_one(
        {"_id": log_id},
        {"$set": {"analysis": analysis}}
    )

# Uncomment the following lines to save the analysis results back to MongoDB
# for log in machine_logs:
#     analysis = analyze_machine_log(log)
#     if analysis:
#         save_analysis_to_mongodb(log["_id"], analysis)