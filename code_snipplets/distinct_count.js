 w3 =  { $tumblingWindow: {
                    interval: {size: NumberInt(30), unit: "second"},
                            "pipeline": [ 
                                {
                                    $group: {
                                        "_id" : 1,
                                        count:  { $addToSet: "$device_id"  }                            
                                    },
                                }, 
                                { $project : {
                                    _id : 1,
                                    count: {$size:"$count"}
                                }
                                }
                            ],
                         } 
                     }


--ALTERNATE--

w2 =  { $tumblingWindow: {
                interval: {size: NumberInt(30), unit: "second"},
                        "pipeline": [ 
                            {
                                $group: {
                                    "_id" : { "device_id" : "$device_id"},                             
                                },
                            }, {
                                $group: {
                                    "_id" : 1,
                                    count: {$sum : 1}
                                }
                            },
                           

                        ],
                     } 
                 }
