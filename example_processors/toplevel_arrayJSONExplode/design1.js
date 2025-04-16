/*
Source Doc
[{"1": 1}, {"2": 2}, {"3": 3}]

After BSON SPEC Applied 
{
  '0': {
    '1': 1
  },
  '1': {
    '2': 2
  },
  '2': {
    '3': 3
  },
  _ts: ISODate("2023-12-08T17:19:53.181Z"),
  _stream_meta: {
    sourceType: 'kafka',
    sourcePartition: 0,
    sourceOffset: 16,
    timestamp: ISODate("2023-12-08T17:19:53.181Z")
  }
}
*/

s = {$source : {
    connectionName : "cc_cloud",
    topic : "topic_0"
}}
af = {$addFields : { fix1 : {$objectToArray : "$$ROOT"} }}
p = {$project : {fix1 : 1}}
uw = {$unwind : "$fix1"}
af2 = {$addFields : {fix2 : "$fix1.v"}}
rr = {$replaceRoot : {newRoot : "$fix2"}}
m = {$merge : { into: {connectionName: "jsncluster0", db: "test", coll: "arraytest"}}}

dlq = {dlq: {connectionName: "jsncluster0", db: "test", coll: "arraytest_dlq"}}

sp.createStreamProcessor('arraytest', [s,af,p,uw,af2,rr,m], dlq)

/* outputs

  Atlas atlas-ec9c8m-shard-0 [primary] test> db.arraytest.find()
[
  {
    '1': 1,
    _id: ObjectId("65735afcd99f91d7ef99a841"),
    _stream_meta: {
      sourceType: 'kafka',
      sourcePartition: 0,
      sourceOffset: Long("35"),
      timestamp: ISODate("2023-12-08T18:05:46.355Z")
    }
  },
  {
    '2': 2,
    _id: ObjectId("65735afcd99f91d7ef99a842"),
    _stream_meta: {
      sourceType: 'kafka',
      sourcePartition: 0,
      sourceOffset: Long("35"),
      timestamp: ISODate("2023-12-08T18:05:46.355Z")
    }
  },
  {
    '3': 3,
    _id: ObjectId("65735afcd99f91d7ef99a843"),
    _stream_meta: {
      sourceType: 'kafka',
      sourcePartition: 0,
      sourceOffset: Long("35"),
      timestamp: ISODate("2023-12-08T18:05:46.355Z")
    }
  }
]

  */
