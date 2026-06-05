// reset-db.mongodb.js — Drop all SMV-related collections.
//
// Run in your DB session (standard Atlas connection string):
//   load("reset-db.mongodb.js")

use('support');

["support_tickets", "queue_stats", "queue_stats_dlq"].forEach(coll => {
  print(`Dropping ${coll}...`);
  db[coll].drop();
});

print("DB reset complete. Follow Step 1 in the README to start a new run.");
