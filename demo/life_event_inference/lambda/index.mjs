import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

try {
  loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const lifeEventSchema = {
  type: "object",
  properties: {
    lifeEvents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lifeEvent: {
            type: "string",
            enum: ["HOUSE_PURCHASE", "VEHICLE_LOAN", "WEDDING_PLANNING"],
          },
          probability: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["lifeEvent", "probability"],
        additionalProperties: false,
      },
    },
  },
  required: ["lifeEvents"],
  additionalProperties: false,
};

export const handler = async (event = {}) => {
  const { cin, events } = event;
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (cin == null) throw new Error("Missing cin");
  if (!Array.isArray(events)) throw new Error("Expected events[]");
  for (const name of ["AI_GATEWAY_API_KEY", "AI_GATEWAY_URL", "AI_GATEWAY_MODEL"]) {
    if (!process.env[name]?.trim()) throw new Error(`Set ${name} in .env or the Lambda environment.`);
  }

  // Keep direct customer/account identifiers out of the model input.
  const safeEvents = events.map((e) => ({
    occurredAt: e.occurredAt ?? null,
    group: e.group ?? null,
    type: e.type ?? null,
    purpose: e.purpose ?? null,
    description: e.description ?? null,
    note: e.note ?? null,
  }));

  console.log("Safe events - ", safeEvents);
  const response = await fetch(
    process.env.AI_GATEWAY_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL,
        input: [
          {
            role: "system",
            content:
              "Infer possible life events from the customer interaction events. Treat them as hypotheses, not facts. Use only the allowed labels. Return an empty list if none is supported. Probabilities are estimates, not calibrated scores.",
          },
          { role: "user", content: JSON.stringify(safeEvents) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "life_event_predictions",
            strict: true,
            schema: lifeEventSchema,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    const networkDenied = /RBAC:\s*access denied/i.test(body);
  
    throw new Error(
      `AI gateway returned HTTP ${response.status}` +
        (networkDenied
          ? " (RBAC access denied; likely network ACL)"
          : " (check gateway authorization or model access)")
    );
  }  

  const result = await response.json();
  const outputText = result.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;

  if (!outputText) throw new Error("Gateway returned no output text");

  const { lifeEvents } = JSON.parse(outputText);

  console.log(
    JSON.stringify({
      check: "lambda_output",
      lifeEventCount: lifeEvents.length,
      lifeEventLabels: lifeEvents.map((item) => item.lifeEvent),
    }),
  );

  return { cin, lifeEvents };
};
