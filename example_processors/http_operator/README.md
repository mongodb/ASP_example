# HTTP Operator ($https) Examples

This directory contains examples demonstrating the `$https` operator in Atlas Stream Processing for making external HTTP API calls and enriching streaming data with external information.

## Overview

The `$https` operator enables stream processors to:
- Make HTTP requests to external APIs
- Enrich streaming data with external information
- Chain multiple API calls within a single processor
- Handle authentication and error scenarios

## Prerequisites

### Required HTTPS Connections

Before using these processors, you must create HTTPS connections in your Atlas Stream Processing workspace:

1. Navigate to Stream Processing → Your Workspace → Connections
2. Click "Add Connection"
3. Select "HTTPS" as the connection type
4. Configure:
   - **Connection name** (referenced in processor)
   - **Base URL** for your API
   - **Authentication headers** (API keys, Bearer tokens, etc.)
5. Test and save the connection

**Replace ALL connection placeholder names with your actual connection names.**

## Example Processors

### 1. Generic API Enrichment (`generic_api_enrichment.json`)

**Purpose**: Demonstrates POST requests with JSON payloads to enrich user events with external data.

**Features**:
- Sources events from MongoDB collection
- Filters for user action events
- Makes POST request with custom JSON payload
- Extracts multiple fields from API response
- Handles errors with DLQ

**API Pattern**: POST request with request body constructed using `$project`

**Use Cases**: 
- User profile enrichment
- Risk scoring
- Recommendation services
- CRM system integration

### 2. Solar Data with Location Enrichment (`solar_fake_zipcode.json`)

**Purpose**: Chains two HTTP API calls to enrich solar device readings with fake location data and real solar irradiance data.

**Features**:
- Sources data from `sample_stream_solar` (built-in test data)
- **Chain 1**: FakerAPI for fake addresses (ZIP, city, coordinates)
- **Chain 2**: NREL API for real solar irradiance data using coordinates from Chain 1
- Combines multiple external data sources
- Demonstrates chained API enrichment pattern

**API Pattern**: Two sequential GET requests where output from first API becomes input to second API

**Use Cases**:
- Testing with realistic location data
- Demo environments
- Development workflows
- Performance analysis comparing actual vs. potential solar output

## Dead Letter Queue (DLQ) Configuration

Both example processors include comprehensive DLQ configuration to handle errors gracefully. The DLQ is a MongoDB collection where failed documents are stored for debugging and retry purposes.

### DLQ Structure in Processor Options

```json
{
  "options": {
    "dlq": {
      "connectionName": "YOUR_CONNECTION_NAME",
      "db": "your_database", 
      "coll": "your_dlq_collection"
    }
  }
}
```

### How DLQ Works

1. **Processor-Level DLQ**: Configured in `options.dlq`, catches any unhandled errors in the processor
2. **Stage-Level Error Handling**: Individual stages can specify `onError: "dlq"` to route specific failures
3. **Automatic Document Storage**: Failed documents are automatically written to the DLQ collection with metadata

### DLQ Document Structure

When a document fails processing, it's stored in the DLQ with additional context:

```json
{
  "_id": ObjectId("..."),
  "originalDocument": { 
    // The original document that failed processing
  },
  "processorName": "your_processor_name",
  "timestamp": ISODate("2024-01-23T10:30:00.000Z"),
  "error": {
    "message": "HTTP request failed: 500 Internal Server Error",
    "code": "HTTP_ERROR", 
    "stage": "$https",
    "details": {
      "statusCode": 500,
      "url": "https://api.example.com/endpoint"
    }
  }
}
```

### HTTP-Specific Error Handling

The `$https` operator supports three error handling strategies:

#### 1. Send to DLQ (Recommended)
```json
{
  "$https": {
    "connectionName": "YOUR_CONNECTION_NAME",
    "method": "GET",
    "onError": "dlq"
  }
}
```
**Behavior**: Failed HTTP requests are sent to DLQ, processing continues for other documents

#### 2. Discard Failed Requests
```json
{
  "$https": {
    "connectionName": "YOUR_CONNECTION_NAME", 
    "method": "GET",
    "onError": "discard"
  }
}
```
**Behavior**: Failed HTTP requests are dropped, no record kept (not recommended for production)

#### 3. Fail Pipeline (Default)
```json
{
  "$https": {
    "connectionName": "YOUR_CONNECTION_NAME",
    "method": "GET",
    "onError": "fail"
  }
}
```
**Behavior**: Any HTTP failure stops the entire processor (use with caution)

### Common HTTP Error Scenarios

The DLQ will capture documents that fail due to:

