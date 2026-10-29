#!/usr/bin/env node

/**
 * Run:
 * Optional example: configure ../.env, then run node generators/batch-events.js from the project directory.
 *
 * Optional:
 * EVENT_COUNT=20 node generators/batch-events.js
 */

const { MongoClient } = require("mongodb");
const { randomUUID } = require("crypto");
const { mongoSettings, positiveInteger } = require("../config");

const { uri, dbName, collectionName } = mongoSettings();
const eventCount = positiveInteger("EVENT_COUNT");

const nullableString = (value) => (value == null ? null : { string: value });
const isoWithFraction = (date) => date.toISOString().replace("Z", "0000000Z");

const scenarios = [
  {
    eventType: "DATA_MANAGEMENT",
    eventPurposeType: "DATA_CHANGE",
    eventGroupType: "CUSTOMER_DATA_CHANGE",
    sourceSystemId: "CDNA_CDC_CDB_NWB",
    sourceSystemCode: "CDB",
    sourceInstance: "NWB",
    initiatedBy: "TCWEVSG_EVENT_STG",
    cdcEventName: "CDNA_CDC_EVENT",
    stageType: "IN1",
    stageStep: "M",
    schemaSubject: "cdna.cdcenrich.datachange.ces-events-value",
  },
  {
    eventType: "CUSTOMER_INTERACTION",
    eventPurposeType: "SERVICE_INTERACTION",
    eventGroupType: "CUSTOMER_SERVICING",
    sourceSystemId: "CDNA_CDC_CDB_NWB",
    sourceSystemCode: "CDB",
    sourceInstance: "NWB",
    initiatedBy: "TCWEVSG_CUSTOMER_SERVICING",
    cdcEventName: "CDNA_INTERACTION_EVENT",
    stageType: "CS1",
    stageStep: "ENRICH",
    schemaSubject: "cdna.cdcenrich.servicing.ces-events-value",
  },
  {
    eventType: "ACCOUNT_MANAGEMENT",
    eventPurposeType: "ACCOUNT_UPDATE",
    eventGroupType: "ACCOUNT_SERVICING",
    sourceSystemId: "CDNA_CDC_CDB_NWB",
    sourceSystemCode: "CDB",
    sourceInstance: "NWB",
    initiatedBy: "TCWEVSG_ACCOUNT_STG",
    cdcEventName: "CDNA_ACCOUNT_EVENT",
    stageType: "AC1",
    stageStep: "VALIDATE",
    schemaSubject: "cdna.cdcenrich.account.ces-events-value",
  },
];

function buildIdentifiers({ eventRef, cin, sortCode, bban }) {
  return [
    {
      identificationCategory: "EVENT",
      identificationType: "EVENT_REFERENCE",
      identificationValue: String(eventRef),
    },
    {
      identificationCategory: "PARTY",
      identificationType: "CIN",
      identificationValue: String(cin),
    },
    {
      identificationCategory: "BRANCH",
      identificationType: "SORT_CODE",
      identificationValue: String(sortCode),
    },
    {
      identificationCategory: "ACCOUNT",
      identificationType: "BBAN",
      identificationValue: String(bban),
    },
  ];
}

function buildClassifications({ action, sequence, scenario }) {
  return [
    { classificationName: "CDC_ACTION_TYPE", classificationValue: action },
    {
      classificationName: "CDNA_CDC",
      classificationValue: scenario.cdcEventName,
    },
    {
      classificationName: "STAGE_SEQUENCE_NO",
      classificationValue: String(sequence),
    },
    {
      classificationName: "STAGE_TYPE",
      classificationValue: scenario.stageType,
    },
    {
      classificationName: "STAGE_STEP",
      classificationValue: scenario.stageStep,
    },
  ];
}

