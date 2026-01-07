 s = {$source : {documents : [{f1: 1, f2: 2}, {f1: 3, f2: 4}]}}
 set = {$set : {topic : ["events_format1", "events_format2"]}}
 uw = {$unwind : "$topic"}
 setmeta = {$setStreamMeta : {"stream.topicFormat" : "$topic"}}
 unset = {$unset : ["topic"]}
 p = {$project : {
	f1 : 1,
	f2 : {$cond : {if : { $eq: [ {$meta : "stream.topicFormat"}, "events_format1" ] }, then : "$f2", else : "$$REMOVE"}},
	f3 : {$cond : {if : { $eq: [ {$meta : "stream.topicFormat"}, "events_format1" ] }, then : {$multiply : ["$f1", "$f2"]}, else : "$$REMOVE"}},
	f4 : {$cond : {if : { $eq: [ {$meta : "stream.topicFormat"}, "events_format2" ] }, then : {$add : ["$f1", "$f2"]}, else : "$$REMOVE"}}
}}
e = {$emit : {connectionName : "kafka0", topic : {$meta : "stream.topicFormat"}}}

sp.process([s,set,uw,setmeta,unset,p,e])

Topic: events_format1 gets
{ "f1": 1,"f2": 2,"f3": 2}
{ "f1": 3, "f2": 4, "f3": 12 }

Topic: events_format2 gets
{ "f1": 1, "f4": 3 }
{ "f1": 3, "f4": 7 }
