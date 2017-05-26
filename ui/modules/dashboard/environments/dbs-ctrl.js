"use strict";

var environmentsApp = soajsApp.components;

environmentsApp.controller('databaseCtrl', ['$scope','$cookies', 'envDB', function ($scope, $cookies, envDB) {
	$scope.$parent.isUserLoggedIn();

	$scope.access = {};
	constructModulePermissions($scope, $scope.access, environmentsConfig.permissions);

	$scope.listDatabases = function (env) {
		envDB.listDatabases($scope, env);
	};

	$scope.removeDatabase = function (env, name) {
		envDB.removeDatabase($scope, env, name);
	};

	$scope.addDatabase = function (env, dbs, session) {
		envDB.addDatabase($scope, env, dbs, session);
	};

	$scope.editDatabase = function (env, name, data, dbs) {
		envDB.editDatabase($scope, env, name, data, dbs);
	};

	$scope.updateDbPrefix = function (env, prefix) {
		envDB.updateDbPrefix($scope, env, prefix);
	};

	//default operation
	if ($scope.access.dbs.list) {
		$scope.envCode = $cookies.getObject("myEnv").code;
		$scope.listDatabases($scope.envCode);
	}
}]);