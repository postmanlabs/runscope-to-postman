var _ = require('lodash'),
  fs=require('fs'),
  SDK = require('postman-collection');

var runscopeConverterV1 = {
  //validate
  validate: function(runscopeJson) {
    if(! runscopeJson.trigger_url || !runscopeJson.name || !runscopeJson.steps){
      return {
        result:false,
        reason:'not a valid runscope file (might not contain trigger_url or name or steps properties )'
      };
    }
    else{
      return {
        result:true
      };
    }
  },

  initCollection: function(runscopeJson) {
    return {
      info: {
        name: runscopeJson.name,
        description: runscopeJson.description,
        schema:
          'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: []
    };
  },

  getPostmanHeadersFromRunscopeHeaders: function(runscopeHeaders) {
    var headers=[];
    for (var key in runscopeHeaders) {
      if (runscopeHeaders.hasOwnProperty(key)) {
        headers.push({
          key:key,
          value:runscopeHeaders[key][0]
        });
      }
    }
    return headers;
  },

  addRequest: function(collection, request) {
    collection.item.push(request);
  },

  handleAuth: function(request, step) {
    if (step.auth.auth_type === 'basic') {
      request.auth = {};
      request.auth.type = 'basic';
      request.auth.basic = [];
      request.auth.basic[0] = {
        key: 'password',
        value: step.auth.password,
        type: 'string'
      };
      request.auth.basic[1] = {
        key: 'username',
        value: step.auth.username,
        type: 'string'
      };
    }
    //no other auth types supported yet
    //do oauth1 next
  },

  handleData: function(request, step) {
    if (typeof step.body === 'string' && JSON.stringify(step.form) == '{}') {
      request.body.mode = 'raw';
      request.body.raw = step.body;
    } else if (step.form) {
      request.body.mode = 'urlencoded';
      var formArray = [];
      for (var key in step.form) {
        if (step.form.hasOwnProperty(key)) {
          formArray.push({
            key: key,
            value: step.form[key][0]
          });
        }
      }
      request.body.urlencoded = formArray;
    }
  },

  handleScripts: function(event, step) {
    //pre-request scripts in postman
    if (!step.before_scripts) {
      step.before_scripts = [];
    }

    var runscopePrScript = [];
    step.before_scripts.forEach(function(element) {
      runscopePrScript.push.apply(element.split('/\n/g'));
    });
    if (!_.isEmpty(runscopePrScript)) {
      var prScript = {
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: []
        }
      };
      prScript.script.exec.push.apply(
        [
          '//==== You will need to convert this to a Postman-compliant script ====\n',
          '//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n',
          '//'
        ]
      );
      runscopePrScript.forEach(function(element)  {
        prScript.script.exec.push('//' + element);
      });
      event.push(prScript);
    }

    //tests in postman
    if (!step.scripts) {
      step.scripts = [];
    }
    var runscopeTestScript = [];
    step.scripts.forEach(function(element) {
      runscopeTestScript.push.apply(element.split('/\n/g'));
    });

    if (!_.isEmpty(runscopeTestScript)) {
      var eventIndex = _.findIndex(event, function(o) {
        return o.listen == 'test';
      });
      if (eventIndex === -1) {
        var testScript = {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: []
          }
        };
        testScript.script.exec.push.apply(
          [
            '//==== You will need to convert this to a Postman-compliant script ====\n',
            '//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n',
            '//'
          ]
        );
        runscopeTestScript.forEach(function(element) {
          testScript.script.exec.push('//' + element);
        });
        event.push(testScript);
      } else {
        event[eventIndex].script.exec.push.apply(
          [
            '//==== You will need to convert this to a Postman-compliant script ====\n',
            '//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n',
            '//'
          ]
        );
        runscopeTestScript.forEach(function(element)  {
          event[eventIndex].script.exec.push('//' + element);
        });
      }
    }
  },

  getRHSFromComparisonAndOperands: function(comparison, oper1, oper2) {
    switch (comparison) {
      case 'equal_number':
      case 'equal':
        return oper1 + ' == ' + oper2;
      case 'not_equal':
        return oper1 + '!=' + oper2;
      case 'empty':
        return '_.isEmpty(' + oper1 + ')';
      case 'not_empty':
        return '!_.isEmpty(' + oper1 + ')';
      case 'contains':
        return '_.contains(' + oper1 + ')';
      case 'does_not_contain':
        return '!_.contains(' + oper1 + ')';
      case 'is_a_number':
        return '!isNaN(' + oper1 + ')';
      case 'is_less_than':
        return oper1 + ' < ' + oper2;
      case 'is_less_than_or_equal':
        return oper1 + ' <= ' + oper2;
      case 'is_greater_than':
        return oper1 + ' > ' + oper2;
      case 'is_greater_than_or_equal':
        return oper1 + ' >= ' + oper2;
      case 'has_key':
        return oper1 + '.hasOwnProperty(' + oper2 + ')';
      case 'has_value':
        return '_.contains(_.values(' + oper1 + '), ' + oper2 + ')';
      default:
        return '<comparison here>';
    }
  },

  handleAssertions: function(event, step) {
    var tests = [],
      oldThis = this;
    _.each(step.assertions, function(ass) {
      var testName = '',
        oper1 = null,
        oper2 = '"' + ass.value + '"',
        testScript = '';

      // Handle source (LHS)
      switch (ass.source) {
        case 'response_status':
          testName += 'Status Code is correct';
          oper1 = 'responseCode.code';
          break;
        case 'response_headers':
          // this will have a property
          testName += '"' + ass.property + '" Response Header is correct';
          oper1 = 'postman.getResponseHeader("' + ass.property + '")';
          break;
        case 'response_json':
          if (ass.property) {
            testName += 'Response.' + ass.property + ' is correct';
            oper1 = 'JSON.parse(responseBody).' + ass.property;
          } else {
            testName += 'JSON Response is correct';
            oper1 = 'JSON.parse(responseBody)';
          }
          break;
        case 'response_size':
          testName += '//';
          break;
        case 'response_text':
          testName += 'Response text is correct';
          oper1 = 'responseBody';
          break;
        case 'response_time':
          testName += 'Response time is correct';
          oper1 = 'responseTime';
          break;
      }

      if (oper1) {
        testScript =
          'tests["' +
          testName +
          '"] = ' +
          oldThis.getRHSFromComparisonAndOperands(
            ass.comparison,
            oper1,
            oper2
          ) +
          ';';
        if (testScript.indexOf('JSON.parse') > -1) {
          testScript =
            'try {\n\t' +
            testScript +
            '\n}\ncatch(e) {\n\t' +
            'tests["' +
            testName +
            '"] = false;\n\t' +
            'console.log("Could not parse JSON");\n}';
        }
        tests.push(testScript);
      }
    });

    if (!_.isEmpty(tests)) {
      var varEvent = {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: []
        }
      };
      varEvent.script.exec.push(
        '//==== This section is Postman-compliant ====\n'
      );
      tests.forEach(function(element){
        varEvent.script.exec.push(element);
      });
      event.push(varEvent);
    }
  },

  getRequestFromStep: function(step) {
    var oldThis = this;
    var item = {
      name: step.url,
      event: [],
      request: {
        method: step.method,
        header: oldThis.getPostmanHeadersFromRunscopeHeaders(step.headers),
        body: {},
        url: {
          raw: step.url
        },
        description: step.note
      },
      response: []
    };
    item.request.url=SDK.Url.parse(item.request.url.raw);
    oldThis.handleData(item.request, step);

    oldThis.handleAuth(item.request, step);

    oldThis.handleAssertions(item.event, step);

    oldThis.handleScripts(item.event, step);

    return item;
  },

  convert: function(runscopeJson) {
    var oldThis = this;
    // runscopeJson = this.validate(runscopeJson);
    var collection = this.initCollection(runscopeJson);

    _.each(runscopeJson.steps, function(step) {
      oldThis.addRequest(collection, oldThis.getRequestFromStep(step));
    });

    return collection;
  }
};

