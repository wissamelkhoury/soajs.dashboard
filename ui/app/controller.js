'use strict';

/* App Module */
var soajsApp = angular.module('soajsApp', ['ui.bootstrap', 'ngRoute', 'ngCookies']);
soajsApp.config([
	'$routeProvider',
	'$controllerProvider',
	'$compileProvider',
	'$filterProvider',
	'$provide',
	'$sceDelegateProvider',
	function($routeProvider, $controllerProvider, $compileProvider, $filterProvider, $provide, $sceDelegateProvider) {

		soajsApp.compileProvider = $compileProvider;
		var whitelisted = ['self'];
		whitelisted = whitelisted.concat(whitelistedDomain);
		$sceDelegateProvider.resourceUrlWhitelist(whitelisted);


		navigation.forEach(function(navigationEntry) {
			if(navigationEntry.scripts && navigationEntry.scripts.length > 0) {
				$routeProvider.when(navigationEntry.url.replace('#', ''), {
					templateUrl: navigationEntry.tplPath,
					resolve: {
						load: ['$q', '$rootScope', function($q, $rootScope) {
							var deferred = $q.defer();
							require(navigationEntry.scripts, function() {
								$rootScope.$apply(function() {
									deferred.resolve();
								});
							});
							return deferred.promise;
						}]
					}
				});
			}
			else {
				$routeProvider.when(navigationEntry.url.replace('#', ''), {
					templateUrl: navigationEntry.tplPath
				});
			}
		});

		$routeProvider.otherwise({
			redirectTo: navigation[0].url.replace('#', '')
		});

		soajsApp.components = {
			controller: $controllerProvider.register,
			service: $provide.service
		};
	}
]);

soajsApp.controller('soajsAppController', ['$scope', '$location', '$timeout', '$route', '$cookies', '$cookieStore', 'ngDataApi',
	function($scope, $location, $timeout, $route, $cookies, $cookieStore, ngDataApi) {
		$scope.enableInterface = false;

		$scope.go = function(path) {
			$location.path(path);
		};

		$scope.alerts = [];
		$scope.themeToUse = themeToUse;

		$scope.displayFixedAlert = function(type, msg) {
			$scope.alerts = [];
			$scope.alerts.push({'type': type, 'msg': msg});
		};

		$scope.displayAlert = function(type, msg) {
			$scope.alerts = [];
			$scope.alerts.push({'type': type, 'msg': msg});
			$scope.closeAllAlerts();
		};

		$scope.pushAlert = function(type, msg) {
			$scope.alerts.push({'type': type, 'msg': msg});
			$scope.closeAllAlerts();
		};

		$scope.closeAlert = function(index) {
			$scope.alerts.splice(index, 1);
		};

		$scope.closeAllAlerts = function() {
			$timeout(function() { $scope.alerts = []; }, 7000);
		};

		$scope.mainMenu = {};
		$scope.mainMenu.links = [];

		$scope.footerMenu = {};
		$scope.footerMenu.links = [];

		$scope.userMenu = {};
		$scope.userMenu.links = [];

		$scope.guestMenu = {};
		$scope.guestMenu.links = [];

		$scope.updateSelectedMenus = function() {
			$scope.mainMenu.selectedMenu = '#/' + $location.path().split("/")[1];
			$scope.footerMenu.selectedMenu = $scope.mainMenu.selectedMenu;
			$scope.userMenu.selectedMenu = $scope.mainMenu.selectedMenu;
			$scope.guestMenu.selectedMenu = $scope.mainMenu.selectedMenu;
		};

		$scope.buildNavigation = function() {
			for(var i = 0; i < navigation.length; i++) {
				if(navigation[i].mainMenu) {
					$scope.mainMenu.links.push(navigation[i]);
				}

				if(navigation[i].footerMenu) {
					$scope.footerMenu.links.push(navigation[i]);
				}

				if(navigation[i].userMenu) {
					$scope.userMenu.links.push(navigation[i]);
				}

				if(navigation[i].guestMenu) {
					$scope.guestMenu.links.push(navigation[i]);
				}
			}
		};

		$scope.rebuildMenus = function() {
			$scope.mainMenu = {};
			$scope.mainMenu.links = [];

			$scope.userMenu = {};
			$scope.userMenu.links = [];

			$scope.guestMenu = {};
			$scope.guestMenu.links = [];

			for(var i = 0; i < navigation.length; i++) {
				if(navigation[i].hasOwnProperty('private') || $scope.dashboard.indexOf(navigation[i].id) !== -1) {
					if(navigation[i].mainMenu) {
						$scope.mainMenu.links.push(navigation[i]);
					}

					if(navigation[i].userMenu) {
						$scope.userMenu.links.push(navigation[i]);
					}

					if(navigation[i].guestMenu) {
						$scope.guestMenu.links.push(navigation[i]);
					}
				}
			}
			$scope.updateSelectedMenus();
		};

		$scope.buildNavigation();
		$scope.$on('$routeChangeSuccess', function() {
			$scope.tracker = [];
			$scope.updateSelectedMenus();

			for(var i = 0; i < navigation.length; i++) {
				if(navigation[i].url === '#' + $route.current.originalPath) {
					if(!navigation[i].hasOwnProperty('private') && !navigation[i].hasOwnProperty('guestMenu') && !navigation[i].hasOwnProperty('footerMenu')) {
						if($scope.dashboard && $scope.dashboard.indexOf(navigation[i].id) === -1) {
							$scope.displayAlert('danger', 'You do not have permissions to access this section');
							$scope.go("/dashboard");
						}
					}

					if(navigation[i].ancestor && Array.isArray(navigation[i].ancestor) && navigation[i].ancestor.length > 0) {
						for(var j = navigation[i].ancestor.length - 1; j >= 0; j--) {
							findAndcestorProperties($scope.tracker, navigation[i].ancestor[j], $route.current.params);
						}
						$scope.tracker.push({
							label: navigation[i].label,
							link: navigation[i].url,
							current: true
						});
					}
				}
			}
		});

		$scope.isUserLoggedIn = function() {
			if(!$cookies['soajs_auth'] || !$cookies['soajs_user']) {
				$cookieStore.remove('soajs_auth');
				$cookieStore.remove('soajs_user');
				$scope.enableInterface = false;

				$scope.displayFixedAlert('danger', "Session expired. Please login.");
				$scope.go("/login");
			}
			else {
				$scope.footerMenu.links.forEach(function(oneMenuEntry) {
					if(oneMenuEntry.id === 'home') {
						oneMenuEntry.url = '#/dashboard';
					}
				});
				if($scope.footerMenu.selectedMenu === '#/login') {
					$scope.footerMenu.selectedMenu = '#/dashboard';
				}

				$scope.dashboard = [];
				var user = $cookieStore.get('soajs_user');
				if(user.config && user.config.dashboard) {
					$scope.dashboard = $scope.dashboard.concat(user.config.dashboard.permissions);
				}
				//console.log( $scope.dashboard );
				$scope.enableInterface = true;
				$scope.userFirstName = user.firstName;
				$scope.userLastName = user.lastName;
				$scope.rebuildMenus();
			}
		};

		$scope.$on("loadUserInterface", function(event, args) {
			$scope.isUserLoggedIn();
		});
	}]);

