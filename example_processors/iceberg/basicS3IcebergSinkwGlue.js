s = {
  $source: {
    connectionName: "jsncluster0",
      db: "test",
      coll: "test",
      config: { fullDocument: "required" },
      initialSync: { enable: true, parallelism: 4 }
  }
}
rr = {
  $replaceRoot: {
    newRoot: {
      $cond: {
        if: { $eq: [{ $meta: "stream.source.operationType" }, "delete"] },
        then: "$documentKey", 
        else: "$fullDocument"
      }
    }
  }
}
ice = {
  $iceberg: {
    connectionName: "iceberg-dev",
    bucket: "iceberg-asp-dev",
    databaseName: "asp-iceberg-db",
    tableName: "test_table_0",
    operationType: "auto",
    path: "jsncluster0",
    catalog: {
      type: "glue"
    }
  }
}
