When determining the appropriate tier for your stream processor, several factors require careful consideration. The following points represent common considerations for tier selection.

# Memory Use
To ensure system stability, Stream Processing reserves 20% of memory for  overhead. User processes are limited to the remaining 80% of the tier memory.  Any process that exceeds this 80% threshold will be terminated, so please  calculate your memory usage to stay within this limit. 

Memory usage is measured using: `memoryUsageBytes`. To estimate the maximum memory required for appropriate stream processor tier selection, it is necessary to query this statistic multiple times over a period.


## memoryUsageBytes
This represents the total amount of memory that the stream processor is using. This value should be used to determine which stream processing tier the processor can be run on that will still have 20% of its memory free for overhead.

### Note on Stream Processing Workspaces 
### (Only for processors on SP10 & SP30 Tiers until December 3rd, 2025):
Currently, Stream Processing Workspaces utilizing the SP10 or SP30 tiers operate on a shared worker model, where up to four processors may run concurrently on a single "worker." This results in a cumulative memoryUsageBytes value for the shared worker.

To identify which processors are allocated to a specific worker, use the `sp.listStreamProcessors` command, which displays the assigned worker. While imperfect, a general estimate of the memory usage per processor can be obtained by dividing the cumulative memoryUsageBytes by the number of processors on that worker. This estimation can assist with general sizing considerations.

### Important Change:
This shared architecture will transition to a new model on December 3rd, 2025. After this date, each processor will run on its own dedicated resource, thus voiding the relevance of this note.


## Investigating Latency
If a processor exhibits high end-to-end latency, a good practice is to examine its statistics to pinpoint the stage causing the delay. The command `sp.PROCESSORNAME.stats({verbose:true})` provides detailed statistics, similar to an explain plan for a database query.

The output will contain "Operator stats" for the processor's various parts, each including a latency section. This section provides the p50 and p99 values in microseconds, the number of events in the sample, and the start and end times of the measurement.

For clarity, p50 (50th percentile) means that 50% of requests are faster than this number, and 50% are slower. Similarly, p99 (99th percentile) indicates that 99% of requests are faster than this number, with only 1% being slower.

```
{
        name: 'ValidateOperator',
        inputMessageSize: 0,
        dlqMessageCount: Long('3751'),
        dlqMessageSize: 1285848,
        stateSize: 0,
        maxMemoryUsage: 0,
        executionTimeMillis: Long('153'),
        latency: {
          p50: 11,
          p99: 93,
          count: Long('17070'),
          sum: 306134,
          unit: 'microseconds',
          start: ISODate('2025-11-13T12:00:34.672Z'),
          end: ISODate('2025-11-13T14:22:55.342Z')
        },
        inputMessageCount: Long('17070'),
        outputMessageCount: Long('13319'),
        outputMessageSize: 0
      } 
      ```

## Parallelism Settings in Stages
To enhance performance, certain stages in the data processing pipeline, such as `$merge` or `$lookup` (and more,)  support a parallelism value that enables concurrent operations. The maximum cumulative parallelism allowed across all stages is dependent on the specific tier being used, and details can be found in the documentation here. Increasing the parallelism value for supporting stages can lead to improved performance.

```
{ $merge: {
                    into: {
                        connectionName: 'jsncluster0',
                        db: 'test',
                        coll: 'replicate_test'
                    },
                    whenMatched: "merge",
                    whenNotMatched: "insert",
                    parallelism : 4
} }
```



