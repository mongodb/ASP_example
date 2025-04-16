Example end to end processors

For a very basic intro processor using the build in ASP sample data source see [simple_solar](https://github.com/josephxsxn/atlas_stream_processors/blob/master/example_processors/README.md#simple_solar)

### accumulation_union_example
Reads records from a Kafka topic with common keys but different fields and merges them into a single record in a tumblingWindow using $top before emitting back to a Kafka topic.

### additive_merge / merge_arrays.js
Method using pipeline pushdown in $merge with $concatArrays to add to an existing collection document's array

### additive_merge / pipelineAdder.js
Uses $merge with a pipeline to add fields together on already existing records in the target collection, this prevents having to perform a $lookup to fetch the values to be added together and lets the server perform the addition

### additive_merge / steps_add_multiplex_window.js
Takes a stream of step counter data that is reported in hex, converts the hex to dec. Then windows the records together based on the number of output reports required and multi-plexes the updates into multiple collections. Outputs and adds the steps of existing records for daily, monthly, weekly, and yearly reports.

### additive_merge / steps_add_multiplex_row.js
Like additive_merge / steps_add_multiplex_window.js but without a window. This one collects raw data and operates row by row. Performance may suffer doing row by row depending on stream velocity against the collections. Outputs and adds the steps of existing records for raw, monthly, weekly, and yearly reports.

### additive_merge / pipelineAdder.js
Uses $merge with a pipeline to add fields together on already existing records in the target collection, this prevents having to perform a $lookup to fetch the values to be added together and lets the server perform the addition

### additive_merge / updateIfGTcurrent.js
Ways to decide using a versionID in the document or a timestamp if the document being merged should replace an existing document or not

### array_explode
Takes a document field that is an array, checks that the array has a specific value within it, explodes (unwinds) the array into multiple records each with the field name now being equal to one of the values of the array, and unsets _id to avoid collisions 

### arrayTypeGrouper / reducer.js
Way to group messsages by id and type into arrays using $reduce

### arrayTypeGrouper / sequencer.js
Checks if proper sequence of events exists in an array, sending it down stream if it does or discarding if it does not

### cs_webexample / simple_cs.js
Basic change streams source example

### dynamicexpressions/simple_dynamic_expressions.js
An example of expression language and switch statements in $merge for routing messages to differnt collections based on values within the documents

### dynamicexpressions/simple_multiplex.js
Method to duplicate events in the processor to send them to multiple output destinations 

### dynamicfilter
Reads a MongoDB change stream $source collection, performs a $lookup to find filtering rules and applys the filter, increments the value of the document and writes it back to the same collection creating a loop. The merge stage output collection is dynamic and breaks the loop after a specific value is reached, writing it to another collection. 

### lateData / lateDataExample.js
Example how late data handling works with allowedLateness. Helpful to understand how watermarks move forward and result in windows opening and closing. This example uses a timestamp from the document to control the watermark time of the event stream.

### fakeCron / scheduledProcessor.js
Way to create a fake scheduled processor using the sample datasource and a window as the timer. Could be improved by using processTime boundy type config

### idletimeout
Processor shows how the idle timeout closes a window if no data is inbound when using the eventTime boundary type (default)

### joinlatedatablog
Joining streams together and handling late events 
https://medium.com/@josephxsxn/joins-with-late-data-handling-in-atlas-stream-processing-28219d365714 

### lateData
A simple example that can be ran to better understand how eventTime works with windows and lateData handling

### packet_processor
Performs a tumblingWindow off of a kafka topic $source for packet combinations of src_ip, src_port, dst_ip, dst_port and performs some time math calculations. Also an example python script for collecting Packet data and writing it to a Kafka Topic 

### race_leaderboard
Calculates and updates a collection to be a leaderboard. Racer data comes from a Kafka Topic $source, the pace car is filter out, and then a window calculates the latest events over a window of time reducing the number of events that must be merged to the target leaderboard collection. Also includes a python script to generate kafka topic race car data

### race_leaderboard_changestreams
Like the race_leaderboard but designed for Change Stream Sources

### reservationUpdater
Example application that manages passenger lists based on reservation actions of passenger

### simple_solar
Uses the built in solar data source to perform validation filtering of iot solar devices, and windowing of the average wattage created before updating devices in a Mongo Collection

### streamingAtlasDeletes / sinkTTLDeletes.js
Using soft deletes (setting document field to true) and partial TTL indexes on a collection to delete records

### streamingAtlasDeletes / sourceTTLDeletes.js
Using change streams and getting delete change events from a collection with a TTL index

### streamingJoins / windowJoins.js
Ways of joining together event documents in a window to access fields

### streamingJoins / leftrightwindow.js
Using a reducer to join 2 event documents completely together without accessing specific fields

### superdoc
Two processors that work together to handle creation and updates, or deletes. The processors read the change stream $source of an entire database and output to a target collection a super document where each field of the document is the collection name it came from. Deletes work to detect that the source collection has deleted the document and removes it from the respective super document. 

### toplevel_arrayJSONExplode
2 Solutions for when a single record is a top level array json rather then a top level object according to the JSON RFC. Turns each array object into its own document for processing. 
