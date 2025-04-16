//DB
db.createCollection("websitedata")
db.websitedata.createIndex({"customerid": 1}, {unique: true})

//index using _ts, could use another date field for the TTL
db.websitedata.createIndex(
  {"_ts" : 1},
  {
     name: "Partial-TTL-Index",
     partialFilterExpression: { _delete : true },
     expireAfterSeconds: 1
  }
)

 db.websitedata.insertOne({"customerid" : 1, "name": "joe"})  
 db.websitedata.insertOne({"customerid" : 2, "name": "kenny"})  
 db.websitedata.insertOne({"customerid" : 3, "name": "laura"})  

//KAFKA
{"customerid" : 1, "stuff" : "stuffhere"}

///ASP - add _delete : true to trigger the TTL index to delete the record
s = {$source : {connectionName : "kafkaprod", topic : "websiteevents"}}
af = {$addFields : {_delete : true}}
m = {$merge : {
    into : {
      connectionName : "jsncluster0", 
      db : "test",
      coll:"websitedata"},
      on : ["customerid"], 
      whenMatched: 'merge',  
      whenNotMatched: 'insert'}}
sp.process([s,af,m])


//BEFORE
[
  {
    _id: ObjectId('67167d14738ebb1fbe44f38a'),
    customerid: 3,
    name: 'laura'
  },
  {
    _id: ObjectId('67168248738ebb1fbe44f38b'),
    customerid: 1,
    name: 'joe'
  },
  {
    _id: ObjectId('67168249738ebb1fbe44f38c'),
    customerid: 2,
    name: 'kenny'
  }
]

//AFTER sending Kafka Message
[
  {
    _id: ObjectId('67167d14738ebb1fbe44f38a'),
    customerid: 3,
    name: 'laura'
  },
  {
    _id: ObjectId('67168249738ebb1fbe44f38c'),
    customerid: 2,
    name: 'kenny'
  }
]
