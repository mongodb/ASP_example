s = {
  $source: {
    connectionName: 'jsncluster0',
    db: 'test',
    coll: 'arrayunwind',
    config : {
      fullDocument: 'whenAvailable',
    },
  }
}

rr =       {
  $replaceRoot: { newRoot : "$fullDocument"}
}

m = {$match : { 'data' : {$all: [0]}}}

uw = {$unwind : '$data'}

us = { $unset: "_id" }

merge =  {$merge: {
  into: {
      connectionName: "jsncluster0",
      db: "test",
      coll: "arraytestdatamerge"},
      on: ["data"],
      whenMatched: "replace"

}}

db.arrayunwind.insertOne({'data' : [1,2,3,4,5,6,7,8,9,10] })
db.arrayunwind.insertOne({'data' : [0,1,2,3,4,5,6,7,8,9,10] })
