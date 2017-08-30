"use strict";
var ckeditorApp = soajsApp.components;
ckeditorApp.controller("ckeditorCtrl", ['$scope', function($scope) {
    $scope.editorOptions = {
        language: 'en',
        uiColor: '#DDDDDD'
    };
    // $scope.save = function() {
    //     $http.post('/examples/test.php', {
    //         content: $scope.test
    //     }).success(function() {
    //         alert('Saved');
    //     });
    // }
}]);
