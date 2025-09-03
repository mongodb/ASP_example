# MongoDB Atlas Stream Processing - Managed Kafka Connector Converter Tool

This tool enable you create Atlas Stream Processing (ASP) stream processors using Confluent managed connector configuration files.  It's designed to be used by MongoDB field teams to easily help their customers test ASP.  Customers are welcome to use it without the support of MongoDB field teams.

## Overview

To use this project you create a main configuration file with a few MongoDB Atlas-specific fields, and then run `python create_processors.py {main_config_file} {stream_processor_config_location/}`.  It will then will automatically create stream processors that you can start running to stream data from MongoDB Atlas clusters to Kafka topics or the reverse.  

## Architecture

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   MongoDB       │    │   MongoDB Atlas     │    │   Apache Kafka  │
│   Collections   │◄──►│ Stream Processing   │◄──►│     Topics      │
│                 │    │                     │    │                 │
└─────────────────┘    └─────────────────────┘    └─────────────────┘
```

## Getting Started

### Prerequisites

- Python 3.6 or higher
- MongoDB Shell (mongosh) installed and in PATH
- MongoDB Atlas CLI installed and authenticated (`atlas auth login`)
- Internet connection for API calls to Confluent Cloud and MongoDB Atlas

### Installation

1. **Clone the project**:
   ```bash
   git clone <repository-url>
   cd kafka_connector_to_atlas_stream_processing
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Quick Start

