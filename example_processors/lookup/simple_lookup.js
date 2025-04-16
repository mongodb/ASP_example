//data to be lookedup
db.people.insertOne({name : "Joe", company : "MongoDB"})


//document for stream processor
db.data.insertOne({name : "Joe"})

s = {
  $source:  {
      connectionName: 'jsncluster0',
      db: 'test',
      coll: 'data',
      config : {
            fullDocument: 'required',
            fullDocumentOnly : true,
          },        
  }
}

l = {
  $lookup: {
      from: {
          connectionName: 'jsncluster0',
          db: 'test',
          coll: 'people'
      },
      localField: "name",
      foreignField: "name",
      as: 'enrichment',
  }
}

sp.process([s,l])
