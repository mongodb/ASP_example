# $function Example

This example demonstrates using the `$function` operator in Atlas Stream Processing to execute custom JavaScript functions on streaming data.

## Overview

The pipeline reads solar panel data from a stream, applies a custom function to boost the wattage values by 20%, and materializes the results into a collection.

## Pipeline Stages

1. **$source**: Reads from the `sample_stream_solar` connection with timestamp parsing
2. **$addFields**: Uses `$function` to calculate a boosted wattage value (original watts * 1.2)
3. **$merge**: Materializes the results into the `MV_solar_boost_materialized_view` collection

## Key Feature: $function

The `$function` operator allows you to execute custom JavaScript code in your stream processing pipeline:

```javascript
{
  "$function": {
    "body": "function(watts) { return watts * 1.2; }",
    "args": ["$obs.watts"],
    "lang": "js"
  }
}
```

- **body**: The JavaScript function code as a string
- **args**: Array of arguments to pass to the function (using field paths from the document)
- **lang**: The language (currently only "js" is supported)

## Use Cases

Use `$function` when you need to:
- Perform complex calculations not available in standard aggregation operators
- Implement custom business logic
- Transform data using JavaScript logic