0. **Create an Atlas Stream Processing Instance** if you don't already have one.  You'll need the stream processing instance url for the next step.
1. **Configure your main settings** in a main configuration file (see [Main Configuration](#main-configuration) below)
2. **Create configuration files for each processor** you want to create.  You can have one processor for one or more collections or topics (see [Connector Configurations](#connector-configurations) below)
3. **Run the create processor command**:
   ```bash
   # to create many processors
   python3 create_processors.py <main_config_file.json> <folder_with_processor_configs/>

   # to create a single process
   python3 create_processors.py <main_config_file.json> <process_config.json>
   ```

## Main Configuration

The main configuration file contains settings for your MongoDB Atlas and Confluent Cloud environments. This file is passed as the first argument to the processing scripts.

### Required Fields

### Field Descriptions

| Field | Description | Example |
|-------|-------------|---------|
| `confluent-cluster-id` | Your Confluent Cloud Kafka cluster ID | `"lkc-12345"` |
| `confluent-rest-endpoint` | Confluent Cloud REST API endpoint | `"https://pkc-abc123.us-west-2.aws.confluent.cloud:443"` |
| `mongodb-stream-processor-instance-url` | MongoDB Atlas Stream Processing instance URL | `"mongodb://cluster0-shard-00-00.mongodb.net:27017"` |
| `kafka-connection-name` | Name for the shared Kafka connection | `"kafka-connection"` |
| `mongodb-connection-name` | Name for the shared MongoDB connection | `"mongodb-connection"` |
| `mongodb-cluster-name` | Name of your MongoDB Atlas cluster | `"Cluster0"` |
| `mongodb-group-id` | MongoDB Atlas project/group ID | `"507f1f77bcf86cd799439011"` |
| `mongodb-tenant-name` | MongoDB Atlas organization/tenant name | `"MyTenant"` |
| `mongodb-connection-role` | Database role for MongoDB connection | `"readWrite"` |

### How to Find These Values

#### Confluent Cloud Values
- **Cluster ID**: Found in Confluent Cloud console under Cluster Settings
- **REST Endpoint**: Found in Cluster Settings → Endpoints section

#### MongoDB Atlas Values  
- **Stream Processor URL**: Found in Atlas Stream Processing section
- **Cluster Name**: Your Atlas cluster name (e.g., "Cluster0")
- **Group ID**: Found in Project Settings → General
- **Tenant Name**: Your Atlas organization name
- **Connection Role**: Database user role (typically "readWrite" or "readWriteAnyDatabase")

### Example Main Config

```json
{
    "confluent-cluster-id": "lkc-12345",
    "confluent-rest-endpoint": "https://pkc-abc123.us-west-2.aws.confluent.cloud:443",
    "mongodb-stream-processor-instance-url": "mongodb://cluster0-shard-00-00.mongodb.net:27017",
    "kafka-connection-name": "kafka-connection",
    "mongodb-connection-name": "mongodb-connection", 
    "mongodb-cluster-name": "Cluster0",
    "mongodb-group-id": "507f1f77bcf86cd799439011",
    "mongodb-tenant-name": "MyTenant",
    "mongodb-connection-role": "readAndWriteAnyDatabase"
}
```

## Connector Configurations

Create individual JSON configuration files for each source or sink connector you want to deploy. These follow the standard Confluent connector format but are validated for MongoDB Atlas Stream Processing compatibility.

### General Configurations

### General Configurations

These fields are common to both source and sink connectors:

| Field | Description | Required | Default | Example |
|-------|-------------|----------|---------|---------|
| `connection.password` | MongoDB Atlas connection password. | Yes | `N/A` | `your-secret` |
| `connection.user` | MongoDB Atlas connection user. | Yes | `N/A` | `dbuser` |
| `connector.class` | Identifies the connector plugin name. MongoDbAtlasSource streams data from MongoDB to Kafka topics.<br><br>MongoDbAtlasSink streams data from Kafka topics to MongoDB. | Yes | `N/A` | `MongoDbAtlasSource` |
| `database` | MongoDB Atlas database name. If not set, all databases in the cluster are watched. | Yes | `N/A` | `orders` |
| `kafka.api.key` | Kafka API Key. Required to connect to your Kafka cluster. | Yes | `N/A` | `your-api-key` |
| `kafka.api.secret` | Secret associated with Kafka API key. | Yes | `N/A` | `your-secret` |
| `name` | Sets a name for your stream processor. | Yes | `N/A` | `my-processor` |
| `collection` | Single MongoDB Atlas collection to watch. If not set, all collections in the specified database are watched. | No | `N/A` | `transactions` |
| `errors.tolerance` | Use this property if you would like to configure the connector's error handling behavior.<br><br>If you set this property to 'all', the connector will not fail on errant records, but will instead store them and their error messages in your Atlas cluster in a collection named dlq.<your-stream-processor-name>.<br><br>If you set this property to 'ignore', the connector will discard errant records and keep processing new ones. | No | `all` | `all` |

### Source-Specific Configurations

These fields are specific to source connectors (MongoDB → Kafka):

| Field | Description | Required | Default | Example |
|-------|-------------|----------|---------|---------|
| `change.stream.full`<br>`document` | Setting that controls whether a change stream source should return a full document, or only the changes when an update occurs.<br><br>Must be one of the following:<br>- updateLookup : Returns only changes on update.<br>- required : Must return a full document.<br><br>If a full document is unavailable, returns nothing.<br>- whenAvailable : Returns a full document whenever one is available, otherwise returns changes.<br><br>If you do not specify a value for fullDocument, it defaults to updateLookup.<br><br>To use this field with a collection change stream, you must enable change stream Pre- and Post-Images on that collection. | No | `updateLookup` | `updateLookup` |
| `change.stream.full`<br>`document.before.change` | Specifies whether a change stream source should include the full document in its original "before changes" state in the output.<br><br>Must be one of the following:<br>- off : Omits the fullDocumentBeforeChange field.<br>- required : Must return a full document in its before changes state.<br><br>If a full document in its before changes state is unavailable, the stream processor fails.<br>- whenAvailable : Returns a full document in its before changes state whenever one is available, otherwise omits the fullDocumentBeforeChange field.<br><br>If you do not specify a value for fullDocumentBeforeChange, it defaults to off.<br><br>To use this field with a collection change stream, you must enable change stream Pre- and Post-Images on that collection. | No | `off` | `off` |
| `output.json.format` | The output format of json strings can be configured to be either: DefaultJson: The legacy strict json formatter.<br><br>ExtendedJson: The fully type safe extended json formatter.<br><br>SimplifiedJson: Simplified Json, with ObjectId, Decimals, Dates and Binary values represented as strings.<br><br>Defaults to DefaultJson Note.<br><br>DefaultJson is mapped to Atlas Stream Processing's canonicalJson format as a conservative choice to preserve type information, though there may be minor differences in how certain data types (like dates) are represented between the two formats. | No | `DefaultJson` | `DefaultJson` |
| `publish.full.document`<br>`only` | Setting that controls whether a change stream source returns the entire change event document including all metadata, or only the contents of fullDocument.<br><br>If set to true, the source returns only the contents of fullDocument.<br><br>To use this field with a collection change stream, you must enable change stream Pre- and Post-Images on that collection. | No | `FALSE` | `FALSE` |
| `topic.prefix` | Prefix to prepend to table names to generate the name of the Apache Kafka topic to publish data to. | Yes | `N/A` | `ecommerce` |
| `startup.mode` | Specifies how the connector should start up when there is no source offset available.<br><br>Must be one of the following:<br>- latest: The connector ignores all existing source data<br>- copy_existing: The connector copies all existing source data to Change Stream events<br><br>If not specified, defaults to latest behavior. | No | `latest` | `latest` |
| `pipeline` | An array of JSON objects describing the pipeline operations to filter or modify the change events output.<br><br>For example, [{"\$match": {"ns.coll": {"\$regex": /^(collection1\|collection2)\$/}}}] will set your source connector to listen to the "collection1" and "collection2" collections only. | No | `[]` | `value` |
| `producer.override`<br>`compression.type` | The compression type for all data generated by the producer. Can be none, gzip, snappy, lz4, or zstd. Defaults to none. | No | `none` | `none` |
| `topic.separator` | Separator to use when joining prefix, database, collection, and suffix values.<br><br>This generates the name of the Kafka topic to publish data to Used by the 'DefaultTopicMapper'. | No | `.` | `.` |
| `topic.suffix` | Suffix to append to database and collection names to generate the name of the Kafka topic to publish data to. | No | `N/A` | `ecommerce.orders` |

### Sink-Specific Configurations

These fields are specific to sink connectors (Kafka → MongoDB):

| Field | Description | Required | Default | Example |
|-------|-------------|----------|---------|---------|
| `topics` | Identifies the topic name or a comma-separated list of topic names. | Yes | `N/A` | `ecommerce.orders` |
| `consumer.override.auto`<br>`offset.reset` | Defines the behavior of the consumer when there is no committed position (which occurs when the group is first initialized) or when an offset is out of range.<br><br>You can choose either to reset the position to the "earliest" offset or the "latest" offset (the default). | No | `N/A` | `latest` |

## Configuration Validation

The tools include automatic configuration validation to ensure your connector configurations are compatible with MongoDB Atlas Stream Processing.

### How It Works

1. **Auto-Detection**: The system automatically detects whether your configuration is for a source or sink connector by examining the `connector.class` field
2. **Comprehensive Validation**: Validates all configuration properties against MongoDB Atlas Stream Processing requirements
3. **Clear Error Messages**: Provides specific guidance on configuration issues

### Validation Types

- **Required Fields**: Must be present (e.g., `name`, `connector.class`, `database`)
- **Unsupported Fields**: Will cause validation to fail if present (e.g., certain timeseries parameters)
- **Restricted Values**: Only specific values are allowed (e.g., `kafka.auth.mode` must be `KAFKA_API_KEY`)

### Example Validation

```python
# Configuration is automatically validated
{
    "connector.class": "MongoSourceConnector",
    "name": "my-source-connector",
    "kafka.auth.mode": "KAFKA_API_KEY",  # ✅ Supported value
    "database": "mydb",                   # ✅ Required field
    "timeseries.field": "timestamp"       # ❌ Unsupported field
}
```

If validation fails, you'll get clear error messages like:
- `Missing required fields: database, topic.prefix` (for sources)
- `Missing required fields: database, collection, topics` (for sinks) 
- `The following fields are not supported: timeseries.field`
- `Only KAFKA_API_KEY is supported for kafka.auth.mode`

## Authentication & Permissions

### MongoDB Atlas

- **Atlas CLI**: Must be authenticated with `atlas auth login`
- **Database User**: Requires appropriate read/write permissions for target databases
- **Stream Processing**: User must have Stream Processing Owner role

### Confluent Cloud

- **API Keys**: Required for Kafka cluster access
- **REST API**: Used for topic management (source tool only)

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify Atlas CLI authentication: `atlas auth whoami`
   - Check database user permissions
   - Validate API key/secret pairs

2. **Connection Issues**:
   - Verify stream processor instance URL format
   - Check network connectivity to both MongoDB Atlas and Confluent Cloud
   - Validate cluster IDs and endpoints

3. **Configuration Errors**:
   - Validate JSON syntax in configuration files
   - Ensure all required fields are present
   - Check field value formats and constraints

### Getting Help

For script-specific issues:
- Check the script output for detailed error messages
- Run unit tests to verify your environment: `cd tests && python3 run_tests.py --unit-only`
- Use verbose mode for more detailed logging: `python3 create_source_processors.py config.json sources/ -v`

For detailed technical information, see [`docs/DEVELOPER.md`](docs/DEVELOPER.md).

## API References

The tools interact with the following APIs:

- **[MongoDB Atlas CLI](https://www.mongodb.com/docs/atlas/cli/stable/)**: Connection and stream processor management
- **[MongoDB Shell (mongosh)](https://www.mongodb.com/docs/mongodb-shell/)**: Stream processor creation and management
- **[Confluent REST API](https://docs.confluent.io/platform/current/kafka-rest/api.html)**: Topic management (source tool only)
- **[MongoDB Atlas Stream Processing](https://www.mongodb.com/docs/atlas/atlas-stream-processing/)**: Core streaming platform

## Contributing

Feel free to submit issues and enhancement requests! When contributing:

1. **Run the test suite** to ensure your changes don't break existing functionality:
   ```bash
   cd tests && python3 run_tests.py -v
   ```
2. **Add tests** for new functionality in the `tests/unit/` or `tests/integration/` directories
3. **Test changes** with both source and sink scripts
4. **Update relevant documentation** (both user and developer docs)
5. **Ensure backward compatibility** with existing configurations

For detailed development guidelines, see [`docs/DEVELOPER.md`](docs/DEVELOPER.md).

## License

This project is provided as-is for educational and development purposes.

---

**Note**: These tools create production-ready streaming pipelines. Ensure you have proper monitoring, alerting, and backup strategies in place before using in production environments.
