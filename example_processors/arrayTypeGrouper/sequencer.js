use airline
db.test.insertMany([{ID : 2, ACTION : "CREATE", time : ISODate("2025-01-01T19:01:05.001Z")}, 
                    {ID : 2, ACTION : "UPDATE", time : ISODate("2025-01-01T19:01:06.301Z")},
                    {ID : 2, ACTION : "SORTTEST", time : ISODate("2025-01-01T19:01:06.002Z")},
                    {ID : 1, ACTION : "UPDATE", time : ISODate("2025-01-01T19:01:06.002Z")}
                 ])

//Fake Stream Documents Array
s = {$source : {documents : [{ID : 1, ACTION : "CREATE", time : ISODate("2025-01-01T19:01:01.001Z")}, 
                             {ID : 2, ACTION : "VOID",  time : ISODate("2025-01-01T19:01:07.001Z")},
                             {ID : 3, ACTION : "VOID",  time : ISODate("2025-01-01T19:01:06.001Z")},
                             {ID : 4, ACTION : "VOID",  time : ISODate("2025-01-01T19:01:06.001Z"), optype : "DELETE"}
                            ]}}

//Find existing documents in the database related to the stream documents that came in
l = {
    $lookup: {
        from: {
            connectionName: 'jsncluster0',
            db: 'airline',
            coll: 'test'
        },
        localField: "ID",
        foreignField: "ID",
        as: 'txn',
    }
}

//Calculate how many documents were found in the database
afsize = {$addFields : {txnsize : {$size : "$txn"}}}

//Decide to pass on a transaction document or not
passon = {$match : {$or : 
                         [{$and : [{$expr: {$eq: ["$ACTION", "VOID"]}}, {$expr: {$eq: ["$optype", "DELETE"]}}]},
                          {$and : [{$expr: {$eq: ["$ACTION", "VOID"]}}, {$expr: {$gt: ["$txnsize", 0]}}]},
                          {$and : [{$expr: {$eq: ["$ACTION", "CREATE"]}}]},  
                    ]}
                }

//add the stream document to the txn array for the next reduce logic
addtotxn = {$project : {
                    ID : 1,
                    optype : 1,
                    txn : { $concatArrays: [ "$txn", [{_id : "$_id", ID : "$ID", ACTION : "$ACTION", time : "$time"}]] }
                }}

//check the txn array for parts to help decide if it really goes down stream or not 
p = { $addFields : {
         txncontents : {$reduce: {
                            input: "$txn",
                            initialValue: {
                                create: false,
                                update : false,
                                void : false,
                            },
                                in: {$switch: {
                                            branches: [
                                            {
                                                case: {$eq: ["$$this.ACTION", "CREATE"]},
                                                then: {$mergeObjects: [
                                                    "$$value",
                                                    {create : true} ]}
                                                },
                                            {
                                                case: {$eq: ["$$this.ACTION", "UPDATE"]},
                                                then: {$mergeObjects: [
                                                    "$$value",
                                                    {update : true}]}
                                            },
                                            {
                                                case: {$eq: ["$$this.ACTION", "VOID"]},
                                                then: {$mergeObjects: [
                                                    "$$value",
                                                    {void : true}]}
                                            },
                                            ],
                                    default: {$mergeObjects: ["$$value"]}    
                                }}
                    }}
}}    

//sort the txn array by time
sa = {$addFields : {
    txn : {$sortArray: {
        input: "$txn",
        sortBy: {time : 1}
    }}
}} 

//filter the documents to decice whats passed on based on all transactions contents in the document array
ready = {$match : {$or : 
    [{$and : [{$expr:  {$eq: [ "$txncontents.create", true ]}}, ]},
     {$and : [{$expr: {$eq: ["$txncontents.void", true]}}, {$expr: {$eq: ["$optype", "DELETE"]}}]},
     {$and : [{$expr:  {$eq: [ "$txncontents.update", true ]}}, ]}
]}
}

//emit stage to Kafka
e = {$emit : { connectionName : "msk", topic : "dtx"}}

sp.process([s,l,afsize,passon,addtotxn,p,sa,ready])

sp.createStreamProcessor("sequencer",[s,l,afsize,passon,addtotxn,p,sa,ready,e])

