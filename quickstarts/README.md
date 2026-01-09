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
| `00_hello_world.json`             | Docs array → `$match`                          | Zero infra; sanity check.           |
| `01_changestream_basic.json`      | `sample_stream_solar` → 10s windowed `$group`  | First change‑stream demo.           |
| `02_changestream_to_kafka.json`   | Change stream → `$emit` → Kafka                | Atlas → Kafka fan‑out.              |
| `03_kafka_to_mongo.json`          | Kafka → 60s roll‑up → `$merge` into Atlas      | Ingest + aggregate.                 |
| `04_mongo_to_mongo.json`          | Atlas coll → `$addFields` → `$merge`           | Same‑cluster ETL.                   |
| `05_kafka_tail.json` *            | Kafka → console (no sink)                      | `tail -f` for Kafka.                |

> **\*** `05_kafka_tail.json` has no sink stage, so it only works with `sp.process()` (ephemeral mode). It cannot be used with `sp.createStreamProcessor()`.

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

Before running these examples, ensure you have:

1. **Stream Processing Instance**: Created in Atlas UI under Stream Processing
2. **Connections**: Register your data sources (clusters, Kafka brokers)
   - Sample data: `sample_stream_solar` is available by default
   - Custom connections: See Atlas UI → Stream Processing → Connections

3. **MongoDB Shell**: Install the latest version
   ```bash
   # macOS
   brew install mongosh
   
   # Or download from mongodb.com/try/download/shell
   ```

4. **Authentication**: Connect to your Atlas Stream Processing instance
   ```bash
   mongosh "mongodb://your-atlas-stream-processing-endpoint"
   ```

---

## Examples

### Example 1: Simple Hello World
```javascript
// Ephemeral - just test it out
const hello = JSON.parse(fs.readFileSync('00_hello_world.json', 'utf8'))
sp.process(hello.pipeline)
// Output: { "_id": 2, "ts": "2024-01-01T00:00:00Z", "msg": "hello" }
```

### Example 2: Stream Solar Data
```javascript
// Watch live solar panel data roll in
const solar = JSON.parse(fs.readFileSync('01_changestream_basic.json', 'utf8'))
sp.process(solar.pipeline)
// Every 10 seconds, you'll see message counts per device
```

### Example 3: Kafka Tail (Monitor Topic)
```javascript
// Tail a Kafka topic in real-time
const tail = JSON.parse(fs.readFileSync('05_kafka_tail.json', 'utf8'))
sp.process(tail.pipeline)
// Press Ctrl+C to stop
```

### Example 4: Production Kafka→Mongo Pipeline
```javascript
// Create a persistent processor
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
