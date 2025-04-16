db.createCollection("ttlTest")
db.runCommand( {
    collMod: "ttlTest",
    changeStreamPreAndPostImages: { enabled: true }
} )
db.ttlTest.createIndex(
                {"time" : 1},
                {
                   name: "Partial-TTL-Index",
                   partialFilterExpression: { _delete : true },
                   expireAfterSeconds: 30
                }
              )


db.ttlTest.insertOne({"test" : 1 , "time" : new Date(), _delete : true})

s = {$source : {
    connectionName : 'jsncluster0',
    db : "test",
    coll : "ttlTest",
}}

sp.process([s])

{
    _id: {
      _data: '8267AB8567000000012B042C0100296E5A100465965B35042C4647BAB8119C46E5BA48463C6F7065726174696F6E54797065003C696E736572740046646F63756D656E744B65790046645F6964006467AB8567A1DFB1AB7E2DBAA7000004'
    },
    operationType: 'insert',
    clusterTime: Timestamp({ t: 1739294055, i: 1 }),
    wallTime: ISODate('2025-02-11T17:14:15.343Z'),
    fullDocument: {
      _id: ObjectId('67ab8567a1dfb1ab7e2dbaa7'),
      test: 1,
      time: ISODate('2025-02-11T17:14:15.203Z'),
      _delete: true
    },
    ns: {
      db: 'test',
      coll: 'ttlTest'
    },
    documentKey: {
      _id: ObjectId('67ab8567a1dfb1ab7e2dbaa7')
    },
    _ts: ISODate('2025-02-11T17:14:15.343Z'),
    _stream_meta: {
      source: {
        type: 'atlas'
      }
    }
  }

  {
    _id: {
      _data: '8267AB85A6000000012B042C0100296E5A100465965B35042C4647BAB8119C46E5BA48463C6F7065726174696F6E54797065003C64656C6574650046646F63756D656E744B65790046645F6964006467AB8567A1DFB1AB7E2DBAA7000004'
    },
    operationType: 'delete',
    clusterTime: Timestamp({ t: 1739294118, i: 1 }),
    wallTime: ISODate('2025-02-11T17:15:18.305Z'),
    ns: {
      db: 'test',
      coll: 'ttlTest'
    },
    documentKey: {
      _id: ObjectId('67ab8567a1dfb1ab7e2dbaa7')
    },
    _ts: ISODate('2025-02-11T17:15:18.305Z'),
    _stream_meta: {
      source: {
        type: 'atlas'
      }
    }
  }
