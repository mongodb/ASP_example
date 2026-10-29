const LIFE_EVENTS = {
  HOUSE_PURCHASE: {
    label: "Home purchase",
    actions: [
      "Proactive mortgage adviser call-back",
      "Pre-approved buildings & contents insurance quote",
      "First-time buyer / moving home guide",
    ],
  },
  VEHICLE_LOAN: {
    label: "Vehicle purchase",
    actions: [
      "Personalised car finance rate offer",
      "Motor insurance bundle via partner",
      "Loan repayment calculator in mobile app",
    ],
  },
  WEDDING_PLANNING: {
    label: "Wedding planning",
    actions: [
      "Joint account fast-track onboarding",
      "Wedding savings pot with round-ups",
      "Fee-free travel money for the honeymoon",
    ],
  },
};
const GROUP_LABELS = {
  PAYMENTS: "Payments",
  LENDING: "Lending",
  CUSTOMER_SERVICING: "Servicing",
  ACCOUNT_SERVICING: "Account",
};
const DERIVED_THRESHOLD = 0.5;

const state = {
  customers: [],
  selected: null,
  events: [],
  insights: [],
  filter: "ALL",
  running: null,
  sourceCount: 0,
  sinkCount: 0,
  windows: new Map(), // cin -> { count, openedAt }
};

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const initials = (name) => name.split(" ").map((p) => p[0]).join("").slice(0, 2);
const maskAccount = (acc) => `••••${String(acc).slice(-4)}`;
const formatSortCode = (sc) => String(sc).replace(/(\d{2})(\d{2})(\d{2})/, "$1-$2-$3");
const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
const humanise = (s) => (s || "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const selectedCustomer = () => state.customers.find((c) => String(c.cin) === String(state.selected));

function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 5000);
}

async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// --- Flow diagram -----------------------------------------------------------

function activate(nodeId, ms = 900) {
  const node = $(nodeId);
  node.classList.add("active");
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove("active"), ms);
}

function sendPacket(linkId, kind = "") {
  const packet = el("span", { class: `packet ${kind}` });
  $(linkId).append(packet);
  packet.addEventListener("animationend", () => packet.remove());
}

function renderAspStat() {
  const node = $("node-asp");
  const open = [...state.windows.entries()];
  if (!open.length) {
    node.classList.remove("buffering");
    $("stat-asp").textContent = "Waiting for events";
    return;
  }
  node.classList.add("buffering");
  const [cin, w] = open[open.length - 1];
  const secs = Math.round((Date.now() - w.openedAt) / 1000);
  const who = state.customers.find((c) => String(c.cin) === cin)?.name ?? `CIN ${cin}`;
  $("stat-asp").textContent = `Window open · ${who} · ${w.count} events · ${secs}s`;
}
setInterval(renderAspStat, 1000);

function flowForEvent(evt) {
  state.sourceCount += 1;
  activate("node-channels", 500);
  $("stat-channels").textContent = evt.description || humanise(evt.type);
  sendPacket("link-1");
  setTimeout(() => {
    activate("node-source");
    $("stat-source").textContent = `${state.sourceCount} events this session`;
    sendPacket("link-2");
  }, 450);
  setTimeout(() => {
    activate("node-asp", 600);
    const key = String(evt.cin);
    const w = state.windows.get(key) ?? { count: 0, openedAt: Date.now() };
    w.count += 1;
    state.windows.set(key, w);
    renderAspStat();
  }, 900);
}

function flowForInsight(insight) {
  state.windows.delete(String(insight.cin));
  activate("node-asp", 1200);
  sendPacket("link-3", "insight");
  setTimeout(() => {
    activate("node-lambda", 1400);
    $("stat-lambda").textContent = `Inferred ${insight.lifeEvents.length} life event(s)`;
    sendPacket("link-4", "insight");
  }, 500);
  setTimeout(() => {
    state.sinkCount += 1;
    activate("node-sink", 1500);
    $("stat-sink").textContent = `${state.sinkCount} intelligent events`;
    renderAspStat();
  }, 1100);
}

// --- Customers --------------------------------------------------------------

function renderCustomers() {
  const list = $("customer-list");
  list.replaceChildren(
    ...state.customers.map((c) =>
      el(
        "li",
        {
          class: [
            "customer",
            String(c.cin) === String(state.selected) ? "selected" : "",
            String(c.cin) === String(state.running?.cin) ? "running" : "",
          ].join(" "),
          onclick: () => selectCustomer(c.cin),
        },
        el("div", { class: "avatar" }, initials(c.name)),
        el(
          "div",
          {},
          el("div", { class: "customer-name" }, c.name),
          el("div", { class: "customer-meta" }, `CIN ${c.cin} · ${formatSortCode(c.sortCode)} · ${maskAccount(c.account)}`),
          el("span", { class: "scenario-tag" }, `Demo scenario: ${humanise(c.storyline)}`),
        ),
      ),
    ),
  );
}

