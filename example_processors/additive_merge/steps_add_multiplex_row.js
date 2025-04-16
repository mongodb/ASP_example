//This processor adds Steps to multiple collections based on the report format - raw, weekly, monthly, yearly. Multi-plexing a single message into multiple collections. 

db.createCollection("steps_raw")
db.steps_raw.createIndex({"report_id": 1}, {unique: true})
db.createCollection("steps_weekly")
db.steps_weekly.createIndex({"report_id": 1}, {unique: true})
db.createCollection("steps_monthly")
db.steps_monthly.createIndex({"report_id": 1}, {unique: true})
db.createCollection("steps_yearly")
db.steps_yearly.createIndex({"report_id": 1}, {unique: true})

db.hextest.insertOne({hex:"03C8", user : "joe", timstam : new ISODate("2022-12-01T14:10:30Z")}) //2022
db.hextest.insertOne({hex:"03C8", user : "joe", timstam : new ISODate("2023-05-01T14:10:30Z")}) //2023 05
db.hextest.insertOne({hex:"03C8", user : "joe", timstam : new ISODate("2023-12-01T14:10:30Z")}) // 2023 12
db.hextest.insertOne({hex:"03C8", user : "joe", timstam : new ISODate("2023-12-29T14:10:30Z")}) //2023 12 52
db.hextest.insertOne({hex:"03C8", user : "joe", timstam : new ISODate("2023-12-30T14:10:30Z")}) // 2023 12 52
db.hextest.insertOne({hex:"03C8", user : "joe", timstam : new ISODate("2023-12-30T14:11:30Z")}) // 2023 12 52
db.hextest.insertOne({hex:"03C8", user : "joe", timstam : new ISODate()}) //now

s = {
    $source:  {
        connectionName: 'jsncluster0',
        db: 'test',
        coll: 'hextest',
        config : {
          fullDocument: 'whenAvailable',
          fullDocumentBeforeChange: 'whenAvailable',
        },    
  }
}

rr = {
  $replaceRoot: {newRoot: '$fullDocument'}
}

af = {$addFields: {hexDec : { 
  $sum: {
    $map: {
       input: { $range: [0, { $strLenBytes: "$hex" }] },
       in: { $multiply: [
             { $pow: [16, { $subtract: [{ $strLenBytes: "$hex" }, { $add: ["$$this", 1] }] }] },
             { $indexOfBytes: ["0123456789ABCDEF", { $toUpper: { $substrBytes: ["$hex", "$$this", 1] } }] }
          ]
       }
    }
 }
}
}}


p = {$project : {
  user : 1,
  steps : "$hexDec",
  timstam : 1,
  reports : [
      "raw", "weekly", "monthly", "yearly"
    ],
    steps_week : {$toString: {$week : "$timstam"}},
    steps_month : { $toString:{$month : "$timstam"}},
    steps_year : { $toString:{$year : "$timstam"}},
    strtime : {$dateToString: { date : "$timstam"}}
}}

uw = { '$unwind': '$reports' }

idgen = {$addFields : { report_id : 
      {$switch : {
        branches: [
          { case: { $eq: ["$reports", "weekly"]}, then: {$concat : ["$user", "-", "$steps_week", "-", "$steps_month", "-", "$steps_year"] } },
          { case: { $eq: ["$reports", "monthly"]}, then: {$concat : ["$user", "-", "$steps_month", "-", "$steps_year"] } },
          { case: { $eq: ["$reports", "yearly"]}, then: {$concat : ["$user", "-", "$steps_year"] } },

        ],
        default: {$concat : ["$user","-","$strtime"]}}
      } }}

unset = {$unset : ["_id", "strtime"] }


m = {$merge : {
  into: {
      connectionName: "jsncluster0",
      db: "test",
      coll: {$concat : ["steps_", "$reports"]}},
      on: ["report_id"],
      let : {value : "$steps"},
      whenMatched : [ { $addFields: {
        steps: { $add:[ "$steps", "$$value" ] },
      } }],
     whenNotMatched: "insert"
}}

