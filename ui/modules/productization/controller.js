"use strict";
var productizationApp = soajsApp.components;
productizationApp.controller('productCtrl', ['$scope', '$timeout', '$modal', '$routeParams', '$compile', 'ngDataApi', function($scope, $timeout, $modal, $routeParams,$compile, ngDataApi) {
	$scope.$parent.isUserLoggedIn();
	
	$scope.viewPackage = function(pack) {
		pack.showDetails = true;
		pack.showClose = true;
	};
	$scope.closePackage = function(pack) {
		pack.showDetails = false;
		pack.showClose = false;
	};
	
	$scope.listProducts = function() {
		getSendDataFromServer(ngDataApi, {
			"method": "get",
			"routeName": "/dashboard/product/list"
		}, function(error, response) {
			if(error) {
				$scope.$parent.displayAlert('danger', error.message);
			}
			else {
				$scope.grid = {
					rows: response
				};

				$scope.grid.actions = {
					'edit': {
						'label': 'Edit',
						'command': function(row) {
							$scope.editProduct(row);
						}
					},
					'delete': {
						'label': 'Remove',
						'commandMsg': "Are you sure you want to remove this product ?",
						'command': function(row) {
							$scope.removeProduct(row);
						}
					}
				};
			}
		});
	};

	$scope.removeProduct = function(row) {
		getSendDataFromServer(ngDataApi, {
			"method": "get",
			"routeName": "/dashboard/product/delete",
			"params": {"id": row._id}
		}, function(error, response) {
			if(error) {
				$scope.$parent.displayAlert('danger', error.message);
			}
			else {
				$scope.$parent.displayAlert('success', "Product removed successfully.");
				$scope.listProducts();
			}
		});
	};

	$scope.addProduct = function() {
		var options = {
			timeout: $timeout,
			form: productizationConfig.form.product,
			type: 'product',
			name: 'addProduct',
			label: 'Add New Product',
			actions: [
				{
					'type': 'submit',
					'label': 'Add Product',
					'btn': 'primary',
					'action': function(formData) {
						var postData = {
							'code': formData.code,
							'name': formData.name,
							'description': formData.description
						};
						getSendDataFromServer(ngDataApi, {
							"method": "send",
							"routeName": "/dashboard/product/add",
							"data": postData
						}, function(error, response) {
							if(error) {
								$scope.form.displayAlert('danger', error.message);
							}
							else {
								$scope.$parent.displayAlert('success', 'Product Added Successfully.');
								$scope.modalInstance.close();
								$scope.form.formData = {};
								$scope.listProducts();
							}
						});
					}
				},
				{
					'type': 'reset',
					'label': 'Cancel',
					'btn': 'danger',
					'action': function() {
						$scope.modalInstance.dismiss('cancel');
						$scope.form.formData = {};
					}
				}]
		};

		buildFormWithModal($scope, $modal, options);
	};

	$scope.editProduct = function(row) {

		var formConfig = {};
		formConfig.form = angular.copy(productizationConfig.form.product);
		formConfig.form.entries[0].type = 'readonly';
		formConfig.name = 'editProduct';
		formConfig.label = 'Edit Product';
		formConfig.timeout = $timeout;

		var keys = Object.keys(row);
		for(var i = 0; i < formConfig.form.entries.length; i++) {
			keys.forEach(function(inputName) {
				if(formConfig.form.entries[i].name === inputName) {
					formConfig.form.entries[i].value = row[inputName];
				}
			});
		}

		formConfig.actions = [
			{
				'type': 'submit',
				'label': 'Edit Product',
				'btn': 'primary',
				'action': function(formData) {
					var postData = {
						'name': formData.name,
						'description': formData.description
					};
					getSendDataFromServer(ngDataApi, {
						"method": "send",
						"routeName": "/dashboard/product/update",
						"data": postData,
						"params": {"id": row['_id']}
					}, function(error, response) {
						if(error) {
							$scope.$parent.displayAlert('danger', error.message);
						}
						else {
							$scope.$parent.displayAlert('success', 'Product Updated Successfully.');
							$scope.modalInstance.close();
							$scope.form.formData = {};
							$scope.listProducts();
						}
					});
				}
			},
			{
				'type': 'reset',
				'label': 'Cancel',
				'btn': 'danger',
				'action': function() {
					$scope.modalInstance.dismiss('cancel');
					$scope.form.formData = {};
				}
			}];

		buildFormWithModal($scope, $modal, formConfig);
	};

	$scope.reloadPackages = function(productId) {
		getSendDataFromServer(ngDataApi, {
			"method": "get",
			"routeName": "/dashboard/product/packages/list",
			"params": {"id": productId}
		}, function(error, response) {
			if(error) {
				$scope.$parent.displayAlert('danger', error.message);
			}
			else {
				for(var i = 0; i < $scope.grid.rows.length; i++) {
					if($scope.grid.rows[i]['_id'] === productId) {
						$scope.grid.rows[i].packages = response;
					}
				}
			}
		});
	};

	$scope.addPackage = function(productId) {
		//$scope.aclFill.services= {};
		console.log($scope.aclFill);
		var formConf = angular.copy(productizationConfig.form.package);
		formConf.entries.forEach(function(oneEn) {
			if(oneEn.type==='select'){
				oneEn.value[0].selected=true;
			}
			if(oneEn.name==='acl'){
				//oneEn.value[0].selected=true;
				/* var cfgElement = angular.element(document.getElementById("idacl"));
				if(cfgElement){
					cfgElement.html('<div ng-repeat="service in allServiceApis"><input type="checkbox">{{service.name}}</div>');
					$compile(cfgElement.contents())($scope);
				}*/

			}
		});

		var options = {
			timeout: $timeout,
			form: formConf,
			name: 'addPackage',
			label: 'Add New Package',
			sub: true,
			actions: [
				{
					'type': 'submit',
					'label': 'Add Package',
					'btn': 'primary',
					'action': function(formData) {
						var postData = {
							'code': formData.code,
							'name': formData.name,
							'description': formData.description,
							'_TTL': Array.isArray(formData._TTL) ? formData._TTL.join("") : formData._TTL
						};
						
						if(formData.acl && (formData.acl != "")) {
							try {
								var aclObj = JSON.parse(formData.acl);
							}
							catch(e) {
								$scope.form.displayAlert('danger', 'Error: Invalid Json object ');
								return;
							}
						}
						else {
							var aclObj = {};
						}	
						postData.acl = aclObj;
						getSendDataFromServer(ngDataApi, {
							"method": "send",
							"routeName": "/dashboard/product/packages/add",
							"data": postData,
							"params": {"id": productId}
						}, function(error, response) {
							if(error) {
								$scope.form.displayAlert('danger', error.message);
							}
							else {
								$scope.$parent.displayAlert('success', 'Package Added Successfully.');
								$scope.modalInstance.close();
								$scope.form.formData = {};
								$scope.$parent.$emit('reloadProducts', {});
								$scope.reloadPackages(productId);
							}
						});
					}
				},
				{
					'type': 'reset',
					'label': 'Cancel',
					'btn': 'danger',
					'action': function() {
						$scope.modalInstance.dismiss('cancel');
						$scope.form.formData = {};
					}
				},
				{
					'type': 'reset',
					'label': 'FILL',
					'btn': 'danger',
					'action': function() {
						$scope.aclFill.services={};
						var cfgElement = angular.element(document.getElementById("idaclForm"));
						if(cfgElement){
							console.log(cfgElement);
							console.log($scope.aclFill);
							cfgElement.html('<ngaclform></ngaclform> ');
							$compile(cfgElement.contents())($scope);
						}

					}
				}
			]
		};
		buildFormWithModal($scope, $modal, options);
	};

	$scope.editPackage = function(productId, data) {
		var formConfig = angular.copy(productizationConfig.form.package);
		var recordData = angular.copy(data);
		$scope.aclFill.services= angular.copy(recordData.acl);
		for(var propt in $scope.aclFill.services){
			var s = $scope.aclFill.services[propt];
			s.include =true;
			if(s.apis){
				for(var ap in s.apis){
					s.apis[ap].include=true;
					if( s.apis[ap].access===true){
						s.apis[ap].accessType = 'private';
					}
				}
			}

		}
		recordData._TTL = recordData._TTL / 3600000;
		recordData.acl = (recordData.acl) ? JSON.stringify(recordData.acl, null, "\t") : "{\n}";
		formConfig.entries[0].type = 'readonly';

		var options = {
			timeout: $timeout,
			form: formConfig,
			name: 'editPackage',
			label: 'Edit Package',
			data: recordData,
			actions: [
				{
					'type': 'submit',
					'label': 'Edit Product',
					'btn': 'primary',
					'action': function(formData) {
						console.log(formData);
						var postData = {
							'name': formData.name,
							'description': formData.description,
							'_TTL': Array.isArray(formData._TTL) ? formData._TTL.join("") : formData._TTL
						};
						var aclObj2 = {};
						var aclObj = {};
						for(var propt in $scope.aclFill.services){

							var s = $scope.aclFill.services[propt];
							if(s.include===true){
								aclObj2[propt]={};
								if(s.accessType==='private'){
									aclObj2[propt].access=true;
								}else{
									//aclObj2[propt].access=false;
								}
								if(s.apis)
								{
									aclObj2[propt].apis={};
									for(var ap in s.apis){
										var api = s.apis[ap];
										if(api.include===true)
										{
											aclObj2[propt].apis[ap]={};
											if(api.access==='private'){
												aclObj2[propt].apis[ap].access=true;
											}else{
												//aclObj2[propt].apis[ap].access=false;
											}
										}
									}
								}
							}
						}

						console.log('aclObj 2');
						console.log(aclObj2);

						if(formData.acl && (formData.acl != "")) {
							try {
								var aclObj = JSON.parse(formData.acl);
							}
							catch(e) {
								$scope.form.displayAlert('danger', 'Error: Invalid Json object ');
								return;
							}
						}
						console.log('aclObj');
						console.log(aclObj);
						postData.acl = aclObj2;
						getSendDataFromServer(ngDataApi, {
							"method": "send",
							"routeName": "/dashboard/product/packages/update",
							"data": postData,
							"params": {"id": productId, "code": data.code.split("_")[1]}
						}, function(error, response) {
							if(error) {
								$scope.form.displayAlert('danger', error.message);
							}
							else {
								$scope.$parent.displayAlert('success', 'Package Updated Successfully.');
								$scope.modalInstance.close();
								$scope.form.formData = {};
								$scope.reloadPackages(productId);
							}
						});
					}
				},
				{
					'type': 'reset',
					'label': 'Cancel',
					'btn': 'danger',
					'action': function() {
						$scope.modalInstance.dismiss('cancel');
						$scope.form.formData = {};
					}
				},
				{
					'type': 'reset',
					'label': 'FILL',
					'btn': 'danger',
					'action': function() {
						var cfgElement = angular.element(document.getElementById("idaclForm"));
						if(cfgElement){
							console.log(cfgElement);
							cfgElement.html('<ngaclform></ngaclform> ');
							$compile(cfgElement.contents())($scope);
						}
						else{
							console.log('no elem');
						}
					}
				}
			]
		};

		buildFormWithModal($scope, $modal, options);
	};

	$scope.removeProductPackage = function(productId, packageCode) {
		packageCode = packageCode.split("_")[1];
		getSendDataFromServer(ngDataApi, {
			"method": "get",
			"routeName": "/dashboard/product/packages/delete",
			"params": {"id": productId, "code": packageCode}
		}, function(error, response) {
			if(error) {
				$scope.$parent.displayAlert('danger', error.message);
			}
			else {
				$scope.$parent.displayAlert('success', "Selected Package has been removed.");
				$scope.reloadPackages(productId);
			}
		});
	};

	$scope.getServices = function() {
		getSendDataFromServer(ngDataApi, {
			"method": "get",
			"routeName": "/dashboard/services/list",
			"params": {}
		}, function (error, response) {
			if (error) {
				$scope.$parent.displayAlert('danger', error.message);
			}
			else {
				console.log(response);
				$scope.allServiceApis = response;
			}
		});
	};
	$scope.selectedServices={};
	$scope.aclFill={};
	$scope.aclFill.services={};
	$scope.aclFill.apis={};

	$scope.selectApi = function(elem, service, api, index) {
		console.log('elem');
		console.log(elem);
		/*
		if($scope.selectedServices[service.name]){
			if($scope.selectedServices[service.name][api])
			{
				if( $scope.selectedServices[service.name][api].selectedApi && ($scope.selectedServices[service.name][api].selectedApi==true)){
					delete $scope.selectedServices[service.name][api];
				}
				else{
					$scope.selectedServices[service.name][api].selectedApi=true;
				}
			}
			else{
				$scope.selectedServices[service.name][api]= {};
				$scope.selectedServices[service.name][api].selectedApi=true;
			}
		}*/
		//console.log( $scope.selectedServices[service.name] );
		console.log($scope.aclFill);
	};

	//default operation
	$scope.getServices();
	$scope.listProducts();

}]);
