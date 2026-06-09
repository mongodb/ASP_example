# /kafka-to-asp

Convert one or more MongoDB Kafka managed connector configs to Atlas Stream Processing (ASP) processors.

**Arguments:** `$ARGUMENTS` — optional path(s) to connector config JSON file(s). If omitted, ask the user to paste the JSON or point you to their files.

---

## Role

You are converting Kafka managed connector configurations (MongoDbAtlasSource / MongoDbAtlasSink) to equivalent Atlas Stream Processing pipelines. This is a one-time migration. Use the `mongodb:atlas-stream-processing` skill and MongoDB MCP tools to create the actual ASP resources.

See the `samples/` directory alongside this file for annotated examples showing the full range of supported fields.

---

## Step 1 — Collect connector configs

If `$ARGUMENTS` contains file paths, read each file. Otherwise ask the user to paste their connector config JSON, or point you to files. Multiple configs can be provided as a JSON array or as separate objects.

Each config must have `connector.class` set to either `MongoDbAtlasSource` or `MongoDbAtlasSink`.

---

## Step 2 — Validate each config

Validate every config against these rules before proceeding. List all issues together before stopping — don't fail one field at a time.

### Required fields (all connectors)
- `name` — becomes the ASP processor name. Must match `[a-zA-Z0-9_-]+`.
- `connector.class` — `MongoDbAtlasSource` or `MongoDbAtlasSink`
- `kafka.api.key` — Kafka credential (API key OR OIDC client ID — see auth section)
- `kafka.api.secret` — Kafka credential (API secret OR OIDC client secret)
- `connection.user` — MongoDB Atlas username
- `connection.password` — MongoDB Atlas password
- `database` — database name

### Required for Source (MongoDbAtlasSource only)
- `topic.prefix` — prefix for the Kafka topic name

### Required for Sink (MongoDbAtlasSink only)
- `collection` — destination collection
- `topics` — Kafka topic(s) to consume (string or comma-separated list)

### Disallowed fields — note and skip gracefully
These have no ASP equivalent. Tell the user which were found and ignored:

`topic.namespace.map`, `schema.context.name`, `kafka.service.account.id` (for non-OIDC flows),
`header.converter`, `publish.full.document.only.tombstone.on.delete`,
`output.schema.infer.value`, `offset.partition.name`, `remove.field.on.schema.mismatch`,
`mongo.errors.deadletterqueue.topic.name`, `startup.mode.copy.existing.namespace.regex`,
`startup.mode.copy.existing.pipeline`, `startup.mode.timestamp.start.at.operation.time`,
`errors.deadletterqueue.topic.name`, `key.projection.type`, `key.projection.list`,
`value.projection.type`, `value.projection.list`, `namespace.mapper.*`, `timeseries.*`,
`ts.granularity`, `csfle.*`, `consumer.override.isolation.level`,
`value.converter.use.latest.version`, `value.converter.replace.null.with.default`,
`value.converter.schemas.enable`, `key.converter.*`

---

## Step 3 — Determine Kafka auth mode

Check `kafka.auth.mode` in the config (defaults to `KAFKA_API_KEY` if absent).

### KAFKA_API_KEY (default)
Use `kafka.api.key` and `kafka.api.secret` directly as credentials.
ASP Kafka connection will use `mechanism: "PLAIN"`.

### SERVICE_ACCOUNT / OIDC
Triggered when:
- `kafka.auth.mode` is `SERVICE_ACCOUNT`, or
- The config or user explicitly indicates OIDC / OAuth 2.0

In this case, ask the user for:
- **OIDC token endpoint URL** — e.g. `https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token` or Confluent's token URL
- **Client ID** — typically what `kafka.api.key` contains (or ask if different)
- **Client secret** — typically what `kafka.api.secret` contains (or ask if different)
- **Scope** (optional) — e.g. `api://confluent-kafka/.default` for Entra ID

Note: `kafka.service.account.id` is the Confluent service account resource ID and is not used in the ASP connection config. It can be safely ignored.

ASP Kafka connection for OIDC will use `mechanism: "OAUTHBEARER"` (see Step 5).

---

## Step 4 — Gather ASP workspace info

Ask the user (or discover via MCP):

1. **Project ID** — call `atlas-list-projects` if unknown
2. **ASP Workspace name** — call `atlas-streams-discover` → `list-workspaces`, or offer to create one
3. **Atlas cluster name** — the cluster for MongoDB source (change streams) or sink (writes)
4. **Kafka connection name** — what to name this connection in ASP (suggest: `kafka-<topic-prefix>`)
5. **MongoDB connection name** — what to name the cluster connection in ASP (suggest: `mongodb-<cluster-name>`)
6. **Confluent REST endpoint** — needed to derive bootstrap servers (e.g. `https://pkc-xxx.confluent.cloud:443`)

