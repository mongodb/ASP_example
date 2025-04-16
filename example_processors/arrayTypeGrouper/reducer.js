
s = {$source : {documents : [  { 
  "type" : "delete",
  "id": "doc1",
  "groups": ["a"]
},
{
  "type" : "insert",
  "id": "doc2",
  "groups": ["a", "b"]
},
{
  "type" : "insert",
  "id": "doc3",
  "groups": ["a"]
}]}}

uw = {$unwind : "$groups"}

w =       { $tumblingWindow: {
  interval: {size: NumberInt(1), unit: "second"},
  idleTimeout : {size: NumberInt(1), unit: "second"},
          "pipeline": [ 
            {$unset : ["_ts","_stream_meta"]},
              {
                  $group: {
                      "_id" : "$groups", 
                      'events': { $push: "$$ROOT" } }  },
            { $project : {
                        properSeq : {$reduce: {
                            input: "$events",
                            initialValue: {
                              updates: [],
                              deletes: [],
                            },
                            in: {$switch: {
                              branches: [
                              {
                                case: {$eq: ["$$this.type", "insert"]},
                                then: {$mergeObjects: [
                                  "$$value",
                                  {
                                    updates: {$concatArrays: ["$$value.updates", ["$$this"]]},
                                  }
                                ]}
                              },
                              ],
                              default: {$mergeObjects: [
                                "$$value",
                                {deletes: {$concatArrays: ["$$value.deletes", ["$$this.id"]]}}
                              ]}    
                            }}
                          }}
        }}    
          ],
       } 
   }

   rr = {
    $replaceRoot: { newRoot :  { $mergeObjects: [ "$properSeq", { "target" : "$_id"} ] }}
  }

   e = {$emit : {connectionName : "kafkaProd", 
                 topic : "$target"
                } }

   sp.process([s,uw,w,rr])


   ##OUTPUTS
   AtlasStreamProcessing>    sp.process([s,uw,w,rr])
{
  updates: [
    {
      type: 'insert',
      id: 'doc2',
      groups: 'b'
    }
  ],
  deletes: [],
  target: 'b'
}
{
  updates: [
    {
      type: 'insert',
      id: 'doc2',
      groups: 'a'
    },
    {
      type: 'insert',
      id: 'doc3',
      groups: 'a'
    }
  ],
  deletes: [
    'doc1'
  ],
  target: 'a'
}
