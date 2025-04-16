
//DB Setup
db.aaa.insertOne({id : 1, a : [100, 200, -1]})
db.aaa.insertOne({id : 1, a : [100, 200, 11, 22]})
db.aaa.insertOne({id : 1, a : [100, 200, 33]})
db.aaa.insertOne({id : 1, a : [33, 44, -1]})


//Processor
s = {$source : { documents : [{id : 1, val : -1}]}}
l = {$lookup : {from: {
        connectionName: 'jsncluster0',
        db: 'test',
        coll: 'aaa'
    },
        let : {val : '$val'} ,
        pipeline : [ {$match: {
                            $expr: { $not : {$in : ["$$val", "$a"]}
                            }
                        }  } 
                ],
                as : "results"
            }
        }

//OUTPUT
{
    id: 1,
    val: -1,
    _ts: ISODate('2024-10-28T17:28:46.348Z'),
    results: [
      {
        _id: ObjectId('671fc733738ebb1fbe44f39f'),
        id: 1,
        a: [
          100,
          200,
          11,
          22
        ]
      },
      {
        _id: ObjectId('671fc733738ebb1fbe44f3a0'),
        id: 1,
        a: [
          100,
          200,
          33
        ]
      }
    ],
    _stream_meta: {
      source: {
        type: 'generated'
      }
    }
  }
