s = {$source : {connectionName : "jsncluster0",  
                coll : "test", 
                db : "test",
                config : {"pipeline" : [
                                    {$match : { $expr: { "$lt": [ { $bsonSize: "$$ROOT" }, 100 ] }}}
                                    ]
                         }}}
