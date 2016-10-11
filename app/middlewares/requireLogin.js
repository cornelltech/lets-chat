//
// Require Login
//

'use strict';

var passport = require('passport');

function getMiddleware(fail) {
    return function(req, res, next) {
        console.log('im requireLogin middleware')
        if (req.user) {
            next();
            return;
        }

        if (req.headers && req.headers.authorization) {

            console.log('in headers check in requireLogin')
            var parts = req.headers.authorization.split(' ');
            if (parts.length === 2) {
                var scheme = parts[0],
                    auth;

                if (/^Bearer$/i.test(scheme)) {
                    console.log('using bearer auth')
                    auth = passport.authenticate('bearer', { session: false });
                    return auth(req, res, next);
                }

                if (/^Basic$/i.test(scheme)) {
                    console.log('using basic auth')
                    auth = passport.authenticate('basic', { session: false });
                    return auth(req, res, next);
                }
            }
        }

        console.log('requireLogin failed')
        fail(req, res);
    };
}

module.exports = getMiddleware(function(req, res) {
    res.sendStatus(401);
});

module.exports.redirect = getMiddleware(function(req, res) {
    res.redirect('/login');
});
