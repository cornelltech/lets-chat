'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    helpers = require('./helpers');

var getParticipants = function(room, options, cb) {
    if (!room.private || !options.participants) {
        return cb(null, []);
    }

    var participants = [];

    if (Array.isArray(options.participants)) {
        participants = options.participants;
    }

    if (typeof options.participants === 'string') {
        participants = options.participants.replace(/@/g, '')
            .split(',').map(function(username) {
                return username.trim();
            });
    }

    participants = _.chain(participants)
        .map(function(username) {
            return username && username.replace(/@,\s/g, '').trim();
        })
        .filter(function(username) { return !!username; })
        .uniq()
        .value();

    var User = mongoose.model('User');
    User.find({username: { $in: participants } }, cb);
};

function RoomManager(options) {
    this.core = options.core;
}

RoomManager.prototype.canJoin = function(options, cb) {
    var method = options.id ? 'get' : 'slug',
        roomId = options.id ? options.id : options.slug;

    this[method](roomId, function(err, room) {
        if (err) {
            return cb(err);
        }

        if (!room) {
            return cb();
        }

        room.canJoin(options, function(err, canJoin) {
            cb(err, room, canJoin);
        });
    });
};

RoomManager.prototype.join = function(options, cb) {
    var Room = mongoose.model('Room');
    var User = mongoose.model('User');
    var roomID = options.roomID,
        userID = options.userID;

    return Room.findByIdAndUpdate(mongoose.Types.ObjectId(roomID),
        { $addToSet: {participants: mongoose.Types.ObjectId(userID)}}, function(err){
            if(!err){
                return User.findByIdAndUpdate(mongoose.Types.ObjectId(userID),
                                       { $addToSet: {rooms: mongoose.Types.ObjectId(roomID)}}, cb)
            }
            else {
              return cb(err);
            }
        })
};

RoomManager.prototype.join_all = function(options, cb) {

    console.log('joining all rooms core');
    var Room = mongoose.model('Room');

    var roomManager = this;

    return Room.find({}, function(err, rooms) {

      if(err) {
        return cb(err, false);
      }
      function join_all_helper(i, callback) {

        // console.log('join_all_rooms_helper')
        if (i < rooms.length) {
          var room = rooms[i];
          return roomManager.join({userID: options.userID, roomID: room._id}, function(err, room) {
            if(err) {
              return callback(err, false);
            }
            else {
              return join_all_helper(i+1, callback);
            }
          })
        }
        else {
          // console.log('joined all rooms core');
          return callback(null)
        }
      }

      return join_all_helper(0, cb);

    });

};

RoomManager.prototype.leave = function(options, cb) {
    var Room = mongoose.model('Room');
    var User = mongoose.model('User');
    var roomID = options.roomID,
        userID = options.userID;

        //probably should check that the user is not the
        return Room.findById(roomID, function(err, room) {

          if (err) {
            return cb(err);
          }
          else if (!room) {
            return cb({error: 'Cannot find room'});
          }
          else if (room.owner.toString() === userID.toString()) {
            return cb({error: 'Owner cannot leave'});
          }

          else {
            return Room.findByIdAndUpdate(mongoose.Types.ObjectId(roomID),
              { $pull: {participants: mongoose.Types.ObjectId(userID)}}, function(err){
                  if(!err){
                      User.findByIdAndUpdate(mongoose.Types.ObjectId(userID),
                                             { $pull: {rooms: mongoose.Types.ObjectId(roomID)}}, cb)
                  }
                  else {
                    cb(err);
                  }
              });
            }
        });
};

RoomManager.prototype.leave_all = function(options, cb) {

    var Room = mongoose.model('Room');

    var roomManager = this;

    return Room.find({ archived: { $ne: true }}, function(err, rooms) {

      if(err) {
        return cb(err, false);
      }
      function leave_all_helper(i, callback) {
        if (i < rooms.length) {
          var room = rooms[i];
          return roomManager.leave({userID: options.userID, roomID: room._id}, function(err, room) {
            if(err) {
              return callback(err, false);
            }
            else {
              return leave_all_helper(i+1, callback);
            }
          })
        }
        else {
          return callback(null)
        }
      }

      return leave_all_helper(0, cb);

    });

};

