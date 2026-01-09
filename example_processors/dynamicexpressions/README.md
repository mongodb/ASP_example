# Dynamic Expressions Examples

This directory contains examples demonstrating **dynamic expressions** in Atlas Stream Processing - using `$switch` and conditional logic to dynamically determine output destinations or values at runtime.

## What Are Dynamic Expressions?

Dynamic expressions allow you to:
- Route documents to different collections based on field values
- Send messages to different Kafka topics based on conditions
- Compute values dynamically using conditional logic
- Multiplex a single input stream to multiple destinations

## Examples

### 1. `simple_dynamic_expressions.json`

**Use Case**: Route speed sensor data to different collections based on thresholds.

**Dynamic Logic**:
- Speed < 0 → `speed_error` collection
- Speed >= 100 → `speed_fast` collection  
- Otherwise → `speed_normal` collection

**Key Feature**: The `$merge` stage uses a dynamic `coll` field with `$switch` to determine the target collection at runtime.

### 2. `simple_multiplex.json`

**Use Case**: Send messages to multiple Kafka topics based on user name.

**Dynamic Logic**:
- Name = "David" → Both `topic_1` and `topic_2`
- Others → Only `topic_2`

**Key Feature**: Uses `$addFields` with `$switch` to create an array of topics, then `$unwind` to create separate messages for each topic.

---

## Setup

### Prerequisites

1. **Stream Processing Workspace**: Created in Atlas UI
2. **MongoDB Connection**: Register your cluster as `sample_streaming` in the connection registry
3. **Kafka Connection** (for `simple_multiplex.json`): Register Kafka brokers as `ccloud` in the connection registry

### Load Sample Data (for simple_dynamic_expressions)

The `simple_dynamic_expressions.json` processor reads from `test.speed` collection. Load sample data using mongosh:

**Option 1: Using the provided data file**
```javascript
// Connect to your cluster
use test

// Load and insert the sample data
const data = JSON.parse(fs.readFileSync('simple_dynamic_expressions_sample_data.json', 'utf8'))
db.speed.insertMany(data)

// Verify
db.speed.find()
```

**Option 2: Manual insert**
```javascript
use test

db.speed.insertMany([
  { speed: 0 },
  { speed: -10 },
  { speed: 101 },
  { speed: 50 },
  { speed: 99 },
  { speed: -5 },
  { speed: 150 }
])
```

---

## Running the Examples

### Example 1: Dynamic Collection Routing

```javascript
// Load the processor definition
const proc = JSON.parse(fs.readFileSync('simple_dynamic_expressions.json', 'utf8'))

// Create the stream processor
sp.createStreamProcessor(proc.name, proc.pipeline)

// Start it
sp.simple_dynamic_expressions.start()

// Check the stats
sp.simple_dynamic_expressions.stats()
```

**Verify Results:**
```javascript
use test

// Check each collection
db.speed_error.find()   // Should have documents where speed < 0
db.speed_fast.find()    // Should have documents where speed >= 100
db.speed_normal.find()  // Should have all other documents
```

**Expected Output:**
- `speed_error`: `{ speed: -10 }`, `{ speed: -5 }`
- `speed_fast`: `{ speed: 101 }`, `{ speed: 150 }`
- `speed_normal`: `{ speed: 0 }`, `{ speed: 50 }`, `{ speed: 99 }`

### Example 2: Dynamic Kafka Topic Multiplexing

```javascript
// Load the processor definition  
const proc = JSON.parse(fs.readFileSync('simple_multiplex.json', 'utf8'))

// Run ephemerally (since it uses inline documents)
sp.process(proc.pipeline)
```

**Expected Behavior:**
- Joe's message → Sent to `topic_2` only
- David's message → Sent to both `topic_1` AND `topic_2` (2 messages created)

**Verify on Kafka side:**
```bash
# Check topic_1 (should only have David's message)
kafka-console-consumer --topic topic_1 --from-beginning

# Check topic_2 (should have both Joe's and David's messages)
kafka-console-consumer --topic topic_2 --from-beginning
```

---

## Key Concepts

### Dynamic Collection Names

Use `$switch` inside the `coll` field of `$merge`:

```json
{
  "$merge": {
    "into": {
      "connectionName": "sample_streaming",
      "db": "test",
      "coll": {
        "$switch": {
          "branches": [
            { "case": { "$expr": { "$lt": ["$field", 0] } }, "then": "collection_a" },
            { "case": { "$expr": { "$gte": ["$field", 100] } }, "then": "collection_b" }
          ],
          "default": "collection_default"
        }
      }
    }
  }
}
```

### Dynamic Topic Routing with Multiplexing

Create multiple messages from one by using arrays and `$unwind`:

```json
[
  {
    "$addFields": {
      "topics": {
        "$switch": {
          "branches": [
            { "case": { "$expr": { "$eq": ["$type", "premium"] } }, "then": ["topic_1", "topic_2"] }
          ],
          "default": ["topic_1"]
        }
      }
    }
  },
  { "$unwind": "$topics" },
  { "$emit": { "connectionName": "kafka", "topic": "$topics" } }
]
```

---

## Use Cases

### When to Use Dynamic Expressions

✅ **Good for:**
- Multi-tenant architectures (route each tenant to their own collection)
- Error handling (separate error documents from normal flow)
- Fan-out patterns (send to multiple destinations)
- Hot/cold data separation (route based on freshness/importance)
- A/B testing (route traffic based on user segments)

❌ **Not ideal for:**
- Simple static routing (just use hardcoded collection names)
- Complex business logic (consider using `$function` or application layer)

---

## Troubleshooting

**Collection not created?**
- Ensure your `sample_streaming` connection has write permissions
- Check that the database name in the pipeline matches your setup
- Verify the processor is running with `.stats()`

**No messages in Kafka topics?**
- Verify Kafka connection is properly configured
- Check topic names match what's expected in `$switch` logic
- Use `.sample()` to see intermediate pipeline output

**Documents not routing correctly?**
- Add `$addFields` before `$merge` to debug the switch logic
- Check that your `$expr` conditions are correct
- Use `sp.process()` to test logic before creating persistent processor

---

## Files

- `simple_dynamic_expressions.json` - Dynamic collection routing based on speed values
- `simple_multiplex.json` - Dynamic Kafka topic multiplexing
- `simple_dynamic_expressions_sample_data.json` - Sample speed data for testing

---

## Learn More

- [Atlas Stream Processing `$merge` Documentation](https://www.mongodb.com/docs/atlas/atlas-sp/operators/merge/)
- [Atlas Stream Processing `$switch` Operator](https://www.mongodb.com/docs/atlas/atlas-sp/operators/switch/)
- [Change Streams Documentation](https://www.mongodb.com/docs/manual/changeStreams/)
