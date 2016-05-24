var fs = require('fs');

var runscopeJson = fs.readFileSync('tests/runscope1.json').toString();

var converter = require('../index.js');
console.log(converter.convert(runscopeJson));