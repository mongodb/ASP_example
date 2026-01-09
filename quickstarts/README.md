# Atlas Stream Processing · Quick‑Starts

Welcome! This folder contains **canonical stream processor examples** in JSON format, following best practices for Atlas Stream Processing definitions.

## Canonical Format

All stream processors use a standardized JSON structure:

```json
{
  "name": "processor_name",
  "pipeline": [
    { "$source": { ... } },
    { "$stage": { ... } },
    ...
  ]
}
```

This format:
- ✅ Works consistently across MongoDB Shell, Admin API, and Terraform
- ✅ Is portable and version-controllable
- ✅ Separates configuration from execution logic
- ✅ Enables easy sharing and reuse

---

## Quick‑Start Catalogue

| File                              | Pattern                                        | Description                         |
| --------------------------------- | ---------------------------------------------- | ----------------------------------- |
| `00_hello_world.json` **          | Docs array → `$match`                          | Zero infra; ephemeral only.         |
| `01_changestream_basic.json`      | `sample_stream_solar` → rollup → `$merge`      | Groups and writes to collection.    |
| `02_changestream_to_kafka.json`   | `sample_stream_solar` → `$emit` → Kafka        | Stream to Kafka topic. *            |
| `03_kafka_to_mongo.json`          | Kafka → 60s roll‑up → `$merge` into Atlas      | Ingest + aggregate. *               |
| `04_mongo_to_mongo.json`          | Reads `solar_rollup` → archive                 | Uses output from example 01.        |
| `05_kafka_tail.json` **           | Kafka → console (no sink)                      | `tail -f` for Kafka. *              |

> **\*** Requires Kafka connection setup in Atlas Stream Processing connection registry  
> **\*\*** No sink stage - only works with `sp.process()` (ephemeral mode)

---

## Using in MongoDB Shell

### Method 1: Ephemeral Processing with `sp.process()`

For quick testing and development, run processors ephemerally (they stop when the shell session ends):

```javascript
// 1. Load the processor definition from a JSON file
const processor = fs.readFileSync('00_hello_world.json', 'utf8')

// 2. Parse the JSON
const def = JSON.parse(processor)

// 3. Run it ephemerally - results print to console
sp.process(def.pipeline)
```

**Complete Example:**
```javascript
// Load and run the hello world example
const helloWorld = JSON.parse(fs.readFileSync('00_hello_world.json', 'utf8'))
sp.process(helloWorld.pipeline)

// Or in one line:
sp.process(JSON.parse(fs.readFileSync('00_hello_world.json', 'utf8')).pipeline)
```

### Method 2: Persistent Processors with `sp.createStreamProcessor()`

For production use, create named processors that run continuously:

```javascript
// 1. Load the processor definition
const processor = JSON.parse(fs.readFileSync('03_kafka_to_mongo.json', 'utf8'))

// 2. Create a persistent stream processor
sp.createStreamProcessor(processor.name, processor.pipeline)

// 3. Start the processor
sp[processor.name].start()

// Management commands:
sp[processor.name].stop()    // Stop processing
sp[processor.name].sample()  // View sample output
sp[processor.name].stats()   // View statistics
sp[processor.name].drop()    // Delete the processor
```

**Complete Example:**
```javascript
// Load the Kafka to Mongo processor
const kafkaToMongo = JSON.parse(fs.readFileSync('03_kafka_to_mongo.json', 'utf8'))

// Create it
sp.createStreamProcessor(kafkaToMongo.name, kafkaToMongo.pipeline)

// Start it
sp.kafka_to_mongo.start()

// Check stats after a few minutes
sp.kafka_to_mongo.stats()
```

### Method 3: Copy-Paste in Shell

You can also copy the JSON content and paste it directly:

```javascript
const def = {
  "name": "hello_world",
  "pipeline": [
    {
      "$source": {
        "documents": [
          { "_id": 1, "ts": "2024-01-01T00:00:00Z", "msg": "hi" },
          { "_id": 2, "ts": "2024-01-01T00:00:00Z", "msg": "hello" }
        ]
      }
    },
    {
      "$match": { "msg": "hello" }
    }
  ]
}

// Run ephemeral
sp.process(def.pipeline)

// Or create persistent
sp.createStreamProcessor(def.name, def.pipeline)
```

---

## Ephemeral vs Persistent

| Method                              | Lifetime                          | UI Visibility                        | Use Case                    |
| ----------------------------------- | --------------------------------- | ------------------------------------ | --------------------------- |
| `sp.process(pipeline)`              | Session ends = processor stops    | Shows as **Interactive Run**         | Testing, demos, development |
| `sp.createStreamProcessor() + start()` | Runs 24×7 until stopped/dropped | Named entry in Stream Processors UI  | Production, long-running    |

---

## Prerequisites

### What's Already Available

These sources are **automatically available** without any connection setup:
- **`documents`**: Inline array of documents (used in `00_hello_world.json`)
- **`sample_stream_solar`**: MongoDB-provided sample streaming data (read-only source)

### What You Need to Set Up

1. **Stream Processing Workspace**: Created in Atlas UI under Stream Processing

