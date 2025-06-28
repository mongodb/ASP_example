function generateRandomLastMaintenanceDate() {
    const now = new Date();
    const lowerDayLimit = 90;
    const lowerMillisLimit = lowerDayLimit * 24 * 60 * 60 * 1000;
    const randomMillisAgo = Math.random() * lowerMillisLimit;  // n days in ms
    return new Date(now.getTime() - randomMillisAgo);
}

let base_device_admin_data = [
  { city: "New York", state: "NY", latitude: 40.714, longitude: -74.006 },
  { city: "Los Angeles", state: "CA", latitude: 34.052, longitude: -118.244 },
  { city: "Chicago", state: "IL", latitude: 41.850, longitude: -87.650 },
  { city: "Houston", state: "TX", latitude: 29.763, longitude: -95.363 },
  { city: "Phoenix", state: "AZ", latitude: 33.448, longitude: -112.074 },
  { city: "Philadelphia", state: "PA", latitude: 39.952, longitude: -75.164 },
  { city: "San Antonio", state: "TX", latitude: 29.424, longitude: -98.494 },
  { city: "San Diego", state: "CA", latitude: 32.716, longitude: -117.165 },
  { city: "Dallas", state: "TX", latitude: 32.776, longitude: -96.797 },
  { city: "San Jose", state: "CA", latitude: 37.338, longitude: -121.886 },
  { city: "San Jose", state: "CA", latitude: 37.335, longitude: -121.890 }
];

for (let i = 0; i < base_device_admin_data.length; i++) {
    base_device_admin_data[i].last_maintenance_date = generateRandomLastMaintenanceDate();
    base_device_admin_data[i].name = `device_${i}`;
}

export { base_device_admin_data };
