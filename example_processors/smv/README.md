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

For example:

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

`data/tickets.json` contains 10 sample tickets across P1, P2, and P3 priorities if you want to browse the shape or load them into a separate collection for reference:

```bash
mongoimport --uri "<connection-string>" --db support --collection sample_tickets --jsonArray --file data/tickets.json
```

### `queue_stats` document shape

One document per priority level. `open_count` is a running total maintained by the stream processor — it is never recomputed from scratch.

```json
{ "_id": "P1", "open_count": 3 }
{ "_id": "P2", "open_count": 7 }
{ "_id": "P3", "open_count": 12 }
```

---

## The Pipeline

`pipelines/escalation-pipeline.mongodb.js` handles four event types:

| Event | Delta | `operationType` |
|---|---|---|
| New open ticket inserted | +1 to priority bucket | `insert` |
| Open ticket resolved | -1 from priority bucket | `update` |
| Open ticket deleted (spam/duplicate) | -1 from priority bucket | `delete` |
| Priority escalated (e.g. P2 → P1) | -1 old bucket, +1 new bucket | `update` |

The escalation case is the interesting one — a single change stream event must affect two priority buckets simultaneously. Instead of a scalar `_delta`, this pipeline computes an `_adjustments` array. `$unwind` fans escalation events into two documents — one per affected bucket. Noise events produce an empty array that `$unwind` drops silently, eliminating the need for a separate `$match` stage.

### Pipeline structure

```
$source → $addFields (_adjustments) → $unwind → $tumblingWindow ($group) → $merge
```

The `$merge` stage uses an additive `whenMatched` pipeline to accumulate deltas into the running total rather than replacing it, with a `lastWindowStart` high-water mark to guard against at-least-once replay.

---

## Prerequisites

**1. Register an ASP connection.**

In your stream processing workspace, register the connection to your Atlas cluster and note its name. Replace `CONNECTION_NAME` in the pipeline files with the registered connection name. This connection is used for both the `$source` and `$merge` stages.

**2. Three sessions.**

You need three mongosh sessions running simultaneously. Connection strings for both types are available via the **Connect** button in the Atlas UI — on your cluster for DB sessions, and on your stream processing instance for the ASP session.

- **ASP session** — connect to your stream processing instance:
  ```bash
  mongosh "mongodb://<asp-host>/?streamProcessingInstance=<name>"
  ```
  Used for `sp.*` commands to manage the processor.

- **DB session (watch)** — connect to your Atlas cluster:
  ```bash
  mongosh "mongodb+srv://<user>:<pass>@<cluster-host>/"
  ```
  Used to run `watch.mongodb.js` and monitor `queue_stats`.

- **DB session (activity)** — a second connection to your Atlas cluster. Used to run the activity simulator.

---

## Running the Demo

> **All commands below assume you have `cd`'d into the `smv` directory:**
> ```bash
> cd example_processors/smv
> ```

### Step 1 — Create the collection and load tickets

In a **DB session**:

```js
use('support');
db.createCollection("support_tickets", {
  changeStreamPreAndPostImages: { enabled: true }
});
```

Pre/post images must be enabled before the processor starts. Creating the collection explicitly ensures you control when the change stream begins.

Then load the sample tickets:

```js
db.support_tickets.insertMany(JSON.parse(fs.readFileSync('data/tickets.json', 'utf8')));
```

### Step 2 — Seed queue_stats

Run a one-time aggregation to compute the initial open ticket counts from the loaded tickets:

```js
load("seed.mongodb.js");
```

This creates `queue_stats` as an on-demand materialized view — a point-in-time snapshot of open ticket counts by priority. It will go stale the moment tickets change.

### Step 3 — Start the processor

In your **ASP session**:

```js
load("pipelines/escalation-pipeline.mongodb.js");
sp.queue_stats_escalation.start();
```

Starting the processor converts `queue_stats` from an on-demand materialized view into a streaming materialized view — kept current continuously as tickets are inserted, resolved, escalated, and deleted.

### Step 4 — Watch the view

In your **DB session**:

```js
load("watch.mongodb.js");
```

This polls `queue_stats` every 2 seconds and prints a live bar chart:

```
10:14:32
  P1  ████ 4
  P2  ███████ 7
  P3  ████████████ 12
```

### Step 5 — Generate activity

In a second **DB session**:

```js
load("activity/escalation-activity.js");
```

Each event prints what happened and what change to expect in `queue_stats`. Cross-reference with the `watch` output to verify the processor is responding correctly.

### Step 6 — Monitor processor health

In your **ASP session**:

```js
sp.queue_stats_escalation.stats();
```

`dlqMessageCount` should remain 0. Any value above zero means a document failed processing — check the `queue_stats_dlq` collection.

---

## Resetting to Initial State

Two scripts handle the reset — run them in order.

In your **ASP session**:

```js
load("reset-asp.mongodb.js");
```

In your **DB session**:

```js
load("reset-db.mongodb.js");
```

This stops and drops whichever SMV processor is running, then drops `support_tickets`, `queue_stats`, and `queue_stats_dlq`. After the reset, follow Step 1 to start a new run. Do not restart the processor against an existing `queue_stats` collection — counts will accumulate on top of the previous run.

---

## Simplified Variant

`pipelines/simple-pipeline.mongodb.js` handles three event types (insert, resolve, delete) and omits the escalation case. It uses a scalar `_delta` field and a `$match` stage to drop noise events, making it easier to follow as an introduction to the pattern. Use `activity/simple-activity.js` with this pipeline.

In your **ASP session**:

```js
load("pipelines/simple-pipeline.mongodb.js");
sp.queue_stats_simple.start();
```

---

## File reference

```
smv/
├── streaming-materialized-views.md         # Conceptual overview
├── README.md                               # This file
├── seed.mongodb.js                         # Seed queue_stats from existing tickets (DB session)
├── reset-asp.mongodb.js                    # Stop and drop the stream processor (ASP session)
├── reset-db.mongodb.js                     # Drop all collections (DB session)
├── watch.mongodb.js                        # Live queue_stats monitor (DB session)
├── activity/
│   ├── simple-activity.js                  # Event simulator — simple
│   └── escalation-activity.js              # Event simulator — with escalations
├── data/
│   └── tickets.json                        # 10 sample support tickets
└── pipelines/
    ├── simple-pipeline.mongodb.js          # Pipeline 1: insert, resolve, delete
    └── escalation-pipeline.mongodb.js      # Pipeline 2: + priority escalation
```
