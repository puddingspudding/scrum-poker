var bcrypt = require('bcrypt');
const saltRounds = 10;

var exports = module.exports = {};

exports.handleCreateRequests = function(socket, groupsById, socketsByUserId, groupsDB, groupusersDB, userIdsByGroupId, groupIdsByUserId) {
    socket.on('group.create', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
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

            groupsDB.insert({
                'name': request.name,
                'password': bcrypt.hashSync(request.password, saltRounds),
                'userId': socket.userId
            }).then(function(g) {
                var group = {
                    'id': g._id,
                    'name': request.name,
                    'userId': socket.userId
                };
                groupusersDB.insert({
                    'groupId': group.id,
                    'userId': socket.userId
                }).then(function(gu) {
                    groupsById[group.id] = group;
                    userIdsByGroupId[group.id] = [socket.userId];
                    groupIdsByUserId[socket.userId].push(group.id);

                    response({
                        'status': 200,
                        'message': {
                            'id': group.id
                        }
                    });
                    for (var userId in socketsByUserId) {
                        socketsByUserId[userId].emit('group.created', group);
                    }
                });
            });

        } catch (e) {
            console.error(e);
            response({
                'status': 500,
                'message': e
            });
        }

    });
};

exports.handleListRequests = function(socket, groupsById) {
    socket.on('group.list', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        var groups = [];
        for (var groupId in groupsById) {
            groups.push(groupsById[groupId]);
        }
        response({
            'status': 200,
            'message': groups
        });
    });
};

exports.handleUsersRequests = function(socket, userIdsByGroupId, groupIdsByUserId, groupsById) {
    socket.on('group.users', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        
        try {
            if (!('id' in request)) {
                throw 'id not set';
            }
            if (typeof request.id !== 'string') {
                throw 'id is not a string';
            }

            if (groupIdsByUserId[socket.userId].indexOf(request.id) == -1) {
                response({
                    'status': 401
                });
                return;
            }
            if (!(request.id in groupsById)) {
                response({
                    'status': 404
                });
                return;
            }

            response({
                'status': 200,
                'message': userIdsByGroupId[request.id]
            });
        } catch (e) {
            console.error(e);
            response({
                'status': 500,
                'message': e
            });
        }
        
    });
};

exports.handleJoinRequests = function(socket, socketsByUserId, groupIdsByUserId, userIdsByGroupId, groupusersDB, groupsDB) {
    socket.on('group.join', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        
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

            if (groupIdsByUserId[socket.userId].indexOf(request.id) != -1) {
                throw 'already joined';
            }

            groupsDB.findOne({
                '_id': request.id
            }).then(function(group) {
                if (group) {
                    if (bcrypt.compareSync(request.password, group.password)) {
                        groupusersDB.insert({
                            'userId': socket.userId,
                            'groupId': request.id
                        }).then(function(gu) {
                            response({
                                'status': 200
                            });
                            for (var key in userIdsByGroupId[request.id]) {
                                var s = socketsByUserId[userIdsByGroupId[request.id][key]];
                                if (s) {
                                    s.emit('group.joined', {
                                        'id': request.id,
                                        'userId': socket.userId
                                    });
                                }
                            }
                            groupIdsByUserId[socket.userId].push(request.id);
                            userIdsByGroupId[request.id].push(socket.userId);
                        });
                    } else {
                        response({
                            'status': 400,
                            'message': 'password invalid'
                        });
                    }
                } else {
                    response({
                        'status': 404
                    });
                }
            });

        } catch (e) {
            console.error(e);
            response({
                'status': 500,
                'message': e
            });
        }
    });
};


exports.handlePokerStartRequests = function(socket, socketsByUserId, userIdsByGroupId, groupsById, betsByGroupId) {
    socket.on('group.poker.start', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        
        try {
            if (!('id' in request)) {
                throw 'id not set';
            }
            if (typeof request.id !== 'string') {
                throw 'id is not a string';
            }

            // check if group exists and user is owner
            if (!(request.id in groupsById)) {
                socket.emit('group.poker.start.response', {
                    'status': 404
                });
                return;
            }
            if (groupsById[request.id].userId != socket.userId) {
                socket.emit('group.poker.start.response', {
                    'status': 403
                });
                return;   
            }

            betsByGroupId[request.id] = [];

            response({
                'status': 200
            });
            for (var key in userIdsByGroupId[request.id]) {
                var s = socketsByUserId[userIdsByGroupId[request.id][key]];
                if (s) {
                    s.emit('group.poker.started', {
                        'id': request.id
                    });
                }
            }
        } catch (e) {
            console.error(e);
            response({
                'status': 500,
                'message': e
            });
        }
    });
};

exports.handlePokerBetRequests = function(socket, betsByGroupId, groupIdsByUserId, userIdsByGroupId, socketsByUserId) {
    socket.on('group.poker.bet', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        
        try {
            if (!('id' in request)) {
                throw 'id not set';
            }
            if (typeof request.id !== 'string') {
                throw 'id is not a string';
            }

            if (!('bet' in request)) {
                throw 'bet not set';
            }
            if (typeof request.bet !== 'number') {
                throw 'bet is not a number';
            }

            // check if user is in group
            if (groupIdsByUserId[socket.userId].indexOf(request.id) == -1) {
                response({
                    'status': 404
                });
                return;
            }

            if ([1,2,3,5,8,13,20,30,40,100].indexOf(request.bet) == -1) {
                throw 'invalid bet';
            }
            
            betsByGroupId[request.id].push({
                'groupId': request.id,
                'userId': socket.userId,
                'bet': request.bet
            });
            response({
                'status': 200
            });

            for (var key in userIdsByGroupId[request.id]) {
                var s = socketsByUserId[userIdsByGroupId[request.id][key]];
                if (s) {
                    s.emit('group.poker.betted', {
                        'id': request.id,
                        'userId': socket.userId
                    });
                }
            }

        } catch (e) {
            console.error(e);
            response({
                'status': 500,
                'message': e
            });
        }
    });
};

exports.handlePokerEndRequests = function(socket, betsByGroupId, socketsByUserId, userIdsByGroupId, groupsById) {
    socket.on('group.poker.end', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        
        try {
            if (!('id' in request)) {
                throw 'id not set';
            }
            if (typeof request.id !== 'string') {
                throw 'id is not a string';
            }

            // check if group exists and user is owner
            if (!(request.id in groupsById)) {
                response({
                    'status': 404
                });
                return;
            }
            if (groupsById[request.id].userId != socket.userId) {
                response({
                    'status': 403
                });
                return;   
            }

            response({
                'status': 200
            });

            var bets = betsByGroupId[request.id];
            betsByGroupId[request.id] = []

            for (var key in userIdsByGroupId[request.id]) {
                var s = socketsByUserId[userIdsByGroupId[request.id][key]];
                if (s) {
                    s.emit('group.poker.ended', bets);
                }
            }
        } catch (e) {
            console.error(e);
            response({
                'status': 500,
                'message': e
            });
        }
    });

}
