// activity.js — Support queue activity simulator
//
// Runs an infinite loop that continuously generates realistic ticket lifecycle
// events against the support_tickets collection. Each iteration either opens a
// new ticket, resolves an existing one, adds a support response (noise), or
// physically deletes a ticket identified as spam or a duplicate.
//
// Run this in a DATA PLANE mongosh session alongside watch.js in a second terminal.
//   mongosh "mongodb+srv://<user>:<pass>@<cluster-host>/" --file streaming/activity.js

use ('support');

// -- Content pools ----------------------------------------------------------

const newTicketTemplates = [
  { priority: "P1", tags: ["outage", "enterprise"],    body: "Our entire production cluster is unresponsive. All application traffic is down." },
  { priority: "P1", tags: ["data-loss"],               body: "Records are missing from our orders collection after a failed bulk write operation." },
  { priority: "P1", tags: ["auth", "enterprise"],      body: "API keys stopped working for all users in our org about 20 minutes ago." },
  { priority: "P2", tags: ["performance"],             body: "Query latency on our primary shard has tripled since this morning. No schema changes on our end." },
  { priority: "P2", tags: ["billing"],                 body: "We were charged for a dedicated cluster that we deleted two weeks ago." },
  { priority: "P2", tags: ["connectivity", "vpc"],     body: "Our Lambda functions can no longer reach Atlas. VPC peering was working fine yesterday." },
  { priority: "P2", tags: ["atlas-search"],            body: "Autocomplete index stopped returning results after we added a new field to the mapping." },
  { priority: "P2", tags: ["terraform"],               body: "Atlas Terraform provider is throwing a 403 when creating database users. IAM role hasn't changed." },
  { priority: "P3", tags: ["docs"],                    body: "The aggregation pipeline docs don't explain how $lookup interacts with Atlas Search indexes." },
  { priority: "P3", tags: ["feature-request"],         body: "Would love the ability to set per-collection read preferences in the connection string." },
  { priority: "P3", tags: ["driver"],                  body: "Node.js driver 6.4 is logging a deprecation warning on MongoClient instantiation. What's the replacement?" },
  { priority: "P3", tags: ["atlas-search"],            body: "Is there a way to boost results from the last 30 days in an Atlas Search query?" }
];

const supportResponses = [
  "I'm looking into this now and will update you shortly.",
  "Can you share your cluster logs from the past hour? You can export them from the Atlas UI under Monitoring.",
  "I've escalated this to our infrastructure team. You should hear back within 30 minutes.",
  "Can you confirm which Atlas region your cluster is deployed in?",
  "I've reproduced this in our test environment. Raising a bug with engineering now.",
  "Could you run db.currentOp() and share the output? I want to see if there are any long-running operations.",
  "I'm opening a case with our billing team and will follow up by end of day.",
  "Can you try connecting with a direct connection string (replicaSet param) and let me know if the issue persists?"
];

// -- Helpers ----------------------------------------------------------------

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSleep() {
  sleep(2000 + Math.floor(Math.random() * 1000));
}

function timestamp() {
  return new Date().toISOString().substring(11, 19);
}

// -- Actions ----------------------------------------------------------------

function openTicket() {
  const t = randomChoice(newTicketTemplates);
  const author = `user${Math.floor(Math.random() * 900) + 100}@customer.com`;
  const now = new Date();

  db.support_tickets.insertOne({
    status:     "open",
    priority:   t.priority,
    created_at: now,
    tags:       t.tags,
    updates: [{
      timestamp: now,
      type:      "customer_message",
      author:    author,
      body:      t.body
    }]
  });

  print(`[${timestamp()}] OPEN    ${t.priority}  → queue_stats ${t.priority} should increment`);
}

function resolveTicket() {
  const ticket = db.support_tickets.findOne({ status: "open" });

  if (!ticket) {
    print(`[${timestamp()}] SKIP    no open tickets available to resolve`);
    return;
  }

  db.support_tickets.updateOne(
    { _id: ticket._id },
    {
      $set:  { status: "resolved" },
      $push: {
        updates: {
          timestamp: new Date(),
          type:      "status_change",
          from:      "open",
          to:        "resolved"
        }
      }
    }
  );

  print(`[${timestamp()}] RESOLVE ${ticket.priority}  → queue_stats ${ticket.priority} should decrement`);
}

function addResponse() {
  const ticket = db.support_tickets.findOne({ status: "open" });

  if (!ticket) {
    print(`[${timestamp()}] SKIP    no open tickets available to respond to`);
    return;
  }

  db.support_tickets.updateOne(
    { _id: ticket._id },
    {
      $push: {
        updates: {
          timestamp: new Date(),
          type:      "support_response",
          author:    "agent.support@mongodb.com",
          body:      randomChoice(supportResponses)
        }
      }
    }
  );

  print(`[${timestamp()}] RESPOND ${ticket.priority}  → noise event, queue_stats should not change`);
}

function deleteTicket() {
  const ticket = db.support_tickets.findOne({ status: "open" });

  if (!ticket) {
    print(`[${timestamp()}] SKIP    no open tickets available to delete`);
    return;
  }

  db.support_tickets.deleteOne({ _id: ticket._id });

  print(`[${timestamp()}] DELETE  ${ticket.priority}  → spam/dupe purged, queue_stats ${ticket.priority} should decrement`);
}

// -- Loop -------------------------------------------------------------------

print("activity.mongodb.js running — Ctrl+C to stop\n");

while (true) {
  const roll = Math.random();

  if      (roll < 0.37) { openTicket();    }
  else if (roll < 0.64) { resolveTicket(); }
  else if (roll < 0.90) { addResponse();   }
  else                  { deleteTicket();  }

  randomSleep();
}
