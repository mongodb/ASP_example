

db.createCollection("array_push")
db.array_push.createIndex({"id": 1}, {unique: true})
db.array_push.insertOne({id : 1, test : ["b","c"]})
db.array_push.insertOne({id : 2, test : ["x","y"]})


s = {$source : {documents : [{id : 1, test : ["a"]}, {id : 2, test : ["z"]}]}}

m = {$merge : {
  into: {
      connectionName: "jsncluster0",
      db: "test",
      coll: "array_push"},
      on: ["id"],
      let : {event_array : "$test"},
      whenMatched : [ { $addFields: {
        test: { $concatArrays: [ "$test", "$$event_array" ]},
      } }],
     whenNotMatched: "insert"
}}

db.array_push.find({})
[
    {
      _id: ObjectId('67a613a15771e34b0b21ebba'),
      id: 1,
      test: [ 'b', 'c', 'a' ]
    },
    {
      _id: ObjectId('67a613a15771e34b0b21ebbb'),
      id: 2,
      test: [ 'x', 'y', 'z' ]
    }
  ]
