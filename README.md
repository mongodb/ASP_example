# Atlas Stream Processing Example Repo

This repository serves as both a the human readable corpus of examples, but also a RAG optimized repository for code generation in AI development scenarios. This repository is the most up to date, has the most detailed examples, and context and is generated and vetting by the MongoDB internal PM and Engineering teams.

## Canonical Stream Processor Format

**All stream processor definitions in this repository follow a standardized JSON format:**

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

### Why This Format?

- ✅ **Portable**: Works consistently across MongoDB Shell, Admin API, Terraform, and all tools
- ✅ **Version Control Friendly**: JSON files can be tracked, diffed, and reviewed
- ✅ **Separation of Concerns**: Configuration (name) separate from logic (pipeline)
- ✅ **Reusable**: Easy to share, import, and adapt examples
- ✅ **AI-Friendly**: Clear structure for code generation and RAG

### Usage Examples

**Ephemeral (testing/development):**
```javascript
const def = JSON.parse(cat('processor.json'))
sp.process(def.pipeline)
```

**Persistent (production):**
```javascript
const def = JSON.parse(cat('processor.json'))
sp.createStreamProcessor(def.name, def.pipeline)
sp[def.name].start()
```

### Best Practices

- Store processor definitions as `.json` files
- Use descriptive names that indicate purpose (e.g., `kafka_to_mongo_rollup`)
- Use `connectionName` instead of hardcoded connection strings
- Include sink stages (`$merge`, `$emit`) for persistent processors
- Pipelines without sinks only work with `sp.process()` (ephemeral mode)

## Contributing
We encourage collaboration, anyone can open a pull request on this repository. Because this repository is a source for AI generated code we ask some simple best practices be followed:

* Keep example files short and name them descriptively (e.g., window_join_example.js, not sample2.js).
* Add thorough comments and docstrings in the sample repo
* **Use the canonical `{name, pipeline}` JSON format for all stream processor definitions**

## Structure
The structure for this repository is:
* [Code snippets](/code_snipplets) are example MQL solutions to specific problems.
* [Example procesors](/example_processors) are end to end Atlas Stream Processing Examples.
* [Terraform](/terraform) examples, explain Terraform usage with Atlas Stream Processing.
* [DB examples](/db) are examples for the MongoDB database in relation to Atlas Stream Processing.
* [Demo](/demo) is various self-contained demos.
