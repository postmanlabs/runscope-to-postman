var _ = require('lodash'),
	SDK = require('postman-collection'),
	uuid = require('node-uuid');

var runscopeConverterV2 = {
	validateRunscope: function(runscopeJson) {
		//validate
		if(typeof runscopeJson === "string") {
			runscopeJson = JSON.parse(runscopeJson);
		}

		if(runscopeJson.hasOwnProperty("name") && 
			runscopeJson.hasOwnProperty("trigger_url")) {
			return runscopeJson;
		}
		else {
			throw {
				"message": "Not a runscope test"
			};
		}
	},

	getHeadersForStep: function(runscopeJson, step) {
		var retVal = [];
		for(var prop in step) {
			if(step.hasOwnProperty(prop)) {
				retVal.push(new SDK.Header({
					key: prop,
					value: step[prop][0]
				}));
			}
		}
		return retVal;
	},

	getRequestsFromSteps: function(runscopeJson) {
		var oldThis = this;
		return _.map(runscopeJson.steps, function(step) {
			console.log("URL: " + step.url);
			var r = new SDK.Request({
				url: step.url,
				method: step.method
			});
			r.headers = oldThis.getHeadersForStep(runscopeJson, step);
			return r;
		});
	},

	convert: function(runscopeJson) {
		var oldThis = this;
		runscopeJson = oldThis.validateRunscope(runscopeJson);
		var collection = new SDK.Collection({
			info: {
				name: runscopeJson.name,
				description: runscopeJson.description
			}
		});


		var items = oldThis.getRequestsFromSteps(runscopeJson);
		_.each(items, function(rItem) {
			var cItem = new SDK.Item({
				id: uuid.v4(),
				version: "1.0.0",
				name: rItem.name,
				request: rItem
			});
			console.log("Added request: " , rItem.toJSON());
			collection.items.add(cItem);
		});
		//console.log(JSON.stringify(collection));
	}
};


var runscopeConverterV1 = {
	validateRunscope: function(runscopeJson) {
		//validate
		if(typeof runscopeJson === "string") {
			runscopeJson = JSON.parse(runscopeJson);
		}

		if(runscopeJson.hasOwnProperty("name") && 
			runscopeJson.hasOwnProperty("trigger_url")) {
			return runscopeJson;
		}
		else {
			throw {
				"message": "Not a runscope test"
			};
		}
	},

	initCollection: function(runscopeJson) {
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

	getPostmanHeadersFromRunscopeHeaders: function(runscopeHeaders) {
		var str = "";
		for(key in runscopeHeaders) {
			if(runscopeHeaders.hasOwnProperty(key)) {
				str += key+":"+runscopeHeaders[key]+"\n";
			}
		}
		return str;
	},

	addRequest: function(collection, request) {
		collection.order.push(request.id);
		request.collectionId = collection.id;
		collection.requests.push(request);
	},

	handleAuth: function(request, step) {
		if(step.auth.auth_type === "basic") {
			request.currentHelper = "basicAuth";
			request.helperAttributes = {
				id: "basic",
				saveToRequest: true,
				username: step.auth.username,
				password: step.auth.password,
			};
		}
		//no other auth types supported yet
		//do oauth1 next
	},

	handleData: function(request, step) {
		if((typeof step.body === "string") && JSON.stringify(step.form) == "{}") {
			request.dataMode = "raw";
			request.data = step.body;
		}

		else if(step.form) {
			request.dataMode = "urlencoded";
			var formArray = [];
			for(key in step.form) {
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

	handleAssertions: function(request, step) {
		var tests = "";
		_.each(step.assertions, function(ass) {
			//LADER DUDES
		});
		return tests;
	},

	handleScripts: function(request, step) {
		if(!step.before_scripts) {
			step.before_scripts = [];
		}
		request.preRequestScript = "// You will need to convert this to a " + 
			"Postman-compliant script\n" + 
			step.before_scripts.join("\n");


		if(!step.scripts) {
			step.scripts = [];
		}
		request.tests = "// You will need to convert this to a " + 
			"Postman-compliant script\n" + 
			step.scripts.join("\n");
	},

	getRequestFromStep: function(step) {
		var oldThis = this;

		var request = {
			id: uuid.v4(),
			url: step.url,
			headers: oldThis.getPostmanHeadersFromRunscopeHeaders(step.headers),
			pathVariables: {},
			method: step.method,
			name: step.url,
			description: "",
			tests: ""
		};

		oldThis.handleData(request, step);

		oldThis.handleAuth(request, step);

		oldThis.handleScripts(request, step);

		oldThis.handleAssertions(request, step);

		return request;
	},

	convert: function(runscopeJson) {
		var oldThis = this;
		runscopeJson = this.validateRunscope(runscopeJson);
		var collection = this.initCollection(runscopeJson);

		_.each(runscopeJson.steps, function(step) {
			oldThis.addRequest(collection, oldThis.getRequestFromStep(step));
		});

		console.log(JSON.stringify(collection));
	}
};

module.exports = runscopeConverterV1;