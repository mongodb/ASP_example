#fast recovery from lost resumeToken
sp.name.modify({resumeFromCheckpoint: false})
sp.name.start()


#passing $date over REST or TF
{"$source" : {"connectionName" : "jsncluster0", "db" : "test", "coll" : "dateTest",
              "config" : {"startAtOperationTime" : {"$date": "2025-01-21T19:25:18.262Z"}}}}


##Mod Processor Pipeline
pipeline = sp.name.stats().pipeline
pipeline[0]["$source"]["config"]["fullDocument"] = "whenAvailable"
sp.name.modify(pipeline, {resumeFromCheckpoint: false})
sp.name.start()


#mod processor to restart changestream at specific time
sp.stuff.stop()
pipeline = sp.stuff.stats().pipeline
pipeline[0]["$source"]["config"]["startAtOperationTime"] = new Date("2025-06-12T01:00:00.000Z")
sp.stuff.modify(pipeline, {resumeFromCheckpoint: false})
sp.stuff.start()