dlq = {dlq: {connectionName: "jsncluster0", db: "test", coll: "steps_dlq"}}

sp.createStreamProcessor('steps', [s,rr,af,p,uw,idgen,unset,m], dlq)

sp.process([s,rr,af,p,uw,idgen,unset,m])


db.steps_raw.remove({})
db.steps_weekly.remove({})
db.steps_yearly.remove({})
db.steps_monthly.remove({})


/*
Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_raw.find()
[
  {
    _id: ObjectId("65bbd92406169f8e7c8facf4"),
    user: 'joe',
    timstam: ISODate("2022-12-01T14:10:30.000Z"),
    steps: 968,
    reports: 'raw',
    steps_week: '48',
    steps_month: '12',
    steps_year: '2022',
    report_id: 'joe-2022-12-01T14:10:30.000Z',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:13.677Z")
    }
  },
  {
    _id: ObjectId("65bbd92606169f8e7c8fad40"),
    user: 'joe',
    timstam: ISODate("2023-05-01T14:10:30.000Z"),
    steps: 968,
    reports: 'raw',
    steps_week: '18',
    steps_month: '5',
    steps_year: '2023',
    report_id: 'joe-2023-05-01T14:10:30.000Z',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:17.464Z")
    }
  },
  {
    _id: ObjectId("65bbd92a06169f8e7c8fada2"),
    user: 'joe',
    timstam: ISODate("2023-12-01T14:10:30.000Z"),
    steps: 968,
    reports: 'raw',
    steps_week: '48',
    steps_month: '12',
    steps_year: '2023',
    report_id: 'joe-2023-12-01T14:10:30.000Z',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:20.956Z")
    }
  },
  {
    _id: ObjectId("65bbd92e06169f8e7c8fae09"),
    user: 'joe',
    timstam: ISODate("2023-12-29T14:10:30.000Z"),
    steps: 968,
    reports: 'raw',
    steps_week: '52',
    steps_month: '12',
    steps_year: '2023',
    report_id: 'joe-2023-12-29T14:10:30.000Z',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:24.890Z")
    }
  },
  {
    _id: ObjectId("65bbd93606169f8e7c8faea0"),
    user: 'joe',
    timstam: ISODate("2023-12-30T14:10:30.000Z"),
    steps: 968,
    reports: 'raw',
    steps_week: '52',
    steps_month: '12',
    steps_year: '2023',
    report_id: 'joe-2023-12-30T14:10:30.000Z',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:31.692Z")
    }
  },
  {
    _id: ObjectId("65bbd93a06169f8e7c8faf64"),
    user: 'joe',
    timstam: ISODate("2023-12-30T14:11:30.000Z"),
    steps: 968,
    reports: 'raw',
    steps_week: '52',
    steps_month: '12',
    steps_year: '2023',
    report_id: 'joe-2023-12-30T14:11:30.000Z',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:35.700Z")
    }
  },
  {
    _id: ObjectId("65bbd93c06169f8e7c8fafb0"),
    user: 'joe',
    timstam: ISODate("2024-02-01T17:47:39.305Z"),
    steps: 968,
    reports: 'raw',
    steps_week: '4',
    steps_month: '2',
    steps_year: '2024',
    report_id: 'joe-2024-02-01T17:47:39.305Z',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:39.377Z")
    }
  }
]
Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_weekly.find()
[
  {
    _id: ObjectId("65bbd92406169f8e7c8face9"),
    user: 'joe',
    timstam: ISODate("2022-12-01T14:10:30.000Z"),
    steps: 968,
    reports: 'weekly',
    steps_week: '48',
    steps_month: '12',
    steps_year: '2022',
    report_id: 'joe-48-12-2022',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:13.677Z")
    }
  },
  {
    _id: ObjectId("65bbd92606169f8e7c8fad36"),
    user: 'joe',
    timstam: ISODate("2023-05-01T14:10:30.000Z"),
    steps: 968,
    reports: 'weekly',
    steps_week: '18',
    steps_month: '5',
    steps_year: '2023',
    report_id: 'joe-18-5-2023',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:17.464Z")
    }
  },
  {
    _id: ObjectId("65bbd92a06169f8e7c8fadac"),
    user: 'joe',
    timstam: ISODate("2023-12-01T14:10:30.000Z"),
    steps: 968,
    reports: 'weekly',
    steps_week: '48',
    steps_month: '12',
    steps_year: '2023',
    report_id: 'joe-48-12-2023',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:20.956Z")
    }
  },
  {
    _id: ObjectId("65bbd92e06169f8e7c8fae13"),
    user: 'joe',
    timstam: ISODate("2023-12-29T14:10:30.000Z"),
    steps: 2904,
    reports: 'weekly',
    steps_week: '52',
    steps_month: '12',
    steps_year: '2023',
    report_id: 'joe-52-12-2023',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:24.890Z")
    }
  },
  {
    _id: ObjectId("65bbd93c06169f8e7c8fafba"),
    user: 'joe',
    timstam: ISODate("2024-02-01T17:47:39.305Z"),
    steps: 968,
    reports: 'weekly',
    steps_week: '4',
    steps_month: '2',
    steps_year: '2024',
    report_id: 'joe-4-2-2024',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:39.377Z")
    }
  }
]
Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_monthly.find()
[
  {
    _id: ObjectId("65bbd92406169f8e7c8fad00"),
    user: 'joe',
    timstam: ISODate("2022-12-01T14:10:30.000Z"),
    steps: 968,
    reports: 'monthly',
    steps_week: '48',
    steps_month: '12',
    steps_year: '2022',
    report_id: 'joe-12-2022',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:13.677Z")
    }
  },
  {
    _id: ObjectId("65bbd92606169f8e7c8fad4a"),
    user: 'joe',
    timstam: ISODate("2023-05-01T14:10:30.000Z"),
    steps: 968,
    reports: 'monthly',
    steps_week: '18',
    steps_month: '5',
    steps_year: '2023',
    report_id: 'joe-5-2023',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:17.464Z")
    }
  },
  {
    _id: ObjectId("65bbd92a06169f8e7c8fad98"),
    user: 'joe',
    timstam: ISODate("2023-12-01T14:10:30.000Z"),
    steps: 3872,
    reports: 'monthly',
    steps_week: '48',
    steps_month: '12',
    steps_year: '2023',
    report_id: 'joe-12-2023',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:20.956Z")
    }
  },
  {
    _id: ObjectId("65bbd93c06169f8e7c8fafa6"),
    user: 'joe',
    timstam: ISODate("2024-02-01T17:47:39.305Z"),
    steps: 968,
    reports: 'monthly',
    steps_week: '4',
    steps_month: '2',
    steps_year: '2024',
    report_id: 'joe-2-2024',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:39.377Z")
    }
  }
]
Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_yearly.find()
[
  {
    _id: ObjectId("65bbd92406169f8e7c8facde"),
    user: 'joe',
    timstam: ISODate("2022-12-01T14:10:30.000Z"),
    steps: 968,
    reports: 'yearly',
    steps_week: '48',
    steps_month: '12',
    steps_year: '2022',
    report_id: 'joe-2022',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:13.677Z")
    }
  },
  {
    _id: ObjectId("65bbd92606169f8e7c8fad2c"),
    user: 'joe',
    timstam: ISODate("2023-05-01T14:10:30.000Z"),
    steps: 4840,
    reports: 'yearly',
    steps_week: '18',
    steps_month: '5',
    steps_year: '2023',
    report_id: 'joe-2023',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:17.464Z")
    }
  },
  {
    _id: ObjectId("65bbd93c06169f8e7c8faf9c"),
    user: 'joe',
    timstam: ISODate("2024-02-01T17:47:39.305Z"),
    steps: 968,
    reports: 'yearly',
    steps_week: '4',
    steps_month: '2',
    steps_year: '2024',
    report_id: 'joe-2024',
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-02-01T17:47:39.377Z")
    }
  }
]
*/
