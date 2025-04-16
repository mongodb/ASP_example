//Create Collections in Atlas
db.createCollection("reservations")
db.createCollection("passengerList")
db.passengerList.createIndex({"flight": 1}, {unique: true})

//Add pre.post images to handle deletes
db.runCommand( {
    collMod: "reservations",
    changeStreamPreAndPostImages: { enabled: true }
} )
db.runCommand( {
    collMod: "passengerList",
    changeStreamPreAndPostImages: { enabled: true }
} )

//Create an existing flight with passengers 
db.passengerList.insertOne({flight : 1, list : [{name : "john"}, {name : "bob"}]})

//Add new reservations to the flight
db.reservations.insertOne({flight : 1, passenger : [{name : "joe"}]})
db.reservations.insertOne({flight : 1, passenger : [{name : "kenny"},{name : "laura"}]})

//create a new flight that has no reservations at all
db.reservations.insertOne({flight : 2, passenger : [{name : "amber"}]})

//remove passangers from flight
db.reservations.remove({flight : 1, passenger : [{name : "kenny"},{name : "laura"}]})
db.reservations.remove({flight : 1, passenger : [{name : "joe"}]})
db.reservations.remove({flight : 2, passenger : [{name : "amber"}]})


//Atlas Stream Processing
s = {$source : {connectionName : "jsncluster0", db : "test", coll : "reservations", config : { fullDocument: 'whenAvailable', fullDocumentBeforeChange: 'whenAvailable',}}}
rr = {$replaceRoot: { newRoot :  { $mergeObjects: [ "$fullDocument", {"deleteChange" : "$fullDocumentBeforeChange"}, { "operationType" : "$operationType"} ] }}}
aff = {$addFields : {"flight" : {$switch: {
            branches: [
                {   case: {$eq: ["$operationType", "delete"]},
                    then: "$deleteChange.flight"
                },
                    ],
            default: "$flight" } }}}
l = {
    $lookup: {
        from: {
            connectionName: 'jsncluster0',
            db: 'test',
            coll: 'passengerList'
        },
        localField: "flight",
        foreignField: "flight",
        as: 'currentPassengerList',
    }
}
af1 = {$addFields : {"newList" :  
                                  {$switch: {
                                    branches: [
                                        {   case: { $and: [ {$eq: ["$operationType", "insert"]}, {$eq: [{$size : "$currentPassengerList"}, 0]}]},
                                            then: "$passenger"
                                        },
                                        {   case: {$eq: ["$operationType", "insert"]},
                                            then: {$concatArrays: ["$passenger", {$arrayElemAt: [ "$currentPassengerList.list", 0]}]}
                                        },
                                            ],
                                    default: { $setDifference: [ {$arrayElemAt: [ "$currentPassengerList.list", 0]}, "$deleteChange.passenger" ] }
 }    
                                }}}

p = {$project : {
    flight : 1,
    list : "$newList"
}}

us = {$unset : ["_id", "_stream_meta", "_ts"]}


m = {$merge : { 
    into : {
        connectionName : "jsncluster0", 
        db : "test", 
        coll : "passengerList"}, 
        on: ["flight"],
        whenMatched : "merge",
        whenNotMatched: "insert"
  }} 


  sp.process([s,rr,aff,l,af1,p,us,m])

