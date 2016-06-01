var expect = require('expect.js'),
    converter = require('../index.js'),
    fs = require('fs');

/* global describe, it */
describe('the converter', function () {
    it('must convert a basic runcope file', function () {
        var runscopeJson = fs.readFileSync('test/runscope2.json').toString(),
        	convertedString = converter.convert(runscopeJson);
        	//console.log(JSON.stringify(convertedString, null, 2))
        expect(convertedString.name).to.be('MY TEST NAME');
    });
});