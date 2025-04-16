s = {$source : { documents : [{id : 1, name : "joe"}, {id : 1, state : "MI"},
                              {id : 2, name : "kenny"}, {id : 2, state : "TX"},
                              {id : 3, name : "laura"}, {id : 3, state : "NY"}   
]}}
w = { 
    $tumblingWindow: {
      interval: {size: NumberInt(5), unit: "second"},
      idleTimeout : {size: NumberInt(1), unit: "second"},
      "pipeline": 
      [ {$unset : ["_ts", "_stream_meta"]},
        {
          '$group': {
            '_id': '$id', 
            'positions': {
              '$push': {
                'events':"$$ROOT" 
              }
            }
          }
        }
      ]
    }
  }


  s = {$source : { documents : [{id : 1, name : "joe"}, {id : 1, state : "MI"},
    {id : 2, name : "kenny"}, {id : 2, state : "TX"},
    {id : 3, name : "laura"}, {id : 3, state : "NY"}   
]}}
  w = { 
    $tumblingWindow: {
      interval: {size: NumberInt(5), unit: "second"},
      idleTimeout : {size: NumberInt(1), unit: "second"},
      "pipeline": 
      [ {$unset : ["_ts", "_stream_meta"]},
        {
          '$group': {
            '_id': '$id', 
            1 : {$first : "$$ROOT"},
            2 : {$last : "$$ROOT"}
            }
          }
        
      ]
    }
  }


  s = {$source : { documents : [{id : 1, name : "joe"}, {id : 1, state : "MI"},
    {id : 2, name : "kenny"}, {id : 2, state : "TX"},
    {id : 3, name : "laura"}, {id : 3, state : "NY"}   
]}}

  w = { 
    $tumblingWindow: {
      interval: {size: NumberInt(5), unit: "second"},
      idleTimeout : {size: NumberInt(1), unit: "second"},
      "pipeline": 
      [ {$unset : ["_ts", "_stream_meta"]},
        {
          '$group': {
            '_id': '$id', 
            name : {$top : { output : ["$name"],  sortBy : { "name" : -1 }}},
            state : {$top : { output : ["$state"],  sortBy : { "state" : -1 }}}
            }
          }
        
      ]
    }
  }
