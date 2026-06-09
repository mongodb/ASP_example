# managed_kafka_connector_converter — Deprecated

This Python tool has been removed in favor of a Claude Code skill that accomplishes the same migration using the MongoDB MCP Server directly.

## Why it was replaced

The Python script required:
- Local Python environment and dependencies (`requests`, `mongosh`, Atlas CLI)
- Temp file management with security considerations around credentials
- Manual subprocess calls passing passwords on the command line
- Maintenance of CSV validation rule files in sync with connector behavior

Since migrating from Kafka connectors to Atlas Stream Processing is a **one-time operation**, a Claude Code skill is a better fit: it handles the conversion conversationally, uses the MongoDB MCP Server to make API calls directly (no local tooling required), and adapts to edge cases without script modifications.

## Use this instead

See [`ASP_tools/kafka-to-asp/`](../kafka-to-asp/) for the replacement skill.

### Quick start

1. Copy the slash command to your Claude Code commands directory:
   ```bash
   cp ASP_tools/kafka-to-asp/commands/kafka-to-asp.md ~/.claude/commands/kafka-to-asp.md
   ```

2. Open Claude Code in this repo and run:
   ```
   /kafka-to-asp samples/source-basic.json
   ```
   or paste your connector config JSON directly.

3. Claude will validate your config, show a migration plan, and create ASP connections and processors via the MongoDB MCP Server.

### Sample configs

See [`ASP_tools/kafka-to-asp/samples/`](../kafka-to-asp/samples/) for annotated examples:
- `source-basic.json` — MongoDbAtlasSource with API key auth
- `source-oidc.json` — MongoDbAtlasSource with OIDC / OAuth 2.0
- `sink-basic.json` — MongoDbAtlasSink

### Prerequisites

- Claude Code with the [MongoDB MCP Server](https://www.mongodb.com/docs/atlas/atlas-stream-processing/) configured
- Atlas API credentials in the MCP server config (`apiClientId`, `apiClientSecret`)
