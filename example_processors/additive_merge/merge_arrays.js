db.createCollection("gps")
db.createCollection("gps_array_push")
db.gps_array_push.createIndex({"vehicle_id": 1}, {unique: true})

var cols = db.getCollectionNames()

for (const el of cols){
    db.runCommand( {
        collMod: "gps",
        changeStreamPreAndPostImages: { enabled: true }
    } )
}

db.gps.insertOne({ "vehicle_id": "vid0001", "coord": [37.76643495, -122.3969431 ],  })
db.gps.insertOne({ "vehicle_id": "vid0001", "coord": [38.76643495, -123.3969431 ],  })
db.gps.insertOne({ "vehicle_id": "vid0001", "coord": [39.76643495, -124.3969431 ],  })
db.gps.insertOne({ "vehicle_id": "vid0001", "coord": [40.76643495, -125.3969431 ],  })



s = {
    $source:  {
        connectionName: 'jsncluster0',
        db: 'test',
        coll: 'gps',
        config : {
          fullDocument: 'whenAvailable',
        },    
  }
}
rr =   {
    $replaceRoot: { newRoot : "$fullDocument"}
 }

 af = {$addFields : { "gps_array" : [{"coord" : "$coord"}]}}

 un = {$unset : ["coord"]}

 m = {$merge : {
  into: {
      connectionName: "jsncluster0",
      db: "test",
      coll: "gps_array_push"},
      on: ["vehicle_id"],
      let : {event_array : "$gps_array"},
      whenMatched : [ { $addFields: {
        gps_array: { $concatArrays: [ "$gps_array", "$$event_array" ]},
      } }],
     whenNotMatched: "insert"
}}

sp.process([s,rr,af,un,m])

Atlas atlas-ec9c8m-shard-0 [primary] test> db.gps_array_push.find({})
[
  {
    _id: ObjectId('65fc35ffab7ca5360f74767e'),
    vehicle_id: 'vid0001',
    gps_array: [
      { coord: [ 37.76643495, -122.3969431 ] },
      { coord: [ 38.76643495, -123.3969431 ] },
      { coord: [ 39.76643495, -124.3969431 ] },
      { coord: [ 40.76643495, -125.3969431 ] }
    ],
    _stream_meta: {
      timestamp: ISODate('2024-03-21T13:28:31.625Z'),
      sourceType: 'atlas'
    }
  }
]
