// setup-SCRATCH.mongodb.js — Stream processor setup and lifecycle commands
//
// Commands are grouped by connection plane. The control plane connection string
// targets the ASP instance; the data plane connection string targets your cluster.
//
//   CONTROL PLANE mongosh "mongodb://<asp-host>/?streamProcessingInstance=<name>"
//   DATA PLANE    mongosh "mongodb+srv://<user>:<pass>@<cluster-host>/"
//
// Both planes can be used in a single mongosh session by constructing an explicit
// data plane connection alongside the default control plane connection:
//
//   const dataPlane = new Mongo("mongodb+srv://<user>:<pass>@<cluster-host>/");
//   const db = dataPlane.getDB("support");
//
// The default `db` in a control plane session points at the ASP instance,
// not your cluster, so the explicit new Mongo() is required for db.* operations.


// =============================================================================
// SECTION 1 — DATA PLANE
// Enable changeStreamPreAndPostImages on the source collection.
//
// Required before starting the stream processor. Without it, $fullDocumentBeforeChange
// is null on update events, and the resolution delta (-1) will never fire.
// =============================================================================

use('support');

db.runCommand({
  collMod: "support_tickets",
  changeStreamPreAndPostImages: { enabled: true }
});

// Verify:
db.getCollectionInfos({ name: "support_tickets" })[0].options;
// Expected output includes: changeStreamPreAndPostImages: { enabled: true }


// =============================================================================
// SECTION 2 — CONTROL PLANE
// Register and start the stream processor.
// =============================================================================

// Create the processor (does not start processing yet):
const def = JSON.parse(fs.readFileSync('example_processors/smv/pipelines/simple-pipeline.json', 'utf8'));
sp.createStreamProcessor(def.name, def.pipeline, def.options);

// Confirm it was registered:
sp.listStreamProcessors();

// Start. queue_stats begins empty and accumulates from this point forward.
// initialSync is not compatible with windowing stages — pre-existing tickets
// are not counted. Populate queue_stats separately if a baseline is needed.
sp[def.name].start();


// =============================================================================
// SECTION 3 — CONTROL PLANE  (operations reference)
// =============================================================================

// Check processor health. dlqMessageCount should remain 0.
// Any value above zero means a document failed processing — check queue_stats_dlq.
sp.queue_stats_processor.stats();

// Stop the processor (preserves queue_stats state):
sp.queue_stats_processor.stop();

// Full reset for development — clears the processor and the view so counts
// don't accumulate across runs:
sp.queue_stats_processor.drop();
use('support');
db.queue_stats.drop();
// Then re-run load() and start() above to begin fresh.
