sp.createStreamProcessor("iceinsert",
  [
    {
      "$source": {
        "connectionName": "jsncluster0",
        "db": "test",
        "coll": "test",
        "initialSync": { "enable": true, "parallelism": 4 },
        "config": { "fullDocument": "required" }
      }
    },
    {
      "$replaceRoot": {
        "newRoot": {
          "$mergeObjects": ["$$ROOT", { "_id": "$documentKey._id" }]
        }
      }
    },
    {
      "$iceberg": {
        "connectionName": "iceberg-dev",
        "bucket": "iceberg-asp-dev",
        "databaseName": "asp-iceberg-db",
        "tableName": "cdcdata",
        "path": "cdcdatatbucket",
        "mode": "insert",
        "idFieldName": "_id",
        "catalog": { "type": "glue" }
      }
    }
  ],
  {tier:"sp10", dlq : {connectionName : "jsncluster0", db : "test", coll : "icedinsertdlq"}}
)
