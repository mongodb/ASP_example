use webdemo
db.createCollection('csweb')

db.runCommand( {
        collMod: 'csweb',
        changeStreamPreAndPostImages: { enabled: true }
} )

db.csweb.insertOne({cust : 111 , data : 'cust 1 stuff', double : 0.0, dt : new Date(), other : 'more stuff'})
db.csweb.insertOne({cust : 222 , data : 'cust2', double : 4.44, dt : new Date(), other : 'more stuff'})
db.csweb.update({cust : 222 }, {$set : {data : 'cust 2 new stuff', dt : new Date()}, $unset : {'other' : ""}})
db.csweb.remove({})

s = {$source : 
     { connectionName : 'jsncluster0',
     db : 'webdemo',
     coll : 'csweb'  }
}
sp.process([s])


s = {$source : 
     { connectionName : 'jsncluster0',
     db : 'webdemo',
     coll : 'csweb',
      config: {  fullDocument: 'whenAvailable',
      fullDocumentBeforeChange: 'whenAvailable',
}  }
}

rr =  {$replaceRoot: { newRoot : "$fullDocument"}}

af = {$addFields : {new_math : { $divide: [ 100, '$double' ] }}}

m = {
     $merge: {
         into: {
             connectionName: 'jsncluster0',
             db: 'webdemo',
             coll: 'csweb_out'
         },
         on: ['_id'],
         whenMatched: 'replace',
         whenNotMatched: 'insert'
     }
 }


 dlq = {dlq: {connectionName: 'jsncluster0', db: 'webdemo', coll: 'csweb_dlq'}}
 sp.createStreamProcessor('cswebdemo',[s,rr,af,m],dlq)
 sp.cswebdemo.start()

db.csweb.drop()

db.csweb_dlq.find({})
db.csweb_out.find({})
