Repo of MongoDB Atlas Stream Processing artifacts

# atlas_stream_processors
Three main examples are indexed below: code_snipplets which are example MQL solutions to specific problems, example_procesors are end to end processors, and terraform examples for reference. 

## code_snipplets
[Examples of MQL code to solve various problems](https://github.com/josephxsxn/atlas_stream_processors/tree/master/code_snipplets)


## example_processors
[Example end to end processors](https://github.com/josephxsxn/atlas_stream_processors/tree/master/example_processors)

## terraform
[Terraform examples](https://github.com/josephxsxn/atlas_stream_processors/tree/master/terraform)




# How To Enable PrePost Images on Change Stream Sources
Enable col for fullDocuments in given database, the below code will enable ALL collections in the database it is ran in.

```
var cols = db.getCollectionNames()

for (const el of cols){
    db.runCommand( {
        collMod: el,
        changeStreamPreAndPostImages: { enabled: true }
    } )
}
```

# Check if PrePost Images on Change Streams are enabled on a collection
```
db.getCollectionInfos({name : "data"})

[
  {
    name: 'data',
    type: 'collection',
    options: { changeStreamPreAndPostImages: { enabled: true } },
    info: {
      readOnly: false,
      uuid: UUID('ff7e3cd5-aa05-4576-aaf4-67bb7eac57d0')
    },
    idIndex: { v: 2, key: { _id: 1 }, name: '_id_' }
  }
]
```

## Count messages on oplog
Check how many messages on the oplog for a given namespace/collection, change test.pipelinetest to be db.coll
```
use local
db.oplog.rs.aggregate( [
    {$match : {ns : "test.pipelinetest"}},
   { $group:   {_id : { op: "$op" , ns : "$ns"},  op: { $sum: 1 } }},
   { $project: { _id: 1, op : 1, ns : 1 } },
   {$sort: {"_id.ns" : 1,  "_id.op" : 1 }}
] )
```

# Outbound Control Plane IPs for Firewall Access Lists
```
curl -H 'Accept: application/vnd.atlas.2023-11-15+json' -s 'https://cloud.mongodb.com/api/atlas/v2/unauth/controlPlaneIPAddresses'
```
# Who is using a change stream
Run on admin db of a database cluster
```
db.aggregate([
  { $currentOp: { allUsers: true }},
  { $match: {
      "cursor.tailable": true,
      "cursor.originatingCommand.pipeline.0.$changeStream": { $exists: true }
    }
  }
]);
```
