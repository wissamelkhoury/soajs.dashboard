"use strict";
var assert = require("assert");
var helper = require("../../../helper.js");
var utils = helper.requireModule('./lib/cloud/namespaces.js');
var namespaces;
var config = {
	errors: {}
};
var req = {
	soajs: {
		registry: {
			coreDB: {
				provision: {}
			}
		},
		log: {
			debug: function (data) {
				console.log(data);
			},
			error: function (data) {
				console.log(data);
			},
			info: function (data) {
				console.log(data);
			}
		},
		inputmaskData: {}
	}
};
var mongoStub = {
	checkForMongo: function (soajs) {
		return true;
	},
	validateId: function (soajs, cb) {
		return cb(null, soajs.inputmaskData.id);
	},
	findEntries: function (soajs, opts, cb) {
		cb(null, []);
	},
	findEntry: function (soajs, opts, cb) {
		cb(null, {});
	},
	removeEntry: function (soajs, opts, cb) {
		cb(null, true);
	},
	saveEntry: function (soajs, opts, cb) {
		cb(null, true);
	}
};

var deployer = {

	deleteNameSpace: function (options, cb) {
		return cb(null, true);
	},
	listNameSpaces: function (options, cb) {
		return cb(null, []);
	},
	addNode: function (options, cb) {
		return cb(null, true);
	},
	updateNode: function (options, cb) {
		return cb(null, true);
	},
	removeNode: function (options, cb) {
		return cb(null, true);
	},
	listNodes: function (options, cb) {
		var arr = [];
		return cb(null, arr);
	},
	listServices: function (data, cb) {
		var arr = [
			{
				labels: {
					'soajs.env.code': 'dev'
				},
				ports: []
			}
		];
		return cb(null, arr);
	}
};

var envRecord = {
	_id: '',
	code: 'DEV',
	deployer: {
		"type": "container",
		"selected": "container.docker.local",
		"container": {
			"docker": {
				"local": {
					"socketPath": "/var/run/docker.sock"
				},
				"remote": {
					"nodes": ""
				}
			},
			"kubernetes": {
				"local": {
					"nginxDeployType": "",
					"namespace": {},
					"auth": {
						"token": ""
					}
				},
				"remote": {
					"nginxDeployType": "",
					"namespace": {},
					"auth": {
						"token": ""
					}
				}
			}
		}
	}
};

var envRecordKub = {
	_id: '',
	code: 'DEV',
	deployer: {
		"type": "container",
		"selected": "container.kubernetes.local",
		"container": {
			"docker": {
				"local": {
					"socketPath": "/var/run/docker.sock"
				},
				"remote": {
					"nodes": ""
				}
			},
			"kubernetes": {
				"local": {
					"nginxDeployType": "",
					"namespace": {},
					"auth": {
						"token": ""
					}
				},
				"remote": {
					"nginxDeployType": "",
					"namespace": {},
					"auth": {
						"token": ""
					}
				}
			}
		}
	}
};

describe("testing namespaces.js", function () {

	describe("testing init", function () {

		it("No Model Requested", function (done) {
			utils.init(null, function (error, body) {
				assert.ok(error);
				done();
			});
		});

		it("Model Name not found", function (done) {

			utils.init('anyName', function (error, body) {
				assert.ok(error);
				done();
			});
		});

		it("Init", function (done) {

			utils.init('mongo', function (error, body) {
				assert.ok(body);
				namespaces = body;
				namespaces.model = mongoStub;
				done();
			});
		});

	});

	describe("list", function () {

		it("success", function (done) {
			mongoStub.findEntry = function (soajs, opts, cb) {
				cb(null, envRecord);
			};
			namespaces.list(config, req.soajs, deployer, function (error, body) {
				// assert.ok(error);
				done();
			});
		});

		it("success kubernetes", function (done) {
			mongoStub.findEntry = function (soajs, opts, cb) {
				cb(null, envRecordKub);
			};
			namespaces.list(config, req.soajs, deployer, function (error, body) {
				// assert.ok(error);
				done();
			});
		});

	});

	describe("delete", function () {

		it("success", function (done) {
			mongoStub.findEntry = function (soajs, opts, cb) {
				cb(null, envRecord);
			};
			namespaces.delete(config, req.soajs, deployer, function (error, body) {
				// assert.ok(error);
				done();
			});
		});

		it("success kubernetes", function (done) {
			mongoStub.findEntry = function (soajs, opts, cb) {
				cb(null, envRecordKub);
			};
			namespaces.delete(config, req.soajs, deployer, function (error, body) {
				// assert.ok(error);
				done();
			});
		});

	});

});