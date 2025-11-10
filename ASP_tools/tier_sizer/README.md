# Stream Processor Tier Recommender Script

## Overview

This script is designed to be run in a `mongosh` environment (or the MongoDB VSCode Plugin) that has access to the Stream Processing (`sp`) shell API.

Its primary purpose is to:

1. List all available stream processors.

2. Fetch the `memoryUsageBytes` statistic for each running processor.

3. Recommend the smallest, most cost-effective Stream Processing (SP) tier (e.g., `SP2`, `SP5`, `SP10`) for each processor based on its current memory usage.

4. Print a formatted table of all processors, their memory usage, and the tier recommendation to the console.

## Requirements

* **`mongosh`:** The script must be run in an environment where the `sp` object and its methods (`sp.listStreamProcessors()`, `sp.PROCESSOR_NAME.stats()`) are available.

* **Permissions:** The user running the script must have sufficient permissions to list processors and view their stats.

## Configuration

You can configure the script's recommendation logic by changing one constant at the top of the file:

* `RECOMMENDATION_PERCENT_THRESHOLD`: This is the target memory usage percentage (as a decimal) that the script aims for. The script will find the smallest tier where the processor's current memory usage is at or below this percentage of the tier's total capacity.

  * **Default:** `0.70` (i.e., 70%)

## How It Works

1. **SP Tiers:** The script begins by defining the available SP tiers and their total memory in bytes.

2. **Fetch Names:** It calls `getStreamProcessorNames()` to get a simple array of all processor names (e.g., `["solardemo", "iot_data"]`).

3. **Iterate and Get Stats:** It loops through each name. For each processor, it carefully:

   * Gets the processor object (e.g., `sp.solardemo`).

   * Calls the `.stats()` function using `processor.stats.call(processor)` to avoid common shell API errors.

   * Safely extracts the `memoryUsageBytes` value.

   * Correctly handles memory usage values that are `Long()` objects (common in `mongosh`) by converting them to standard JavaScript `number`s.

4. **Get Recommendation:** The script passes the memory usage number to the `getTierRecommendation()` function. This function calculates the smallest tier that satisfies the `RECOMMENDATION_PERCENT_THRESHOLD` and returns the recommended tier name and the *actual* percentage of that tier that would be used.

5. **Print Report:** Finally, it prints a formatted line to the console for each processor.

## Output Format

The script prints a header followed by a CSV-style list, one for each processor.

**Example Output:**

```
Stream Processor Memory & Tier Recommendations (Targeting <= 70% usage):
Processor, Recommended Tier, Memory Usage, % Used of Tiers
solardemo, SP2, 205,520,896 bytes, 38.3%
iot_data, No stats available, N/A, N/A
data_pipeline, SP5, 750,123,456 bytes, 69.9%
heavy_processor, No suitable tier (Larger than SP50), 40,123,456,789 bytes, N/A
```


## Error & State Handling

The script is designed to run without crashing, even when processors are in different states:

* **Running Processor:** Shows the full recommendation (e.g., `solardemo`).

* **Stopped or Errored Processor:** If a processor is stopped, in an error state (like an SSL error), or simply doesn't return stats, it will be listed with `No stats available` (e.g., `iot_data`).

* **Usage Too High:** If a processor's memory usage is so high that even the largest tier (`SP50`) isn't big enough to meet the 70% target, it will be noted as `No suitable tier` (e.g., `heavy_processor`).