soajsApp.controller('welcomeCtrl', ['$scope', 'ngDataApi', '$cookieStore', function($scope, ngDataApi, $cookieStore) {
	$scope.$parent.$on('refreshWelcome', function(event, args) {
		$scope.setUser();
	});

	$scope.setUser = function() {
		var user = $cookieStore.get('soajs_user');
		if(user) {
			$scope.userFirstName = user.firstName;
			$scope.userLastName = user.lastName;
		}
	};

	$scope.logoutUser = function() {
		var user = $cookieStore.get('soajs_user');

		function logout() {
			getSendDataFromServer(ngDataApi, {
				"method": "get",
				"routeName": "/urac/logout",
				"params": {"username": user.username}
			}, function(error, response) {
				if(error) {
					$scope.$parent.displayAlert('danger', error.message);
				}

				$cookieStore.remove('soajs_auth');
				$cookieStore.remove('soajs_user');
				$scope.$parent.enableInterface = false;
				$scope.$parent.go("/login");
			});
		}

		if(typeof(user) != 'undefined') {
			logout();
		} else {
			$cookieStore.remove('soajs_auth');
			$scope.$parent.isUserLoggedIn();
		}
	};
}]);

soajsApp.directive('header', function() {
	return {
		restrict: 'E',
		templateUrl: 'themes/' + themeToUse + '/directives/header.tmpl'
	};
});

soajsApp.directive('userMenu', function() {
	return {
		restrict: 'E',
		templateUrl: 'themes/' + themeToUse + '/directives/userMenu.tmpl'
	};
});

soajsApp.directive('mainMenu', function() {
	return {
		restrict: 'E',
		templateUrl: 'themes/' + themeToUse + '/directives/mainMenu.tmpl'
	};
});

soajsApp.directive('tracker', function() {
	return {
		restrict: 'E',
		templateUrl: 'themes/' + themeToUse + '/directives/tracker.tmpl'
	};
});

soajsApp.directive('content', function() {
	return {
		restrict: 'E',
		templateUrl: 'themes/' + themeToUse + '/directives/content.tmpl'
	};
});

soajsApp.directive('footer', function() {
	return {
		restrict: 'E',
		templateUrl: 'themes/' + themeToUse + '/directives/footer.tmpl'
	};
});

soajsApp.directive('ngConfirmClick', [
	function() {
		return {
			priority: -1,
			restrict: 'A',
			link: function(scope, element, attrs) {
				element.bind('click', function(e) {
					var message = attrs.ngConfirmClick;
					if(message && !confirm(message)) {
						e.stopImmediatePropagation();
						e.preventDefault();
					}
				});
			}
		}
	}
]);

function findAndcestorProperties(tracker, ancestorName, params) {
	for(var i = 0; i < navigation.length; i++) {
		if(navigation[i].label === ancestorName) {
			var link = navigation[i].url;
			for(var i in params) {
				link = link.replace(":" + i, params[i]);
			}
			tracker.unshift({
				label: ancestorName,
				link: link
			});

		}
	}
}

(function() {
	var link = document.createElement("link");
	link.type = "text/css";
	link.rel = "stylesheet";
	link.href = "themes/" + themeToUse + "/css/app.css";
	document.getElementsByTagName("head")[0].appendChild(link);
})();