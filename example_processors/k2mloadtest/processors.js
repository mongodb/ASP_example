s={
  '$source': {
    connectionName: 'kbtestkafka',
    topic: 'topic_0',
    config: { group_id : "testkb1", auto_offset_reset: 'earliest'  }
  }
}

m =        {$merge: {
    into: {
        connectionName: 'jsncluster0',
        db: 'test',
        coll: 'twentykbtest'},
        on: '_id'
    
}}

sp.twentykbtest.drop()
sp.createStreamProcessor('twentykbtest', [s,m])
sp.twentykbtest.start()
sp.twentykbtest.stats()


s={
    '$source': {
      connectionName: 'kbtestkafka',
      topic: 'topic_0',
      config: { group_id : "testkb2", auto_offset_reset: 'earliest'  }
    }
  }

af1 = {$addFields : {upper : {$toUpper : "$data" }}}
af2 = {$addFields : {lower : {$toLower : "$upper" }}}
  
  m =        {$merge: {
      into: {
          connectionName: 'jsncluster0',
          db: 'test',
          coll: '60kbcasetest'},
          on: '_id'
      
  }}
  
  sp.sixtykbtest.drop()
sp.createStreamProcessor('sixtykbtest', [s,af1,af2,m])
sp.sixtykbtest.start()
sp.sixtykbtest.stats()


  s={
    '$source': {
      connectionName: 'kbtestkafka',
      topic: 'topic_0',
      config: { group_id : "testkb19", auto_offset_reset: 'earliest'  }
    }
  }

w = {
                $tumblingWindow: {
                    interval: {size: NumberInt(60), unit: "second"},
                    idleTimeout : {size: NumberInt(60), unit: "second"},
                    allowedLateness : {size: NumberInt(10), unit: "second"},
                    pipeline: [
                        { $group : {
                            _id : '$$ROOT'
                        },
                    },
                    {$replaceRoot: {newRoot: '$_id'}},
                    {$group : {
                         _id : {id : "$_id", data : "$data"},
                         'count' : {$sum : 1},
                    }}, 
                    {$project: {
                        _id : "$_id.id",
                        data : "$_id.data",
                        count : 1 }}, 
                    ]
                }
            }
  
  m =        {$merge: {
      into: {
          connectionName: 'jsncluster0',
          db: 'test',
          coll: 'twentywindowdedupe'},
      
  }}

  sp.windowdedupe.drop()
  sp.createStreamProcessor('windowdedupe', [s,w,m])
  sp.windowdedupe.start()
  sp.windowdedupe.stats().stats
