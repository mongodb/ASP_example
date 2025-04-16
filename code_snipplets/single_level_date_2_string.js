//convert all dates at the root level to strings. (need to add a replace route to get to the fulldocument as $$ROOT, or change $$ROOT)
s =  {$source: { documents: [ 
    {"_id" : new ObjectId(), "cdate": new Date(), "tim": new ISODate(), "String": "a string", "boolean": true, "int": 2, "double": 1.101, "none": null }
    ,{"_id" : new ObjectId(), "cdate": new Date(), "tim": new ISODate(), "String": "a string", "boolean": true, "int": 1, "double": 1.101, "object": { "test1": 1, "test2": "val2" }, "none": null,  "array": [1, "2", 3.3, { "test1": 1,  "test2": "val2" }]}
], }}

p = {$project : {
    _id : 0,
    items : { $arrayToObject : { $map :{
        input: {$filter: {
            input: { $objectToArray: "$$ROOT" },
            cond: { $and: [
                {$ne: ["$$this.k", "_ts"]}, 
                {$ne: ["$$this.k", "_stream_meta"]}
            ]}
        }},
        in:  {$switch : {
            branches: [
                {case : {$or : [{$eq : [{$type : "$$this.v"}, "date"]}, {$eq : [{$type : "$$this.v"}, "timestamp" ]}] }, 
                 then : {"k" : "$$this.k", "v" : {$toString : "$$this.v"}}
                },                   
            ],
            default:  {"k" : "$$this.k", "v" :  "$$this.v"}
        }}  
      } } }
}}

rr = {$replaceRoot: { newRoot : "$items"} }

sp.process([s,p,rr])
