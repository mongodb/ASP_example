// find who is using the change stream cursor
// This script is intended to be run in the MongoDB shell
db = db.getSiblingDB("admin");
db.aggregate([
  { $currentOp: { allUsers: true }},
  { $match: {
      "cursor.tailable": true,
      "cursor.originatingCommand.pipeline.0.$changeStream": { $exists: true }
    }
  }
]);