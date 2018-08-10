var _ = require('lodash'),
  SDK = require('postman-collection');
  //uuidv4 = require('uuid/v4');

// var runscopeConverterV2 = {
// 	validateRunscope: function (runscopeJson) {
// 		//validate
// 		if (typeof runscopeJson === 'string') {
// 			runscopeJson = JSON.parse(runscopeJson);
// 		}

// 		if (runscopeJson.hasOwnProperty('name') &&
// 			runscopeJson.hasOwnProperty('trigger_url')) {
// 			return runscopeJson;
// 		}
// 		else {
// 			throw {
// 				'message': 'Not a runscope test'
// 			};
// 		}
// 	},

// 	getHeadersForStep: function (runscopeJson, step) {
// 		var retVal = [];
// 		for (var prop in step) {
// 			if (step.hasOwnProperty(prop)) {
// 				retVal.push(new SDK.Header({
// 					key: prop,
// 					value: step[prop][0]
// 				}));
// 			}
// 		}
// 		return retVal;
// 	},

// 	getRequestsFromSteps: function (runscopeJson) {
// 		var oldThis = this;
// 		return _.map(runscopeJson.steps, function(step) {
// 			console.log('URL: ' + step.url);
// 			var r = new SDK.Request({
// 				url: step.url,
// 				method: step.method
// 			});
// 			r.headers = oldThis.getHeadersForStep(runscopeJson, step);
// 			return r;
// 		});
// 	},

// 	convert: function (runscopeJson) {
// 		var oldThis = this;
// 		runscopeJson = oldThis.validateRunscope(runscopeJson);
// 		var collection = new SDK.Collection({
// 			info: {
// 				name: runscopeJson.name,
// 				description: runscopeJson.description
// 			}
// 		});

// 		var items = oldThis.getRequestsFromSteps(runscopeJson);
// 		_.each(items, function (rItem) {
// 			var cItem = new SDK.Item({
// 				id: uuid.v4(),
// 				version: '1.0.0',
// 				name: rItem.name,
// 				request: rItem
// 			});
// 			console.log('Added request: ' , rItem.toJSON());
// 			collection.items.add(cItem);
// 		});
// 		//console.log(JSON.stringify(collection));
// 	}
// };

var runscopeConverterV1 = {
  validateRunscope: function(runscopeJson) {
    //validate
    if (typeof runscopeJson === 'string') {
      runscopeJson = JSON.parse(runscopeJson);
    }

    if (
      runscopeJson.hasOwnProperty('name') &&
      runscopeJson.hasOwnProperty('trigger_url')
    ) {
      return runscopeJson;
    } else {
      throw {
        message: 'Not a runscope test'
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

  // handleAssertions: function (request, step) {
  // 	var tests = '';
  // 	_.each(step.assertions, function(ass) {
  // 	});
  // 	return tests;
  // },

  handleScripts: function(event, step) {
    //pre-request scripts in postman
    if (!step.before_scripts) {
      step.before_scripts = [];
    }

    var runscopePrScript = [];
    step.before_scripts.forEach(function(element) {
      runscopePrScript.push(...element.split('/\n/g'));
    });
    if (!_.isEmpty(runscopePrScript)) {
      var prScript = {
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: []
        }
      };
      prScript.script.exec.push(
        ...[
          '//==== You will need to convert this to a Postman-compliant script ====\n',
          '//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n',
          '//'
        ]
      );
      runscopePrScript.forEach(element => {
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
      runscopeTestScript.push(...element.split('/\n/g'));
    });

    if (!_.isEmpty(runscopeTestScript)) {
      var eventIndex = _.findIndex(event, function(o) {
        return o.listen == 'test';
      });
      if (eventIndex === -1) {
        var prScript = {
          listen: 'test',
          script: {
            type: 'text/javascript',
            exec: []
          }
        };
        prScript.script.exec.push(
          ...[
            '//==== You will need to convert this to a Postman-compliant script ====\n',
            '//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n',
            '//'
          ]
        );
        runscopeTestScript.forEach(element => {
          prScript.script.exec.push('//' + element);
        });
        event.push(prScript);
      } else {
        event[eventIndex].script.exec.push(
          ...[
            '//==== You will need to convert this to a Postman-compliant script ====\n',
            '//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n',
            '//'
          ]
        );
        runscopeTestScript.forEach(element => {
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
        oper2 = "'" + ass.value + "'",
        testScript = '';

      // Handle source (LHS)
      switch (ass.source) {
        case 'response_status':
          testName += 'Status Code is correct';
          oper1 = 'responseCode.code';
          break;
        case 'response_headers':
          // this will have a property
          testName += "'" + ass.property + "' Response Header is correct";
          oper1 = "postman.getResponseHeader('" + ass.property + "')";
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
      tests.forEach(element => {
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
    runscopeJson = this.validateRunscope(runscopeJson);
    var collection = this.initCollection(runscopeJson);

    _.each(runscopeJson.steps, function(step) {
      oldThis.addRequest(collection, oldThis.getRequestFromStep(step));
    });

    return collection;
  }
};

module.exports = {
  validate: function(runscopeJson) {
    try {
      var collection = runscopeConverterV1.validateRunscope(runscopeJson);
      return {
        result: true
      };
    } catch (e) {
      return {
        result: false,
        reason: e
      };
    }
  },
  convert: function(runscopeJson, cb) {
    var conversionResult;
    var check = false;
    try {
      conversionResult = runscopeConverterV1.convert(runscopeJson);
      check = true;
    } catch (e) {
      console.log(e);
      cb(e, {
        result: false,
        reason: e
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
