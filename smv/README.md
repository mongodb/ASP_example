# Streaming Materialized View: Support Queue Dashboard

This example demonstrates a streaming materialized view built with Atlas Stream Processing (ASP). A `queue_stats` collection is continuously maintained in near real-time as support tickets are opened, resolved, escalated, and deleted — with no manual refresh required.

For conceptual background and a discussion of when streaming materialized views are preferable to the incremental approach, see [streaming-materialized-views.md](streaming-materialized-views.md).

---

## Collections

| Collection | Role |
|---|---|
| `support_tickets` | Source — individual support cases |
| `queue_stats` | Materialized view — open ticket count per priority |
| `queue_stats_dlq` | Dead letter queue — tickets that failed processing |

### `support_tickets` document shape

Tickets carry an embedded `updates` array — an append-only log of every message, response, and status change on the case. Entries are polymorphic: a customer message and a status change have different fields. This is the natural fit for MongoDB's document model that would require separate tables and joins in a relational system.

```json
{
  "_id":       ObjectId("..."),
  "status":    "open",
  "priority":  "P2",
  "created_at": ISODate("2026-05-11T07:20:00Z"),
  "tags":      ["connectivity", "vpc"],
  "updates": [
    {
      "timestamp": ISODate("2026-05-11T07:20:00Z"),
      "type":      "customer_message",
      "author":    "infra@bluth.co",
      "body":      "Intermittent connection timeouts to our Atlas cluster from our VPC."
    },
    {
      "timestamp": ISODate("2026-05-11T08:05:00Z"),
      "type":      "support_response",
      "author":    "agent.rivera@support.com",
      "body":      "Can you confirm which Atlas region your cluster is deployed in?"
    },
    {
      "timestamp": ISODate("2026-05-11T08:30:00Z"),
      "type":      "status_change",
      "from":      "open",
      "to":        "in_progress"
    }
  ]
}
```

### `queue_stats` document shape

One document per priority level. `open_count` is a running total maintained by the stream processor — it is never recomputed from scratch.

```json
{ "_id": "P1", "open_count": 3 }
{ "_id": "P2", "open_count": 7 }
{ "_id": "P3", "open_count": 12 }
```

---

## The Two Pipelines

Two pipeline variants are provided, demonstrating progressively more complex delta logic.

### Pipeline 1: Simple (`pipelines/simple-pipeline.json`)

Handles three event types:

| Event | Delta | `operationType` |
|---|---|---|
| New open ticket inserted | +1 to priority bucket | `insert` |
| Open ticket resolved | -1 from priority bucket | `update` |
| Open ticket deleted (spam/duplicate) | -1 from priority bucket | `delete` |

Uses a scalar `_delta` field. A `$match` stage filters events with `_delta = 0` before they reach the window.

### Pipeline 2: With Escalation (`pipelines/escalation-pipeline.json`)

Adds a fourth event type — priority escalation (e.g. P2 → P1) — which must affect two priority buckets simultaneously from a single change stream event.

| Event | Delta | `operationType` |
|---|---|---|
| New open ticket inserted | +1 to priority bucket | `insert` |
| Open ticket resolved | -1 from priority bucket | `update` |
| Open ticket deleted (spam/duplicate) | -1 from priority bucket | `delete` |
| Priority escalated | -1 old bucket, +1 new bucket | `update` |

Instead of a scalar `_delta`, this pipeline computes an `_adjustments` array. `$unwind` fans escalation events into two documents — one per affected bucket. Noise events produce an empty array that `$unwind` drops silently, eliminating the need for a separate `$match` stage.

### Pipeline structure

Both pipelines share the same stage sequence:

```
$source → $addFields → [$unwind] → $tumblingWindow ($group) → $merge
```

The `$merge` stage uses an additive `whenMatched` pipeline to accumulate deltas into the running total rather than replacing it:

```js
whenMatched: [{ $set: { open_count: { $add: ["$open_count", "$$new.open_count"] } } }]
```

---

## Prerequisites