2. **Atlas Cluster Connection** (for writing data):
   - Register your Atlas cluster as a connection named `sample_streaming` in the connection registry
   - This is used to write results to collections (examples 01, 03, 04)
   - See [Atlas Stream Processing Connections Docs](https://www.mongodb.com/docs/atlas/atlas-sp/connections/)

3. **MongoDB Shell (mongosh)**: Install the latest version
   ```bash
   # macOS
   brew install mongosh
   
   # Or download from mongodb.com/try/download/shell
   ```

3. **Authentication**: Connect to your Atlas stream processing workspace
   ```bash
   mongosh "mongodb://your-atlas-stream-processing-endpoint"
   ```

4. **Kafka Connections** (Required for examples 02, 03, 05):
   - Register Kafka brokers in Atlas UI → Stream Processing → Connections
   - Create a connection named to match the `connectionName` in the JSON files
   - See [Atlas Stream Processing Connections Docs](https://www.mongodb.com/docs/atlas/atlas-sp/connections/)

### Connection Registry Notes

- **`sample_stream_solar`** is a read-only streaming source (cannot be used for $merge destinations)
- **`sample_streaming`** connection is your Atlas cluster used for writing collections
- **Example 00** (`hello_world.json`) works immediately - no external connections needed
- **Example 01** (`changestream_basic.json`) requires the `sample_streaming` connection and writes to `sample_streaming.solar_rollup` collection
- **Example 02** (`changestream_to_kafka.json`) uses `sample_stream_solar` as source, only needs Kafka sink connection
- **Example 03** (`kafka_to_mongo.json`) requires the `sample_streaming` connection - writes to `sample_streaming.flights_1m`
- **Example 04** (`mongo_to_mongo.json`) requires the `sample_streaming` connection - reads from `solar_rollup` and archives to `solar_archive`
- Examples with Kafka sinks or sources (`02`, `03`, `05`) require you to register your Kafka brokers in the connection registry

### Recommended Learning Path

1. Start with `00_hello_world.json` (ephemeral, no setup)
2. Set up the `sample_streaming` Atlas cluster connection in your connection registry
3. Run `01_changestream_basic.json` as a persistent processor (creates data for next step)
4. Once #3 is running, try `04_mongo_to_mongo.json` to read and archive the rollup data
5. Set up Kafka connections to try the Kafka examples (`02`, `03`, `05`)

---

## Examples

### Example 1: Simple Hello World (Ephemeral)
```javascript
// Ephemeral - just test it out (no data is persisted)
const hello = JSON.parse(fs.readFileSync('00_hello_world.json', 'utf8'))
sp.process(hello.pipeline)
// Output: Documents matching "hello" print to console
```

### Example 2: Stream Solar Data to Collection (Persistent)
```javascript
// Create a persistent processor that rolls up solar data
const solar = JSON.parse(fs.readFileSync('01_changestream_basic.json', 'utf8'))
sp.createStreamProcessor(solar.name, solar.pipeline)
sp.changestream_basic.start()

// Every 10 seconds, device message counts are written to sample_streaming.solar_rollup
// Check the collection:
// use sample_streaming
// db.solar_rollup.find()
```

### Example 3: Archive the Rollup Data (Persistent)
```javascript
// This reads from the solar_rollup collection created in Example 2
const archive = JSON.parse(fs.readFileSync('04_mongo_to_mongo.json', 'utf8'))
sp.createStreamProcessor(archive.name, archive.pipeline)
sp.mongo_to_mongo.start()

// Changes to sample_streaming.solar_rollup are now archived to sample_streaming.solar_archive
```

### Example 4: Kafka Tail (Monitor Topic)
```javascript
// Tail a Kafka topic in real-time (requires Kafka connection setup)
const tail = JSON.parse(fs.readFileSync('05_kafka_tail.json', 'utf8'))
sp.process(tail.pipeline)
// Press Ctrl+C to stop
```

### Example 5: Production Kafka→Mongo Pipeline
```javascript
// Create a persistent processor (requires Kafka connection setup)
const prod = JSON.parse(fs.readFileSync('03_kafka_to_mongo.json', 'utf8'))
sp.createStreamProcessor(prod.name, prod.pipeline)
sp.kafka_to_mongo.start()

// Check it's running
sp.kafka_to_mongo.stats()

// Stop when needed
sp.kafka_to_mongo.stop()
```

---

## Tips & Best Practices

### ✅ DO
- Use the canonical `{name, pipeline}` format for all processors
- Store processor definitions in `.json` files for version control
- Test with `sp.process()` before creating persistent processors
- Use descriptive names that indicate the processor's purpose

### ❌ DON'T
- Hardcode credentials in pipeline definitions (use connectionName instead)
- Create persistent processors for one-off tests (use sp.process() instead)
- Forget to `.stop()` processors before `.drop()`ping them

---

## Troubleshooting

**Connection errors?**
- Verify connections exist: Check Atlas UI → Stream Processing → Connections
- Connection names are case-sensitive

**Pipeline not processing?**
- For persistent processors, ensure you called `.start()`
- Check `.stats()` for error messages
- Verify source has data (try `sp.process()` first to test)

**Can't load JSON file?**
- Ensure you're in the quickstarts directory or use full path
- Use `fs.readFileSync('path/to/file.json', 'utf8')` to read file contents
- mongosh uses Node.js fs module, not legacy `cat()` function

---

## Need Help?

- **Documentation**: [Atlas Stream Processing Docs](https://www.mongodb.com/docs/atlas/atlas-sp/)
- **Examples**: All files in this directory include inline comments
- **Community**: [MongoDB Community Forums](https://www.mongodb.com/community/forums/)

Happy streaming! 🚀
