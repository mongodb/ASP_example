// Streaming Materialized View: Open Ticket Count per Priority (with Escalation)
//
// Extends simple-pipeline.mongodb.js to handle priority escalations (e.g. P2 → P1).
// A single change stream event for an escalation must affect two priority buckets
// simultaneously — decrement the old, increment the new. This requires a different
// approach to the delta logic.
//
// Instead of a scalar _delta field, we compute an _adjustments array:
//   - Normal insert or resolve       → one-element array
//   - Delete (spam or duplicate)     → one-element array
//   - Priority escalation            → two-element array: [{old, -1}, {new, +1}]
//   - Noise (responses, etc.)        → empty array
//
// $unwind then fans each event into one document per adjustment. Escalations
// become two documents; noise events produce zero documents and are effectively
// filtered without a separate $match stage.
//
// Prerequisites:
//   1. changeStreamPreAndPostImages enabled on support_tickets (see setup-SCRATCH.mongodb.js)
//   2. An ASP connection named CONNECTION_NAME registered in your stream processing instance
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

  // Stage 2: Compute an _adjustments array describing which priority buckets
  // this event should affect and by how much.
  //
  //   Insert (open ticket)   → [{ _priority: P,    _delta:  1 }]
  //   Resolve (open ticket)  → [{ _priority: P,    _delta: -1 }]
  //   Escalation             → [{ _priority: old,  _delta: -1 },
  //                             { _priority: new,  _delta:  1 }]
  //   Everything else        → []  (dropped by $unwind in stage 3)
  {
    $addFields: {
      _adjustments: {
        $switch: {
          branches: [
            // New open ticket inserted
            {
              case: {
                $and: [
                  { $eq: ["$operationType", "insert"] },
                  { $eq: ["$fullDocument.status", "open"] }
                ]
              },
              then: [
                { _priority: "$fullDocument.priority", _delta: 1 }
              ]
            },
            // Open ticket resolved
            {
              case: {
                $and: [
                  { $eq: ["$operationType", "update"] },
                  { $eq: ["$fullDocumentBeforeChange.status", "open"] },
                  { $eq: ["$fullDocument.status", "resolved"] }
                ]
              },
              then: [
                { _priority: "$fullDocumentBeforeChange.priority", _delta: -1 }
              ]
            },
            // Priority escalation: open ticket whose priority field changed.
            // Produces two adjustments so both affected buckets are updated.
            {
              case: {
                $and: [
                  { $eq: ["$operationType", "update"] },
                  { $eq: ["$fullDocument.status", "open"] },
                  { $ne: ["$fullDocument.priority", "$fullDocumentBeforeChange.priority"] }
                ]
              },
              then: [
                { _priority: "$fullDocumentBeforeChange.priority", _delta: -1 },
                { _priority: "$fullDocument.priority",             _delta:  1 }
              ]
            },
            // Open ticket physically deleted (spam or duplicate)
            {
              case: {
                $and: [
                  { $eq: ["$operationType", "delete"] },
                  { $eq: ["$fullDocumentBeforeChange.status", "open"] }
                ]
              },
              then: [
                { _priority: "$fullDocumentBeforeChange.priority", _delta: -1 }
              ]
            }
          ],
          // Noise events (support responses, in_progress transitions, etc.)
          // Empty array is silently dropped by $unwind — no explicit $match needed.
          default: []
        }
      }
    }
  },

  // Stage 3: Fan out the _adjustments array into one document per adjustment.
  // Escalation events become two documents. Empty arrays are dropped entirely.
  {
    $unwind: "$_adjustments"
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
            _id:         "$_adjustments._priority",
            open_count:  { $sum: "$_adjustments._delta" },
            windowStart: { $first: { $meta: "stream.window.start" } }
          }
        }
      ]
    }
  },

  // Stage 5: Apply the windowed delta to the running total in queue_stats.
  // Identical structure to simple-pipeline. whenMatched guards against at-least-once
  // replay using a lastWindowStart high-water mark: the delta is only applied if the
  // incoming window is strictly newer than the last one recorded. A replayed window
  // fails the $gt check and is silently skipped, preventing double-counting.
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

sp.createStreamProcessor("queue_stats_escalation", pipeline, {
  dlq: {
    connectionName: CONNECTION_NAME,
    db: "support",
    coll: "queue_stats_dlq"
  }
});
