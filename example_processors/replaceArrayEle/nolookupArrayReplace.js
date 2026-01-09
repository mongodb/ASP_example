db.spec.remove({})
db.spec.insertOne({_id : 1, subsarray: [ {speciality_id: "000", description: "spec1"}, {speciality_id: "001", description: "spec2"}]})
Atlas atlas-ec9c8m-shard-0 [primary] test> db.spec.find()
[
  {
    _id: 1,
    subsarray: [
      { speciality_id: '000', description: 'spec1' },
      { speciality_id: '001', description: 'spec2' }
    ]
  }
]



s = {$source : {documents : [{_id : 1, speciality_id: "000", description : "new_desc"}]}}
m = {$merge : {
  into: {
      connectionName: "jsncluster0",
      db: "test",
      coll: "spec"},
      on: ["_id"],
      let : {specid : "$speciality_id", desc : "$description"},
      whenMatched : [ {$addFields : { 
            subsarray : {$filter: {
             input: "$subsarray",
                as: "subsarray",
                cond: { $ne: ["000", "$$subsarray.speciality_id"] }
             }
            }}},
        {$addFields : {subsarray : 
            {$concatArrays : ["$subsarray", [{"speciality_id" : "$$specid", "description" : "$$desc"}]]}}}
        ],
      whenNotMatched: "insert"
}}
sp.process([s,m])



#after
Atlas atlas-ec9c8m-shard-0 [primary] test> db.spec.find()
[
  {
    _id: 1,
    subsarray: [
      { speciality_id: '001', description: 'spec2' },
      { speciality_id: '000', description: 'new_desc' }
    ]
  }
]