function renderSimControls() {
  const running = state.running;
  $("run-btn").disabled = !state.selected || Boolean(running);
  $("stop-btn").hidden = !running;
  $("progress").hidden = !running;
  if (running) {
    $("progress-bar").style.width = `${Math.round((running.inserted / running.total) * 100)}%`;
    const who = state.customers.find((c) => String(c.cin) === String(running.cin))?.name;
    $("sim-text").textContent = `Streaming ${who}'s activity · ${running.inserted}/${running.total} events`;
  }
}

async function selectCustomer(cin) {
  state.selected = cin;
  state.filter = "ALL";
  renderCustomers();
  renderSimControls();
  const c = selectedCustomer();
  $("customer-banner").replaceChildren(
    el("strong", {}, c.name),
    ` · CIN ${c.cin} · Sort code ${formatSortCode(c.sortCode)} · Account ${maskAccount(c.account)}`,
  );
  $("query-snippet").hidden = false;
  $("query-snippet").textContent =
    `db.${$("source-ns").textContent.split(".").pop()}.find({ "payload.value.actionedFields.CUSTOMER_ID": ${c.cin} })\n  .sort({ "envelope.initiatedTimeStamp": -1 })`;

  try {
    const [events, insights] = await Promise.all([
      api(`/api/timeline?cin=${encodeURIComponent(cin)}`),
      api(`/api/insights?cin=${encodeURIComponent(cin)}`),
    ]);
    if (String(state.selected) !== String(cin)) return;
    state.events = events;
    state.insights = insights;
  } catch (error) {
    toast(`Failed to load customer: ${error.message}`);
    state.events = [];
    state.insights = [];
  }
  renderTimeline();
  renderAnalysis();
}

// --- Timeline (use case 1) --------------------------------------------------

function renderFilters() {
  const groups = ["ALL", ...Object.keys(GROUP_LABELS)];
  $("filters").replaceChildren(
    ...groups.map((g) => {
      const count = g === "ALL" ? state.events.length : state.events.filter((e) => e.group === g).length;
      return el(
        "button",
        {
          class: `filter ${state.filter === g ? "on" : ""}`,
          onclick: () => {
            state.filter = g;
            renderTimeline();
          },
        },
        `${g === "ALL" ? "All" : GROUP_LABELS[g]} (${count})`,
      );
    }),
  );
}

function timelineItem(evt, isNew = false) {
  return el(
    "li",
    { class: `tl-item ${isNew ? "new" : ""}` },
    el(
      "div",
      { class: "tl-top" },
      el("span", { class: "tl-title" }, evt.description || humanise(evt.type)),
      el("span", { class: "tl-time" }, formatTime(evt.occurredAt)),
    ),
    el("div", { class: "tl-note" }, evt.note || ""),
    el(
      "div",
      { class: "tl-meta" },
      el("span", { class: `chip g-${evt.group}` }, GROUP_LABELS[evt.group] || humanise(evt.group)),
      `  ${humanise(evt.type)} · ${humanise(evt.purpose)} · Ref ${evt.eventRef ?? "-"}`,
    ),
  );
}

function renderTimeline(newId) {
  renderFilters();
  const visible = state.events.filter((e) => state.filter === "ALL" || e.group === state.filter);
  $("timeline").replaceChildren(
    ...(visible.length
      ? visible.map((e) => timelineItem(e, e.id === newId))
      : [el("li", { class: "empty" }, state.selected ? "No interactions recorded yet. Run a simulation." : "")]),
  );
}

// --- Analysis (use case 2) --------------------------------------------------

