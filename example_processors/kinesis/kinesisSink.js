
#Emit Stage
#partitionKey must be a string
e = {
	"$emit": {
    "connectionName": "kinesis1",
		"stream" : "jsnkstreamtest02",
		"partitionKey" : {$toString : "$id"},
		"config" : {
			"outputFormat" : "basicJson", dateFormat : "ISO8601"
 }}}

#IAM Policy
        {
            "Effect": "Allow",
            "Action": [
                "kinesis:PutRecords",
                "kinesis:DescribeStreamSummary"
            ],
            "Resource": [
                "arn:aws:kinesis:us-east-1:195385555781:stream/jsnkstreamtest01"
            ]
        }
