db.hextest.insertOne({hex:"03C8"})


af = {$addFields: {hexDec : { 
  $sum: {
    $map: {
       input: { $range: [0, { $strLenBytes: "$hex" }] },
       in: { $multiply: [
             { $pow: [16, { $subtract: [{ $strLenBytes: "$hex" }, { $add: ["$$this", 1] }] }] },
             { $indexOfBytes: ["0123456789ABCDEF", { $toUpper: { $substrBytes: ["$hex", "$$this", 1] } }] }
          ]
       }
    }
 }
}
}}


/*
{
  _id: ObjectId("65bbadf71885149d4b1f0309"),
  hex: '03C8',
  hexDec: 968,
  _stream_meta: {
    sourceType: 'atlas',
    timestamp: ISODate("2024-02-01T14:43:03.715Z")
  }
}
  */
