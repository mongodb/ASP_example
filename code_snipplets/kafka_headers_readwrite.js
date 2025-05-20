#write header
s = {$source : {documents : [{test : 1}]}}
m = {$addFields : {time : {$meta : "stream.source.ts"},}}
e = {$emit : {connectionName : "solareventhub", 
              topic : "headertest", 
              config : {  "headers": { $objectToArray: {"type" : {$meta : "stream.source.type"}}}}
              }}


#read and convert header
s = {$source : {connectionName : "solareventhub", topic : "headertest", 
 config : {"auto_offset_reset" : "earliest", group_id : "test4"}}}
h = {$addFields : {headers : {$arrayToObject: {$meta : "stream.source.headers"}}}}
c = {$addFields : {converted : {
                        $convert: {
                            input: "$headers.type",
                            to: "string",
                            format: "utf8"
                        }
                        }}}
