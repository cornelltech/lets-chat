
//
// Require Internal Token
//

'use strict';

var passport = require('passport');

module.exports = function(req, res, next) {

  return passport.authenticate('internal-bearer', { session: false })(req, res, next);

}
