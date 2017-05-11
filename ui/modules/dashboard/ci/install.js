'use strict';

var ciNav = [
    {
        'id': 'continuous-integration',
        'label': "Continuous Integration",
        'checkPermission': {
            'service': 'dashboard',
            'route': '/ci/get',
            'method': 'get'
        },
        'url': '#/continuous-integration',
        'tplPath': 'modules/dashboard/ci/directives/list.tmpl',
        'icon': 'file-text2',
        'pillar': {
            'name': 'development',
            'label': translation.develop[LANG],
            'position': 6
        },
        'mainMenu': true,
        'tracker': true,
        'order': 4,
        'scripts': ['modules/dashboard/ci/config.js', 'modules/dashboard/ci/controller.js'],
        'ancestor': [translation.home[LANG]]
    }
];
navigation = navigation.concat(ciNav);
