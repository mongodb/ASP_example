# Canonical Processor Definition

This guide explains the complete structure of an Atlas Stream Processor definition, including all key components: the processor name, pipeline stages, and options configuration (especially the Dead Letter Queue).

## Overview

A stream processor definition is a JSON configuration that specifies:
1. **name** - A unique identifier for the processor
2. **pipeline** - An array of aggregation pipeline stages that process data
3. **options** (optional) - Configuration for error handling, DLQ, and other processor settings

## Prerequisites

### Required Database Connections

**IMPORTANT**: Before using any processor, you must create database connections in your Atlas Stream Processing workspace. All processor definitions use placeholder connection names that you must replace with your actual connection names.

To create a MongoDB connection:
1. Navigate to Stream Processing → Your Workspace → Connections
2. Click "Add Connection"
3. Select "MongoDB Atlas" as the connection type
4. Name your connection (e.g., "my_atlas_cluster", "production_db", "analytics_cluster")
5. Configure the connection string and authentication
6. Test and save the connection

**Replace ALL instances of `"YOUR_CONNECTION_NAME"` with your actual connection name.**

## Basic Template

Here's the canonical structure for any stream processor:

```json
{
  "name": "your_processor_name",
  "pipeline": [
    
  ],
  "options": {
    "dlq": {
      "connectionName": "YOUR_CONNECTION_NAME",
      "db": "your_database",
      "coll": "your_processor_dlq"
    }
  }
}
```

## Key Components Explained

### 1. Processor Name (`name`)

The `name` field is a string identifier for your processor. It must be unique within your workspace.

**Rules:**
- Must be unique within the workspace
- Used to reference the processor in API calls and scripts
- Cannot contain spaces or special characters (use underscores or camelCase)

### 2. Pipeline (`pipeline`)

The `pipeline` is an array of MongoDB aggregation pipeline stages. Common stages include:

- **$source** - Defines the data source (Kafka, MongoDB change streams, sample documents)
- **$match** - Filters documents based on conditions
- **$project** - Includes, excludes, or transforms fields
- **$group** - Groups documents by a key and performs aggregations
- **$merge** - Writes output to a MongoDB collection or Kafka topic
- **$window** - Creates tumbling or session windows for time-based operations
- **$addFields** - Adds or modifies fields

**For detailed pipeline examples, see the other processor examples in this repository.**

### 3. Options (`options`)

Options configure processor-level settings. The most important option is the Dead Letter Queue (DLQ).

#### Dead Letter Queue (DLQ)

The DLQ is a MongoDB collection where documents that fail processing are written. This prevents loss of data and allows for debugging.

**DLQ Fields Explained:**
- **connectionName** - The name of the MongoDB connection configured in your workspace (YOU MUST CREATE THIS)
- **db** - The database where DLQ documents are stored
- **coll** - The collection name for storing failed documents

**⚠️ CRITICAL**: Replace `"YOUR_CONNECTION_NAME"` with the actual name of the MongoDB connection you created in your workspace.

#### Document Validation and DLQ Routing

You can route specific validation failures to the DLQ using the `$validate` stage:

```json
{
  "$validate": {
    "validator": {
      "$expr": {
        "$lt": [{ "$bsonSize": "$$ROOT" }, 16777216]
      }
    },
    "validationAction": "dlq"
  }
}
```

When a document fails validation and `validationAction` is set to "dlq", the document is automatically sent to the DLQ collection.

## DLQ Document Structure

When a document is sent to the DLQ, it includes additional metadata:

```json
{
  "_id": ObjectId("..."),
  "originalDocument": { ... },
  "processorName": "your_processor_name",
  "timestamp": ISODate("2024-01-23T10:30:00.000Z"),
  "error": {
    "message": "Document size exceeds limit",
    "code": "VALIDATION_FAILED",
    "stage": "$validate"
  }
}
```

## Best Practices

1. **Always Configure a DLQ** - Enables debugging and prevents silent failures
2. **Create Proper Database Connections** - Never use placeholder connection names in production
3. **Use Validation Early** - Place `$validate` stages early to catch bad data quickly
4. **Test with Sample Data** - Use `$source` with `documents` array for testing
5. **Monitor DLQ Collections** - Regularly review failed documents to identify patterns
6. **Use Meaningful Names** - Choose processor names that describe their function
7. **Document Complex Pipelines** - Add comments in sample data or external documentation

## Creating a Processor via API

Once you have your JSON definition with proper connection names, create it using:

```javascript
// In mongosh with Stream Processing access
const processorDef = JSON.parse(fs.readFileSync('your_processor.json', 'utf8'));

sp.createStreamProcessor(
  processorDef.name,
  processorDef.pipeline,
  processorDef.options
);

sp[processorDef.name].start();
```

## Example Processors

For detailed pipeline examples and specific use cases, explore the other processor examples in this repository:

- **simple_solar** - Basic processor with sample data
- **dynamicexpressions** - Dynamic routing based on document content
- **additive_merge** - Merging data with existing collections
- **sessionWindow** - Time-based windowing operations
- **interfacing_with_LLM** - External API integration
- And many more in the `example_processors` directory

## References

- [MongoDB Atlas Stream Processing Documentation](https://www.mongodb.com/docs/atlas/app-services/mongodb-stream-processing/)
- [Aggregation Pipeline Stages](https://www.mongodb.com/docs/atlas/app-services/mongodb-stream-processing/reference/operator/stage/)
- [Error Handling and DLQ](https://www.mongodb.com/docs/atlas/app-services/mongodb-stream-processing/manage-stream-processor/)
- [Connection Management](https://www.mongodb.com/docs/atlas/app-services/mongodb-stream-processing/manage-stream-processor/)