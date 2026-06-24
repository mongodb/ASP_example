// watch.js — Live queue_stats monitor
//
// Polls queue_stats every 2 seconds and prints the current open ticket count
// per priority. queue_stats is a regular MongoDB collection maintained by the
// Streaming Materialized View Pattern — this is a plain find() query, not a
// special ASP API. It can be indexed, queried, and used as the backing store
// for an application like any other collection.
//
// Run in a DB session alongside activity.js in a second terminal:
//   mongosh "mongodb+srv://<user>:<pass>@<cluster-host>/"

use('support');

print("Watching queue_stats — Ctrl+C to stop\n");

while (true) {
  const counts = db.queue_stats.find().sort({ _id: 1 }).toArray();

  print(new Date().toISOString().substring(11, 19));

  if (counts.length === 0) {
    print("  (no data yet — is the stream processor running?)");
  } else {
    counts.forEach(doc =>
      print(`  ${doc._id}  ${"█".repeat(Math.max(0, doc.open_count))} ${doc.open_count}`)
    );
  }

  print("");
  sleep(2000);
}
