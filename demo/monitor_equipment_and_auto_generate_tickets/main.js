import { config } from 'dotenv';
import { MongoClient } from 'mongodb';
import {spawn} from 'child_process';
import { base_device_admin_data }  from './scripts/seed_data.js';

// Goal: Running this script script creates and seeds an admin data collection used for HTTPS calls and runs the scripts creating the stream processors.

// Load environment variables
config();

// Set local variables using env variales
const MONGO_COLLECTION_URI = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_CLUSTER}/?retryWrites=true&w=majority`;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE;
const CONNECT_TO_ASP_SHELL_COMMAND = [
    process.env.MONGODB_STREAM_INSTANCE,
    "--tls",
    "--authenticationDatabase", "admin",
    "--username", process.env.MONGODB_USERNAME,
    "--password", process.env.MONGODB_PASSWORD,
]

// Get CLI argument
const command = process.argv[2];
const processors = [
  'convert_to_farenheit',
  'generate_maintenance_windows',
  'generate_maintenance_tickets'
];

// Confirm that all required environment variables are set
function confirmAllEnvSet(){
  let env_vars= {
    "MONGODB_USERNAME": process.env.MONGODB_USERNAME,
    "MONGODB_PASSWORD": process.env.MONGODB_PASSWORD,
    "MONGODB_DATABASE": process.env.MONGODB_DATABASE,
    "MONGODB_CLUSTER": process.env.MONGODB_CLUSTER,
    "ATLAS_DATABASE_CONNECTION_NAME": process.env.ATLAS_DATABASE_CONNECTION_NAME,
    "MONGODB_STREAM_INSTANCE": process.env.MONGODB_STREAM_INSTANCE,
    "SAMPLE_STREAM_CONNECTION_NAME": process.env.SAMPLE_STREAM_CONNECTION_NAME,
    "HTTPS_CONNECTION_NAME": process.env.HTTPS_CONNECTION_NAME
  }

  const null_env_vars = [];
  for (const [key, value] of Object.entries(env_vars)) {
    if (value === undefined || value === null || value === '') {
      null_env_vars.push(key);
    }
  }

  if (null_env_vars.length > 0) {
    console.error("The following environment variables are not set:\n");
      null_env_vars.forEach(key => console.log(key));
    console.error("\nPlease set them in your .env file or environment to continue.");
    return false;
  }
  return true;
}

// Helper: Create collection for solar generator location data that will be used for forecasts and seed it
async function createAndSeedAdminDataCollection(db){
    // delete collection if it exists so we do not get duplicate records
    const collections = await db.listCollections({ name: "admin_data" }).toArray();
    if (collections.length > 0) {
        await db.collection("admin_data").drop();
    }
    // create a collection an index as we will be looking it up by device_name
    const adminCollection = await db.collection("admin_data");
    await adminCollection.createIndex({ device_name: 1 });
    await adminCollection.insertMany(base_device_admin_data);
    console.log("Admin data seeded successfully");
}

// Helper: Connect to MongoDB and run the command to create and seed the colletions
async function seedCollections() {
  const mongoClient = new MongoClient(MONGO_COLLECTION_URI);
  try {
    console.log("Connecting to MongoDB");
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DATABASE);
    await createAndSeedAdminDataCollection(db);
  } catch (error) {
    console.error('Error with MongoDB operation:', error);
  } finally {
    console.log("Closing MongoDB connection");
    await mongoClient.close();
  }
}

// Helper: Run mongosh command with --eval.  Used for starting and stopping processors
function runMongoshEval(jsCommand) {
  try { // 🟢 Added try
    const args = [
      '--eval', `const database_name="${process.env.MONGODB_DATABASE}"; ${jsCommand}`,
      ...CONNECT_TO_ASP_SHELL_COMMAND
    ];
    spawn('mongosh', args, { stdio: 'inherit' });
  } catch (error) { // 🟢 Added catch
    console.error(`Error running ${jsCommand}: `, error);
  }
}

// 🟢 Check if all environment variables are set before proceeding
if(confirmAllEnvSet() === false){
  process.exit(1);
}; 

// Main
if (command === '--setup') {
  await seedCollections();

  const allScripts = [
    './scripts/convert_to_farenheit.mongodb.js',
    './scripts/generate_maintenance_tickets.mongodb.js',
    './scripts/generate_maintenance_windows.mongodb.js',
  ];

  for (const script of allScripts) {
    console.log(`Running script: ${script}`);
    const args = [
      "--eval",
      // 🟢 Fix: wrap string values in quotes, and remove extra linebreaks
      `const database_connection_name="${process.env.ATLAS_DATABASE_CONNECTION_NAME}";
      const database_name="${process.env.MONGODB_DATABASE}";
      const sample_stream_name="${process.env.SAMPLE_STREAM_CONNECTION_NAME}";
      const https_connection_name="${process.env.HTTPS_CONNECTION_NAME}";`,
      ...CONNECT_TO_ASP_SHELL_COMMAND,
      script
    ];
    spawn('mongosh', args, { stdio: 'inherit' });
  }
}

if (command === '--start_processors') {
  processors.forEach(processor => {
    console.log(`Starting processor: ${processor}`);
    runMongoshEval(`sp.${processor}.start();`);
  });
}

if (command === '--stop_processors') {
  processors.forEach(processor => {
    console.log(`Stopping processor: ${processor}`);
    runMongoshEval(`sp.${processor}.stop();`);
  });
}

if (command === '--drop_processors') {
  processors.forEach(processor => {
    console.log(`Dropping processor: ${processor}`);
    runMongoshEval(`sp.${processor}.drop();`);
  });
}