RoomManager.prototype.create = function(options, cb) {

    var Room = mongoose.model('Room');
    // console.log(options);
    Room.create(options, function(err, room) {
        if (err) {
            return cb(err);
        }

        if (cb) {
            room = room;
            cb(null, room);
            this.core.emit('rooms:new', room);
        }
    }.bind(this));
};

RoomManager.prototype.update = function(roomId, options, cb) {
    var Room = mongoose.model('Room');

    Room.findById(roomId, function(err, room) {
        if (err) {
            // Oh noes, a bad thing happened!
            console.error(err);
            return cb(err);
        }

        if (!room) {
            return cb('Room does not exist.');
        }

        if(room.private && !room.owner.equals(options.user.id)) {
            return cb('Only owner can change private room.');
        }

        getParticipants(room, options, function(err, participants) {
            if (err) {
                // Oh noes, a bad thing happened!
                console.error(err);
                return cb(err);
            }

            room.name = options.name;
            // DO NOT UPDATE SLUG
            // room.slug = options.slug;
            room.description = options.description;

            if (room.private) {
                room.password = options.password;
                room.participants = participants;
            }

            room.save(function(err, room) {
                if (err) {
                    console.error(err);
                    return cb(err);
                }
                room = room;
                cb(null, room);
                this.core.emit('rooms:update', room);
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

RoomManager.prototype.archive = function(roomId, cb) {
    var Room = mongoose.model('Room');

    Room.findById(roomId, function(err, room) {
        if (err) {
            // Oh noes, a bad thing happened!
            console.error(err);
            return cb(err);
        }

        if (!room) {
            return cb('Room does not exist.');
        }

        room.archived = true;
        room.save(function(err, room) {
            if (err) {
                console.error(err);
                return cb(err);
            }
            cb(null, room);
            this.core.emit('rooms:archive', room);

        }.bind(this));
    }.bind(this));
};

RoomManager.prototype.list = function(options, cb) {
    options = options || {};

    options = helpers.sanitizeQuery(options, {
        defaults: {
            take: 10
        },
        maxTake: 5000
    });

    var Room = mongoose.model('Room');

    console.log('finding rooms with the following options', options)
    var find = Room.find({
        archived: { $ne: true },
        $or: [
            {private: {$exists: false}},
            {private: false},

            {owner: options.userId},

            {participants: options.userId}}
        ]
    });

    if (options.skip) {
        find.skip(options.skip);
    }

    if (options.take) {
        find.limit(options.take);
    }

    if (options.sort) {
        var sort = options.sort.replace(',', ' ');
        find.sort(sort);
    } else {
        find.sort('-lastActive');
    }

    find.populate('participants');
    find.populate('owner');

    console.log('executing query', find)
    find.exec(function(err, rooms) {
        if (err) {
            return cb(err);
        }

        console.log('found rooms of length', rooms.length)
        console.log(rooms)
        _.each(rooms, function(room) {
            this.sanitizeRoom(options, room);
        }, this);

        if (options.users && !options.sort) {
            rooms = _.sortByAll(rooms, ['userCount', 'lastActive'])
                     .reverse();
        }

        console.log('calling back')
        cb(null, rooms);

    }.bind(this));
};

RoomManager.prototype.sanitizeRoom = function(options, room) {
    var authorized = options.userId && room.isAuthorized(options.userId);

    if (options.users) {
        if (authorized) {
            room.users = this.core.presence
                        .getUsersForRoom(room.id.toString());
        } else {
            room.users = [];
        }
    }
};

RoomManager.prototype.findOne = function(options, cb) {
    var Room = mongoose.model('Room');
    Room.findOne(options.criteria)
        .populate('participants').exec(function(err, room) {

        if (err) {
            return cb(err);
        }

        this.sanitizeRoom(options, room);
        cb(err, room);

    }.bind(this));
};

RoomManager.prototype.get = function(options, cb) {
    var identifier;

    if (typeof options === 'string') {
        identifier = options;
        options = {};
        options.identifier = identifier;
    } else {
        identifier = options.identifier;
    }

    options.criteria = {
        _id: identifier,
        archived: { $ne: true }
    };

    this.findOne(options, cb);
};

RoomManager.prototype.slug = function(options, cb) {
    var identifier;

    if (typeof options === 'string') {
        identifier = options;
        options = {};
        options.identifier = identifier;
    } else {
        identifier = options.identifier;
    }

    options.criteria = {
        slug: identifier,
        archived: { $ne: true }
    };

    this.findOne(options, cb);
};

module.exports = RoomManager;
