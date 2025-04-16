db.createCollection("steps_daily")
db.steps_daily.createIndex({"report_id": 1}, {unique: true})
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
        timeField :  { $toDate : "$fullDocument.timstam"},
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
       "daily", "weekly", "monthly", "yearly"
    ],
    steps_day : {$toString: {$dayOfMonth : "$timstam"}},
    steps_week : {$toString: {$week : "$timstam"}},
    steps_month : { $toString:{$month : "$timstam"}},
    steps_year : { $toString:{$year : "$timstam"}},
    strtime : {$dateToString: { date : "$timstam"}}
}}

uw = { '$unwind': '$reports' }

idgen = {$addFields : { report_id : 
      {$switch : {
        branches: [
          { case: { $eq: ["$reports", "weekly"]}, then: {$concat : ["$user", "-", "$steps_week", "$steps_year"] } },
          { case: { $eq: ["$reports", "monthly"]}, then: {$concat : ["$user", "-", "$steps_month", "-", "$steps_year"] } },
          { case: { $eq: ["$reports", "yearly"]}, then: {$concat : ["$user", "-", "$steps_year"] } },

        ],
        default: {$concat : ["$user", "-", "$steps_day", "-", "$steps_month", "-", "$steps_year"]}}
      } }}

unset = {$unset : ["_id", "strtime", "timstam", "steps_day", "steps_week", "steps_month", "steps_year"] }

w = {
  $tumblingWindow: {
      interval: {size: NumberInt(60), unit: "minute"},
      idleTimeout: {size: NumberInt(5), unit: "minute"},
      allowedLateness : {size: NumberInt(15), unit: "minute"},
      pipeline: [
          { $group : {
              _id : { report_id: '$report_id', reports : '$reports', user : '$user'},
              steps : {$sum : '$steps'}
          },
      },
      ]
  }
}

p2 = {$project : { 
  _id : 0,
  report_id : '$_id.report_id',
  user : '$_id.user',
  reports : '$_id.reports',
  steps : 1
}}


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

dlq = {dlq: {connectionName: "jsncluster0", db: "test", coll: "hex_dlq"}}

sp.createStreamProcessor('hex', [s,rr,af,p,uw,idgen,unset,w,p2,m], dlq)

sp.process([s,rr,af,p,uw,idgen,unset,w,p2,m])


db.steps_daily.remove({})
db.steps_weekly.remove({})
db.steps_yearly.remove({})
db.steps_monthly.remove({})

db.steps_daily.find()
db.steps_weekly.find()
db.steps_monthly.find()
db.steps_yearly.find()



/* BELOW RESULTS DIDNT WAIT FOR THE LAST WINDOW TO CLOSE FOR THE LAST RECORD.
    Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_daily.find()
[
  {
    _id: ObjectId("65bbd57606169f8e7c8f6a33"),
    steps: 968,
    report_id: 'joe-1-12-2022',
    user: 'joe',
    reports: 'daily',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2022-12-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2022-12-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd57a06169f8e7c8f6a94"),
    steps: 968,
    report_id: 'joe-1-5-2023',
    user: 'joe',
    reports: 'daily',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-05-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-05-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd57c06169f8e7c8f6b05"),
    steps: 968,
    report_id: 'joe-1-12-2023',
    user: 'joe',
    reports: 'daily',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-12-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-12-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd58006169f8e7c8f6b65"),
    steps: 968,
    report_id: 'joe-29-12-2023',
    user: 'joe',
    reports: 'daily',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-12-29T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-12-29T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd58806169f8e7c8f6c68"),
    steps: 1936,
    report_id: 'joe-30-12-2023',
    user: 'joe',
    reports: 'daily',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-12-30T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-12-30T15:00:00.000Z")
    }
  }
]
Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_weekly.find()
[
  {
    _id: ObjectId("65bbd57606169f8e7c8f6a28"),
    steps: 968,
    report_id: 'joe-482022',
    user: 'joe',
    reports: 'weekly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2022-12-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2022-12-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd57a06169f8e7c8f6a9e"),
    steps: 968,
    report_id: 'joe-182023',
    user: 'joe',
    reports: 'weekly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-05-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-05-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd57c06169f8e7c8f6b0f"),
    steps: 968,
    report_id: 'joe-482023',
    user: 'joe',
    reports: 'weekly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-12-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-12-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd58006169f8e7c8f6b6f"),
    steps: 2904,
    report_id: 'joe-522023',
    user: 'joe',
    reports: 'weekly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-12-29T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-12-29T15:00:00.000Z")
    }
  }
]
Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_monthly.find()
[
  {
    _id: ObjectId("65bbd57606169f8e7c8f6a49"),
    steps: 968,
    report_id: 'joe-12-2022',
    user: 'joe',
    reports: 'monthly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2022-12-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2022-12-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd57a06169f8e7c8f6ab2"),
    steps: 968,
    report_id: 'joe-5-2023',
    user: 'joe',
    reports: 'monthly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-05-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-05-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd57c06169f8e7c8f6b22"),
    steps: 3872,
    report_id: 'joe-12-2023',
    user: 'joe',
    reports: 'monthly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-12-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-12-01T15:00:00.000Z")
    }
  }
]
Atlas atlas-ec9c8m-shard-0 [primary] test> db.steps_yearly.find()
[
  {
    _id: ObjectId("65bbd57606169f8e7c8f6a3e"),
    steps: 968,
    report_id: 'joe-2022',
    user: 'joe',
    reports: 'yearly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2022-12-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2022-12-01T15:00:00.000Z")
    }
  },
  {
    _id: ObjectId("65bbd57a06169f8e7c8f6aa8"),
    steps: 4840,
    report_id: 'joe-2023',
    user: 'joe',
    reports: 'yearly',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-05-01T14:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-05-01T15:00:00.000Z")
    }
  }
]
    */