module.exports = {
  validate: function(input) {
    try {
      var data;
      if(input.type === 'string'){
        data=JSON.parse(input.data);
        return runscopeConverterV1.validate(data);
      }
      else if(input.type === 'file'){
        data=fs.readFileSync(input.data).toString();
        data=JSON.parse(input.data);
       return runscopeConverterV1.validate(data);
      }
      else if(input.type === 'json'){
        return runscopeConverterV1.validate(input.data);
      }
      else{
        throw 'input type is not valid';
      }
    } catch (e) {
      return {
        result: false,
        reason: e.toString()
      };
    }
  },
  convert: function(input, options,cb) {
    var conversionResult;
    var check = false;
    try {
      var data;
      if(input.type === 'string'){
        data=JSON.parse(input.data);
      }
      else if(input.type === 'file'){
        data=fs.readFileSync(input.data).toString();
        data=JSON.parse(input.data);
      }
      else if(input.type === 'json'){
        data=input.data;
      }
      else{
        throw 'input type is not valid';
      }
      conversionResult = runscopeConverterV1.convert(data);
      check = true;
    } catch (e) {
      console.log(e);
      cb(null, {
        result: false,
        reason: e.toString()
      });
    }
    if (check) {
      cb(null, {
        result: true,
        output: [
          {
            type: 'collection',
            data: conversionResult
          }
        ]
      });
    }
  }
};
