//
// Rooms Controller
//

'use strict';

var settings = require('./../config').rooms;
var mongoose = require('mongoose');

module.exports = function() {
    var app = this.app,
        core = this.core,
        middlewares = this.middlewares,
        models = this.models,
        User = models.user;

    core.on('presence:user_join', function(data) {
        User.findById(data.userId, function (err, user) {
            if (!err && user) {
                user = user.toJSON();
                user.room = data.roomId;
                if (data.roomHasPassword) {
                    app.io.to(data.roomId).emit('users:join', user);
                } else {
                    app.io.emit('users:join', user);
                }
            }
        });
    });

    core.on('presence:user_leave', function(data) {
        User.findById(data.userId, function (err, user) {
            if (!err && user) {
                user = user.toJSON();
                user.room = data.roomId;
                if (data.roomHasPassword) {
                    app.io.to(data.roomId).emit('users:leave', user);
                } else {
                    app.io.emit('users:leave', user);
                }
            }
        });
    });

    var getEmitters = function(room) {
        if (room.private && !room.hasPassword) {
            var connections = core.presence.connections.query({
                type: 'socket.io'
            }).filter(function(connection) {
                return room.isAuthorized(connection.user);
            });

            return connections.map(function(connection) {
                return {
                    emitter: connection.socket,
                    user: connection.user
                };
            });
        }

        return [{
            emitter: app.io
        }];
    };

    core.on('rooms:new', function(room) {
        var emitters = getEmitters(room);
        emitters.forEach(function(e) {
            e.emitter.emit('rooms:new', room.toJSON(e.user));
        });
    });

    core.on('rooms:update', function(room) {
        var emitters = getEmitters(room);
        emitters.forEach(function(e) {
            e.emitter.emit('rooms:update', room.toJSON(e.user));
        });
    });

    core.on('rooms:archive', function(room) {
        var emitters = getEmitters(room);
        emitters.forEach(function(e) {
            e.emitter.emit('rooms:archive', room.toJSON(e.user));
        });
    });


    //
    // Routes
    //
    app.route('/rooms')
        .get(middlewares.requireLogin, function(req) {
            req.io.route('rooms:list');
        })
        .post(middlewares.requireInternalToken,
            function(req) {
            req.io.route('rooms:create');
        });


      app.route('/rooms/join')
          .all(middlewares.requireInternalToken)
          .post(function(req) {
            console.log('joining all rooms route');
              req.io.route('rooms:join_all');
          })

      app.route('/rooms/leave')
          .all(middlewares.requireInternalToken)
          .post(function(req) {
              req.io.route('rooms:leave_all');
          })

    app.route('/rooms/:room')
        .all(middlewares.roomRoute)
        .get(middlewares.requireLogin,
          function(req) {
            req.io.route('rooms:get');
        })
        .put(middlewares.requireLogin,
          function(req) {
            req.io.route('rooms:update');
        })
        .delete(middlewares.requireInternalToken,
          function(req) {
            req.io.route('rooms:archive');
        });

    app.route('/rooms/:room/join')
        .all(middlewares.requireInternalToken, middlewares.roomRoute)
        .post(function(req) {
            req.io.route('rooms:join');
        })

    app.route('/rooms/:room/leave')
        .all(middlewares.requireInternalToken, middlewares.roomRoute)
        .post(function(req) {
            req.io.route('rooms:leave');
        })

    // app.route('/rooms/join')
    //     .all(middlewares.requireInternalToken, middlewares.roomRoute)
    //     .post(function(req) {
    //         console.log('joining all rooms route');
    //         req.io.route('rooms:join_all');
    //     })
    //
    // app.route('/rooms/leave')
    //     .all(middlewares.requireInternalToken, middlewares.roomRoute)
    //     .post(function(req) {
    //         req.io.route('rooms:leave_all');
    //     })

    app.route('/rooms/:room/users')
        .all(middlewares.requireLogin, middlewares.roomRoute)
        .get(function(req) {
            req.io.route('rooms:users');
        });


    //
    // Sockets
    //
    app.io.route('rooms', {
        list: function(req, res) {
            var options = {
                    userId: req.user._id,
                    users: req.param('users'),

                    skip: req.param('skip'),
                    take: req.param('take')
                };

            core.rooms.list(options, function(err, rooms) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                var filteredRooms = rooms.filter(function(room) {
                  return room.isAuthorized(req.user._id);
                });

                var results = filteredRooms.map(function(room) {
                    return room.toJSON(req.user);
                });

                res.json(results);
            });
        },
        get: function(req, res) {
            var options = {
                userId: req.user._id,
                identifier: req.param('room') || req.param('id')
            };

            core.rooms.get(options, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                res.json(room.toJSON(req.user));
            });
        },
        // create: function(req, res) {
        //     var options = {
        //         owner: req.user._id,
        //         name: req.param('name'),
        //         slug: req.param('slug'),
        //         description: req.param('description'),
        //         participants: [ req.user._id ],
        //         private: req.param('private'),
        //         password: req.param('password')
        //     };
        //
        //     if (!settings.private) {
        //         options.private = false;
        //         delete options.password;
        //     }
        //
        //     core.rooms.create(options, function(err, room) {
        //         if (err) {
        //             console.error(err);
        //             return res.status(400).json(err);
        //         }
        //         res.status(201).json(room.toJSON(req.user));
        //     });
        // },
        create: function(req, res) {


          // console.log('CREATING ROOM!!!');
            var User = mongoose.model('User');
            //note that ownerUID
            var ownerUID = req.param('owner');
            var participantUIDs = req.param('participants');

            return User.findOne({uid: ownerUID}, function(err, user) {

              if (err) {
                  console.error(err);
                  return res.status(400).json(err);
              }

              if (!user) {
                  // console.error(err);
                  return res.sendStatus(404);
              }

              var owner = user._id;

              return User.find({uid: {$in: participantUIDs}}, function(err, participantObjects) {

                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                if (participantObjects.length == 0) {
                  return res.sendStatus(404);
                }

                var participants = participantObjects.map(function(participant) {
                    return participant._id;
                });

                var options = {
                    owner: owner,
                    name: req.param('name'),
                    slug: req.param('slug'),
                    description: req.param('description'),
                    participants: participants,
                    private: true,
                    password: req.param('password')
                };

                if (!settings.private) {
                    options.private = false;
                    delete options.password;
                }

                core.rooms.create(options, function(err, room) {
                    if (err) {
                        console.error(err);
                        return res.status(400).json(err);
                    }
                    res.status(201).json(room.toJSON(req.user));
                });

            });
          });

        },
        update: function(req, res) {
            var roomId = req.param('room') || req.param('id');

            var options = {
                    name: req.param('name'),
                    slug: req.param('slug'),
                    description: req.param('description'),
                    password: req.param('password'),
                    participants: req.param('participants'),
                    user: req.user
                };

            if (!settings.private) {
                delete options.password;
                delete options.participants;
            }

            core.rooms.update(roomId, options, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.status(400).json(err);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                res.json(room.toJSON(req.user));
            });
        },
        archive: function(req, res) {
            var roomId = req.param('room') || req.param('id');

            // console.log(roomId);

            core.rooms.archive(roomId, function(err, room) {
                if (err) {
                    console.log(err);
                    return res.sendStatus(400);
                }

                if (!room) {
                    //should this be 404 or 200?
                    return res.sendStatus(404);
                }

                res.sendStatus(204);
            });
        },
        // join: function(req, res) {
        //     var options = {
        //             userId: req.user._id,
        //             saveMembership: true
        //         };
        //
        //     if (typeof req.data === 'string') {
        //         options.id = req.data;
        //     } else {
        //         options.id = req.param('roomId');
        //         options.password = req.param('password');
        //     }
        //
        //     var user = req.user.toJSON();
        //     var userID = req.param('userID') || req.user._id;
        //
        //     core.rooms.join({roomID: req.param('room'), userID: userID}, function(err) {
        //         if( err ){
        //             console.log('there was an error joining')
        //             console.log(err)
        //             return res.sendStatus(400);
        //         }
        //         var options = {
        //             userId: req.user._id,
        //             identifier: req.param('room') || req.param('id')
        //         };
        //         return res.sendStatus(200)
        //     });
        //
        // },
        join: function(req, res) {
          var roomID = req.param('room');
          var userUID = req.body.uid;

          return User.findOne({uid: userUID}, function(err, user) {

            if( err ){
                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else if (!user) {

                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else {
              return core.rooms.join({roomID: roomID, userID: user._id}, function(err) {
                  if( err ){
                      console.log('there was an error joining')
                      console.log(err)
                      return res.status(400).send({error: 'there was an error joining'});
                  }

                  return res.sendStatus(200)
              });
            }


          });
        },
        join_all: function(req, res) {
          var userUID = req.body.uid;

          console.log('joining all rooms route');
          return User.findOne({uid: userUID}, function(err, user) {

            if( err ){
                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else if (!user) {

                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else {
              return core.rooms.join_all({userID: user._id}, function(err) {
                  if( err ){
                      console.log('there was an error joining')
                      console.log(err)
                      return res.status(400).send({error: 'there was an error joining'});
                  }

                  return res.sendStatus(200)
              });
            }


          });
        },

        leave: function(req, res) {
          var roomID = req.param('room');
          var userUID = req.body.uid;

          return User.findOne({uid: userUID}, function(err, user) {

            if( err ){
                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else if (!user) {

                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else {
              return core.rooms.leave({roomID: roomID, userID: user._id}, function(err) {
                  if( err ){
                      console.log('there was an error leaving')
                      console.log(err)
                      return res.sendStatus(400);
                  }

                  return res.sendStatus(200);
              });
            }



          });
        },
        leave_all: function(req, res) {
          var userUID = req.body.uid;

          return User.findOne({uid: userUID}, function(err, user) {

            if( err ){
                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else if (!user) {

                console.log('No user with the specified UID found')
                console.log(err)
                return res.status(400).send({error: 'No user with the specified UID found'});
            }

            else {
              return core.rooms.leave_all({userID: user._id}, function(err) {
                  if( err ){
                      console.log('there was an error leaving')
                      console.log(err)
                      return res.sendStatus(400);
                  }

                  return res.sendStatus(200);
              });
            }



          });
        },
        users: function(req, res) {
            var roomId = req.param('room');

            core.rooms.get(roomId, function(err, room) {
                if (err) {
                    console.error(err);
                    return res.sendStatus(400);
                }

                if (!room) {
                    return res.sendStatus(404);
                }

                var users = core.presence.rooms
                        .getOrAdd(room)
                        .getUsers()
                        .map(function(user) {
                            // TODO: Do we need to do this?
                            user.room = room.id;
                            return user;
                        });

                res.json(users);
            });
        }
    });
};
