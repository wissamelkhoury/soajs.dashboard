'use strict';
var fs = require("fs");
var request = require("request");
var colName = "hosts";
var deployer = require("../utils/deployer.js");

function pad(d) {
    return (d < 10) ? '0' + d.toString() : d.toString();
}

function deployNginx(config, mongo, req, res) {
    //from envCode, load env, get port and domain
    mongo.findOne("environment", {code: req.soajs.inputmaskData.envCode.toUpperCase()}, function (err, envRecord) {
        if (err || !envRecord) {
            return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
        }

        req.soajs.log.debug("checking for old nginx container for environment: " + envRecord.code);
        var condition = {
            "env": req.soajs.inputmaskData.envCode.toLowerCase(),
            "hostname": "nginx_" + req.soajs.inputmaskData.envCode.toLowerCase()
        };
        mongo.findOne("docker", condition, function (error, oldNginx) {
            if (err) {
                req.soajs.log.error(err);
                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
            }

            if (oldNginx) {
                removeOldNginx(oldNginx, envRecord);
            }
            else {
                req.soajs.log.debug("NO old Nginx container found, building new nginx...");
                rebuildNginx(envRecord);
            }
        });
    });

    function removeOldNginx(oldNginx, envRecord) {
        var condition = {
            "env": req.soajs.inputmaskData.envCode.toLowerCase(),
            "hostname": "nginx_" + req.soajs.inputmaskData.envCode.toLowerCase()
        };
        req.soajs.log.debug("Old Nginx container found, removing nginx ...");
        mongo.remove("docker", condition, function (err) {
            if (err) {
                req.soajs.log.error(err);
                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
            }

            deployer.remove(oldNginx.deployer, oldNginx.cid, function (error) {
                if (error) {
                    req.soajs.log.error(error);
                    return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                }

                req.soajs.log.debug("Old Nginx container removed, building new nginx...");
                rebuildNginx(envRecord);
            });
        });
    }

    function getRunningControllers(cb) {
        var condition = {
            "env": req.soajs.inputmaskData.envCode.toLowerCase(),
            "running": true,
            "type": "controller"
        };
        mongo.find("docker", condition, function (error, controllers) {
            if (error) {
                req.soajs.log.error(error);
                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
            }

            //no controllers found, no need to proceed
            else if (!controllers || (controllers && controllers.length === 0)) {
                req.soajs.log.debug("No controllers found for environment: " + req.soajs.inputmaskData.envCode + ". No need to proceed.");
                return res.json(req.soajs.buildResponse(null, true));
            }
            else {
                return cb(controllers);
            }
        });
    }

    function rebuildNginx(envRecord) {
        var links = [];
        getRunningControllers(function (controllers) {
            for (var i = 0; i < controllers.length; i++) {
                links.push(controllers[i].hostname + ":controllerProxy0" + (i + 1));
            }

            var dockerParams = {
                "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                "name": "nginxapi",
                "image": config.images.nginx,
                "port": envRecord.port,
                "variables": [
                    "SOAJS_NX_NBCONTROLLER=" + links.length,
                    "SOAJS_NX_APIPORT=" + envRecord.port,
                    "SOAJS_NX_APIDOMAIN=api." + envRecord.domain //mydomain.com
                ],
                "Binds": [
                    config.workDir + "soajs/FILES:/opt/soajs/FILES",
                    "/var/run/docker.sock:/var/run/docker.sock"
                ],
                "links": links,
                "Cmd": [
                    'bash',
                    '-c',
                    'cd /opt/soajs/FILES/scripts/; ./runNginx.sh'
                ]
            };

            var deployerConfig = envRecord.deployer[envRecord.deployer.type];
            var driver = deployerConfig.selected.split(".");
            deployerConfig = deployerConfig[driver[0]][driver[1]];
            deployerConfig.driver = {
                'type': envRecord.deployer.type,
                'driver': driver[0]
            };
            req.soajs.log.debug("Calling create nginx container with params:", JSON.stringify(deployerConfig), JSON.stringify(dockerParams));
            deployer.createContainer(deployerConfig, dockerParams, function (error, data) {
                if (error) {
                    req.soajs.log.error(error);
                    return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                }

                req.soajs.log.debug("Nginx Container Created, starting container with params:", JSON.stringify(deployerConfig), JSON.stringify(data));
                deployer.start(deployerConfig, data.Id, function (error) {
                    if (error) {
                        req.soajs.log.error(error);
                        return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                    }

                    req.soajs.log.debug("Nginx Container started. Saving nginx container information in docker collection.");
                    var document = {
                        "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                        "cid": data.Id,
                        "hostname": "nginx_" + req.soajs.inputmaskData.envCode.toLowerCase(),
                        "deployer": deployerConfig
                    };
                    mongo.insert("docker", document, function (error) {
                        if (error) {
                            req.soajs.log.error(error);
                            return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                        }
                        return res.json(req.soajs.buildResponse(null, true));
                    });
                });
            });

        });
    }
}

