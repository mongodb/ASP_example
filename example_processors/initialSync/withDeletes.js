//NOTE - This method of source to merge has no understanding of transactions, and is only eventually consistent. 

sp.createStreamProcessor("clone", [
            {
                $source: {
                    connectionName: 'jsncluster0',
                    db: 'test',
                    coll: 'replicate',
                    config: {fullDocument: "required"},
                    initialSync: {enable: true, "parallelism": 16}
                }
            },
            {
                $replaceRoot: {
                    newRoot:
                        {$cond: {if: { $eq: [{$meta: "stream.source.operationType"}, "delete"] }, then: "$documentKey", else: "$fullDocument"}}
                }
            },
            {
                $merge: {
                    into: {
                        connectionName: 'jsncluster0',
                        db: 'test',
                        coll: 'replicate_test'
                    },
                    whenMatched: {$cond: {if: { $eq: [{$meta: "stream.source.operationType"}, "delete"] }, then: "delete", else: "replace"}},
                    whenNotMatched: {$cond: {if: { $eq: [{$meta: "stream.source.operationType"}, "delete"] }, then: "discard", else: "insert"}}
                },
            }
        ])
