// Streaming Materialized View Pattern: Open Ticket Count per Priority (Simple)
//
// A minimal implementation of the Streaming Materialized View Pattern that
// maintains a running count of open support tickets per priority in
// the queue_stats collection. Three events are handled:
//
//   - New open ticket inserted              → open_count for that priority increments
//   - Open ticket resolved                  → open_count for that priority decrements
//   - Open ticket deleted (spam/duplicate)  → open_count for that priority decrements
//
// Priority escalations (P2 → P1 etc.) are out of scope here.
// See escalation-pipeline.mongodb.js for the version that handles them.
//
// Prerequisites:
//   1. changeStreamPreAndPostImages enabled on support_tickets (see setup.js)
//   2. An ASP connection named CONNECTION_NAME registered in your stream
//      processing instance pointing at your Atlas cluster
//   3. Load and run via the ASP control plane connection in mongosh

const CONNECTION_NAME = "MyAtlas"; // replace with your ASP connection name

const pipeline = [
  // Stage 1: Read from the support_tickets change stream.
  // Note: initialSync is not compatible with windowing stages in ASP — queue_stats
  // starts empty and accumulates from the moment the processor starts.
  {
    $source: {
      connectionName: CONNECTION_NAME,
      db: "support",
      coll: "support_tickets",
      config: {
        fullDocument: "updateLookup",
        fullDocumentBeforeChange: "whenAvailable"
      }
    }
  },

  // Stage 2: Compute a _delta value and extract _priority for grouping.
  // Insert of an open ticket   → +1
  // Resolution of open ticket  → -1
  // Everything else            → 0 (filtered in stage 3)
  {
    $addFields: {
      _delta: {
        $switch: {
          branches: [
            {
              case: {
                $and: [
                  { $eq: ["$operationType", "insert"] },
                  { $eq: ["$fullDocument.status", "open"] }
                ]
              },
              then: 1
            },
            {
              case: {
                $and: [
                  { $eq: ["$operationType", "update"] },
                  { $eq: ["$fullDocumentBeforeChange.status", "open"] },
                  { $eq: ["$fullDocument.status", "resolved"] }
                ]
              },
              then: -1
            },
            // Open ticket physically deleted (spam or duplicate)
            {
              case: {
                $and: [
                  { $eq: ["$operationType", "delete"] },
                  { $eq: ["$fullDocumentBeforeChange.status", "open"] }
                ]
              },
              then: -1
            }
          ],
          default: 0
        }
      },
      _priority: {
        $ifNull: ["$fullDocument.priority", "$fullDocumentBeforeChange.priority"]
      }
    }
  },

  // Stage 3: Drop events that don't affect the count (e.g. a support agent
  // appending a response to updates[], or an in_progress status change).
  {
    $match: { _delta: { $ne: 0 } }
  },

  // Stage 4: Aggregate deltas into per-priority counts within each 1-second window.
  // windowStart is emitted alongside the count so the merge stage can use it as
  // a high-water mark to guard against at-least-once replay.
  {
    $tumblingWindow: {
      interval: { size: 1, unit: "second" },
      pipeline: [
        {
          $group: {
            _id: "$_priority",
            open_count: { $sum: "$_delta" },
            windowStart: { $first: { $meta: "stream.window.start" } }
          }
        }
      ]
    }
  },

  // Stage 5: Apply the windowed delta to the running total in queue_stats.
  // whenMatched guards against at-least-once replay using a lastWindowStart
  // high-water mark: the delta is only applied if the incoming window is strictly
  // newer than the last one recorded. A replayed window fails the $gt check and
  // is silently skipped, preventing double-counting.
  // whenNotMatched inserts a new document for priority buckets seen for the first time.
  {
    $merge: {
      into: {
        connectionName: CONNECTION_NAME,
        db: "support",
        coll: "queue_stats"
      },
      whenMatched: [
        {
          $set: {
            open_count: {
              $cond: [
                { $gt: ["$$new.windowStart", { $ifNull: ["$lastWindowStart", new Date(0)] }] },
                { $add: ["$open_count", "$$new.open_count"] },
                "$open_count"
              ]
            },
            lastWindowStart: {
              $max: [{ $ifNull: ["$lastWindowStart", new Date(0)] }, "$$new.windowStart"]
            }
          }
        }
      ],
      whenNotMatched: "insert"
    }
  }
];

sp.createStreamProcessor("queue_stats_simple", pipeline, {
  dlq: {
    connectionName: CONNECTION_NAME,
    db: "support",
    coll: "queue_stats_dlq"
  }
});
