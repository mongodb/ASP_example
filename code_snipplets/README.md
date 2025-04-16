Examples of MQL code to solve various problems


#### cs_coll_to_object
When using a change stream _$source_ will take the name of the collection from which the document came from and create a new root document object named after the collection with the fullDocument as its value, also includes the fullDocument._id at the root level.
#### dedupe_whole_doc
Deduplcates identical documents in the window by using the $$ROOT object and setting it to an _id, the replace root in the pipeline then restores the original document structure, after which accumulators can be used without worrying about counting duplicates
#### distinct_count
Alternate ways of counting distinct occurrences in a window 
#### kafka_metadata
Kafka metadata which a _$source_ provices in _stream_meta
#### related_record_accumulation
Ways to combine messages that have different fields but a common matching key together in a window by using $top to test if the object is missing or null 
#### source_sinks
Examples of different ways to configure $source, $merge, and $emit
