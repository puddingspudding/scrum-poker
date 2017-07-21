var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var os = require('os');
var db = require('node-localdb');


var userEvents = require("./src/main/js/events/user.js");

const fs = require('fs');
const uuidv4 = require('uuid/v4');

var usersDB = db('users.json');
var groupsDB = db('groups.json');
var groupusersDB = db('groupusers.json');
var betsDB = db('bets.json');

var usersById = {}; 
var groupsById = {};
var socketsByUserId = {};
var usersByGroupId = {}
var betsByGroupId = {};

usersDB.find({}).then(function(users) {
    for (var key in users) {
        var user = users[key];
        usersById[user._id] = user;
    }
});

app.get('/', function(req, res){
  res.sendFile(__dirname + '/src/main/html/index.html');
});

io.on('connection', function(socket){   

    socket.on('disconnect', function(){
        if ('userId' in socket) {
            for (var userId in socketsByUserId) {
                if (socketsByUserId[userId] == socket) {
                    delete sockets[userId];
                } else {
                    socketsByUserId[userId].emit('user.left', {"id": userId});  
                }
            }    
        }
    });

    userEvents.handleCreateRequests(socket, usersDB);
    userEvents.handleJoinRequests(socket, socketsByUserId, usersDB);


});



http.listen(3000, function(){
  console.log('listening on *:3000');
});