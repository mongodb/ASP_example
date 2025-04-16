
s2 = {$source : {connectionName : "jsncluster0",
                db : "sensorData",
                coll : "sensorDLQ"
}}

eq = { $match: { $and : 
                [   {$expr: { $eq : ["$operationType","insert"]}}, 
                    {$expr: { $eq : ["$fullDocument.errInfo.reason","Input document arrived late."]}},
                ]
}}

rr = {$replaceRoot : {newRoot : "$fullDocument.doc"}}

af = {$addFields : {_id : "$sensorIdGroup"}}

us = {$unset : ["sensorIdGroup", "timestamp", "_ts", "_stream_meta"]}

m = {$merge: {
    into: {
        connectionName: 'jsncluster0',
        db: 'sensorData',
        coll: 'weather'
    },
    on: ['_id'],
    whenMatched: 'merge',
    whenNotMatched: 'insert'
}}

sp.createStreamProcessor("sensorDLQUpdater", [s2, eq, rr, af, us, m])
sp.sensorDLQUpdater.start()