- **Network timeouts** - External API is slow or unreachable
- **HTTP errors** - 4xx client errors, 5xx server errors  
- **Authentication failures** - Invalid API keys or expired tokens
- **Rate limiting** - Too many requests to external API
- **Malformed responses** - Invalid JSON or unexpected response format
- **Connection issues** - DNS failures, SSL certificate problems

### Monitoring and Troubleshooting DLQ

#### Query Failed Documents
```javascript
// Find all recent failures
db.your_dlq_collection.find({
  "timestamp": { "$gte": new Date(Date.now() - 24*60*60*1000) }
}).sort({ "timestamp": -1 })

// Find failures by error type
db.your_dlq_collection.find({
  "error.code": "HTTP_ERROR"
})

// Find failures for specific HTTP status codes
db.your_dlq_collection.find({
  "error.details.statusCode": 500
})
```

#### Analyze Error Patterns
```javascript
// Group errors by type
db.your_dlq_collection.aggregate([
  { "$group": { 
    "_id": "$error.code", 
    "count": { "$sum": 1 },
    "examples": { "$push": "$error.message" }
  }},
  { "$sort": { "count": -1 }}
])
```

#### Retry Failed Documents
```javascript
// Get original document for manual retry
db.your_dlq_collection.findOne({
  "_id": ObjectId("...")
}).originalDocument
```

### DLQ Best Practices

1. **Always Configure DLQ** - Prevents data loss during API failures
2. **Use Meaningful Collection Names** - Include processor name and purpose  
3. **Monitor DLQ Size** - Set up alerts for growing DLQ collections
4. **Analyze Failure Patterns** - Regular review to identify systemic issues
5. **Implement Retry Logic** - Consider automated retry mechanisms for transient failures
6. **Set TTL on DLQ Collections** - Automatically clean up old failed documents
7. **Separate DLQ per Processor** - Makes troubleshooting easier

## Best Practices

1. **Configure Connection Properly** - Set base URLs and authentication in the connection, not in the processor
2. **Handle Errors Gracefully** - Use `onError: "dlq"` to capture failed requests for debugging
3. **Parse JSON Responses** - Always set `parseJsonStrings: true` for JSON APIs
4. **Rate Limiting** - Be aware of API rate limits; consider using windows for batch requests
5. **Security** - Store API keys in connection configuration, not in processor code
6. **Monitoring** - Monitor DLQ collections for failed HTTP requests
7. **Timeouts** - External APIs can be slow; configure appropriate timeouts in connection settings

## Performance Considerations

- The `$https` operator executes **per document**
- For high-volume streams, consider:
  - Batching requests using `$group` and `$window` stages
  - Using rate limiting on the API side
  - Implementing caching strategies
  - Using asynchronous processing patterns

## Common Use Cases

### Data Enrichment
- Geocoding addresses
- Weather data for locations
- Currency conversion rates
- Company information lookup
- **Fake data generation** - Adding mock ZIP codes, addresses, or other test data using services like FakerAPI

### Notifications
- Sending alerts to external systems
- Creating tickets in ITSM systems
- Triggering webhooks

### Validation
- Address validation
- Credit card verification
- Fraud detection

### Integration
- CRM system updates
- Third-party analytics
- External reporting systems

## Key $https Operator Concepts

### Basic Structure
```json
{
  "$https": {
    "connectionName": "YOUR_CONNECTION_NAME",
    "method": "GET",
    "path": "/api/endpoint", 
    "as": "api_response",
    "onError": "dlq",
    "config": {
      "parseJsonStrings": true
    }
  }
}
```

### Required Fields
- **connectionName** - HTTPS connection configured in workspace
- **method** - HTTP method (GET, POST, PUT, DELETE)
- **as** - Field name for storing API response

### Key Configuration Options
- **path** - API endpoint path
- **headers** - Additional HTTP headers (usually set in connection)
- **payload** - Request body for POST/PUT (constructed with aggregation pipeline)
- **onError** - Error handling: "dlq", "discard", "fail"
- **config.parseJsonStrings** - Parse JSON responses automatically

### Authentication
Authentication should be configured in the HTTPS connection settings, not in the processor code. This includes:
- API keys in headers
- Bearer tokens
- Basic authentication
- Custom authentication headers

### Response Processing
Access response data after the `$https` stage:
```json
{
  "$addFields": {
    "api_data": "$api_response.body",
    "status_code": "$api_response.statusCode",
    "success": { "$eq": ["$api_response.statusCode", 200] }
  }
}
```

## Best Practices

