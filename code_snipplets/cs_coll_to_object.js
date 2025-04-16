rr = {
  $replaceRoot: {
     newRoot: { $mergeObjects: [ {$arrayToObject: [ [ { k: "$ns.coll", v: "$fullDocument" } ] ]}, {"_id":"$fullDocument._id"}]}
  }
}
