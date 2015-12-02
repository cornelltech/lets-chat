'use strict';

var mongoose = require('mongoose'),
    helpers = require('./helpers');

function UserManager(options) {
    this.core = options.core;
}

UserManager.prototype.list = function(options, cb) {
    options = options || {};

    options = helpers.sanitizeQuery(options, {
        defaults: {
            take: 500
        },
        maxTake: 5000
    });

    var User = mongoose.model('User');

    var find = User.find();

    if (options.skip) {
        find.skip(options.skip);
    }

    if (options.take) {
        find.limit(options.take);
    }

    find.exec(cb);
};

UserManager.prototype.findByIds = function(ids, cb) {
    var User = mongoose.model('User');
    User.find({_id: { $in: ids}}, cb);
};

UserManager.prototype.get = function(identifier, cb) {
    var User = mongoose.model('User');
    User.findById(identifier, cb);
};

UserManager.prototype.username = function(username, cb) {
    var User = mongoose.model('User');
    User.findOne({
        username: username
    }, cb);
};

UserManager.prototype.rooms = function(identifier, cb) {
    var User = mongoose.model('User');
    var Room = mongoose.model('Room');
    User.findById(mongoose.Types.ObjectId(identifier), function(err, user){
        Room.find({'_id': { $in: user.rooms}}, cb)
    });
};

module.exports = UserManager;
