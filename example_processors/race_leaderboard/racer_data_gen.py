import random
import time
import json
from datetime import datetime
from kafka import KafkaProducer

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

producer = KafkaProducer(bootstrap_servers=["localhost:9092"],
                         value_serializer=lambda m: json.dumps(m).encode('ascii'))

while True:
    for racer in racers:
        racer.move()
        event = racer.get_status()
        producer.send("thunderhead_race", value=event)
        print(json.dumps(event))
        time.sleep(random.uniform(0.5, 1.0))
