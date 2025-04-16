//Processor shows how the idle timeout closes a window if no data is inbound
/*
In a window a field named idleTimeout can be passed a time interval to wait if the stream has gone completely idle to close windows once the idle duration is longer than the remaining window time and idleTimeout combined. 
*/

db.datetest.insertOne({test:1})

s = {
    $source:  {
        connectionName: 'jsncluster0',
        db: 'test',
        coll : 'datetest'   
    }
}

w =  { $tumblingWindow: {
    interval: {size: NumberInt(5), unit: "second"},
    idleTimeout: {size: NumberInt(1), unit : "minute"},
            "pipeline": [ { $group : {
                _id : '$$ROOT'
            },
        }, ],
         } 
     }

sp.process([s,w])
