import random
import time
import json
from datetime import datetime
from pymongo import MongoClient

class Racer:
    def __init__(self, name, number):
        self.name = name
        self.number = number
        self.lap = 1
        self.corner = 1
        self.time = datetime.now().isoformat()

    def move(self):
        self.corner += 1
        if self.corner > 4:
            self.corner = 1
            self.lap += 1
        self.time = datetime.now().isoformat()

    def get_status(self):
        return {
            "Racer_Num": self.number,
            "Racer_Name": self.name,
            "lap": self.lap,
            "Corner_Num": self.corner,
            "timestamp": self.time,
        }

racers = [
    Racer("Go Mifune", 5),
    Racer("Captain Terror", 11),
    Racer("Snake Oiler", 12),
    Racer("Race X", 9),
    Racer("Pace Car", 0),
]

# Connect to MongoDB
client = MongoClient('localhost', 27017)
db = client['test']
collection = db['race_events_raw']

while True:
    for racer in racers:
        racer.move()
        event = racer.get_status()
        racer_num = event['Racer_Num']
        collection.update_one(
            {"Racer_Num": racer_num},
            {"$set": event},
            upsert=True
        )
        print(event)
        time.sleep(random.uniform(0.5, 1.0))
