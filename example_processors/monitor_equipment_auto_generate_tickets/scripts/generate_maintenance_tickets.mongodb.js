// generate_maintenance_tickets.mongodb.js

// Connections needed:
//   1 Atlas Database.  This is the database with the collection that we stored the solar equipment logs in.
//   We will use this for both the data source and data sink (where we are writing it to).

// Goal: Detect poor performance of solar generators by reviewing the maintenance window data.  If performance is poor, file a ticket so the generator can be checked.

// Confirm that the required environment variables are set
if (database_name == null) {
    console.log("Database name is undefined. Please set the database name.");
}
if (database_connection_name == null){
    console.log("Database connection name is undefined. Please set the database connection name.");
}

// These are the weather codes that are considered severe.  When a generator needs maintenance, we will check the weather forecast for the next 24 hours to see if it is servered.
// If it is, we will set the priority of the maintenance ticket to "urgent".  If not, we will set it to "standard".
severe_weather_codes = [
  9,   // Duststorm or sandstorm
  18,  // Squalls
  19,  // Funnel clouds (tornado, waterspout)
  24,  // Freezing drizzle or freezing rain
  27,  // Shower(s) of hail or rain and hail
  29,  // Thunderstorm (past hour)
  37,  // Heavy drifting snow
  39,  // Heavy blowing snow
  49,  // Fog depositing rime
  57,  // Freezing drizzle, moderate/heavy
  67,  // Freezing rain, moderate/heavy
  89,  // Shower(s) of hail not associated with thunder
  96,  // Thunderstorm with slight/moderate hail
  97,  // Thunderstorm, heavy, no hail
  98,  // Thunderstorm, heavy, with slight/moderate hail
  99   // Thunderstorm, heavy, with heavy hail
]

// Set the source of your records to be the maintenance_windows collection that getting the min, max, and average readings for generators' wattage and temperature
// This will set change streams of inserted, updated, and deleted records to be the source of the stream processor
let maintenance_windows_source = {
    $source: {
        connectionName: database_connection_name,
        db: database_name,
        coll: "maintenance_windows"
    }
};

// this looks for devices that have had more than 3 events and an average wattage of greater than 400
// a device that meets this criteria is likely to be functioning properly and needs maintenance
let match_high_wattage = {
    $match: {
        $and: [
            { "fullDocument.events": { $gt: 3 } },
            { "fullDocument.avg_watts": { $lt: 400 } }
        ]
    }
}

// we use $lookup to get the administrative data for the solar generator
// we generated this data in the setup_env.js script and stored it in the admin_data collection
// it looks for the device_id in the maintenance_windows collection and matches it to the name field in the admin_data collection
let lookup_admin_data = {
    $lookup: {
      "from": {
        "connectionName": database_connection_name,
        "db": database_name,
        "coll": "admin_data"
      },
      "localField": "fullDocument.device_id",
      "foreignField": "name",
      "as": "admin_info"
    }
}

// The lookup will return an array of matching documents.  We only need the first one, so we use $arrayElemAt to get the first element of the array
let break_admin_info_out_of_array = {
    $set: {
        "admin_info": { $arrayElemAt: ["$admin_info", 0] }
    }   
}

// We use the $https stage to call the Open Meteo API to get the weather alerts for the location of the solar generator for the next 24 hours
// We use the latitude and longitude from the admin_info object that we got from the lookup stage
// This will be stored in document as an object called weather_alerts
let get_weather_alerts = {
    $https: {
        connectionName: https_connection_name,
        parameters: {
            "latitude": "$admin_info.latitude",
            "longitude": "$admin_info.longitude",
            "hourly": "weather_code",
            "current": "weather_code",
            "forecast_hours": 24
        },
        as: "weather_alerts",
        onError: "ignore"
    }
}

// We look for the weather codes in the weather_alerts object.  If none match the severe weather codes, we set the priority to "standard".
// If any of them do, we set the priority to "urgent".
let add_priority = {
  $addFields: {
    priority: {
      $cond: {
        if: {
          $or: [
            { $in: ["$weather_alerts.current.weather_code", severe_weather_codes] },
            { 
              $anyElementTrue: {
                $map: {
                  input: "$weather_alerts.hourly.weather_code",
                  as: "code",
                  in: { $in: ["$$code", severe_weather_codes] }
                }
              }
            },
            { $lt: ["$fullDocument.min_temp", 42] }
          ]
        },
        then: "urgent",
        else: "standard"
      }
    }
  }
};

// We use $project to format the records that we will write to the bug_check collection so that all fields we need are at the top level of the document
let format_records = {
    $project: {
        "device_name": "$fullDocument.device_id",
        "city": {
            $concat: [
                "$admin_info.city",
                ", ",
                "$admin_info.state"
            ]
        },
        "latitude": "$admin_info.latitude",
        "longitude": "$admin_info.longitude",
        "priority": 1,
        "avg_temp": "$fullDocument.avg_temp",
        "min_temp": "$fullDocument.min_temp",
        "max_temp": "$fullDocument.max_temp",
        "avg_watts": "$fullDocument.avg_watts",
        "min_watts": "$fullDocument.min_watts",
        "max_watts": "$fullDocument.max_watts",
    }
}

// We write the records to the maintenance_tickets collection so that they can be reviewed by the operations team
let write_to_collection = {
    $merge: {
        into: {
            connectionName: database_connection_name,
            db: database_name,
            coll: "maintenance_tickets"
        }
    }
};

// Create an array of stages that the stream processor will run
let pipeline = [
    maintenance_windows_source,
    match_high_wattage,
    lookup_admin_data,
    break_admin_info_out_of_array,
    get_weather_alerts,
    add_priority,
    format_records,
    write_to_collection
]

// Drop the existing stream processor if it exists
try {
  sp.generate_maintenance_tickets.drop();
} catch (e) { }

// Create and start the stream processor
sp.createStreamProcessor("generate_maintenance_tickets", pipeline);
// sp.generate_maintenance_tickets.start();


let m = {
  $merge: {
    into: {
      connectionName: "jsncluster0", db: "lce", coll: "del"
    },
    whenMatched: { $cond: { if: { $eq: ["$$ROOT", {}] }, then: "delete", else: "merge" } },
    whenNotMatched: "insert"
  },
  on: { $meta: "stream.source.key" }
}