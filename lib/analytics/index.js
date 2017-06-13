'use strict';

var fs = require("fs");
var async = require("async");
var soajs = require('soajs');
var analytics = require('soajs.analytics');
var utils = require("../../utils/utils.js");
var lib = require("./helper.js");
var cloud = require("./cloud/deploy/index");
var colls = {
	analytics: 'analytics',
	environment: 'environment'
};
var modelName = "mongo";

var BL = {
	model: null,

	/**
	 * check analytics status
	 * @param {Object} config: soajs config object
	 * @param {Object} req: soajs req object
	 * @param {Object} res: soajs res object
	 * @param {Object} cbMain: callback function
	 */
	"getSettings": function (config, req, res, cbMain) {

		var combo = {};
		combo.collection = colls.analytics;
		combo.conditions = {
			"_type": "settings"
		};
		//get analytics settings object
		BL.model.findEntry(req.soajs, combo, function (error, response) {
			utils.checkErrorReturn(req.soajs, cbMain, {config: config, error: error, code: 600}, function () {
				//formulate object
				var opts = {
					settings: response,
					env: req.soajs.inputmaskData.env.toLowerCase()
				};
				//forward call to soajs.analytics repository
				analytics.checkAnalytics(opts, cbMain);
			});
		});
	},

	/**
	 * Deploy analytics components and activate analytics in service
	 * @param {Object} config: soajs config object
	 * @param {Object} req: soajs req object
	 * @param {Object} res: soajs res object
	 * @param {Object} cbMain: callback function
	 */
	"activateAnalytics": function (config, req, res, cbMain) {
		cloud.init(modelName, function (err, catalogDeployment) {
			if (err) {
				return cb(err);
			}
			var combo = {};
			combo.collection = colls.analytics;
			combo.conditions = {
				"_type": "settings"
			};
			/**
			 * get analytics settings
			 * get current environment record where analytics should be deployed and dashboard environment record
			 * get elasticsearch cluster and create an elasticsearch connection
			 * forward the call to soajs.analytics repository
			 */
			BL.model.findEntry(req.soajs, combo, function (error, settings) {
				utils.checkErrorReturn(req.soajs, cbMain, {config: config, error: error, code: 600}, function () {
					var env = req.soajs.inputmaskData.env.toLowerCase();
					lib.listEnvironments(req, BL.model, env, function (error, envRecords) {
						utils.checkErrorReturn(req.soajs, cbMain, {
							config: config,
							error: error || envRecords.length === 0,
							code: 600
						}, function () {
							lib.getNeededEnvs(env, envRecords, function (err, dashboard, selectedEnv) {
								utils.checkErrorReturn(req.soajs, cbMain, {
									config: config,
									error: err,
									code: 600
								}, function () {
									var opts = {
										settings: settings,
										envRecord: selectedEnv,
										soajs: req.soajs,
										config: config,
										model: BL.model,
										catalogDeployment: catalogDeployment,
										esClient: null,
										esCluster: null,
										dashboard: dashboard
									};
									if (req.soajs.inputmaskData.elasticsearch === 'local'){
										analytics.activateAnalytics(opts, "dashboard", function (err, data) {
											return cbMain(null, data);
										});
									}
									else {
										lib.setEsCluster(req, config, dashboard, selectedEnv, settings, BL.model, function (err, esCluster, local) {
											utils.checkErrorReturn(req.soajs, cbMain, {
												config: config,
												error: err,
												code: 600 //check this
											}, function () {
												if (!esCluster) {
													return cbMain({"code": 961, "msg": config.errors[961]});
												}
												if (local) {
													return cbMain({"code": 960, "msg": config.errors[960]});
												}
												opts.esClient = new soajs.es(esCluster);
												opts.esCluster= esCluster;

												// tracker.myAnalytics = new analytics(opts);
												// tracker.myAnalytics.run();
												analytics.activateAnalytics(opts, "dashboard", function (err, data) {
													return cbMain(null, data);
												});
											});
										});
									}
								});
							});
						});
					});
				});
			});
		});
	},

	/*"deactivateAnalytics": function (config, req, res, cbMain) {
	 /!**
	 * deactivateAnalytics
	 *
	 * @param {Object} config
	 * @param {Object} req
	 * @param {Object} res
	 * @returns {Object}
	 *!/
	 var env = req.soajs.inputmaskData.env.toLowerCase();
	 var combo = {};
	 combo.collection = colls.analytics;
	 combo.conditions = {
	 "_type": "settings"
	 };
	 //get analytics mongo record (settings)
	 BL.model.findEntry(req.soajs, combo, function (error, settings) {
	 utils.checkErrorReturn(req.soajs, cbMain, {config: config, error: error, code: 600}, function () {
	 utils.getEnvironment(req.soajs, BL.model, env, function (error, envRecord) {
	 utils.checkErrorReturn(req.soajs, cbMain, {
	 config: config,
	 error: error || !envRecord,
	 code: 402
	 }, function () {
	 //list services
	 var options = utils.buildDeployerOptions(envRecord, req.soajs, BL);
	 deployer.listServices(options, function (error, services) {
	 utils.checkErrorReturn(req.soajs, cbMain, {config: config, error: error}, function () {
	 if (!services) services = [];
	 //loop over services
	 //delete kibana, logstash, filebeat, and metric beat
	 var activated = lib.getActivatedEnv(settings, env);
	 async.eachSeries(services, function (oneService, callback) {
	 //add check if another environment have analytics activated
	 //if activated do not remove kibana or metricbeat
	 if (oneService.labels["soajs.service.type"] === "elk"
	 && oneService.labels["soajs.service.name"] !== "soajs-analytics-elasticsearch") {
	 if (activated && ((oneService.labels["soajs.service.name"] === "soajs-metricbeat") ||
	 oneService.labels["soajs.service.name"] === "kibana")) {
	 return callback(null, true);
	 }
	 else if (oneService.labels["soajs.env.code"] === env || oneService.labels["soajs.service.name"] === "kibana" || oneService.labels["soajs.service.name"] === "soajs-metricbeat") {
	 options.params = {
	 id: oneService.id,
	 mode: oneService.labels["soajs.service.mode"] //NOTE: required for kubernetes driver only
	 };
	 if (!(process.env.SOAJS_TEST_ANALYTICS === 'test')) {
	 deployer.deleteService(options, callback);
	 }
	 else {
	 return callback(null, true);
	 }
	 }
	 else {
	 return callback(null, true);
	 }
	 }
	 else {
	 return callback(null, true);
	 }
	 }, function (error) {
	 utils.checkErrorReturn(req.soajs, cbMain, {
	 config: config,
	 error: error
	 },
	 function () {
	 //update mongo record
	 if (!settings) {
	 tracker = {};
	 return cbMain(null, true);
	 }

	 if (settings.env && settings.env[env]) {
	 settings.env[env] = false;
	 }

	 if (settings.logstash && settings.logstash[env]) {
	 delete settings.logstash[env];
	 }

	 if (settings.filebeat && settings.filebeat[env]) {
	 delete settings.filebeat[env];
	 }

	 if (settings.metricbeat && !activated) {
	 delete settings.metricbeat;
	 }
	 if (settings.kibana && !activated) {
	 delete settings.kibana;
	 }

	 //save
	 var comboS = {};
	 comboS.collection = colls.analytics;
	 comboS.record = settings;
	 BL.model.saveEntry(req.soajs, comboS, function (error) {
	 utils.checkErrorReturn(req.soajs, cbMain, {
	 config: config,
	 error: error,
	 code: 600
	 }, function () {
	 //reset tracker
	 tracker = {};
	 return cbMain(null, true);
	 });
	 });
	 });
	 });
	 });
	 });
	 });
	 });
	 });
	 });
	 }*/

	/**
	 * Delete analytics components and deactivate analytics in service
	 * @param {Object} config: soajs config object
	 * @param {Object} req: soajs req object
	 * @param {Object} res: soajs res object
	 * @param {Object} cbMain: callback function
	 */
	"deactivateAnalytics": function (config, req, res, cbMain) {
		var env = req.soajs.inputmaskData.env.toLowerCase();
		var combo = {};
		combo.collection = colls.analytics;
		combo.conditions = {
			"_type": "settings"
		};
		/**
		 * get environment record and forward the call to soajs.analytics repository
		 */
		utils.getEnvironment(req.soajs, BL.model, env, function (error, envRecord) {
			utils.checkErrorReturn(req.soajs, cbMain, {
				config: config,
				error: error || !envRecord,
				code: 402
			}, function () {
				var opts = {
					envRecord: envRecord,
					soajs: req.soajs,
					model: BL.model
				};
				analytics.deactivateAnalytics(opts, function (err) {
					utils.checkErrorReturn(req.soajs, cbMain, {
						config: config,
						error: err,
						code: 600
					}, function () {
						return cbMain(null, true);
					});
				});
			});
		});
	},

	/**
	 * Deploy elasticserach locally and update analytics settings and dashboard environment
	 * @param {Object} config: soajs config object
	 * @param {Object} req: soajs req object
	 * @param {Object} res: soajs res object
	 * @param {Object} cbMain: callback function
	 */
	"deployLocalElastic": function (config, req, res, cbMain) {
		var combo = {};
		combo.collection = colls.analytics;
		combo.conditions = {
			"_type": "settings"
		};

		/**
		 * get analytics settings
		 * get current environment record and dashboard environment record
		 * get elasticsearch cluster and create an elasticsearch connection
		 * forward the call to soajs.analytics repository
		 */
		BL.model.findEntry(req.soajs, combo, function (error, settings) {
			utils.checkErrorReturn(req.soajs, cbMain, {config: config, error: error, code: 600}, function () {
				var env = req.soajs.inputmaskData.env.toLowerCase();
				lib.listEnvironments(req, BL.model, env, function (error, envRecords) {
					utils.checkErrorReturn(req.soajs, cbMain, {
						config: config,
						error: error || envRecords.length === 0,
						code: 600
					}, function () {
						lib.getNeededEnvs(env, envRecords, function (err, dashboard, selectedEnv) {
							utils.checkErrorReturn(req.soajs, cbMain, {
								config: config,
								error: err,
								code: 600
							}, function () {
								var opts = {
									config: config,
									settings: settings,
									envRecord: selectedEnv,
									soajs: req.soajs,
									model: BL.model,
									dashboard: dashboard
								};
								analytics.deployElastic(opts, "dashboard", function (err, data) {
									return cbMain(null, data);
								});
							});
						});
					});
				});
			});
		});
	}
};

module.exports = {
	"init": function (modelName, cb) {
		var modelPath;

		if (!modelName) {
			return cb(new Error("No Model Requested!"));
		}

		modelPath = __dirname + "/../../models/" + modelName + ".js";
		return requireModel(modelPath, cb);

		/**
		 * checks if model file exists, requires it and returns it.
		 * @param filePath
		 * @param cb
		 */
		function requireModel(filePath, cb) {
			//check if file exist. if not return error
			fs.exists(filePath, function (exists) {
				if (!exists) {
					return cb(new Error("Requested Model Not Found!"));
				}

				BL.model = require(filePath);
				return cb(null, BL);
			});
		}
	}
};
