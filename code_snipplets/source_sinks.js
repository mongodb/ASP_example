--Pre and Post images from Change Stream Source
 s = {
      $source:  {
          connectionName: 'jsncluster0',
          db: 'bronze',
          config : {
            fullDocument: 'whenAvailable',
            fullDocumentBeforeChange: 'whenAvailable',
          },    
    }
}

--Full Document Change Stream from a Collection
s = {
        $source:  {
            connectionName: 'jsncluster0',
            db: 'asp_poc_db',
            coll: 'sensors_data',
            config : {
                  fullDocument: 'whenAvailable',
                },        
        }
    }

--Full Document Change Stream from a Database (and all collections within)
s = {
        $source:  {
            connectionName: 'jsncluster0',
            db: 'asp_poc_db',
            config : {
                  fullDocument: 'whenAvailable',
                },        
        }
    }

--Change Stream Source starting in the past of the oplog with startAtOperationTime        
s = {
    $source:  {
        connectionName: 'jsncluster0',
        db: 'test',
        coll : 'datetest',
        config : {
              startAtOperationTime : Timestamp(new Date('2024-01-30T00:00:01Z').getTime()/1000,0),
            },        
    }
}

--Change Stream Source starting with OpLog resume token
s = {
    $source:  {
        connectionName: 'jsncluster0',
        db: 'test',
        coll : 'datetest',
        config : {
            startAfter : new Object({_data : '8265B8F36B000000022B042C0100296E5A100469E03217B2954C6580FCAD5A7D225571463C6F7065726174696F6E54797065003C696E736572740046646F63756D656E744B65790046645F6964006465B8F36BBDD90E425EC09B31000004'}),
            },        
    }
}

--Merge to a Atlas Cluster Collection
merge = {
    $merge: {
        into: {
            connectionName: 'jsncluster0',
            db: 'asp_poc_db',
            coll: 'silver1'
        },
        on: ['_id'],
        whenMatched: 'merge',
        whenNotMatched: 'insert'
    }
}

--Dynamic Merge
    merge =  {$merge: {
        into: {
            connectionName: "jsncluster0",
            db: "test",
            coll: { $cond: { if: {$expr : {$lte : ['$count', '$filter_rule']}}, then: "countData", else: { $concat: ["countData_",{$toString: '$count'}]} } }},
            on: ["entity"],
            whenMatched: "replace"

    }}

--Emit to a Kafka Topic
e =     { $emit: { 
            connectionName: 'aaeh', 
             topic: 'sometopic' 
         }}


--Kafka Start At Latest/Earliest
s1={
  '$source': {
    connectionName: 'ccloud',
    topic: 'Stocks',
    timeField: { '$dateFromString': { dateString: '$tx_time' } },
    config: { auto_offset_reset: 'earliest' }
  }
}

--idle partition timeouts
  s = {$source: {
    connectionName: 'StreamProcessingDemo',
    topic: 'events',
    partitionIdleTimeout : {size: NumberInt(5), unit: 'second'},
  }
}

--documents
s = {$source: { documents: [ 
   {a: 1, time: "2024-02-12T15:03:20.000Z" },
   {b: 1, time: "2024-02-12T15:03:21.000Z"} ], 
   timeField : { $dateFromString : { "dateString" : "$time"} }}}


--timeseires collection emit
e = {$emit : {
    connectionName : "jsncluster0",
    db : "test",
    coll : "solarAggs",
    timeseries : {
        timeField : "timestamp",
        metaField : "device_id"
    }}
}

--change stream source with pushdown pipeline operator
s = {$source : {
    connectionName : 'jsncluster0',
    db : "test",
    coll : "format",
    config : {
         fullDocument: 'whenAvailable',
        pipeline : [{ $match: { 'fullDocument.num': 1 } }]}
}}


--wildcard pipeline match for specific collections with changestream
s = {$source : {
    connectionName : 'jsncluster0',
    db : "test",
    config : {pipeline : [{$match : { $expr: { $regexMatch: { input: "$ns.coll" , regex: "pipe_.*", options: "i" } }}  }]}
}}


--Kafka Keys for Source and Emit
KeyFormat values:
            BinData: "binData"
            String: "string"
            Json: "json"
            # The int and long are big-endian to align with the Java serializer/deserializer for Kafka
            Int: "int"
            Long: "long"


s={
  '$source': {
    connectionName: 'ccloud',
    topic: 'keytest',
    config: { auto_offset_reset: 'earliest',
              keyFormat : "string",
              keyFormatError: 'passThrough'
            }
  }
}


e = {$emit : {
  connectionName : 'ccloud',
  topic : 'keyOutTest',
  config : { key: {$toString : "$_stream_meta.source.partition"}, 
             keyFormat : "string",
}
}}


--manual partiton by _id
 s = {
      $source:  {
          connectionName: 'jsncluster0',
          db: 'test',
          coll : 'hashtest',
          config : {
            fullDocument: 'whenAvailable',
            fullDocumentBeforeChange: 'whenAvailable',
            pipeline : [ 
              {  $addFields : { 
                  hashedPlanIdMod : { 
                    "$mod" : [  

                      { 
                        "$abs" : 
                       { 
                          "$toHashedIndexKey" : "$documentKey._id" 
                          } }, 
                      2 
                      ] 
                    } 
                  }
                }, 
                {$match : { $expr: { $eq : ["$hashedPlanIdMod", 0]}}}
              ] },   }}


--kafka multi-topic $source
s = {$source : {connectionName : "kafkaprod",
    topic : ["topic_1","topic_2"]}}
