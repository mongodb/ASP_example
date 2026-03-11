--bronze1 & bronze2 are objects that are related by $_STAT, 
--messages are missing one of the bronze# fields. and $top is used to push the null objects to the bottom. 

w = { 
    $tumblingWindow: {
        interval: {size: NumberInt(30), unit: "second"},
        "pipeline": [ 
                {$group: {_id : "$_STAT",
                bronze1: {$top : { output : ["$bronze1"],  sortBy : { "bronze1" : -1 }}},
                bronze2: {$top : { output : ["$bronze2"], sortBy : { "bronze2" : -1 }}},
                }},    
                ]
            }
}


--ALT, multiple records related by $id, merged together for a single output record

w2 = { 
    $tumblingWindow: {
        interval: {size: NumberInt(60), unit: "second"},
        "pipeline": [ 
                {$group: {_id : "$id",
                    phone: {$top : { output : ["$phone"],  sortBy : { "phone" : -1 }}},
                    email: {$top : { output : ["$email"], sortBy : { "email" : -1 }}},
                    state: {$top : { output : ["$state"], sortBy : { "state" : -1 }}}
                    }},
                {$project : {
                        _id :1,
                        phone : {$arrayElemAt : ["$phone" ,0]},
                        email :  {$arrayElemAt : ["$email" ,0]},
                        state : {$arrayElemAt : ["$state" ,0]},
                    }}
                ]
            }
}
