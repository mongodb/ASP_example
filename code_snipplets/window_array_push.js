{ "vehicle_id": "vid0001", "coord": [37.76643495, -122.3969431 ], timestamp :  new ISODate("2022-12-01T14:10:30Z") }
{ "vehicle_id": "vid0001", "coord": [38.76643495, -123.3969431 ], timestamp :  new ISODate("2022-12-01T14:10:31Z") }
{ "vehicle_id": "vid0001", "coord": [39.76643495, -124.3969431 ] , timestamp :  new ISODate("2022-12-01T14:10:32Z") }
{ "vehicle_id": "vid0001", "coord": [40.76643495, -125.3969431 ] , timestamp :  new ISODate("2022-12-01T14:10:33Z") }


w = { 
    $tumblingWindow: {
      interval: {size: NumberInt(10), unit: "second"},
      idleTimeout : {size: NumberInt(5), unit: "second"},
      "pipeline": 
      [ { $sort : {"timestamp" : 1}},
        {
          '$group': {
            '_id': '$vehicle_id', 
            'positions': {
              '$push': {
                'coord':"$coord" 
              }
            }
          }
        }
      ]
    }
  }


db.gpsCord_res.find()
[
  {
    _id: 'vid0001',
    _stream_meta: {
      sourceType: 'atlas',
      windowStartTimestamp: ISODate("2022-12-01T14:10:30.000Z"),
      windowEndTimestamp: ISODate("2022-12-01T14:10:40.000Z")
    },
    positions: [
      { coord: [ 37.76643495, -122.3969431 ] },
      { coord: [ 38.76643495, -123.3969431 ] },
      { coord: [ 39.76643495, -124.3969431 ] },
      { coord: [ 40.76643495, -125.3969431 ] }
    ]
  }
]

