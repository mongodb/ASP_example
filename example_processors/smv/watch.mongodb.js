// watch.js — Live queue_stats monitor
//
// Polls the queue_stats materialized view every 2 seconds and prints the
// current open ticket count per priority. Run this in a DATA PLANE mongosh
// session alongside activity.js in a second terminal.
//
//   mongosh "mongodb+srv://<user>:<pass>@<cluster-host>/" --file streaming/watch.js

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
