db.speed.insertOne({speed : 0})
db.speed.insertOne({speed : -10})
db.speed.insertOne({speed : 101})

s = {
  $source:  {
      connectionName: 'jsncluster0',
      db: 'test',
      coll: 'speed',
      config : {
            fullDocument: 'required',
            fullDocumentOnly : true,
          },        
  }
}


merge =  {$merge: {
  into: {
      connectionName: "jsncluster0",
      db: "test",
      coll: { $switch: {
        branches: [
           { case: {$expr : {$lt : ['$speed', 0]}}, then: "speed_error"},
           { case: {$expr : {$gte : ['$speed', 100]}}, then: "speed_fast" },
          ],
        default: "speed_normal"
      }}
}}}
