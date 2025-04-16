s = {$source: { documents: [ 
   {name : "Joe", time: "2024-02-12T15:03:20.000Z" },
   {name : "David", time: "2024-02-12T15:03:21.000Z"} ], 
   timeField : { $dateFromString : { "dateString" : "$time"} }}}

af = { $addFields : {topic : {$switch: {
            branches: [
               { case: {$expr : {$eq : ['$name', "David"]}}, then: ["topic_1", "topic_2"] },
            ],
            default: [ "topic_2"]
}}}}

uw = {$unwind : "$topic"}

e = {$emit : { connectionName : "ccloud", topic : "$topic"}}
