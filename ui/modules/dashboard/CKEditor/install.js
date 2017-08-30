"use strict";

var ckNav = [
	{
		'id': 'CKEditor',
		'label': 'CK Editor',
		'url': '#/CKEditor',
		'tplPath': 'modules/dashboard/CKEditor/directives/test.tmpl',
		'icon': 'pen',
		'pillar': {
			'name': 'development',
			'label': translation.develop[LANG],
			'position': 1
		},
		'mainMenu': true,
		'tracker': true,
		'order': 8,
		'scripts': ['modules/dashboard/CKEditor/controller.js'],
		'ancestor': [translation.home[LANG]]
	}
];
navigation = navigation.concat(ckNav);
