// count the number of operations in a change stream
// Thi s script is intended to be run in the mongo shell

db.getSiblingDB("local")
db.oplog.rs.aggregate( [
    {$match : {ns : "test.pipelinetest"}},
   { $group:   {_id : { op: "$op" , ns : "$ns"},  op: { $sum: 1 } }},
   { $project: { _id: 1, op : 1, ns : 1 } },
   {$sort: {"_id.ns" : 1,  "_id.op" : 1 }}
] )