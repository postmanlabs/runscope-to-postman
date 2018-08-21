var expect = require('expect.js'),
    converter = require('../index.js'),
    fs = require('fs');

/* global describe, it */
describe('the converter', function () {
    it('must convert a basic runcope file', function () {
        var runscopeJson = fs.readFileSync('test/runscope2.json').toString();
            //console.log(JSON.stringify(convertedString, null, 2))
            var input={
                type:'string',
                data:runscopeJson
            };
        converter.convert(input,{}, function(
            err,
            convertedString
          ) {
            expect(convertedString.output[0].data.info.name).to.be('MY TEST NAME');
        });
    });
});