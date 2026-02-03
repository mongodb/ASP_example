p = [
    {
        "$source": {
            "connectionName": "jsncluster0",
            "db": "test",
            "coll": "test",
            "config": {
                "fullDocument": "whenAvailable"
            }
        }
    },
    {
        "$addFields": {
            "isLarge": {
                "$gt": [
                    {
                        "$bsonSize": "$$ROOT"
                    },
                    16793600
                ]
            }
        }
    },
    {
        "$replaceRoot": {
            "newRoot": {
                "$cond": {
                    "if": {
                        "$eq": [
                            "$isLarge",
                            true
                        ]
                    },
                    "then": "$documentKey",
                    "else": "$$ROOT"
                }
            }
        }
    },
    {
        "$validate": {
            "validator": {
                "$expr": {
                    "$eq": [
                        "$isLarge",
                        false
                    ]
                }
            },
            "validationAction": "dlq"
        }
    },
    {
        "$unset": [
            "isLarge"
        ]
    },
    {
        "$merge": {
            "into": {
                "connectionName": "jsncluster0",
                "db": "test",
                "coll": "sizetest"
            }
        }
    }
]