1. **Configure Connections Properly** - Store authentication in connection settings, not processor code
2. **Always Use DLQ** - Set `onError: "dlq"` to capture failed requests for debugging  
3. **Parse JSON Responses** - Set `config.parseJsonStrings: true` for JSON APIs
4. **Monitor DLQ Collections** - Regular review to identify API issues or rate limiting
5. **Handle Rate Limits** - Consider API rate limits when processing high-volume streams
6. **Clean Response Data** - Use `$project` to remove large API response objects after extracting needed data
7. **Use Meaningful Connection Names** - Makes processors more maintainable
8. **Test Error Scenarios** - Ensure DLQ works properly when APIs are unavailable

## Performance Considerations

### Per-Document Execution Pattern

**CRITICAL**: The `$https` operator executes **once per document** that flows through the pipeline. This means:

- **High-volume streams** can generate thousands of HTTP requests
- **Each document** triggers a separate API call
- **API rate limits** can be quickly exceeded
- **Costs** can accumulate rapidly with paid APIs

### Using Windows to Reduce HTTP Frequency

To reduce HTTP call frequency, place the `$https` operator **downstream of window stages**. This way, HTTP calls only happen when windows close/emit, not for every individual document.

#### Bad: HTTP per Document
```json
{
  "pipeline": [
    { "$source": { "connectionName": "sample_stream_solar" }},
    { "$match": { "device_id": { "$exists": true }}},
    {
      "$https": {
        "connectionName": "YOUR_API_CONNECTION",
        "method": "GET", 
        "path": "/api/current-weather",
        "as": "weather_data"
      }
    },
    {
      "$tumblingWindow": {
        "interval": { "size": 60, "unit": "second" },
        "pipeline": [
          { "$group": { "_id": "$device_id", "avg_temp": { "$avg": "$obs.temp" }}}
        ]
      }
    }
  ]
}
```
**Result**: HTTP call for **every** solar reading (potentially hundreds per minute)

#### Good: HTTP per Window
```json
{
  "pipeline": [
    { "$source": { "connectionName": "sample_stream_solar" }},
    { "$match": { "device_id": { "$exists": true }}},
    {
      "$tumblingWindow": {
        "interval": { "size": 60, "unit": "second" },
        "pipeline": [
          { "$group": { "_id": "$device_id", "avg_temp": { "$avg": "$obs.temp" }}}
        ]
      }
    },
    {
      "$https": {
        "connectionName": "YOUR_API_CONNECTION", 
        "method": "GET",
        "path": "/api/current-weather",
        "as": "weather_data"
      }
    }
  ]
}
```
**Result**: HTTP call only when **windows close** (once per minute per device)

### Window-Based HTTP Patterns

#### 1. Aggregated Data Enrichment
```json
{
  "$tumblingWindow": {
    "interval": { "size": 300, "unit": "second" },
    "pipeline": [
      { "$group": { 
        "_id": { "location": "$zipcode" },
        "total_power": { "$sum": "$obs.watts" },
        "device_count": { "$sum": 1 },
        "avg_temp": { "$avg": "$obs.temp" }
      }}
    ]
  }
}
```
Then make one HTTP call per location every 5 minutes instead of per device reading.

#### 2. Batch API Calls
```json
{
  "$tumblingWindow": {
    "interval": { "size": 60, "unit": "second" },
    "pipeline": [
      { "$group": {
        "_id": null,
        "device_readings": { "$push": "$$ROOT" },
        "total_devices": { "$sum": 1 }
      }}
    ]
  }
}
```
Then make one HTTP call with batched data every minute.

#### 3. Threshold-Based API Calls
```json
{
  "$tumblingWindow": {
    "interval": { "size": 30, "unit": "second" },
    "pipeline": [
      { "$group": { 
        "_id": "$device_id",
        "max_temp": { "$max": "$obs.temp" }
      }},
      { "$match": { "max_temp": { "$gt": 85 }}}
    ]
  }
}
```
Only make HTTP calls (e.g., alerts) when temperature thresholds are exceeded.

### API Rate Limit Management

#### Example Rate Limit Scenarios:
- **FakerAPI**: No limits (free)
- **NREL API**: 1,000 requests/hour = ~16 requests/minute  
- **Weather APIs**: Often 1,000-10,000 requests/day
- **Commercial APIs**: May charge per request

#### Calculation Example:
```
Solar data: 100 devices × 1 reading/second = 100 HTTP calls/second
Without windowing: 360,000 calls/hour (exceeds most rate limits)
With 5-minute windows: 1,200 calls/hour (manageable)
```

## References

- [MongoDB Atlas Stream Processing Documentation](https://www.mongodb.com/docs/atlas/atlas-stream-processing/)
- [HTTPS Connection Configuration](https://www.mongodb.com/docs/atlas/atlas-stream-processing/manage-stream-processor/)
- [FakerAPI Documentation](https://fakerapi.it/)  
- [NREL Solar Resource API](https://developer.nrel.gov/docs/solar/solar-resource-v1/)