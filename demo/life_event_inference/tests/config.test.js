const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { requiredSetting, positiveInteger } = require("../config");

const root = path.resolve(__dirname, "..");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "life-event-config-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.copyFileSync(path.join(root, "config.js"), path.join(directory, "config.js"));
  return directory;
}

function runNode(directory, source, environment = {}) {
  const result = spawnSync(process.execPath, ["-e", source], {
    cwd: path.dirname(directory),
    env: { ...process.env, ...environment },
    encoding: "utf8",
    timeout: 10000,
  });
  assert.ifError(result.error);
  return result;
}

test("loads project .env from another working directory and preserves shell overrides", (context) => {
  const directory = fixture(context);
  fs.writeFileSync(path.join(directory, ".env"), "CONFIG_FILE_ONLY=from-file\nEVENT_COUNT=100000\n");
  const result = runNode(directory, `
    require(${JSON.stringify(path.join(directory, "config.js"))});
    console.log(JSON.stringify([process.env.CONFIG_FILE_ONLY, process.env.EVENT_COUNT]));
  `, { EVENT_COUNT: "20" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ["from-file", "20"]);
});

test("allows a missing .env when configuration is provided by the environment", (context) => {
  const directory = fixture(context);
  const result = runNode(directory, `
    const config = require(${JSON.stringify(path.join(directory, "config.js"))});
    console.log(config.requiredSetting("CONFIG_SHELL_ONLY"));
  `, { CONFIG_SHELL_ONLY: "provided" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "provided");
});

test("does not hide .env filesystem errors other than a missing file", (context) => {
  const directory = fixture(context);
  fs.mkdirSync(path.join(directory, ".env"));
  const result = runNode(directory, `require(${JSON.stringify(path.join(directory, "config.js"))});`);
  assert.notEqual(result.status, 0);
});

test("validates settings without leaking their values or requiring unrelated secrets", () => {
  assert.equal(requiredSetting("DB_NAME", { DB_NAME: "demo" }), "demo");
  assert.throws(() => requiredSetting("AI_GATEWAY_API_KEY", {}), /Set AI_GATEWAY_API_KEY/);
  assert.throws(() => requiredSetting("MONGODB_URI", { MONGODB_URI: " " }), /Set MONGODB_URI/);
  assert.equal(positiveInteger("EVENT_COUNT", undefined, { EVENT_COUNT: "20" }), 20);
  for (const value of ["0", "-1", "1.5", "20events", "1e3", "9007199254740992", "secret-value"]) {
    assert.throws(() => positiveInteger("EVENT_COUNT", undefined, { EVENT_COUNT: value }), (error) => {
      assert.equal(error.message, `EVENT_COUNT must be a positive integer no greater than ${Number.MAX_SAFE_INTEGER}.`);
      return true;
    });
  }
  assert.throws(() => positiveInteger("PORT", 65535, { PORT: "65536" }), /PORT must/);
});

test("MongoDB consumers share the configured collections without requiring AI credentials", (context) => {
  const directory = fixture(context);
  fs.writeFileSync(path.join(directory, ".env"), "DB_NAME=shared_demo\nCOLLECTION_NAME=shared_events\n");
  const result = runNode(directory, `
    const config = require(${JSON.stringify(path.join(directory, "config.js"))});
    console.log(JSON.stringify(config.mongoSettings()));
  `, { MONGODB_URI: "mongodb://fixture.invalid", AI_GATEWAY_API_KEY: "", DB_NAME: "shared_demo", COLLECTION_NAME: "shared_events" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    uri: "mongodb://fixture.invalid", dbName: "shared_demo", collectionName: "shared_events",
  });
  for (const file of ["generators/batch-events.js", "generators/stream-events.js", "webui/server.js"]) {
    assert.match(fs.readFileSync(path.join(root, file), "utf8"), /mongoSettings\(\)/);
  }
});

test("Lambda loads local .env settings and remains standalone without that file", (context) => {
  const directory = fixture(context);
  fs.mkdirSync(path.join(directory, "lambda"));
  fs.copyFileSync(path.join(root, "lambda/index.mjs"), path.join(directory, "lambda/index.mjs"));
  const environment = {
    AI_GATEWAY_API_KEY: "fixture-key", AI_GATEWAY_URL: "https://fixture.invalid/responses", AI_GATEWAY_MODEL: "fixture-model",
  };
  const source = `
    const assert = require('node:assert/strict');
    const { pathToFileURL } = require('node:url');
    (async () => {
      const { handler } = await import(pathToFileURL(${JSON.stringify(path.join(directory, "lambda/index.mjs"))}));
      await assert.rejects(handler(), /Missing cin/);
      global.fetch = async (url, options) => {
        assert.equal(url, 'https://fixture.invalid/responses');
        assert.equal(options.headers['api-key'], 'fixture-key');
        const body = JSON.parse(options.body);
        assert.equal(body.model, 'fixture-model');
        assert.ok(!body.input[1].content.includes('private-identifier'));
        return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: '{"lifeEvents":[]}' }] }] }) };
      };
      assert.deepEqual(await handler({ cin: 'private-identifier', events: [] }), { cin: 'private-identifier', lifeEvents: [] });
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  let result = runNode(directory, source, environment);
  assert.equal(result.status, 0, result.stderr);
  fs.writeFileSync(path.join(directory, ".env"), Object.entries(environment).map(([name, value]) => `${name}=${value}`).join("\n"));
  result = runNode(directory, `
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_URL;
    delete process.env.AI_GATEWAY_MODEL;
    ${source}
  `);
  assert.equal(result.status, 0, result.stderr);
});

function processorFixture() {
  const { parseEnv } = require("node:util");
  return {
    template: JSON.parse(fs.readFileSync(path.join(root, "processors/life_event_inference.json"), "utf8")),
    environment: parseEnv(fs.readFileSync(path.join(root, ".env.example"), "utf8")),
  };
}

test("renders typed ASP configuration while preserving aggregation expressions and excluding credentials", () => {
  const { renderProcessor } = require("../scripts/render-processor");
  const { template, environment } = processorFixture();
  const rendered = renderProcessor(template, {
    ...environment, DB_NAME: 'fixture"db', MONGODB_URI: "never-include-uri", AI_GATEWAY_API_KEY: "never-include-key",
  });
  assert.equal(rendered.name, environment.ASP_PROCESSOR_NAME);
  assert.equal(rendered.pipeline[0].$source.db, 'fixture"db');
  assert.equal(rendered.pipeline[0].$source.coll, environment.COLLECTION_NAME);
  assert.equal(rendered.pipeline[0].$source.connectionName, environment.ASP_ATLAS_CONNECTION);
  assert.equal(rendered.pipeline[0].$source.timeField.$toDate, "$fullDocument.envelope.initiatedTimeStamp");
  assert.equal(rendered.pipeline[1].$hoppingWindow.interval.size, 60);
  assert.equal(rendered.pipeline[1].$hoppingWindow.hopSize.size, 5);
  assert.equal(rendered.pipeline[2].$externalFunction.parallelism, 8);
  assert.equal(rendered.pipeline[2].$externalFunction.functionName, environment.ASP_LAMBDA_FUNCTION);
  assert.equal(rendered.pipeline[4].$merge.into.db, environment.INSIGHTS_DB);
  assert.equal(rendered.options.dlq.coll, environment.ASP_DLQ_COLLECTION);
  const output = JSON.stringify(rendered);
  assert.doesNotMatch(output, /\$\{|never-include-uri|never-include-key|MONGODB_URI|AI_GATEWAY_API_KEY/);
  assert.deepEqual(JSON.parse(output), rendered);
});

test("renderer rejects missing, malformed, unsafe and unresolved settings", () => {
  const { renderProcessor } = require("../scripts/render-processor");
  const { template, environment } = processorFixture();
  assert.throws(() => renderProcessor(template, { ...environment, DB_NAME: "" }), /Set DB_NAME/);
  assert.throws(() => renderProcessor(template, { ...environment, ASP_PARALLELISM: "8workers" }), /ASP_PARALLELISM must/);
  assert.throws(() => renderProcessor(template, { ...environment, ASP_HOP_SECONDS: "61" }), /must not exceed/);
  assert.throws(() => renderProcessor(template, { ...environment, ASP_TIER: "secret-invalid" }), /SP<number>/);
  assert.throws(() => renderProcessor({ name: "${MONGODB_URI}" }, environment), /Unsupported processor/);
  assert.throws(() => renderProcessor({ name: "prefix-${DB_NAME}" }, environment), /entire string/);
  assert.throws(() => renderProcessor(template, { ...environment, DB_NAME: "${OTHER_DB}" }), /unresolved placeholders/);
});

test("renderer CLI works from another working directory without requiring credentials", (context) => {
  const directory = fixture(context);
  fs.mkdirSync(path.join(directory, "scripts"));
  fs.mkdirSync(path.join(directory, "processors"));
  fs.copyFileSync(path.join(root, "scripts/render-processor.js"), path.join(directory, "scripts/render-processor.js"));
  fs.copyFileSync(path.join(root, "processors/life_event_inference.json"), path.join(directory, "processors/life_event_inference.json"));
  fs.copyFileSync(path.join(root, ".env.example"), path.join(directory, ".env"));
  const { environment } = processorFixture();
  const cli = spawnSync(process.execPath, [path.join(directory, "scripts/render-processor.js")], {
    cwd: os.tmpdir(), env: { ...process.env, ...environment }, encoding: "utf8", timeout: 10000,
  });
  assert.ifError(cli.error);
  assert.equal(cli.status, 0, cli.stderr);
  const rendered = JSON.parse(fs.readFileSync(path.join(directory, "processors/generated/life_event_inference.json"), "utf8"));
  assert.equal(rendered.name, environment.ASP_PROCESSOR_NAME);
});

test("runtime entry points reject missing MongoDB configuration before any network access", () => {
  for (const file of ["generators/batch-events.js", "generators/stream-events.js", "webui/server.js"]) {
    const result = spawnSync(process.execPath, [path.join(root, file)], {
      cwd: os.tmpdir(), env: { ...process.env, MONGODB_URI: "" }, encoding: "utf8", timeout: 10000,
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Set MONGODB_URI in .env or the process environment/);
    assert.doesNotMatch(result.stderr, /MODULE_NOT_FOUND/);
  }
});

test("private environment files and generated output are ignored but the example remains trackable", () => {
  for (const relative of [".env", ".env.local", "webui/.env", "processors/generated/life_event_inference.json"]) {
    const result = spawnSync("git", ["check-ignore", "--no-index", "--quiet", relative], {
      cwd: root, encoding: "utf8", timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, relative);
  }
  const example = spawnSync("git", ["check-ignore", "--no-index", "--quiet", ".env.example"], {
    cwd: root, encoding: "utf8", timeout: 10000,
  });
  assert.ifError(example.error);
  assert.equal(example.status, 1);
  const { parseEnv } = require("node:util");
  const values = parseEnv(fs.readFileSync(path.join(root, ".env.example"), "utf8"));
  assert.match(values.MONGODB_URI, /^mongodb\+srv:\/\/\.\.\.\/$/);
  assert.equal(values.AI_GATEWAY_API_KEY, "");
  assert.doesNotMatch(fs.readFileSync(path.join(root, ".command"), "utf8"), /MONGODB_URI=|AI_GATEWAY_API_KEY=/);
});