//todo: remove zombie containers
//todo: when deploying env for first time, loop and turn off all old containers

module.exports = {

    "deployController": function (config, mongo, req, res) {
        if (req.soajs.inputmaskData.envCode.toLowerCase() === 'dashboard') {
            return res.jsonp(req.soajs.buildResponse({"code": 750, "msg": config.errors[750]}));
        }
        //from profile name, construct profile path and equivalently soajsData01....
        mongo.findOne("environment", {code: req.soajs.inputmaskData.envCode.toUpperCase()}, function (err, envRecord) {
            if (err || !envRecord) {
                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
            }

            if (envRecord.deployer.type === 'manual') {
                return res.jsonp(req.soajs.buildResponse({"code": 618, "msg": config.errors[618]}));
            }

            //fetch how many servers are in the profile
            var list = [];
            var regFile = envRecord.profile;
            var profile = require(regFile);

            //todo: this is hardcoded for now, needs to become dynamic
            for (var i = 0; i < profile.servers.length; i++) {
                list.push("soajsData:dataProxy" + pad(i + 1));
            }

            var dockerParams = {
                "image": config.images.services,
                "name": "controller",
                "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                "profile": regFile,
                "links": list,
                "variables": [
                    "SOAJS_SRV_AUTOREGISTERHOST=false",
                    "NODE_ENV=production"
                ],
                "Binds": [
                    config.workDir + "soajs/open_source/services/controller:/opt/soajs/node_modules/controller",
                    config.workDir + "soajs/FILES:/opt/soajs/FILES",
                    "/var/run/docker.sock:/var/run/docker.sock"
                ],
                "Cmd": [
                    'bash',
                    '-c',
                    'cd /opt/soajs/node_modules/controller/; npm install; node .'
                ]
            };

            if (req.soajs.inputmaskData.variables && req.soajs.inputmaskData.variables.length > 0) {
                dockerParams.variables = dockerParams.variables.concat(req.soajs.inputmaskData.variables);
            }
            deployControllers(0, req.soajs.inputmaskData.number, envRecord, dockerParams, function () {
                deployNginx(config, mongo, req, res);
            });
        });

        function deployControllers(counter, max, envRecord, dockerParams, cb) {
            var deployerConfig = envRecord.deployer[envRecord.deployer.type];
            var driver = deployerConfig.selected.split(".");
            deployerConfig = deployerConfig[driver[0]][driver[1]];
            deployerConfig.driver = {
                'type': envRecord.deployer.type,
                'driver': driver[0]
            };
            req.soajs.log.debug("Calling create controller container:", JSON.stringify(deployerConfig), JSON.stringify(dockerParams));
            deployer.createContainer(deployerConfig, dockerParams, function (error, data) {
                if (error) {
                    req.soajs.log.error(error);
                    return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                }

                req.soajs.log.debug("Controller Container Created, starting container:", JSON.stringify(deployerConfig), JSON.stringify(data));
                deployer.start(deployerConfig, data.Id, function (error, data) {
                    if (error) {
                        req.soajs.log.error(error);
                        return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                    }

                    req.soajs.log.debug("Controller Container started, saving information in core_provision");
                    registerNewHost(data, deployerConfig, function () {
                        counter++;
                        if (counter === max) {
                            return cb();
                        }
                        else {
                            deployControllers(counter, max, envRecord, dockerParams, cb);
                        }
                    });
                });
            });
        }

        function registerNewHost(data, deployerConfig, cb) {
            //get the ip of the host from hosts
            //insert into docker collection
            var document = {
                "cid": data.Id,
                "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                "hostname": data.Name || data.name, //data.Config.Hostname,
                "running": true,
                "type": "controller",
                "deployer": deployerConfig
            };
            mongo.insert("docker", document, function (error) {
                if (error) {
                    req.soajs.log.error(error);
                    return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                }

                var newHost = {
                    "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                    "name": "controller",
                    "ip": data.NetworkSettings.IPAddress,
                    "hostname": data.Name || data.name //data.Config.Hostname
                };
                mongo.insert(colName, newHost, function (error) {
                    if (error) {
                        req.soajs.log.error(error);
                        return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                    }
                    return cb();
                });
            });
        }
    },

    "deployService": function (config, mongo, req, res) {
        var serviceName, serviceOrig;
        //from profile name, construct profile path and equivalently soajsData01....
        //if gc info, check if gc exists before proceeding
        mongo.findOne("environment", {code: req.soajs.inputmaskData.envCode.toUpperCase()}, function (err, envRecord) {
            if (err || !envRecord) {
                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
            }

            if (envRecord.deployer.type === 'manual') {
                return res.jsonp(req.soajs.buildResponse({"code": 618, "msg": config.errors[618]}));
            }

            //build the regFile path
            var regFile = envRecord.profile;

            //fetch how many servers are in the profile
            var links = [];
            var profile = require(regFile);

            //todo: this is hardcoded for now, need to become dynamic
            for (var i = 0; i < profile.servers.length; i++) {
                links.push("soajsData:dataproxy" + pad(i + 1));
            }

            serviceOrig = serviceName = req.soajs.inputmaskData.name;
            if (req.soajs.inputmaskData.gcName) {
                serviceName = req.soajs.inputmaskData.gcName;
                serviceOrig = 'gcs';
            }
            var folderPath = config.workDir + "soajs/open_source/services/" + serviceOrig;

            mongo.findOne("services", {"name": serviceName}, function (err, serviceRecord) {
                if (err || !serviceRecord) {
                    return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                }

                if(serviceRecord.custom){ folderPath = serviceRecord.custom; }

                var dockerParams = {
                    "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                    "name": serviceName,
                    "profile": regFile,
                    "links": links,
                    "image": config.images.services,
                    "variables": [],
                    "Binds": [
                        folderPath + ":/opt/soajs/node_modules/" + serviceName,
                        config.workDir + "soajs/FILES:/opt/soajs/FILES",
                        "/var/run/docker.sock:/var/run/docker.sock"
                    ],
                    "Cmd": [
                        'bash',
                        '-c',
                        'cd /opt/soajs/node_modules/' + serviceName + '/; npm install; node .'
                    ]
                };

                if (req.soajs.inputmaskData.gcName) {
                    dockerParams.variables = [
                        "SOAJS_GC_NAME=" + req.soajs.inputmaskData.gcName,
                        "SOAJS_GC_VERSION=" + req.soajs.inputmaskData.gcVersion,
                        "SOAJS_ENV_WORKDIR=" + config.workDir
                    ];
                }

                dockerParams.variables.push("SOAJS_SRV_AUTOREGISTERHOST=false");
                dockerParams.variables.push("NODE_ENV=production");

                if (req.soajs.inputmaskData.variables && req.soajs.inputmaskData.variables.length > 0) {
                    dockerParams.variables = dockerParams.variables.concat(req.soajs.inputmaskData.variables);
                }

                var deployerConfig = envRecord.deployer[envRecord.deployer.type];
                var driver = deployerConfig.selected.split(".");
                deployerConfig = deployerConfig[driver[0]][driver[1]];
                deployerConfig.driver = {
                    'type': envRecord.deployer.type,
                    'driver': driver[0]
                };
                req.soajs.log.debug("Calling create service container with params:", JSON.stringify(deployerConfig), JSON.stringify(dockerParams));
                deployer.createContainer(deployerConfig, dockerParams, function (error, data) {
                    if (error) {
                        req.soajs.log.error(error);
                        return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                    }

                    req.soajs.log.debug("Service Container Created, starting container with params:", JSON.stringify(deployerConfig), JSON.stringify(data));
                    deployer.start(deployerConfig, data.Id, function (error, data) {
                        if (error) {
                            req.soajs.log.error(error);
                            return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                        }
                        req.soajs.log.debug("Service Container started, saving information in core_provision");
                        //get the ip of the host from hosts
                        registerHost(data, deployerConfig);
                    });
                });
            });
        });

        function registerHost(data, deployerConfig) {
            var document = {
                "cid": data.Id,
                "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                "hostname": data.Name || data.name, //Config.Hostname,
                "type": "service",
                "running": true,
                "deployer": deployerConfig
            };
            mongo.insert("docker", document, function (error) {
                if (error) {
                    req.soajs.log.error(error);
                    return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                }

                var newHost = {
                    "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                    "name": serviceName,
                    "ip": data.NetworkSettings.IPAddress,
                    "hostname": data.Name || data.name //data.Config.Hostname
                };
                mongo.insert(colName, newHost, function (error) {
                    if (error) {
                        req.soajs.log.error(error);
                        return res.json(req.soajs.buildResponse({"code": 615, "msg": config.errors[615]}));
                    }

                    mongo.find(colName, {
                        "env": req.soajs.inputmaskData.envCode.toLowerCase(),
                        "name": "controller"
                    }, function (error, controllers) {
                        if (error) {
                            req.soajs.log.error(error);
                            return res.json(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                        }
                        //return res.json(req.soajs.buildResponse(null, {"ip": hostRecord.ip, 'hostname': data.Config.Hostname, "controllers": controllers}));
                        return res.json(req.soajs.buildResponse(null, {
                            'cid': data.Id,
                            'hostname': data.Name || data.name, //data.Config.Hostname,
                            "ip": data.NetworkSettings.IPAddress,
                            "controllers": controllers
                        }));
                    });
                });
            });
        }
    },

    "list": function (config, mongo, req, res) {
	    mongo.findOne("environment", {code: req.soajs.inputmaskData.env.toUpperCase()}, function (err, envRecord) {
		    if (err || !envRecord) {
			    return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
		    }

	        mongo.find(colName, {env: req.soajs.inputmaskData.env.toLowerCase()}, function (err, hosts) {
	            if (err) {
	                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
	            }

	            mongo.find('docker', {env: req.soajs.inputmaskData.env.toLowerCase()}, function (err, containers) {
	                if (err) {
	                    return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
	                }

	                hosts.forEach(function (oneHost) {
	                    containers.forEach(function (oneContainer) {
	                        if (oneHost.hostname === oneContainer.hostname) {
	                            oneHost.cid = oneContainer.cid;
	                        }
	                    });
	                });
	                return res.jsonp(req.soajs.buildResponse(null, {'hosts': hosts, 'deployer': envRecord.deployer, 'profile': envRecord.profile}));
	            });
	        });
        });
    },

    "delete": function (config, mongo, req, res) {
        var dockerColCriteria = {
            'env': req.soajs.inputmaskData.env.toLowerCase(),
            'hostname': req.soajs.inputmaskData.hostname
        };

        var rebuildNginx = false;
        mongo.findOne("environment", {code: req.soajs.inputmaskData.env.toUpperCase()}, function (err, envRecord) {
            if (err || !envRecord) {
                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
            }

            if (envRecord.deployer.type === 'manual') {
                removeFromHosts();
            }
            else {
                removeDockerRecord();
            }
        });

        function removeDockerRecord() {
            mongo.findOne('docker', dockerColCriteria, function (error, response) {
                if (error || !response) {
                    return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                }

                if (response.type === 'controller') {
                    rebuildNginx = true;
                }

                var deployerConfig = response.deployer;
                deployer.remove(deployerConfig, response.cid, function (error) {
                    if (error) {
                        return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                    }

                    else {
                        mongo.remove('docker', {'_id': response._id}, function (err) {
                            if (err) {
                                return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                            }

                            removeFromHosts();
                        });
                    }
                });
            });
        }

        function removeFromHosts() {
            var hostCriteria = {
                'env': req.soajs.inputmaskData.env.toLowerCase(),
                'name': req.soajs.inputmaskData.name,
                'ip': req.soajs.inputmaskData.ip
            };
            mongo.remove(colName, hostCriteria, function (err) {
                if (err) {
                    return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                }

                if (rebuildNginx) {
                    req.soajs.log.debug("Deleted controller container, rebuilding Nginx ....");
                    req.soajs.inputmaskData.envCode = req.soajs.inputmaskData.env.toUpperCase();
                    deployNginx(config, mongo, req, res);
                }
                else {
                    return res.jsonp(req.soajs.buildResponse(null, true));
                }
            });
        }
    },

    "maintenanceOperation": function (config, mongo, req, res) {
        req.soajs.inputmaskData.env = req.soajs.inputmaskData.env.toLowerCase();

        if (req.soajs.inputmaskData.operation === 'awarenessStat' && req.soajs.inputmaskData.serviceName !== 'controller') {
            return res.jsonp(req.soajs.buildResponse({"code": 602, "msg": config.errors[602]}));
        }

        if (req.soajs.inputmaskData.operation === 'loadProvision' && req.soajs.inputmaskData.serviceName === 'controller') {
            return res.jsonp(req.soajs.buildResponse({"code": 602, "msg": config.errors[602]}));
        }

        //check that the given service has the given port in services collection
        if (req.soajs.inputmaskData.serviceName === 'controller') {
            checkServiceHost();
        }
        else {
            mongo.findOne('services', {
                'name': req.soajs.inputmaskData.serviceName,
                'port': req.soajs.inputmaskData.servicePort
            }, function (error, record) {
                if (error) {
                    return res.jsonp(req.soajs.buildResponse({"code": 603, "msg": config.errors[603]}));
                }
                if (!record) {
                    return res.jsonp(req.soajs.buildResponse({"code": 604, "msg": config.errors[604]}));
                }

                //check that the given service has the given host in hosts collection
                checkServiceHost();
            });
        }

        function checkServiceHost() {
            var condition = {
                'env': req.soajs.inputmaskData.env.toLowerCase(),
                "name": req.soajs.inputmaskData.serviceName
            };
            if (req.soajs.inputmaskData.ip) {
                condition.ip = req.soajs.inputmaskData.serviceHost;
            }
            else {
                condition.hostname = req.soajs.inputmaskData.hostname;
            }
            mongo.findOne(colName, condition, function (error, record) {
                if (error) {
                    return res.jsonp(req.soajs.buildResponse({"code": 603, "msg": config.errors[603]}));
                }
                if (!record) {
                    return res.jsonp(req.soajs.buildResponse({"code": 605, "msg": config.errors[605]}));
                }

                //perform maintenance operation
                doMaintenance(record);
            });
        }

        function doMaintenance(oneHost) {
            var criteria = {
                'env': req.soajs.inputmaskData.env.toLowerCase(),
                "hostname": req.soajs.inputmaskData.hostname
            };

            mongo.findOne('environment', {'code': req.soajs.inputmaskData.env.toUpperCase()}, function (err, envRecord) {
                if (err || !envRecord) {
                    return res.jsonp(req.soajs.buildResponse({"code": 600, "msg": config.errors[600]}));
                }

                if (req.soajs.inputmaskData.operation === 'hostLogs' && envRecord.deployer.type === 'manual') {
                    return res.jsonp(req.soajs.buildResponse({"code": 619, "msg": config.errors[619]}));
                }

                switch (req.soajs.inputmaskData.operation) {
                    case 'hostLogs':
                        mongo.findOne("docker", criteria, function (error, response) {
                            if (error) {
                                return res.jsonp(req.soajs.buildResponse({"code": 603, "msg": config.errors[603]}));
                            }
                            var deployerConfig = response.deployer;
                            deployer.info(deployerConfig, response.cid, req, res);
                        });
                        break;
                    default:
                        req.soajs.inputmaskData.servicePort = req.soajs.inputmaskData.servicePort + 1000;
                        var maintenanceURL = "http://" + oneHost.ip + ":" + req.soajs.inputmaskData.servicePort;
                        maintenanceURL += "/" + req.soajs.inputmaskData.operation;
                        request.get(maintenanceURL, function (error, response, body) {
                            if (error) {
                                return res.jsonp(req.soajs.buildResponse({"code": 603, "msg": config.errors[603]}));
                            }
                            else {
                                return res.jsonp(req.soajs.buildResponse(null, JSON.parse(body)));
                            }
                        });
                        break;
                }
            });
        }
    }
};