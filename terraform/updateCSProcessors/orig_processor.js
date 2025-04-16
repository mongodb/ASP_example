[
      {
        "$source": {
          "coll": "csweb",
          "config": {
            "fullDocument": "whenAvailable",
            "fullDocumentBeforeChange": "whenAvailable"
          },
          "connectionName": "jsncluster0",
          "db": "webdemo"
        }
      },
      {
        "$merge": {
          "into": {
            "coll": "csweb_out",
            "connectionName": "jsncluster0",
            "db": "webdemo"
          },
          "on": [ "_id" ],
          "whenMatched": "replace",
          "whenNotMatched": "insert"
        }
      }
]