If the workspace doesn't exist, offer to create it at SP10 tier in the region closest to the Atlas cluster.

---

## Step 5 — Show the migration plan and confirm

Present a summary before creating anything:

```
Connections to create:
  Kafka:    <kafka-connection-name>  (mechanism: PLAIN or OAUTHBEARER)
  MongoDB:  <mongodb-connection-name> (cluster: <cluster-name>)

Processors to create:  (all will be created STOPPED)
  Name                   Type    Topic / Collection                   DLQ
  ─────────────────────────────────────────────────────────────────────────
  <name>                 source  <topic.prefix>.<db>.<coll>           yes/no
  <name>                 sink    <topics>  →  <db>.<collection>       yes/no

Fields ignored (not supported in ASP):
  <list if any>
```

Wait for explicit confirmation before creating anything.

---

## Step 6 — Create connections

Check first with `atlas-streams-discover` → `list-connections`. Skip creation if a connection with the same name already exists.

### Kafka connection — API key auth (PLAIN)
```json
{
  "connectionType": "Kafka",
  "authentication": {
    "mechanism": "PLAIN",
    "username": "<kafka.api.key>",
    "password": "<kafka.api.secret>"
  },
  "bootstrapServers": "<bootstrap-servers>",
  "config": {
    "auto.offset.reset": "earliest"
  },
  "security": {
    "protocol": "SASL_SSL"
  }
}
```

### Kafka connection — OIDC / OAuth 2.0 (OAUTHBEARER)
```json
{
  "connectionType": "Kafka",
  "authentication": {
    "mechanism": "OAUTHBEARER",
    "username": "<client-id>",
    "password": "<client-secret>"
  },
  "bootstrapServers": "<bootstrap-servers>",
  "config": {
    "auto.offset.reset": "earliest",
    "sasl.oauthbearer.token.endpoint.url": "<token-endpoint-url>",
    "sasl.oauthbearer.client.id": "<client-id>",
    "sasl.oauthbearer.client.secret": "<client-secret>",
    "sasl.oauthbearer.scope": "<scope>"
  },
  "security": {
    "protocol": "SASL_SSL"
  }
}
```
Omit `sasl.oauthbearer.scope` if the user didn't provide one.

**Deriving bootstrap servers from REST endpoint:** strip `https://` and replace `:443` with `:9092`.
Example: `https://pkc-abc.us-east-1.aws.confluent.cloud:443` → `pkc-abc.us-east-1.aws.confluent.cloud:9092`

### MongoDB connection
```json
{
  "connectionType": "Cluster",
  "clusterName": "<atlas-cluster-name>",
  "dbRoleToExecute": {
    "role": "readWriteAnyDatabase",
    "type": "BUILT_IN"
  }
}
```

---

## Step 7 — Build each processor pipeline

### Source processor (MongoDbAtlasSource → Atlas change stream → Kafka)

**Topic name construction:**
```
topic = topic.prefix + separator + database [+ separator + collection] [+ separator + topic.suffix]
```
- `topic.separator` defaults to `.`
- Omit `collection` segment if `collection` is not set (watches entire database)
- Omit `topic.suffix` segment if not set

**Pipeline:**
```json
[
  {
    "$source": {
      "connectionName": "<mongodb-connection-name>",
      "db": "<database>",
      "coll": "<collection>",
      "initialSync": { "enable": true },
      "config": {
        "fullDocument": "<change.stream.full.document>",
        "fullDocumentBeforeChange": "<change.stream.full.document.before.change>",
        "fullDocumentOnly": true,
        "pipeline": [...]
      }
    }
  },
  {
    "$emit": {
      "connectionName": "<kafka-connection-name>",
      "topic": "<constructed-topic-name>",
      "config": {
        "compression_type": "<producer.override.compression.type>",
        "outputFormat": "<mapped-output-format>"
      }
    }
  }
]
```

