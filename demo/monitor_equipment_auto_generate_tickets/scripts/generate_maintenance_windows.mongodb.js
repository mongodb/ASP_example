// generate_maintenance_windows.mongodb.js

// Connections needed:
//   1 Atlas Database.  This is the database with the collection that we stored the solar equipment logs in.
//   We will use this for both the data source and data sink (where we are writing it to).

// Goal: Every 30 seconds, get the min, max, and average of the watts and temperature readings from the solar equipment logs
// and store them in the database.  This will be used to understand if a solar generator is operating at a high level or if 
// we need to do maintenance on it.

// Confirm that the required environment variables are set
if (database_name == null) {
    console.log("Database name is undefined. Please set the database name.");
}
if (database_connection_name == null){
    console.log("Database connection name is undefined. Please set the database connection name.");
}

// Set the source of your records to be the equipment_logs collection that is getting the generator data with farenheit temperature and wattage
// This will set change streams of inserted, updated, and deleted records to be the source of the stream processor
let solar_equipment_logs_source = {
    $source: {
        connectionName: database_connection_name,
        db: database_name,
        coll: "equipment_logs"
    }
};

// Group data by device_id and get the avg, min, and max of the watts and temperature readings for all data within the group
// The hopping window below we define will ensure that we do this every 30 seconds
let aggregate_output_data = {
    $group: {
        _id: "$fullDocument.device_id",
        events: {
            $sum: 1
        },
        avg_temp: {
            $avg: "$fullDocument.farenheit"
        },
        min_temp: {
            $min: "$fullDocument.farenheit"
        },
        max_temp: {
            $max: "$fullDocument.farenheit"
        },
        avg_watts: {
            $avg: "$fullDocument.watts"
        },
        min_watts: {
            $min: "$fullDocument.watts"
        },
        max_watts: {
            $max: "$fullDocument.watts"
        }
    }
}

// Create a hopping window that will group the data by device_id and get the avg, min, and max of the watts and temperature readings for all data within the group every 30 seconds
// The stages within pipeline will be run on all data within the window after the interval is reached
let hop_every_30_seconds = {
    $hoppingWindow: {
        "boundary": "eventTime",
        "interval": {
            "size": 30,
            "unit": "second"
        },
        "hopSize": {
            "size": 30,
            "unit": "second"
        },
        pipeline: [aggregate_output_data]

    }
}

// Se the field device_id to be equal to the _id field and then remove the existing _id field
// This is done so we generate a new UUID field referencing the maintenance window data each time we insert
let add_device_id = {
    $set: {
        "device_id": "$_id"
    }
}
let remove_id = {
    $unset: "_id"
}

// This merges it to the collection so we can see it
let write_to_collection = {
    $merge: {
        into: {
        connectionName: database_connection_name,
        db: database_name,
            coll: "maintenance_windows"
        }
    }
};

// Create an array of stages that the stream processor will run
pipeline = [
    solar_equipment_logs_source,
    hop_every_30_seconds,
    add_device_id,
    remove_id,
    write_to_collection
];

// Drop the existing stream processor if it exists
try {
  sp.generate_maintenance_windows.drop();
} catch (e) { }

// Create and start the stream processor
sp.createStreamProcessor("generate_maintenance_windows", pipeline);
// sp.generate_maintenance_windows.start();


let statement = {
    $source: {
            config: {
                value: {
                $cond: {
                    if: {$eq: ["$value", {}]},
                    then: null,
                    else: "$$ROOT"
                },
                key: {$toString : "$_stream_meta.source.partition"}, 
                keyFormat : "string",
                
            }
        }
    }
}


m = {
    $merge: {
        into: {
            connectionName: "jsncluster0", db: "lce", coll: "del"
        },
        whenMatched: {
            $cond: {
                if: { $eq: ["$isActive", 0] }, then: "delete", else: "merge"
            }
        },
        whenNotMatched: "insert"
    },
}
// cmd + kf for format :)