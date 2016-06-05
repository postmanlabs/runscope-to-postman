var _ = require('lodash'),
	//SDK = require('postman-collection'),
	uuid = require('node-uuid');

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
	validateRunscope: function (runscopeJson) {
		//validate
		if(typeof runscopeJson === 'string') {
			runscopeJson = JSON.parse(runscopeJson);
		}

		if(runscopeJson.hasOwnProperty('name') && 
			runscopeJson.hasOwnProperty('trigger_url')) {
			return runscopeJson;
		}
		else {
			throw {
				'message': 'Not a runscope test'
			};
		}
	},

	initCollection: function (runscopeJson) {
		return {
			id: uuid.v4(),
			name: runscopeJson.name,
			description: runscopeJson.description,
			order: [],
			folders: [],
			requests: [],
			timestamp: (new Date()).getTime()
		};
	},

	getPostmanHeadersFromRunscopeHeaders: function (runscopeHeaders) {
		var str = '';
		for(var key in runscopeHeaders) {
			if(runscopeHeaders.hasOwnProperty(key)) {
				str += key+':'+runscopeHeaders[key]+'\n';
			}
		}
		return str;
	},

	addRequest: function (collection, request) {
		collection.order.push(request.id);
		request.collectionId = collection.id;
		collection.requests.push(request);
	},

	handleAuth: function (request, step) {
		if(step.auth.auth_type === 'basic') {
			request.currentHelper = 'basicAuth';
			request.helperAttributes = {
				id: 'basic',
				saveToRequest: true,
				username: step.auth.username,
				password: step.auth.password,
			};
		}
		//no other auth types supported yet
		//do oauth1 next
	},

	handleData: function (request, step) {
		if((typeof step.body === 'string') && JSON.stringify(step.form) == '{}') {
			request.dataMode = 'raw';
			request.data = step.body;
		}

		else if(step.form) {
			request.dataMode = 'urlencoded';
			var formArray = [];
			for(var key in step.form) {
				if(step.form.hasOwnProperty(key)) {
					formArray.push({
						key: key,
						value: step.form[key][0]
					});
				}
			}
			request.data = formArray;
		}
	},

	// handleAssertions: function (request, step) {
	// 	var tests = '';
	// 	_.each(step.assertions, function(ass) {
	// 	});
	// 	return tests;
	// },

	handleScripts: function (request, step) {
		if(!step.before_scripts) {
			step.before_scripts = [];
		}

		request.preRequestScript = '';

		var runscopePrScript = step.before_scripts.join('\n');
		runscopePrScript = runscopePrScript.replace(/\n/g,'\n//');
		if(!_.isEmpty(runscopePrScript)) {
			request.preRequestScript = '//==== You will need to convert this to a ' + 
				'Postman-compliant script ====\n' + 
				'//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n' + 
				'//' + runscopePrScript;
		}


		if(!step.scripts) {
			step.scripts = [];
		}
		var runscopeTestScript = step.scripts.join('\n');
		runscopeTestScript = runscopeTestScript.replace(/\n/g,'\n//');
		if(!_.isEmpty(runscopeTestScript)) {
			request.tests += '//==== You will need to convert this to a ' + 
				'Postman-compliant script ====\n' + 
				'//==== (Select text and use Ctrl + / (Win) or Cmd + / (Mac) to uncomment ====\n' + 
				'//' + runscopeTestScript;
		}
	},

	getRHSFromComparisonAndOperands: function(comparison, oper1, oper2) {
		switch(comparison) {
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
				return '!isNaN('+oper1+')';
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

	handleAssertions: function (request, step) {
		var tests = '',
			oldThis = this;
		_.each(step.assertions, function (ass) {

			var testName = '',
				oper1 = null,
				oper2 = '\'' + ass.value + '\'',
				testScript = '';

			// Handle source (LHS)
			switch(ass.source) {
				case 'response_status':
					testName += 'Status Code is correct';
					oper1 = 'responseCode.code';
					break;
				case 'response_headers':
					// this will have a property
					testName += '\''+ass.property+'\' Response Header is correct';
					oper1 = 'postman.getResponseHeader(\''+ass.property+'\')';
					break;
				case 'response_json':
					if(ass.property) {
						testName += 'Response.' + ass.property + ' is correct';
						oper1 = 'JSON.parse(responseBody).'+ass.property;
					}
					else {
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

			if(oper1) {
				testScript = 'tests["' + testName + '"] = ' + 
					oldThis.getRHSFromComparisonAndOperands(ass.comparison, oper1, oper2) + ';';
				if(testScript.indexOf('JSON.parse') > -1) {
					testScript = 'try {\n\t' + testScript + '\n}\ncatch(e) {\n\t'+
					'tests["' + testName + '"] = false;\n\t' +
					'console.log(\"Could not parse JSON\");\n}';
				}
				tests += testScript + '\n\n';
			}
		});

		if(!_.isEmpty(tests)) {
			request.tests += '//==== This section is Postman-compliant ====\n' + 
				tests + '\n';
		}
	},

	getRequestFromStep: function (step) {
		var oldThis = this;

		var request = {
			id: uuid.v4(),
			url: step.url,
			headers: oldThis.getPostmanHeadersFromRunscopeHeaders(step.headers),
			pathVariables: {},
			method: step.method,
			name: step.url,
			description: step.note,
			tests: ''
		};

		oldThis.handleData(request, step);

		oldThis.handleAuth(request, step);

		oldThis.handleAssertions(request, step);

		oldThis.handleScripts(request, step);		

		return request;
	},

	convert: function (runscopeJson) {
		var oldThis = this;
		runscopeJson = this.validateRunscope(runscopeJson);
		var collection = this.initCollection(runscopeJson);

		_.each(runscopeJson.steps, function(step) {
			oldThis.addRequest(collection, oldThis.getRequestFromStep(step));
		});

		return collection;
	}
};

module.exports = runscopeConverterV1;