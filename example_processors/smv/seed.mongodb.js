// seed.mongodb.js — Compute initial queue_stats from existing support_tickets.
//
// Run in your DB session after loading tickets but before starting the processor:
//   load("seed.mongodb.js")
//
// This seeds queue_stats with the current open ticket count per priority.
// Once the stream processor starts, it maintains these counts incrementally.

use('support');

db.support_tickets.aggregate([
  { $match: { status: "open" } },
  { $group: { _id: "$priority", open_count: { $sum: 1 } } },
  { $merge: { into: "queue_stats", whenMatched: "replace", whenNotMatched: "insert" } }
]);

print("queue_stats seeded:");
db.queue_stats.find().forEach(doc => print(` ${doc._id}: ${doc.open_count}`));
