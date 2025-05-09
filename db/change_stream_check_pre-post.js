// check if preAndPostImages are enabled
// for the collection "data" in the current database
// and print the collection information
// using the MongoDB shell

var db = db.getSiblingDB("test") // replace "test" with your database name
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