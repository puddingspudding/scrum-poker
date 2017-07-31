
var exports = module.exports = {};
exports.handleListRequests = function(socket, socketsByUserId, usersById) {
    socket.on('user.list', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        var users = [];
        for (var userId in socketsByUserId) {
            users.push(usersById[userId]);
        }
        response({
            'status': 200,
            'message': users
        });
    });
}

exports.handleGroupsRequests = function(socket, groupIdsByUserId) {
    socket.on('user.groups', function(request, response) {
        if (!('userId' in socket)) {
            response({
                'status': 401
            });
            return;
        }
        response({
            'status': 200,
            'message': groupIdsByUserId[socket.userId]
        });
    });
}

