s = {$source : {documents : [{name : "joe", test : null, more : "stuff"}, {name : "ryan", test : "word", more : null}, {name : "dom", test : null, more : null}, {name : "john", test : 1, more : "stuff"}, ]}}
p = { $project: {_id: 0,  item: {
    $filter: {
        input: { $objectToArray: "$$ROOT" },
        cond: { $and: [
            {$ne: ["$$this.v", null]},
        ]}
    }
}}}
a = {$project : {new : { $arrayToObject: "$item"}}}
rr = {$replaceRoot : {newRoot : "$new"}}

sp.process([s,p,a,rr])
