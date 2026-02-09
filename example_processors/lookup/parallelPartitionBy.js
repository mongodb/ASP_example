s = {$source : {documents : [{device : 1},{ device : 2}]}}
l = {
  $lookup: {
      from: {
          connectionName: 'jsncluster0',
          db: 'test',
          coll: 'device_meta'
      },
      localField: "device",
      foreignField: "device",
      as: 'enrichment',
      partitionBy : "$device",
      parallelism : 2
    }
}
