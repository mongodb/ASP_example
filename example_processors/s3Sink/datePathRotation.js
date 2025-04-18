s =  {
        $source: {
          connectionName: 'sample_stream_solar',
          timeField: { $dateFromString: { dateString: '$timestamp' }}
      }
  }


s3 = {$emit : {connectionName :"s3test", 
                bucket : "jsnbucket0",
                path : { $concat: [ { $toString : {$year: {$currentDate: {}}}}, '/',
                    { $toString : {$month: {$currentDate: {}}}}, '/',
                    { $toString : {$dayOfMonth: {$currentDate: {}}}}, '/',
                    { $toString : {$hour: {$currentDate: {}}}}, '/',
                    { $toString : {$minute: {$currentDate: {}}}},
                 ] },
                config : {outputFormat : "basicJson",
                    writeOptions : {count : 10}
                }
}}

sp.process([s,s3])


curl  --request POST --location "https://cloud.mongodb.com/api/atlas/v2/groups/GROUP/streams/SPINAME/connections" \
     --user "PUBLICKEY:PRIVATEKEY" \
     --digest \
     --header "Content-Type: application/json" \
     --header "Accept: application/vnd.atlas.2023-02-01+json" \
     --data '{
	"name": "s3test",
	"type": "S3",
	"aws": {
		"roleArn": "ARNFROMIAMFROMTRUSTROLE",
		"testBucket": "jsnbucket0"
	}}'
    
