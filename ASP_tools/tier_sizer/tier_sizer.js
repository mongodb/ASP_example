/**
 * Run this script in mongosh or vscode with the MongoDB VSCode Plugin
 * This script assumes the existence of a function `sp.listStreamProcessors()`
 * which returns an array of objects, where each object has a 'name' property.
 *
 * It also assumes that for each processor name, a stats object can be fetched via
 * `sp[PROCESSOR_NAME].stats().stats.memoryUsageBytes`.
 *
 * Example structure returned by sp.listStreamProcessors():
 * [
 * { "name": "processor_one", "id": "uuid-123", "status": "running" },
 * { "name": "processor_two", "id": "uuid-456", "status": "stopped" },
 * { "name": "data_ingest", "id": "uuid-789", "status": "running" }
 * ]
 */

// --- Configuration ---
/**
 * The desired percentage (as a decimal) of memory usage to target.
 * The script will recommend the smallest tier where the processor's memory
 * is this percentage or less of the tier's total.
 *
 * To ensure system stability, Stream Processing reserves 20% of memory for 
 * overhead. User processes are limited to the remaining 80% of the tier memory. 
 * Any process that exceeds this 80% threshold will be terminated, so please 
 * calculate your memory usage to stay within this limit.
 *
 * Example: 0.70 = 70%
 */
const RECOMMENDATION_PERCENT_THRESHOLD = 0.70; // Defaulting to 70%

// --- SP Tiers Definition ---
// Converted from the input array for easier use.
const SP_TIERS = [
  { name: "SP2", bytes: 536870912 },
  { name: "SP5", bytes: 1073741824 },
  { name: "SP10", bytes: 2147483648 },
  { name: "SP30", bytes: 8589934592 },
  { name: "SP50", bytes: 34359738368 }
];
// We assume SP_TIERS is sorted by size, which it is.

/**
 * Lists all stream processor names.
 *
 * This function calls `sp.listStreamProcessors()`, extracts the 'name'
 * from each processor object, and returns an array of names.
 *
 * @returns {string[]} An array of stream processor names.
 */
function getStreamProcessorNames() {
  try {
    // 1. Call the function to get the array of processor objects
    const processors = sp.listStreamProcessors();

    // 2. Use the .map() method to create a new array containing only the names
    // 3. Store all names in the 'processorNames' array
    const processorNames = processors.map(processor => processor.name);

    return processorNames;

  } catch (error) {
    console.error("Failed to list stream processors:", error);
    return []; // Return an empty array on failure
  }
}

/**
 * Finds the smallest SP tier where the given memory usage is at or below
 * the RECOMMENDATION_PERCENT_THRESHOLD.
 *
 * @param {number} memoryUsageBytes - The memory usage to check.
 * @returns {object | null} An object { name, bytes, percentUsed } or null if no tier fits.
 */
function getTierRecommendation(memoryUsageBytes) {
  // We need to find the smallest tier where:
  // memoryUsageBytes <= tier.bytes * RECOMMENDATION_PERCENT_THRESHOLD
  // which is equivalent to:
  // (memoryUsageBytes / RECOMMENDATION_PERCENT_THRESHOLD) <= tier.bytes
  const requiredMinBytes = memoryUsageBytes / RECOMMENDATION_PERCENT_THRESHOLD;

  for (const tier of SP_TIERS) {
    if (tier.bytes >= requiredMinBytes) {
      // This is the first (smallest) tier that fits
      const percentUsed = (memoryUsageBytes / tier.bytes) * 100;
      return {
        name: tier.name,
        bytes: tier.bytes,
        percentUsed: percentUsed.toFixed(1) // Format to 1 decimal place
      };
    }
  }

  // If no tier is large enough
  return null;
}

// --- Main execution ---

// Fetch the names
const names = getStreamProcessorNames();

console.log(`Stream Processor Memory & Tier Recommendations (Targeting <= ${RECOMMENDATION_PERCENT_THRESHOLD * 100}% usage):`);
console.log("-------------------------------------------------");
console.log("Processor, Recommended Tier, Memory Usage, % Used of Tier");

// Loop through each name, get stats, and print recommendations
names.forEach(name => {
  try {
    // 1. Explicitly get the processor object from the 'sp' namespace
    const processor = sp[name];

    // 2. Check if the processor and its .stats method exist
    if (typeof processor?.stats !== 'function') {
      console.log(
        `${name}, No stats available, N/A, N/A`
      );
      // 'continue' is not allowed in forEach, so we just return to stop this iteration
      return; 
    }

    // 3. Call the stats function, explicitly setting its 'this' context to 'processor'
    // This is the crucial fix for shell API proxy errors.
    const statsResult = processor.stats.call(processor);

    // 4. Get the value from the stats result.
    // This value could be undefined, a 'number', or a 'Long' object.
    const memUsageValue = statsResult?.stats?.memoryUsageBytes;

    let memoryUsageNumber = null;

    // 5. Convert the value to a plain JavaScript number
    if (typeof memUsageValue === 'number') {
      // Case 1: It's already a native JavaScript number
      memoryUsageNumber = memUsageValue;
    } else if (typeof memUsageValue === 'object' && memUsageValue !== null && typeof memUsageValue.toNumber === 'function') {
      // Case 2: It's a Long() object. Convert it.
      memoryUsageNumber = memUsageValue.toNumber();
    }

    // 6. Check if we successfully got a number
    if (typeof memoryUsageNumber === 'number' && !isNaN(memoryUsageNumber)) {
      // 7. Compare value and get recommendation
      const recommendation = getTierRecommendation(memoryUsageNumber);

      // 8. Print out the result
      if (recommendation) {
        console.log(
          `${name}, ${recommendation.name}, ${memoryUsageNumber.toLocaleString()} bytes, ${recommendation.percentUsed}%`
        );
      } else {
        console.log(
          `${name}, No suitable tier (Larger than SP50), ${memoryUsageNumber.toLocaleString()} bytes, N/A`
        );
      }
    } else {
      // This handles cases where stats are missing (e.g., stopped/partial processor)
      console.log(
        `${name}, No stats available, N/A, N/A`
      );
    }

  } catch (error) {
    // This handles cases where the .stats() call itself throws an error (e.g., API error)
    // We will just report that stats are unavailable, as requested.
    console.log(
      `${name}, No stats available, N/A, N/A`
    );
  }
});

// Example of how to print them one by one, if needed:
// console.log("\nIndividual names:");
// names.forEach(name => console.log(name));