**Rules — only include optional fields when the connector config sets them:**
- `coll` — omit if `collection` not in connector config
- `initialSync` — include only if `startup.mode` is set (`copy_existing` → `true`, `latest` → `false`)
- `config` block in `$source` — omit entirely if none of `fullDocument`, `fullDocumentBeforeChange`, `fullDocumentOnly`, `pipeline` apply
- `fullDocument` — only if `change.stream.full.document` is set and not `default`
- `fullDocumentBeforeChange` — only if `change.stream.full.document.before.change` is set and not `default`
- `fullDocumentOnly: true` — only if `publish.full.document.only=true`
- `pipeline` — only if `pipeline` is set and non-empty (parse JSON string to array)
- `config` block in `$emit` — omit entirely if neither `compression_type` nor `outputFormat` apply
- `compression_type` — only if `producer.override.compression.type` is set (values: `none`, `gzip`, `snappy`, `lz4`, `zstd`)

**output.json.format mapping:**
| Connector value | ASP `outputFormat` |
|----------------|-------------------|
| `DefaultJson`  | `canonicalJson`   |
| `ExtendedJson` | `canonicalJson`   |
| `SimplifiedJson` | `relaxedJson`  |
| not set        | omit field        |

---

### Sink processor (MongoDbAtlasSink → Kafka → Atlas)

**Pipeline:**
```json
[
  {
    "$source": {
      "connectionName": "<kafka-connection-name>",
      "topic": "<topics>",
      "config": {
        "auto_offset_reset": "<consumer.override.auto.offset.reset>",
        "maxAwaitTimeMS": 60000
      }
    }
  },
  {
    "$merge": {
      "into": {
        "connectionName": "<mongodb-connection-name>",
        "db": "<database>",
        "coll": "<collection>"
      }
    }
  }
]
```

**Rules:**
- `config` block in `$source` — omit entirely if neither field applies
- `auto_offset_reset` — only if `consumer.override.auto.offset.reset` is set (`earliest` or `latest`)
- `maxAwaitTimeMS` — only if `max.poll.interval.ms` is set; convert to integer

---

### DLQ configuration

If `errors.tolerance=all`, add DLQ to the processor call:
```json
{
  "connectionName": "<mongodb-connection-name>",
  "db": "dlq",
  "coll": "<processor-name>"
}
```

---

## Step 8 — Create processors

Call `atlas-streams-build` with `resource: "processor"` for each. Use:
- `autoStart: false` — always. User must review and start manually.
- `dlq` — include only if `errors.tolerance=all`

After all processors are created, print a summary:

```
Migration complete.

Connections:
  ✓ <kafka-connection-name>   (PLAIN / OAUTHBEARER)
  ✓ <mongodb-connection-name>

Processors created (STOPPED — review pipeline before starting):
  ✓ <name>  [source]  →  topic: <topic>
  ✓ <name>  [sink]    ←  topics: <topics>  →  <db>.<collection>

Skipped (validation failures):
  ✗ <name>: <reason>

Next steps:
  1. Inspect each processor in the Atlas UI to confirm the pipeline looks correct
  2. Start with: atlas-streams-manage → start-processor (billing begins immediately)
  3. Monitor initial output before decommissioning the old Kafka connector
```

---

## Field mapping reference

| Connector field | ASP location | Notes |
|----------------|-------------|-------|
| `name` | `processorName` | |
| `database` | `$source.db` / `$merge.into.db` | |
| `collection` | `$source.coll` / `$merge.into.coll` | optional for source |
| `topics` | `$source.topic` | sink only |
| `topic.prefix` | start of `$emit.topic` | source only |
| `topic.separator` | separator in topic name | default `.` |
| `topic.suffix` | end of `$emit.topic` | optional |
| `change.stream.full.document` | `$source.config.fullDocument` | source |
| `change.stream.full.document.before.change` | `$source.config.fullDocumentBeforeChange` | source |
| `publish.full.document.only` | `$source.config.fullDocumentOnly` | source |
| `pipeline` | `$source.config.pipeline` | source; parse JSON string → array |
| `startup.mode=copy_existing` | `$source.initialSync.enable: true` | source |
| `startup.mode=latest` | `$source.initialSync.enable: false` | source |
| `producer.override.compression.type` | `$emit.config.compression_type` | source |
| `output.json.format` | `$emit.config.outputFormat` | source; see mapping table |
| `consumer.override.auto.offset.reset` | `$source.config.auto_offset_reset` | sink |
| `max.poll.interval.ms` | `$source.config.maxAwaitTimeMS` (int) | sink |
| `errors.tolerance=all` | `dlq` config block on processor | |
| `kafka.api.key` / `kafka.api.secret` | Kafka connection `username` / `password` | PLAIN auth |
| `kafka.auth.mode=SERVICE_ACCOUNT` | Kafka connection `mechanism: "OAUTHBEARER"` | requires token endpoint |
| `connection.user` / `connection.password` | MongoDB cluster connection credentials | not stored in pipeline |
