const fs = require("node:fs");
const path = require("node:path");
const { requiredSetting, positiveInteger } = require("../config");

function renderProcessor(template, environment = process.env) {
  const names = [
    "DB_NAME", "COLLECTION_NAME", "INSIGHTS_DB", "INSIGHTS_COLLECTION",
    "ASP_PROCESSOR_NAME", "ASP_ATLAS_CONNECTION", "ASP_LAMBDA_CONNECTION",
    "ASP_LAMBDA_FUNCTION", "ASP_TIER", "ASP_DLQ_DB", "ASP_DLQ_COLLECTION",
  ];
  const settings = Object.fromEntries(names.map((name) => [name, requiredSetting(name, environment)]));
  for (const name of ["ASP_WINDOW_SECONDS", "ASP_HOP_SECONDS", "ASP_PARALLELISM"]) {
    settings[name] = positiveInteger(name, undefined, environment);
  }
  if (settings.ASP_HOP_SECONDS > settings.ASP_WINDOW_SECONDS) {
    throw new Error("ASP_HOP_SECONDS must not exceed ASP_WINDOW_SECONDS.");
  }
  if (!/^SP[1-9]\d*$/.test(settings.ASP_TIER)) {
    throw new Error("ASP_TIER must use the SP<number> format.");
  }

  function resolve(value) {
    if (Array.isArray(value)) return value.map(resolve);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, resolve(entry)]));
    }
    if (typeof value !== "string") return value;
    if (value.startsWith("${") && value.endsWith("}")) {
      const name = value.slice(2, -1);
      if (!Object.hasOwn(settings, name)) throw new Error("Unsupported processor configuration placeholder.");
      if (typeof settings[name] === "string" && settings[name].includes("${")) {
        throw new Error(`${name} must not contain unresolved placeholders.`);
      }
      return settings[name];
    }
    if (value.includes("${")) throw new Error("Processor placeholders must occupy the entire string value.");
    return value;
  }

  return resolve(template);
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, "..");
    const template = JSON.parse(fs.readFileSync(path.join(root, "processors/life_event_inference.json"), "utf8"));
    const output = path.join(root, "processors/generated/life_event_inference.json");
    const processor = renderProcessor(template);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(processor, null, 2)}\n`);
    console.log("Rendered processors/generated/life_event_inference.json");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { renderProcessor };