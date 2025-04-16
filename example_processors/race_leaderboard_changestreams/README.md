note that currently Atlas SP does not provide the FULL DOCUMENT on anything other then an new insert into the collection.. 
this can make a number of problems for groupbys as the required data may not be part of the upsert of the document..
in the future the full document will be provided as default for even updates. 

the script racer2mongo.py creates new inserts non-stop

the script racer2mongo_upsert.py updates the records which is currently of no use to this processor.
