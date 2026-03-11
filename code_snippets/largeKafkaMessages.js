#filter large messages and send to DLQ
v2 = { $validate: {
              validator:  {
                $expr: 
                  { $lt: [ { $bsonSize: "$$ROOT" }, 1 ] }
                
              },    validationAction : "dlq"}}
