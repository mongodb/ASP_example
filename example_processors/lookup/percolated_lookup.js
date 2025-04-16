db.createCollection("userFilters")
db.createCollection("properties")

//setup full document change streams on collections or replace with kafka
var cols = db.getCollectionNames()

for (const el of cols){
    db.runCommand( {
        collMod: el,
        changeStreamPreAndPostImages: { enabled: true }
    } )
}

//user filter in collection
db.userFilters.insertMany([
{city : "new york",
baths : 2,
rooms : 4, 
user : "joe"},
{city : "new york",
baths : 1,
rooms : 4, 
user : "jane"},
{
    city : "new york",
    baths : 1,
    user : "nick"  
}])


//properties stream, insert after processor is running (or get from Kafka topic)
db.properties.insertMany([
{city : "new york",
baths : 1,
rooms : 3, },
{city : "detroit",
baths : 2,
rooms : 4, },
{city : "new york",
baths : 1,
rooms : 1, },
{city : "new york",
baths : 3,
rooms : 4, }])

//could be kafka rather than change streams
s = {
    $source:  {
        connectionName: 'jsncluster0',
        db: 'test',
        coll: 'properties',
        config : {
          fullDocument: 'whenAvailable',
        },    
  }
}
rr =   {
    $replaceRoot: { newRoot : "$fullDocument"}
 }

l = {
    $lookup: {
        from: {
            connectionName: 'jsncluster0',
            db: 'test',
            coll: 'userFilters'
        },
            let : {city : '$city', baths : '$baths', rooms : '$rooms'} ,
            pipeline : [{
                $match: {
                  $expr: {
                    $and: [
                      {
                        $eq: [{$ifNull : ['$$city', '$city'] }, '$city']
                      },
                      {
                        $gte: [{$ifNull : ['$$baths', '$baths'] }, '$baths']
                      },
                      {
                        $gte: [{$ifNull : ['$$rooms', '$rooms'] }, '$rooms']
                      },
                    ]
                  }
                }
              }],
            as: 'matched',
    }
  }

  sp.process([s,rr,l])

  {
    _id: ObjectId("65b01fa326d988e2c11ba389"),
    city: 'new york',
    baths: 1,
    rooms: 3,
    matched: [
      {
        _id: ObjectId("65b01b5226d988e2c11ba368"),
        city: 'new york',
        baths: 1,
        user: 'nick'
      }
    ],
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-01-23T20:20:51.231Z")
    }
  }
  {
    _id: ObjectId("65b01fa326d988e2c11ba38a"),
    city: 'detroit',
    baths: 2,
    rooms: 4,
    matched: [],
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-01-23T20:20:51.231Z")
    }
  }
  {
    _id: ObjectId("65b01fa326d988e2c11ba38b"),
    city: 'new york',
    baths: 1,
    rooms: 1,
    matched: [
      {
        _id: ObjectId("65b01b5226d988e2c11ba368"),
        city: 'new york',
        baths: 1,
        user: 'nick'
      }
    ],
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-01-23T20:20:51.231Z")
    }
  }
  {
    _id: ObjectId("65b01fa326d988e2c11ba38c"),
    city: 'new york',
    baths: 3,
    rooms: 4,
    matched: [
      {
        _id: ObjectId("65b01b5226d988e2c11ba366"),
        city: 'new york',
        baths: 2,
        rooms: 4,
        user: 'joe'
      },
      {
        _id: ObjectId("65b01b5226d988e2c11ba367"),
        city: 'new york',
        baths: 1,
        rooms: 4,
        user: 'jane'
      },
      {
        _id: ObjectId("65b01b5226d988e2c11ba368"),
        city: 'new york',
        baths: 1,
        user: 'nick'
      }
    ],
    _stream_meta: {
      sourceType: 'atlas',
      timestamp: ISODate("2024-01-23T20:20:51.231Z")
    }
  }
  
