// reset-asp.mongodb.js — Stop and drop the SMV stream processor.
//
// Run in your ASP session (control plane connection string):
//   load("reset-asp.mongodb.js")

["queue_stats_escalation", "queue_stats_simple"].forEach(name => {
  const procs = sp.listStreamProcessors();
  const match = procs.find(p => p.name === name);
  if (match) {
    if (match.status === "running") {
      print(`Stopping ${name}...`);
      sp[name].stop();
    }
    print(`Dropping ${name}...`);
    sp[name].drop();
  }
});

print("ASP reset complete. Now run reset-db.mongodb.js in your DB session.");
