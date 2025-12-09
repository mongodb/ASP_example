
s = {
  "$source": {
    "connectionName": "kinesis1",
    "stream": "testkstream1",
        "config": {
      "consumerARN": "arn:aws:kinesis:us-east-1:1234567890:stream/testkstream1/consumer/MyEnhancedConsumer01:1764882718",
    }
  }
}

		{
			"Sid": "KinesisSource",
			"Effect": "Allow",
			"Action": [
				"kinesis:ListShards",
				"kinesis:DescribeStreamSummary",
				"kinesis:SubscribeToShard"
			],
			"Resource": [
				"arn:aws:kinesis:*:195385555781:*/*/consumer/*:*",
				"arn:aws:kinesis:us-east-1:195385555781:stream/testkstream1"
			]
		},

aws kinesis register-stream-consumer \
    --consumer-name MyEnhancedConsumer01 \
    --stream-arn arn:aws:kinesis:us-east-1:1234567890:stream/testkstream1
