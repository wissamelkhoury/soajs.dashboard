'use strict';

var fs = require("fs");
var uuid = require('uuid');
var colls = {
	analytics: 'analytics',
	environment: 'environment'
};

var lib = {
	/**
	 * get elasticsearch cluster
	 * @param {Object} config: soajs config object
	 * @param {Object} req: soajs req object
	 * @param {Object} dashboard: dashboard environment record
	 * @param {Object} selectedEnv: current environment record
	 * @param {Object} settings: settings environment record
	 * @param {Object} model: mongo record
	 * @param {Object} cb: callback function
	 */
	"setEsCluster": function (req, config, dashboard, selectedEnv, settings, model, cb) {
		var es_analytics_db, es_analytics_cluster_name, es_analytics_cluster;
		
		function getCluster(call) {
			/**
			 * check ifs settings have elasticsearch db name
			 * get elasticsearch cluster from dashboard environment using db name
			 */
			if (settings && settings.elasticsearch && settings.elasticsearch.db_name && settings.elasticsearch.db_name !== '') {
				es_analytics_db = settings.elasticsearch.db_name;
				//get cluster from environment using db name
				if (dashboard.dbs && dashboard.dbs.databases && dashboard.dbs.databases[es_analytics_db] && dashboard.dbs.databases[es_analytics_db].cluster) {
					es_analytics_cluster_name = dashboard.dbs.databases[es_analytics_db].cluster;
					es_analytics_cluster = dashboard.dbs.clusters[es_analytics_cluster_name];
					return call();
				}
				else {
					//elasticsearch cluster not compatible
					//return error
					return call(new Error("Elasticsearch cluster not compatible with analytics settings"));
				}
			}
			else {
				/**
				 * if no db name was found in settings search dashboard environment for any db with usedForAnalytics set to true
				 */
				var local = true;
				Object.keys(dashboard.dbs.databases).forEach(function (oneDb) {
					if (dashboard.dbs.databases[oneDb].usedForAnalytics) {
						es_analytics_db = oneDb;
						local = false;
					}
				});
				if (local) {
					return call(null, true);
				}
				else {
					es_analytics_cluster_name = dashboard.dbs.databases.cluster;
					es_analytics_cluster = dashboard.dbs.clusters[es_analytics_db.cluster];
					return call();
				}
				// if (selectedEnv.deployer.selected.split('.')[1] === "kubernetes") {
				// 	//added support for namespace and perService
				// 	var namespace = selectedEnv.deployer.container["kubernetes"][selectedEnv.deployer.selected.split('.')[2]].namespace.default;
				// 	if (selectedEnv.deployer.container["kubernetes"][selectedEnv.deployer.selected.split('.')[2]].namespace.perService) {
				// 		namespace += '-soajs-analytics-elasticsearch-service';
				// 	}
				// 	es_analytics_cluster.servers[0].host += '.-service' + namespace;
				// }
				
			}
		}
		
		/**
		 * update settings object
		 * if settings object is not found insert record else update it
		 */
		getCluster(function (err, local) {
			if (!es_analytics_db) {
				return cb(null, null);
			}
			var comboS = {};
			comboS.collection = colls.analytics;
			if (!settings) {
				settings = {};
				settings._type = "settings";
				settings.env = {};
				settings.env[selectedEnv.code.toLowerCase()] = false;
				settings.elasticsearch = {
					"db_name": es_analytics_db
				};
				comboS.record = settings;
				update("insertEntry", cb);
			}
			if (settings.elasticsearch) {
				settings.elasticsearch.db_name = es_analytics_db;
				comboS.record = settings;
				update("saveEntry", cb);
			}
			
			function update(mode, call) {
				BL.model[mode](req.soajs, comboS, function (err) {
					if (err) {
						return call(err);
					}
					else {
						return call(null, es_analytics_cluster, local || null);
					}
				});
			}
			
		});
	},
	
	/**
	 * get current and dashboard environment
	 * @param {Object} req: soajs req object
	 * @param {Object} model: mongo record
	 * @param {string} env: environment code
	 * @param {Object} cb: callback function
	 */
	"listEnvironments": function (req, model, env, cb) {
		var opts = {};
		opts.collection = colls.environment;
		if (env !== 'dashboard') {
			opts.condition = {
				code: {
					"$in": [env, 'dashboard']
				}
			};
		}
		else {
			opts.condition = {
				code: env
			};
		}
		BL.model.findEntries(req.soajs, opts, cb);
	},
	
	/**
	 * Organize records
	 * @param {string} env: environment code
	 * @param {Object} envRecords: current environment record
	 * @param {Object} cb: callback function
	 */
	"getNeededEnvs": function (env, envRecords, cb) {
		var dashboard = null;
		var selectedEnv = null;
		envRecords.forEach(function (oneRecord) {
			//get dashboard environment
			if (oneRecord.code.toLowerCase() === 'dashboard') {
				dashboard = oneRecord;
			}
			//get selected environment
			if (oneRecord.code.toLowerCase() === env.toLowerCase()) {
				selectedEnv = oneRecord;
			}
		});
		//check if the environment exist
		if (!dashboard || !selectedEnv) {
			return cb(true);
		}
		//check if selected env is dashboard
		return cb(null, dashboard, selectedEnv);
	},
	
	/**
	 * check if analytics is activated in any other environment
	 * @param {Object} currentEnv: current environment record
	 * @param {Object} settings: settings environment record
	 */
	"getActivatedEnv": function (settings, currentEnv) {
		var activated = false;
		if (settings && settings.env) {
			var environments = Object.keys(settings.env);
			environments.forEach(function (oneEnv) {
				if (oneEnv !== currentEnv) {
					if (settings.env[oneEnv]) {
						activated = true;
					}
				}
			});
		}
		return activated;
	}
};

module.exports = lib;