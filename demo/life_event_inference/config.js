const path = require("node:path");
const { loadEnvFile } = require("node:process");

try {
  loadEnvFile(path.join(__dirname, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function requiredSetting(name, environment = process.env) {
  const value = environment[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Set ${name} in .env or the process environment.`);
  }
  return value;
}

function positiveInteger(name, maximum = Number.MAX_SAFE_INTEGER, environment = process.env) {
  const value = requiredSetting(name, environment);
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}.`);
  }
  return number;
}

function mongoSettings() {
  return {
    uri: requiredSetting("MONGODB_URI"),
    dbName: requiredSetting("DB_NAME"),
    collectionName: requiredSetting("COLLECTION_NAME"),
  };
}

module.exports = { requiredSetting, positiveInteger, mongoSettings };