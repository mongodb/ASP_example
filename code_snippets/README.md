Examples of MQL code to solve various problems


#### cs_coll_to_object
When using a change stream _$source_ will take the name of the collection from which the document came from and create a new root document object named after the collection with the fullDocument as its value, also includes the fullDocument._id at the root level.
#### dedupe_whole_doc
Deduplcates identical documents in the window by using the $$ROOT object and setting it to an _id, the replace root in the pipeline then restores the original document structure, after which accumulators can be used without worrying about counting duplicates
#### distinct_count
Alternate ways of counting distinct occurrences in a window 
#### hexConverter
Ways to convert hex values to decimal
#### kafka_metadata
Kafka metadata which a _$source_ provices in _stream_meta
#### largeKafkaMessages
Ways to check the size of a document/event in the Stream Processors and DLQ if its to large. Needed at times when messages can be larger then the Kafka topic/broker/cluster will accept.
#### opscmds
Asorted operations commands: How to clear a checkpoint, passing date objects over Terraform and AdminAPI, modifying a processor stage without copying the pipeline
#### related_record_accumulation
Ways to combine messages that have different fields but a common matching key together in a window by using $top to test if the object is missing or null 
#### single_level_date_2_string
Convert all date objects at the root level to a string. (Not needed when output stage supports the dateFormat config)
#### source_sinks
Examples of different ways to configure $source, $merge, and $emit
#### window_array_push
A way to build an array of common records in a window