**1. Enable change stream pre- and post-images on `support_tickets`.**

Required before starting the processor. Without it, `$fullDocumentBeforeChange` is null on update and delete events, and the `-1` delta will never fire.

Run in a data plane mongosh session (see `setup-SCRATCH.mongodb.js`):

```js
use('support');
db.runCommand({
  collMod: "support_tickets",
  changeStreamPreAndPostImages: { enabled: true }
});
```

**2. Register an ASP connection.**

In your stream processing instance, register a connection named `MyAtlas` (or update `CONNECTION_NAME` in the pipeline file) pointing at your Atlas cluster. This connection is used for both the `$source` and `$merge` stages.

**3. Two connection planes.**

ASP management commands (`sp.*`) require a control plane connection string:
```
mongodb://<asp-host>/?streamProcessingInstance=<name>
```

Data plane commands (`db.*`) use a standard Atlas connection string. You can use both in a single mongosh session by constructing an explicit data plane connection:

```js
const dataPlane = new Mongo("mongodb+srv://<user>:<pass>@<cluster-host>/");
const db = dataPlane.getDB("support");
```

The default `db` in a control plane session points at the ASP instance, not your cluster — so the explicit `new Mongo()` is required if you want both in the same session.

---

## Running the Demo

### Step 1 — Load the initial data

The sample data file contains 10 support tickets across P1, P2, and P3 priorities in various states.

```bash
mongoimport \
  --uri "<connection-string>" \
  --db support \
  --collection support_tickets \
  --jsonArray \
  --file streaming/data/tickets.json
```

### Step 2 — Enable pre/post images and start the processor

In your **data plane** session, run the `collMod` from `setup-SCRATCH.mongodb.js`.

In your **control plane** session:

```js
const def = JSON.parse(fs.readFileSync('smv/pipelines/simple-pipeline.json', 'utf8'));
sp.createStreamProcessor(def.name, def.pipeline, def.options);
sp[def.name].start();
```

`queue_stats` starts empty and accumulates from this point forward. Note: `initialSync` is not compatible with windowing stages in ASP — pre-existing tickets are not counted in the initial view state.

### Step 3 — Watch the view

In a second **data plane** session:

```js
load("smv/watch.mongodb.js");
```

This polls `queue_stats` every 2 seconds and prints a live bar chart:

```
10:14:32
  P1  ████ 4
  P2  ███████ 7
  P3  ████████████ 12
```

### Step 4 — Generate activity

In a third session, run one of the activity scripts:

```js
// Simple events only (open, resolve, respond, delete):
load("smv/activity.mongodb.js");

// Includes priority escalations:
load("smv/activity-escalation.mongodb.js");
```

Each event prints what happened and what change to expect in `queue_stats`. Cross-reference with the `watch` output to verify the processor is responding correctly.

### Step 5 — Monitor processor health

In the control plane session:

```js
sp.queue_stats_processor.stats();
```

`dlqMessageCount` should remain 0. Any value above zero means a document failed processing — check the `queue_stats_dlq` collection.

### Resetting between runs

To start fresh (e.g., when switching between pipelines):

```js
// Control plane:
sp.queue_stats_processor.stop();
sp.queue_stats_processor.drop();

// Data plane:
use('support');
db.queue_stats.drop();
```

Then reload the pipeline and start again. Do not restart the processor without dropping `queue_stats` — counts will accumulate on top of the previous run.

---

## File reference

```
smv/
├── streaming-materialized-views.md         # Conceptual overview
├── README.md                               # This file
├── setup-SCRATCH.mongodb.js                # Setup and lifecycle command reference
├── watch.mongodb.js                        # Live queue_stats monitor (data plane)
├── activity.mongodb.js                     # Event simulator — simple
├── activity-escalation.mongodb.js          # Event simulator — with escalations
├── data/
│   └── tickets.json                        # 10 sample support tickets
└── pipelines/
    ├── simple-pipeline.json                # Pipeline 1: insert, resolve, delete
    └── escalation-pipeline.json            # Pipeline 2: + priority escalation
```
