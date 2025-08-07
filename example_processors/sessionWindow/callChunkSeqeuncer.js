db.call.insertOne({call : 1, agent : "bob", start : new ISODate("2025-01-01T00:00:00Z"), end : new ISODate("2025-01-01T00:10:00Z")})
db.call.insertOne({call : 2, agent : "adam", start : new ISODate("2025-01-01T00:00:00Z"), end : new ISODate("2025-01-01T00:10:00Z")})
db.call.insertOne({call : 2, agent : "john", start : new ISODate("2025-01-01T00:10:01Z"), end : new ISODate("2025-01-01T00:15:00Z")})



s = {$source : {documents : [
    {call : 1, chunk : "words1", time : new ISODate("2025-01-01T00:00:01Z")}, 
    {call : 1, chunk : "words2", time : new ISODate("2025-01-01T00:00:02Z")}, 
    {call : 1, chunk : "words3", time : new ISODate("2025-01-01T00:00:03Z")},
{call : 2, chunk : "words1", time : new ISODate("2025-01-01T00:09:01Z")}, 
{call : 2, chunk : "words2-transfer", time : new ISODate("2025-01-01T00:11:02Z")}, 
{call : 2, chunk : "words3-transfer", time : new ISODate("2025-01-01T00:14:00Z")}]}}

w = {$sessionWindow : {
      partitionBy: "$call",
      gap: {unit: "second", size: 1},
      pipeline: [{$group: {_id : "$call", docs : {$push : "$$ROOT"}}},
                 {$lookup: {
                    from: {
                        connectionName: 'jsncluster0',
                        db: 'test',
                        coll: 'call'
                    },
                    localField: "_id",
                    foreignField: "call",
                    as: 'agents',
                }},
                {$unwind : "$agents"},
                { $project : {
                        data : {$reduce: {
                            input: "$docs",
                            initialValue: {
                              call_chunks: [],
                            },
                            in: {$switch: {
                                            branches: [
                                            {
                                                case: {$and : [ {$gte: ["$$this.time", "$agents.start"]}, 
                                                         {$lte: ["$$this.time", "$agents.end"]}]},
                                                then: {$mergeObjects: [ "$$value",
                                            {
                                                call_chunks: {$concatArrays: ["$$value.call_chunks", ["$$this"]]},
                                            }]}
                                                },
                                            ],
                                    default: {$mergeObjects: ["$$value"]}    
                                }}
                                }} ,
                            agents : 1}},
                            {$project : {agents : 1, call_chunks : { $sortArray: { input: "$data.call_chunks", sortBy: { time: 1 }}}}},
            ],
      boundary: "processingTime",
  }}


  {
  _id: 1,
  agents: {
    _id: ObjectId('6894c1b92d42dfd54a366283'),
    call: 1,
    agent: 'bob',
    start: ISODate('2025-01-01T00:00:00.000Z'),
    end: ISODate('2025-01-01T00:10:00.000Z')
  },
  call_chunks: [
    {
      call: 1,
      chunk: 'words1',
      time: ISODate('2025-01-01T00:00:01.000Z')
    },
    {
      call: 1,
      chunk: 'words2',
      time: ISODate('2025-01-01T00:00:02.000Z')
    },
    {
      call: 1,
      chunk: 'words3',
      time: ISODate('2025-01-01T00:00:03.000Z')
    }
  ]
}
{
  _id: 2,
  agents: {
    _id: ObjectId('6894c1b92d42dfd54a366284'),
    call: 2,
    agent: 'adam',
    start: ISODate('2025-01-01T00:00:00.000Z'),
    end: ISODate('2025-01-01T00:10:00.000Z')
  },
  call_chunks: [
    {
      call: 2,
      chunk: 'words1',
      time: ISODate('2025-01-01T00:09:01.000Z')
    }
  ]
}
{
  _id: 2,
  agents: {
    _id: ObjectId('6894c1b92d42dfd54a366285'),
    call: 2,
    agent: 'john',
    start: ISODate('2025-01-01T00:10:00.000Z'),
    end: ISODate('2025-01-01T00:15:00.000Z')
  },
  call_chunks: [
    {
      call: 2,
      chunk: 'words2-transfer',
      time: ISODate('2025-01-01T00:11:02.000Z')
    },
    {
      call: 2,
      chunk: 'words3-transfer',
      time: ISODate('2025-01-01T00:14:00.000Z')
    }
  ]
}