function buildFields({
  eventRef,
  customerId,
  branchNumber,
  accountNumber,
  sequence,
  contactName,
  contactTel,
  note,
  stageStatus,
  scenario,
}) {
  return {
    EVENT_REF: eventRef,
    CUSTOMER_ID: customerId,
    BRANCH_NUMBER: branchNumber,
    CUSTOMER_ACCOUNT_NUMBER: accountNumber,
    STAGE_SEQUENCE_NO: sequence,
    CREATE_TIMESTAMP: isoWithFraction(new Date()),
    STAGE_TYPE: scenario.stageType,
    STAGE_STEP: scenario.stageStep,
    PAYMENT_TYPE: null,
    STAFF_CONTACT_TEL: nullableString(contactTel),
    STAFF_CONTACT_NAME: nullableString(contactName),
    BENEFICIARY: null,
    ITEM_DESC_CODE: null,
    INTRVW_NOTE_TYPE: nullableString("GN"),
    INTRVW_DESC: nullableString("Account review completed"),
    OVERDRAFT_STATUS: null,
    OVERDRAFT_EXP_DATE: null,
    NOTE_DETAILS: nullableString(note),
    STAGE_EXPIRY_DATE: "2028-08-20",
    STAGE_STATUS: stageStatus,
    CREATE_USERID: nullableString("SYSTEM_USER_01"),
  };
}

function buildRawCdcEvent(currentFields, action, beforeFields, scenario) {
  const beforeImage = Object.fromEntries(
    Object.keys(currentFields).map((field) => [
      `B_${field}`,
      action === "UPDATE" ? beforeFields[field] : null,
    ]),
  );

  return {
    ...currentFields,
    ...beforeImage,
    SRC_SYS_ID: nullableString(scenario.sourceSystemCode),
    SRC_INGEST_MAP: nullableString(scenario.initiatedBy),
    SRC_EVT_TYP_FLG: nullableString(action === "INSERT" ? "IN" : "UP"),
    SRC_SYS_INST_ID: nullableString(scenario.sourceInstance),
    SRC_EXTRACT_TS: nullableString(isoWithFraction(new Date())),
  };
}

function buildEvent({ sequence, action }) {
  const scenario = scenarios[(sequence - 1) % scenarios.length];
  const eventRef = 60124587 + sequence;
  const customerId = 2001450032 + sequence;
  const branchNumber = 601122 + (sequence % 5);
  const accountNumber = 712345 + sequence;

  const beforeFields = buildFields({
    eventRef,
    customerId,
    branchNumber,
    accountNumber,
    sequence,
    contactName: "John Smith",
    contactTel: "john.smith@example.com",
    note: "Customer called regarding direct debit setup",
    stageStatus: "A",
    scenario,
  });

  const currentFields =
    action === "UPDATE"
      ? buildFields({
          eventRef,
          customerId,
          branchNumber,
          accountNumber,
          sequence,
          contactName: "John A. Smith",
          contactTel: "john.smith@example.com",
          note: "Customer called to update direct debit instructions",
          stageStatus: "U",
          scenario,
        })
      : beforeFields;

  const schemaId = `https://schemaregistry.example.com/subjects/${scenario.schemaSubject}/versions/latest/schema`;

  return {
    schemaId,
    eventUniqueId: randomUUID(),
    envelope: {
      schemaId: "envelope/stdevent-envelope-v3.0",
      eventType: scenario.eventType,
      eventPurposeType: scenario.eventPurposeType,
      sourceSystemId: scenario.sourceSystemId,
      initiatedBy: scenario.initiatedBy,
      initiatedTimeStamp: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      eventGroup: {
        eventGroupType: scenario.eventGroupType,
      },
      eventClassification: buildClassifications({
        action,
        sequence,
        scenario,
      }),
      payloadIdentification: buildIdentifiers({
        eventRef,
        cin: customerId,
        sortCode: branchNumber,
        bban: accountNumber,
      }),
    },
    payload: {
      schemaId,
      value: {
        actionedFields: currentFields,
        rawCDCEvent: buildRawCdcEvent(
          currentFields,
          action,
          beforeFields,
          scenario,
        ),
      },
    },
  };
}

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const collection = client.db(dbName).collection(collectionName);

    const events = Array.from({ length: eventCount }, (_, index) =>
      buildEvent({
        sequence: index + 1,
        action: index % 2 === 0 ? "INSERT" : "UPDATE",
      }),
    );

    let inserted = 0;
    for (const event of events) {
      await collection.insertOne(event);
      inserted += 1;
      if (inserted % 100 === 0) {
        console.log(`Inserted ${inserted}/${eventCount} events...`);
      }
    }

    console.log(
      `Inserted ${inserted} CES events into ${dbName}.${collectionName}`,
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
