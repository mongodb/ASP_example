[
  {
    "$source": {
      "connectionName": "atlas1",
      "db": "db",
      "coll": ["a", "b", "c"],
      "initialSync": {
        "enable": true
      },
      "config": {
        "fullDocument": "required"
      }
    }
  },
  {
    "$match": {
      "operationType": {
        "$in": ["insert", "update", "delete", "replace"]
      }
    }
  },
  {
    "$replaceRoot": {
      "newRoot": {
        "$cond": {
          "if": {
            "$eq": [{ "$meta": "stream.source.operationType" }, "delete"]
          },
          "then": "$documentKey",
          "else": "$fullDocument"
        }
      }
    }
  },
  {
    "$iceberg": {
      "connectionName": "myS3Connection",
      "databaseName": "iceberg-db",
      "bucket": "myData",
      "path": "iceberg-warehouse/",
      "tableName": { "$meta": "stream.source.ns.coll" },
      "mode": "cdc"
    }
  }
]