function renderAnalysis() {
  const container = $("analysis");
  const latest = state.insights[0];
  const runningForSelected = String(state.running?.cin) === String(state.selected);
  const awaitingWindow = state.windows.has(String(state.selected));

  if (!state.selected) {
    container.replaceChildren(el("div", { class: "empty" }, "No customer selected."));
  } else if (runningForSelected || (awaitingWindow && !latest?.fresh)) {
    container.replaceChildren(
      el(
        "div",
        { class: "empty waiting" },
        el("span", { class: "spinner" }),
        runningForSelected
          ? "Events streaming into Atlas. Stream Processing is windowing this customer's activity…"
          : "Window closing. Awaiting Lambda inference result…",
      ),
    );
  } else if (!latest) {
    container.replaceChildren(el("div", { class: "empty" }, "No intelligent events yet for this customer."));
  } else {
    const ranked = [...latest.lifeEvents].sort((a, b) => b.probability - a.probability);
    const top = ranked[0];
    const derived = top && top.probability >= DERIVED_THRESHOLD ? top : null;
    const c = selectedCustomer();

    container.replaceChildren(
      el(
        "div",
        { class: "analysis-meta" },
        `Generated ${formatTime(latest.receivedAt)}`,
        latest.eventCount != null ? ` · ${latest.eventCount} events analysed` : "",
      ),
      ...(ranked.length
        ? ranked.map((le) =>
            el(
              "div",
              { class: "le-row" },
              el(
                "div",
                { class: "le-top" },
                el("span", {}, LIFE_EVENTS[le.lifeEvent]?.label ?? humanise(le.lifeEvent)),
                el("span", {}, `${Math.round(le.probability * 100)}%`),
              ),
              el("div", { class: "bar" }, el("div", { style: `width:${Math.round(le.probability * 100)}%` })),
            ),
          )
        : [el("div", { class: "empty" }, "No life event signals detected in this window.")]),
      derived
        ? el(
            "div",
            { class: "derived" },
            el("div", { class: "derived-label" }, "Intelligent event raised"),
            el("div", { class: "derived-title" }, `${c?.name ?? "Customer"}: ${LIFE_EVENTS[derived.lifeEvent]?.label ?? humanise(derived.lifeEvent)}`),
            el("div", { class: "small" }, "Suggested next best actions for downstream channels:"),
            el("ul", {}, ...(LIFE_EVENTS[derived.lifeEvent]?.actions ?? []).map((a) => el("li", {}, a))),
            el(
              "pre",
              { class: "mono" },
              JSON.stringify(
                {
                  eventType: "INTELLIGENT_EVENT",
                  eventPurposeType: "LIFE_EVENT_DETECTED",
                  cin: c?.cin,
                  lifeEvent: derived.lifeEvent,
                  probability: derived.probability,
                  derivedAt: latest.receivedAt,
                },
                null,
                2,
              ),
            ),
          )
        : el(
            "div",
            { class: "derived baseline" },
            el("div", { class: "derived-label" }, "No intelligent event raised"),
            el("div", { class: "derived-title" }, "Baseline behaviour"),
            el("div", { class: "small" }, `No life event exceeded the ${DERIVED_THRESHOLD * 100}% threshold. Continue standard engagement.`),
          ),
      el("div", { class: "disclaimer" }, "Probabilities are model hypotheses, not facts. Direct identifiers are removed before inference."),
    );
  }

  $("insight-history").replaceChildren(
    ...state.insights.slice(1).map((i) => {
      const top = [...i.lifeEvents].sort((a, b) => b.probability - a.probability)[0];
      return el(
        "li",
        {},
        el("span", {}, top ? `${LIFE_EVENTS[top.lifeEvent]?.label ?? top.lifeEvent} · ${Math.round(top.probability * 100)}%` : "No life event"),
        el("span", { class: "muted" }, formatTime(i.receivedAt)),
      );
    }),
  );
  if (state.selected && state.insights.length < 2) {
    $("insight-history").append(el("li", { class: "muted" }, "None"));
  }
}

// --- Live stream ------------------------------------------------------------

function connect() {
  const source = new EventSource("/api/stream");
  source.onopen = () => {
    $("conn-pill").className = "pill ok";
    $("conn-text").textContent = "Live · change streams";
  };
  source.onerror = () => {
    $("conn-pill").className = "pill err";
    $("conn-text").textContent = "Reconnecting…";
  };

  source.addEventListener("cdpEvent", (e) => {
    const evt = JSON.parse(e.data);
    flowForEvent(evt);
    if (String(evt.cin) === String(state.selected)) {
      state.events.unshift(evt);
      renderTimeline(evt.id);
    }
  });

  source.addEventListener("insight", (e) => {
    const insight = JSON.parse(e.data);
    flowForInsight(insight);
    if (String(insight.cin) === String(state.selected)) {
      insight.fresh = true;
      setTimeout(() => {
        state.insights.unshift(insight);
        renderAnalysis();
      }, 1200);
    }
    const name = state.customers.find((c) => String(c.cin) === insight.cin)?.name ?? `CIN ${insight.cin}`;
    toast(`Intelligent event received for ${name}`);
  });

  source.addEventListener("simulation", (e) => {
    const sim = JSON.parse(e.data);
    if (sim.state === "started" || sim.state === "progress") {
      state.running = { cin: sim.cin, inserted: sim.inserted ?? 0, total: sim.total };
    } else {
      state.running = null;
      $("sim-text").textContent =
        sim.state === "failed"
          ? `Simulation failed: ${sim.message}`
          : `Simulation ${sim.state} · ${sim.inserted}/${sim.total} events written to Atlas. Waiting for the stream window to close.`;
    }
    renderCustomers();
    renderSimControls();
    if (String(sim.cin) === String(state.selected) && sim.state !== "progress") renderAnalysis();
  });

  source.addEventListener("status", (e) => toast(JSON.parse(e.data).message));
}

// --- Init -------------------------------------------------------------------

$("run-btn").addEventListener("click", async () => {
  try {
    await api("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cin: state.selected }),
    });
  } catch (error) {
    toast(error.message);
  }
});

$("stop-btn").addEventListener("click", () => api("/api/stop", { method: "POST" }).catch((e) => toast(e.message)));

(async function init() {
  const config = await api("/api/config");
  state.customers = config.customers;
  state.running = config.simulation;
  $("source-ns").textContent = config.source;
  $("sink-ns").textContent = config.sink;
  $("source-info").textContent = `${config.source} → ${config.sink}`;
  renderCustomers();
  renderSimControls();
  connect();
})().catch((error) => toast(`Failed to load config: ${error.message}`));
