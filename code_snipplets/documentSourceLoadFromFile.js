#/path/data.json file contents
{"test" : 1}
{"test" : 2}
{"test" : 3}

// In mongosh
const fs = require('fs')
const raw_data = fs.readFileSync("/path/data.json", 'utf-8').split(/\r?\n/).filter(line => line !== '').map(line => EJSON.parse(line))
s = {$source : {documents : raw_data}}
sp.process([s,af])
