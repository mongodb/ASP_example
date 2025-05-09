// enable pre and post images for all collections in the database
// Note: This script is intended to be run in the MongoDB shell
// get the current database

var db = db.getSiblingDB("test") // replace "test" with your database name
var cols = db.getCollectionNames()

for (const el of cols){
    db.runCommand( {
        collMod: el,
        changeStreamPreAndPostImages: { enabled: true }
    } )
}