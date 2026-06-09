---
name: kafka-to-asp
description: "Converts MongoDB Kafka managed connector configurations (MongoDbAtlasSource / MongoDbAtlasSink) to equivalent Atlas Stream Processing processors. One-time migration workflow: reads connector JSON, validates it, maps fields to ASP pipeline stages, and creates connections and processors via the MongoDB MCP Server. Requires MongoDB MCP Server with Atlas API credentials."
metadata:
  version: 1.0.0
  user-invocable: "true"
---

See [commands/kafka-to-asp.md](commands/kafka-to-asp.md) for the slash command definition.

## Installation

Copy `commands/kafka-to-asp.md` to `~/.claude/commands/kafka-to-asp.md` to make `/kafka-to-asp` available globally, or to `.claude/commands/kafka-to-asp.md` in any project for project-scoped use.

## What it does

Accepts one or more Kafka managed connector config files (or pasted JSON) and creates the equivalent Atlas Stream Processing resources:

- **MongoDbAtlasSource** → `$source` (Atlas change stream) + `$emit` (Kafka topic)
- **MongoDbAtlasSink** → `$source` (Kafka topic) + `$merge` (Atlas collection)

Uses the `mongodb:atlas-stream-processing` skill and MongoDB MCP tools under the hood.
