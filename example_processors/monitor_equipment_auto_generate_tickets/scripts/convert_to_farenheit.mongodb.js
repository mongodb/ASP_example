// convert_to_farenheit.mongodb.js

// Connections needed:
//   1 Sample Stream.  This is a sample stream of solar generator data mimicking the data that would be stored in a Kafka topic
//   1 Atlas Database.  This is the database that will be used to store the data from the stream.

// Goal: Convert the temperature readings from Celsius to Fahrenheit and store them in the database.

// Confirm that the required environment variables are set
if (database_name == null) {
    console.log("Database name is undefined. Please set the database name.");
}
if (database_connection_name == null){
    console.log("Database connection name is undefined. Please set the database connection name.");
}
if (sample_stream_name == null){
    console.log("Sample stream name is undefined. Please set the sample stream name.");
}

// Set the source of your records to be the sample stream that generates solar generator data
// This data mimics the solar generator data that would be stored in a Kafka topic
let solar_stream_source = {
    $source: {
        connectionName: sample_stream_name
     }
}

// Add a field to the document called farenheit by multiplying the celsius temperature by 1.8 and adding 32
let add_farenheit_and_rename_celsius = {
    $set: {
        "farenheit": {
            $add: [ 
                {
                    $multiply: ["$obs.temp", 1.8]
                },
                32
            ]
        },
        "watts": "$obs.watts"
    }
}

// Remove the obs object from the document after extracting data we need
let cleanup = {
    $unset: "obs"
}


// Merge the records to the equipment_logs collection as they come in
let write_to_collection = {
    $merge: {
        into: {
            connectionName: database_connection_name,
            db: database_name,
            coll: "equipment_logs"
        }
    }
};

// Create an array of stages that the stream processor will run
pipeline = [
    solar_stream_source,
    add_farenheit_and_rename_celsius,
    cleanup,
    write_to_collection
];

// Drop the existing stream processor if it exists
try {
  sp.convert_to_farenheit.drop();
} catch (e) { }

// Create the stream processor and start it
sp.createStreamProcessor("convert_to_farenheit", pipeline);
// sp.convert_to_farenheit.start();