var bcrypt = require('bcrypt');
const saltRounds = 10;

var exports = module.exports = {};

exports.handleCreateRequests = function(socket, usersDB) {
    socket.on('user.create.request', function(request) {
        try {
            // name validation
            if (!('name' in request)) {
                throw 'name not set';
            }
            if (typeof request.name !== 'string') {
                throw 'name is not a string';
            }
            if (request.name.length < 3 || request.name.length > 64) {
                throw 'name length < 3 or > 64';
            }
            
            // password validation
            if (!('password' in request)) {
                throw 'password not set';
            }
            if (typeof request.password !==  'string') {
                throw 'password is not a string';
            }
            if (request.password.length < 8) {
                throw 'password min length 8';
            }


            usersDB.insert({
                'name': request.name,
                'password': bcrypt.hashSync(request.password, saltRounds)
            }).then(function(r) {
                socket.emit('user.create.response', {
                    'status': 200,
                    'message': {
                        'id': r._id
                    }
                });
            });

        } catch (e) {
            console.error(e);
            socket.emit('user.create.response', {
                'status': 500,
                'message': e
            });
        }
    });
}

exports.handleJoinRequests = function(socket, socketsByUserId, usersDB) {
    socket.on('user.join.request', function(request) {
        try {
            if (!('id' in request)) {
                throw 'id not set';
            }
            if (typeof request.id !== 'string') {
                throw 'id is not a string';
            }
            if (!('password' in request)) {
                throw 'password not set';
            }
            if (typeof request.password !== 'string') {
                throw 'password is not a string';
            }

            usersDB.findOne({'_id': request.id}).then(function(user, err) {
                if (user && bcrypt.compareSync(request.password, user.password)) {
                    socket.emit('user.join.response', {
                        'status': 200
                    });
                    socket.userId = user._id;
                    for (var key in socketsByUserId) {
                        socketsByUserId[key].emit('user.joined', {
                            'id': socket.userId
                        });
                    }
                    socketsByUserId[socket.userId] = socket;
                } else {
                    socket.emit('user.join.response', {
                        'login invalid'
                    });
                }
            });

        } catch (e) {
            console.error(e);
            socket.emit('user.join.response', {
                'status': 500,
                'message': e
            });
        }
    });
}



