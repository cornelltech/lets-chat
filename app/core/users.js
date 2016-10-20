'use strict';

var mongoose = require('mongoose'),
    helpers = require('./helpers');

function UserManager(options) {
    this.core = options.core;
}

UserManager.prototype.listAllUsersHelper = function(accumulatedUsers, skip, take, cb) {

  var options = {
    take: take,
    skip: skip
  }


  console.log('calling user list with ', options)
  console.log(this);

  var listCallback = function(err, users) {
      console.log('user list callback in listAllUsersHelper')
      if (err) {
          console.log(err);
          return cb(err);
      }

      var newUsers = accumulatedUsers.concat(users);
      console.log('found users of length', users.length)
      console.log('take is length', take);
      console.log('the accumulated user count is', newUsers.length)
      if (users.length < take) {
        console.log('calling final callback in listAllUsersHelper');
        return cb(null, newUsers);
      }
      else {
        console.log('recursing in listAllUsersHelper')
        return this.listAllUsersHelper(newUsers, skip, take + skip, cb);
      }
  };

  this.list(options, listCallback.bind(this));
}

UserManager.prototype.listAllUsers = function(cb) {
  console.log('calling initial listAllUsersHelper')
  console.log(this);
  this.listAllUsersHelper([], 0, 50, cb);
}

UserManager.prototype.list = function(options, cb) {
    options = options || {};

    options = helpers.sanitizeQuery(options, {
        defaults: {
            take: 50
        },
        maxTake: 50
    });

    var User = mongoose.model('User');

    var find = User.find();

    console.log('user find options', options);
    if (options.skip) {
        find.skip(options.skip);
    }

    if (options.take) {
        find.limit(options.take);
    }

    console.log('executing user list');

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
