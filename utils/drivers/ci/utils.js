'use strict';

module.exports = {
	//return an error object if a function generates an error
	checkError: function (error, options, cb, callback) {
		if (error) {
			if (options && options.code) {
				if (typeof(error) === 'object' && error.code) {
					error.code = options.code;
				}
				else {
					error = {
						code: options.code,
						message: options.message || error
					};
				}
			}
			
			return cb(error);
		}
		
		return callback();
	},
	getDomain: function (domain) {
		return /^[^:]+(?=:\/\/)/.test(domain) ? domain : `https://${domain}`;
	}
};
