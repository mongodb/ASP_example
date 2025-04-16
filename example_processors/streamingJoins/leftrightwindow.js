s = {$source : {documents : [{id : 1, stuff1 : "words1a", topic : "a"}, {id : 1, stuff2 : "words1b", topic : "b"}]}}

w = { 
    $tumblingWindow: {
      interval: {size: NumberInt(5), unit: "second"},
      idleTimeout : {size: NumberInt(1), unit: "second"},
      "pipeline": 
      [ {
          '$group': {
            '_id': '$id', 
            'documents': {
              '$push': "$$ROOT"
            }
          }
        },
        { $project : {
            joins : {$reduce: {
                input: "$documents",
                initialValue: {
                  left: null,
                  right: null,
                },
                in: {$switch: {
                  branches: [
                  {
                    case: {$eq: ["$$this.topic", "a"]},
                    then: {$mergeObjects: [
                      "$$value",
                      {
                        left: "$$this",
                      }
                    ]}
                  },
                  {
                    case: {$eq: ["$$this.topic", "b"]},
                    then: {$mergeObjects: [
                      "$$value",
                      {
                        right: "$$this",
                      }
                    ]}
                  },
                  ],
                  default: {$mergeObjects: [ "$$value" ]}    
                }}
              }}
            }}, 
    {$replaceRoot : {newRoot :{ $mergeObjects: ["$joins.left", "$joins.right"] }}},
    {$unset : ["topic"]}


      ],
    }
  }

  sp.process([s,w])

//output
   {
  id: 1,
  stuff1: 'words1a',
  stuff2: 'words1b'
}
