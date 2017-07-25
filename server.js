var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var os = require('os');
var db = require('node-localdb');


var userEvents = require("./src/main/js/events/user.js");
var groupEvents = require("./src/main/js/events/group.js");

const fs = require('fs');
const uuidv4 = require('uuid/v4');

var usersDB = db('users.json');
var groupsDB = db('groups.json');
var groupusersDB = db('groupusers.json');

var usersById = {};
var groupsById = {};
var socketsByUserId = {};
var userIdsByGroupId = {};
var betsByGroupId = {};
var groupIdsByUserId = {};

usersDB.find({}).then(function(users) {
    if (users) {
        for (var key in users) {
            var user = {
                'id': users[key]._id,
                'name': users[key].name
            };
            usersById[user.id] = user;
            groupIdsByUserId[user.id] = [];
        }
    }
}).then(function() {
    return groupsDB.find({}).then(function(groups) {
        if (groups) {
            for (var key in groups) {
                var group = {
                    'id': groups[key]._id,
                    'name': groups[key].name,
                    'userId': groups[key].userId
                };
                groupsById[group.id] = group;
                userIdsByGroupId[group.id] = [];
                betsByGroupId[group.id] = [];
            }    
        }
    });    
}).then(function() {
    groupusersDB.find({}).then(function(groupUsers) {
        if (groupUsers) {
            for (var key in groupUsers) {
                var groupId = groupUsers[key].groupId;
                var userId = groupUsers[key].userId;

                userIdsByGroupId[groupId].push(userId);
                groupIdsByUserId[userId].push(groupId);
            }
        }
    });    
});


app.get('/', function(req, res){
  res.sendFile(__dirname + '/src/main/html/index.html');
});

io.on('connection', function(socket){   

    socket.on('disconnect', function(){
        if ('userId' in socket) {
            for (var userId in socketsByUserId) {
                if (socketsByUserId[userId] == socket) {
                    delete socketsByUserId[userId];
                } else {
                    socketsByUserId[userId].emit('user.left', {"id": userId});  
                }
            }    
        }
    });

    // user.* events
    userEvents.handleCreateRequests(socket, usersById, usersDB, socketsByUserId, groupIdsByUserId);
    userEvents.handleJoinRequests(socket, socketsByUserId, usersDB);
    userEvents.handleListRequests(socket, socketsByUserId, usersById);
    userEvents.handleLeaveRequests(socket, socketsByUserId);
    userEvents.handleGroupsRequests(socket, groupIdsByUserId);

    // group.* events
    groupEvents.handleCreateRequests(socket, groupsById, socketsByUserId, groupsDB, groupusersDB, userIdsByGroupId, groupIdsByUserId);
    groupEvents.handleListRequests(socket, groupsById);
    groupEvents.handleUsersRequests(socket, userIdsByGroupId, groupIdsByUserId, groupsById);
    groupEvents.handleJoinRequests(socket, socketsByUserId, groupIdsByUserId, userIdsByGroupId, groupusersDB, groupsDB);
    groupEvents.handlePokerStartRequests(socket, socketsByUserId, userIdsByGroupId, groupsById, betsByGroupId);
    groupEvents.handlePokerBetRequests(socket, betsByGroupId, groupIdsByUserId, userIdsByGroupId, socketsByUserId);
    groupEvents.handlePokerEndRequests(socket, betsByGroupId, socketsByUserId, userIdsByGroupId, groupsById);

});


http.listen(3000, function(){
  console.log('listening on *:3000');
});
