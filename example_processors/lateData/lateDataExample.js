// First Window 20:00 - 20:30
  db.timeTest.insertOne({"timestamp" : '2023-11-08T20:00:00.000'})
  db.timeTest.insertOne({"timestamp" : '2023-11-08T20:25:00.000'})
  db.timeTest.insertOne({"timestamp" : '2023-11-08T20:10:00.000'})
// Second Window open at same time, as we wait up to 1 minute based on lateness configs. 
// The watermark must get past the 1st window by the allowed lateness to close it
  db.timeTest.insertOne({"timestamp" : '2023-11-08T20:30:30.000'})
// Documents that belong in the first window
  db.timeTest.insertOne({"timestamp" : '2023-11-08T20:29:00.000'})
  db.timeTest.insertOne({"timestamp" : '2023-11-08T20:10:00.000'})
//Document for the second window that raises the watermark PAST the allowed lateness closing the first window.
  db.timeTest.insertOne({"timestamp" : '2023-11-08T20:35:00.000'})

  /*Should return count of 5 for the window of 20:00:00.000 - 20:30:00.000

  {
    _id: null,
    count: 5,
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2023-11-08T20:00:00.000Z"),
      windowEndTimestamp: ISODate("2023-11-08T20:30:00.000Z")
    }
  } */


  s = {
        $source:  {
            connectionName: 'jsncluster0',
            db: 'test',
            coll: 'timeTest',
            timeField : { $dateFromString: { dateString: '$fullDocument.timestamp' } },
            config : {
                fullDocument: 'whenAvailable',
            }
        }
    }

    

   t = { $tumblingWindow: {
        interval: {size: NumberInt(30), unit: "minute"},
        allowedLateness : {size: 1, unit: "minute"}, 
        pipeline: [
            { $group : {
                "_id" : null,      
                count : { $count : {}}
            }}
        ]
        }}

sp.process([s,t])
