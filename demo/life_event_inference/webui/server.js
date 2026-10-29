#!/usr/bin/env node

/**
 * Banking demo web UI: Atlas -> Atlas Stream Processing -> Lambda -> Atlas.
 *
 * Run (from the life_event_inference directory):
 * Configure ../.env, then run npm start.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const { customers, planForCustomer, buildEvent } = require("./scenarios");
const { mongoSettings, requiredSetting, positiveInteger } = require("../config");

const { uri, dbName, collectionName } = mongoSettings();
const insightsDbName = requiredSetting("INSIGHTS_DB");
const insightsCollectionName = requiredSetting("INSIGHTS_COLLECTION");
const port = positiveInteger("PORT", 65535);

const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
};

const client = new MongoClient(uri);
const sseClients = new Set();
let simulation = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const findCustomer = (cin) => customers.find((c) => String(c.cin) === String(cin));

function broadcast(type, data) {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(message);
}

function summariseEvent(doc) {
  const fields = doc?.payload?.value?.actionedFields ?? {};
  return {
    id: doc.eventUniqueId ?? String(doc._id),
    cin: fields.CUSTOMER_ID ?? null,
    eventRef: fields.EVENT_REF ?? null,
    occurredAt: doc?.envelope?.initiatedTimeStamp ?? null,
    group: doc?.envelope?.eventGroup?.eventGroupType ?? null,
    type: doc?.envelope?.eventType ?? null,
    purpose: doc?.envelope?.eventPurposeType ?? null,
    description: fields.INTRVW_DESC?.string ?? null,
    note: fields.NOTE_DETAILS?.string ?? null,
  };
}

// ASP output shape depends on the pipeline, so search a few levels deep for the Lambda result.
function findValue(obj, predicate, depth = 4) {
  if (!obj || typeof obj !== "object" || depth < 0) return undefined;
  for (const [key, value] of Object.entries(obj)) {
    if (predicate(key, value)) return value;
  }
  for (const value of Object.values(obj)) {
    const found = findValue(value, predicate, depth - 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function summariseInsight(doc) {
  const lifeEvents = findValue(doc, (k, v) => k === "lifeEvents" && Array.isArray(v));
  if (!lifeEvents) return null;
  const cin =
    findValue(doc, (k, v) => (k === "cin" || k === "CUSTOMER_ID") && (typeof v !== "object" || v === null)) ??
    (typeof doc._id !== "object" ? doc._id : null);
  return {
    id: String(doc._id),
    cin: cin == null ? null : String(cin),
    lifeEvents,
    eventCount: findValue(doc, (k, v) => k === "eventCount" && typeof v === "number") ?? null,
    windowStart: findValue(doc, (k) => k === "windowStart" || k === "start") ?? null,
    windowEnd: findValue(doc, (k) => k === "windowEnd" || k === "end") ?? null,
    receivedAt: new Date().toISOString(),
  };
}

function watch(collection, label, onInsert) {
  const stream = collection.watch([{ $match: { operationType: { $in: ["insert", "replace", "update"] } } }], {
    fullDocument: "updateLookup",
  });
  stream.on("change", (change) => change.fullDocument && onInsert(change.fullDocument));
  stream.on("error", (error) => {
    console.error(`${label} change stream error:`, error.message);
    broadcast("status", { level: "error", message: `${label} change stream error: ${error.message}` });
  });
  return stream;
}

async function runSimulation(customer) {
  const collection = client.db(dbName).collection(collectionName);
  const plan = planForCustomer(customer);
  simulation = { cin: customer.cin, total: plan.length, inserted: 0, stop: false };
  broadcast("simulation", { state: "started", cin: customer.cin, total: plan.length });

  try {
    for (const [i, activity] of plan.entries()) {
      if (simulation.stop) break;
      await collection.insertOne(buildEvent({ sequence: i + 1, customer, activity, timestamp: new Date() }));
      simulation.inserted += 1;
      broadcast("simulation", { state: "progress", cin: customer.cin, inserted: simulation.inserted, total: plan.length });
      // 500-1000ms gap keeps a customer's burst inside one ASP window, matching generators/stream-events.js.
      if (i < plan.length - 1) await sleep(500 + Math.random() * 500);
    }
    broadcast("simulation", { state: simulation.stop ? "stopped" : "completed", cin: customer.cin, inserted: simulation.inserted, total: plan.length });
  } catch (error) {
    console.error("Simulation failed:", error.message);
    broadcast("simulation", { state: "failed", cin: customer.cin, message: error.message });
  } finally {
    simulation = null;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Body too large");
  }
  return body ? JSON.parse(body) : {};
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && STATIC[url.pathname]) {
    const [file, type] = STATIC[url.pathname];
    res.writeHead(200, { "Content-Type": type });
    fs.createReadStream(path.join(__dirname, "public", file)).pipe(res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    return sendJson(res, 200, {
      customers,
      source: `${dbName}.${collectionName}`,
      sink: `${insightsDbName}.${insightsCollectionName}`,
      simulation: simulation && { cin: simulation.cin, inserted: simulation.inserted, total: simulation.total },
    });
  }

  if (req.method === "GET" && url.pathname === "/api/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": connected\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/timeline") {
    const customer = findCustomer(url.searchParams.get("cin"));
    if (!customer) return sendJson(res, 404, { error: "Unknown customer" });
    const docs = await client
      .db(dbName)
      .collection(collectionName)
      .find({ "payload.value.actionedFields.CUSTOMER_ID": customer.cin })
      .sort({ "envelope.initiatedTimeStamp": -1 })
      .limit(200)
      .toArray();
    return sendJson(res, 200, docs.map(summariseEvent));
  }

  if (req.method === "GET" && url.pathname === "/api/insights") {
    const customer = findCustomer(url.searchParams.get("cin"));
    if (!customer) return sendJson(res, 404, { error: "Unknown customer" });
    const docs = await client
      .db(insightsDbName)
      .collection(insightsCollectionName)
      .find({})
      .sort({ _id: -1 })
      .limit(200)
      .toArray();
    const insights = docs.map(summariseInsight).filter((i) => i && i.cin === String(customer.cin));
    return sendJson(res, 200, insights.slice(0, 10));
  }

  if (req.method === "POST" && url.pathname === "/api/simulate") {
    const { cin } = await readJson(req);
    const customer = findCustomer(cin);
    if (!customer) return sendJson(res, 404, { error: "Unknown customer" });
    if (simulation) return sendJson(res, 409, { error: "A simulation is already running" });
    runSimulation(customer);
    return sendJson(res, 202, { started: true });
  }

  if (req.method === "POST" && url.pathname === "/api/stop") {
    if (simulation) simulation.stop = true;
    return sendJson(res, 200, { stopping: Boolean(simulation) });
  }

  sendJson(res, 404, { error: "Not found" });
}

async function main() {
  await client.connect();

  watch(client.db(dbName).collection(collectionName), "Source", (doc) => broadcast("cdpEvent", summariseEvent(doc)));
  watch(client.db(insightsDbName).collection(insightsCollectionName), "Insights", (doc) => {
    const insight = summariseInsight(doc);
    if (insight) broadcast("insight", insight);
  });

  setInterval(() => broadcast("ping", { t: Date.now() }), 20_000);

  http
    .createServer((req, res) =>
      handle(req, res).catch((error) => {
        console.error(error);
        if (!res.headersSent) sendJson(res, 400, { error: "Request failed" });
      }),
    )
    .listen(port, () => {
      console.log(`Customer Intelligence Hub on http://localhost:${port}`);
      console.log(`Source: ${dbName}.${collectionName}  Sink: ${insightsDbName}.${insightsCollectionName}`);
    });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
