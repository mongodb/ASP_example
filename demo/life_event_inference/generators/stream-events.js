#!/usr/bin/env node

/**
 * Inserts realistic customer-activity CES events (same shape as batch-events.js).
 * Each customer has a life-event storyline (house purchase, vehicle loan,
 * wedding planning, or a plain baseline). Events keep the same narrative
 * ordering as the historical version but are inserted in real time, one at a
 * time with a 0.5-2s random gap, timestamped at insert (no late events for ASP).
 *
 * Optional example: configure ../.env, then run node generators/stream-events.js from the project directory.
 */

const { MongoClient } = require("mongodb");
const { randomUUID } = require("crypto");
const { mongoSettings } = require("../config");

const { uri, dbName, collectionName } = mongoSettings();

const nullableString = (value) => (value == null ? null : { string: value });
const isoWithFraction = (date) => date.toISOString().replace("Z", "0000000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days) =>
  new Date(
    Date.now() - days * DAY + Math.floor(Math.random() * 8 * 60 * 60 * 1000),
  );

// --- Activity catalogues ----------------------------------------------------
// Each activity becomes one event. `day` = days before now (fractions ok).

const BACKGROUND = [
  {
    group: "PAYMENTS",
    type: "PAYMENT_PROCESSING",
    purpose: "PAYMENT",
    note: "Faster payment to British Gas - monthly utility bill",
    intrvw: "Utility bill payment",
  },
  {
    group: "PAYMENTS",
    type: "PAYMENT_PROCESSING",
    purpose: "PAYMENT",
    note: "Direct debit collected - Netflix subscription",
    intrvw: "Subscription direct debit",
  },
  {
    group: "PAYMENTS",
    type: "PAYMENT_PROCESSING",
    purpose: "PAYMENT",
    note: "Card payment - Tesco groceries",
    intrvw: "Debit card purchase",
  },
  {
    group: "CUSTOMER_SERVICING",
    type: "CUSTOMER_INTERACTION",
    purpose: "SERVICE_INTERACTION",
    note: "Customer logged into mobile app and viewed statement",
    intrvw: "Mobile app login",
  },
  {
    group: "PAYMENTS",
    type: "PAYMENT_PROCESSING",
    purpose: "PAYMENT",
    note: "Standing order - monthly rent payment",
    intrvw: "Rent standing order",
  },
  {
    group: "CUSTOMER_SERVICING",
    type: "CUSTOMER_INTERACTION",
    purpose: "SERVICE_INTERACTION",
    note: "Customer updated marketing preferences online",
    intrvw: "Preference update",
  },
];

const STORYLINES = {
  HOUSE_PURCHASE: [
    {
      day: 14,
      group: "CUSTOMER_SERVICING",
      type: "CUSTOMER_INTERACTION",
      purpose: "SERVICE_INTERACTION",
      note: "Customer used online mortgage affordability calculator three times",
      intrvw: "Mortgage calculator usage",
    },
    {
      day: 12,
      group: "LENDING",
      type: "PRODUCT_ENQUIRY",
      purpose: "PRODUCT_ENQUIRY",
      note: "Customer requested mortgage Agreement in Principle via web",
      intrvw: "Agreement in Principle request",
    },
    {
      day: 11,
      group: "CUSTOMER_SERVICING",
      type: "CUSTOMER_INTERACTION",
      purpose: "SERVICE_INTERACTION",
      note: "Customer requested copy of credit report and proof of income letter",
      intrvw: "Credit report and income proof request",
    },
    {
      day: 9,
      group: "ACCOUNT_SERVICING",
      type: "ACCOUNT_MANAGEMENT",
      purpose: "ACCOUNT_UPDATE",
      note: "Transfer of 25000 GBP from ISA to current account - customer cited house deposit",
      intrvw: "Large savings withdrawal for deposit",
    },
    {
      day: 7,
      group: "LENDING",
      type: "PRODUCT_ENQUIRY",
      purpose: "PRODUCT_ENQUIRY",
      note: "Mortgage adviser appointment booked at branch for fixed rate discussion",
      intrvw: "Mortgage adviser appointment booked",
    },
    {
      day: 4,
      group: "CUSTOMER_SERVICING",
      type: "CUSTOMER_INTERACTION",
      purpose: "SERVICE_INTERACTION",
      note: "Customer enquired about home insurance quotes for a 3-bed property",
      intrvw: "Home insurance enquiry",
    },
    {
      day: 2,
      group: "PAYMENTS",
      type: "PAYMENT_PROCESSING",
      purpose: "PAYMENT",
      note: "CHAPS payment of 500 GBP to Hamilton Conveyancing Solicitors",
      intrvw: "Solicitor fee payment",
    },
  ],
  VEHICLE_LOAN: [
    {
      day: 13,
      group: "CUSTOMER_SERVICING",
      type: "CUSTOMER_INTERACTION",
      purpose: "SERVICE_INTERACTION",
      note: "Customer browsed personal loan pages for car purchase amounts 15000-20000 GBP",
      intrvw: "Car loan pages browsed",
    },
    {
      day: 11,
      group: "LENDING",
      type: "PRODUCT_ENQUIRY",
      purpose: "PRODUCT_ENQUIRY",
      note: "Personal loan quote generated - 18000 GBP over 48 months, purpose: vehicle purchase",
      intrvw: "Vehicle loan quote",
    },
    {
      day: 8,
      group: "CUSTOMER_SERVICING",
      type: "CUSTOMER_INTERACTION",
      purpose: "SERVICE_INTERACTION",
      note: "Customer called to ask about loan early repayment charges and APR",
      intrvw: "Loan terms phone enquiry",
    },
    {
      day: 6,
      group: "PAYMENTS",
      type: "PAYMENT_PROCESSING",
      purpose: "PAYMENT",
      note: "Card payment of 200 GBP to Arnold Clark - holding deposit on used vehicle",
      intrvw: "Dealership holding deposit",
    },
    {
      day: 3,
      group: "LENDING",
      type: "PRODUCT_ENQUIRY",
      purpose: "PRODUCT_ENQUIRY",
      note: "Loan affordability check completed, customer uploaded payslips",
      intrvw: "Loan affordability check",
    },
    {
      day: 1,
      group: "CUSTOMER_SERVICING",
      type: "CUSTOMER_INTERACTION",
      purpose: "SERVICE_INTERACTION",
      note: "Customer enquired about adding motor insurance via bank partner",
      intrvw: "Motor insurance enquiry",
    },
  ],
  WEDDING_PLANNING: [
    {
      day: 15,
      group: "PAYMENTS",
      type: "PAYMENT_PROCESSING",
      purpose: "PAYMENT",
      note: "Card payment of 1500 GBP to The Grand Venue Ltd - event deposit",
      intrvw: "Wedding venue deposit",
    },
    {
      day: 12,
      group: "CUSTOMER_SERVICING",
      type: "CUSTOMER_INTERACTION",
      purpose: "SERVICE_INTERACTION",
      note: "Customer enquired about opening a joint account with partner",
      intrvw: "Joint account enquiry",
    },
    {
      day: 10,
      group: "PAYMENTS",
      type: "PAYMENT_PROCESSING",
      purpose: "PAYMENT",
      note: "Payment of 800 GBP to Elegant Bridal Boutique",
      intrvw: "Bridal boutique payment",
    },
    {
      day: 8,
      group: "LENDING",
      type: "PRODUCT_ENQUIRY",
      purpose: "PRODUCT_ENQUIRY",
      note: "Personal loan quote - 10000 GBP, purpose stated: wedding expenses",
      intrvw: "Wedding loan quote",
    },
    {
      day: 5,
      group: "ACCOUNT_SERVICING",
      type: "ACCOUNT_MANAGEMENT",
      purpose: "ACCOUNT_UPDATE",
      note: "Customer requested temporary credit card limit increase citing upcoming wedding costs",
      intrvw: "Card limit increase request",
    },
    {
      day: 2,
      group: "PAYMENTS",
      type: "PAYMENT_PROCESSING",
      purpose: "PAYMENT",
      note: "Payment of 600 GBP to Firefly Wedding Photography",
      intrvw: "Wedding photographer payment",
    },
  ],
  BASELINE: [], // only background noise - control customer
};

const customers = [
  {
    name: "Alice Hargreaves",
    cin: 3001450001,
    account: 81234501,
    sortCode: 601101,
    storyline: "HOUSE_PURCHASE",
  },
  {
    name: "Ben Okafor",
    cin: 3001450002,
    account: 81234502,
    sortCode: 601102,
    storyline: "VEHICLE_LOAN",
  },
  {
    name: "Chloe Mathieson",
    cin: 3001450003,
    account: 81234503,
    sortCode: 601103,
    storyline: "WEDDING_PLANNING",
  },
  {
    name: "Dev Patel",
    cin: 3001450004,
    account: 81234504,
    sortCode: 601104,
    storyline: "BASELINE",
  },
];

// --- Event construction (same shape as index.js) ----------------------------

function buildFields({ eventRef, customer, sequence, activity, timestamp }) {
  return {
    EVENT_REF: eventRef,
    CUSTOMER_ID: customer.cin,
    BRANCH_NUMBER: customer.sortCode,
    CUSTOMER_ACCOUNT_NUMBER: customer.account,
    STAGE_SEQUENCE_NO: sequence,
    CREATE_TIMESTAMP: isoWithFraction(timestamp),
    STAGE_TYPE: "CS1",
    STAGE_STEP: "ENRICH",
    PAYMENT_TYPE: activity.group === "PAYMENTS" ? nullableString("FPS") : null,
    STAFF_CONTACT_TEL: null,
    STAFF_CONTACT_NAME: null,
    BENEFICIARY: null,
    ITEM_DESC_CODE: null,
    INTRVW_NOTE_TYPE: nullableString("GN"),
    INTRVW_DESC: nullableString(activity.intrvw),
    OVERDRAFT_STATUS: null,
    OVERDRAFT_EXP_DATE: null,
    NOTE_DETAILS: nullableString(activity.note),
    STAGE_EXPIRY_DATE: "2028-08-20",
    STAGE_STATUS: "A",
    CREATE_USERID: nullableString("SYSTEM_USER_01"),
  };
}

function buildEvent({ sequence, customer, activity, timestamp }) {
  const eventRef = 70200000 + sequence;
  const schemaSubject = "cdna.cdcenrich.servicing.ces-events-value";
  const schemaId = `https://schemaregistry.example.com/subjects/${schemaSubject}/versions/latest/schema`;
  const fields = buildFields({
    eventRef,
    customer,
    sequence,
    activity,
    timestamp,
  });

  const rawCDCEvent = {
    ...fields,
    ...Object.fromEntries(Object.keys(fields).map((f) => [`B_${f}`, null])),
    SRC_SYS_ID: nullableString("CDB"),
    SRC_INGEST_MAP: nullableString("TCWEVSG_CUSTOMER_SERVICING"),
    SRC_EVT_TYP_FLG: nullableString("IN"),
    SRC_SYS_INST_ID: nullableString("NWB"),
    SRC_EXTRACT_TS: nullableString(isoWithFraction(timestamp)),
  };

  return {
    schemaId,
    eventUniqueId: randomUUID(),
    envelope: {
      schemaId: "envelope/stdevent-envelope-v3.0",
      eventType: activity.type,
      eventPurposeType: activity.purpose,
      sourceSystemId: "CDNA_CDC_CDB_NWB",
      initiatedBy: "TCWEVSG_CUSTOMER_SERVICING",
      initiatedTimeStamp: timestamp.toISOString(),
      eventGroup: { eventGroupType: activity.group },
      eventClassification: [
        {
          classificationName: "CDC_ACTION_TYPE",
          classificationValue: "INSERT",
        },
        {
          classificationName: "CDNA_CDC",
          classificationValue: "CDNA_INTERACTION_EVENT",
        },
        {
          classificationName: "STAGE_SEQUENCE_NO",
          classificationValue: String(sequence),
        },
        { classificationName: "STAGE_TYPE", classificationValue: "CS1" },
        { classificationName: "STAGE_STEP", classificationValue: "ENRICH" },
      ],
      payloadIdentification: [
        {
          identificationCategory: "EVENT",
          identificationType: "EVENT_REFERENCE",
          identificationValue: String(eventRef),
        },
        {
          identificationCategory: "PARTY",
          identificationType: "CIN",
          identificationValue: String(customer.cin),
        },
        {
          identificationCategory: "BRANCH",
          identificationType: "SORT_CODE",
          identificationValue: String(customer.sortCode),
        },
        {
          identificationCategory: "ACCOUNT",
          identificationType: "BBAN",
          identificationValue: String(customer.account),
        },
      ],
    },
    payload: {
      schemaId,
      value: { actionedFields: fields, rawCDCEvent },
    },
  };
}

// --- Generate ---------------------------------------------------------------

// Plan the same documents/order as before, but assign timestamps at insert
// time so events arrive in real time with no lateness for ASP.
function generatePlan() {
  const plan = [];
  let sequence = 0;

  for (const customer of customers) {
    // Background noise: routine activity every ~4 days over the last 120 days.
    for (let day = 120; day > 0; day -= 3 + Math.floor(Math.random() * 4)) {
      const activity =
        BACKGROUND[Math.floor(Math.random() * BACKGROUND.length)];
      plan.push({ sequence: ++sequence, customer, activity, sortKey: daysAgo(day) });
    }
    // Storyline: intent-signalling activity clustered in the last 15 days.
    for (const activity of STORYLINES[customer.storyline]) {
      plan.push({
        sequence: ++sequence,
        customer,
        activity,
        sortKey: daysAgo(activity.day),
      });
    }
  }

  // ponytail: one customer at a time so a single window (keyed by CUSTOMER_ID,
  // length >= ~60s) always sees the customer's whole storyline in one shot
  return plan.sort(
    (a, b) => a.customer.cin - b.customer.cin || a.sortKey - b.sortKey,
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);
    const plan = generatePlan();
    const counts = {};

    for (const [i, { sequence, customer, activity }] of plan.entries()) {
      const event = buildEvent({
        sequence,
        customer,
        activity,
        timestamp: new Date(),
      });
      await collection.insertOne(event);
      counts[customer.cin] = (counts[customer.cin] || 0) + 1;
      console.log(
        `[${i + 1}/${plan.length}] ${new Date().toISOString()} ${customer.name}: ${activity.intrvw}`,
      );
      // ponytail: 500-1000ms gap keeps each customer's burst under ~35s,
      // so it fits in one 60s window; retune if you change window sizing
      if (i < plan.length - 1) await sleep(500 + Math.random() * 500);
    }

    for (const customer of customers) {
      console.log(
        `${customer.name} (CIN ${customer.cin}, ${customer.storyline}): ${counts[customer.cin] || 0} events`,
      );
    }
    console.log(
      `Inserted ${plan.length} events into ${dbName}.${collectionName}`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
