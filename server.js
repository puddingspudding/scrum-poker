var app = require('express')();
var bodyParser = require('body-parser');

var http = require('http').Server(app);
var io = require('socket.io')(http);
var os = require('os');
var db = require('node-localdb');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');
var cors = require('cors');
const saltRounds = 10;

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

const SECRET_KEY = bcrypt.hashSync(uuidv4(), saltRounds);

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

app.use(cors());
app.use(bodyParser.json()); // for parsing application/json
app.get('/', function(req, res){
  res.sendFile(__dirname + '/src/main/html/index.html');
});
app.get('/users', function(req, res) {
    var token = req.header('Authorization');
    if (!token || token.length == 0) {
        return res.status(401).end();
    }
    jwt.verify(token, SECRET_KEY, function(err, decoded) {
        var users = [];
        for (var userId in usersById) {
            users.push(usersById[userId]);
        }
        res.send(JSON.stringify(users));    
    });
})
app.post('/tokens', function(req, res) {
    var userReq = req.body;
    try {
        if (!('name' in userReq)) {
            throw 'name not set';
        }
        if (typeof userReq.name !== 'string') {
            throw 'name is not a string';
        }
        if (!('password' in userReq)) {
            throw 'password not set';
        }
        if (typeof userReq.password !== 'string') {
            throw 'password is not a string';
        }

        usersDB.findOne({'name': userReq.name}).then(function(user, err) {
            if (userReq && bcrypt.compareSync(userReq.password, user.password)) {
                res.send(jwt.sign(usersById[user._id], SECRET_KEY, { expiresIn: '24h' }));
            } else {
                res.status(400).send('login invalid');
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).send(e);
    }
})
app.post('/users', function(req, res) {
    var user = req.body;
    try {
            // name validation
            if (!('name' in user)) {
                throw 'name not set';
            }
            if (typeof user.name !== 'string') {
                throw 'name is not a string';
            }
            if (user.name.length < 3 || user.name.length > 64) {
                throw 'name length < 3 or > 64';
            }
            
            // password validation
            if (!('password' in user)) {
                throw 'password not set';
            }
            if (typeof user.password !==  'string') {
                throw 'password is not a string';
            }
            if (user.password.length < 8) {
                throw 'password min length 8';
            }
            user.name = user.name.trim();

            usersDB.findOne({"name": user.name}).then(function(existingUser) {
                if (existingUser) {
                    res.status(400).send('name already exists');
                    return;
                }
                usersDB.insert({
                    'name': user.name,
                    'password': bcrypt.hashSync(user.password, saltRounds)
                }).then(function(r) {
                    usersById[r._id] = {
                        'id': r._id,
                        'name': user.name
                    }
                    res.send(jwt.sign(usersById[r._id], SECRET_KEY, { expiresIn: '24h' }));
                });
            });
        } catch (e) {
            console.error(e);
            res.status(500).send(e);
        }
});

io.use((socket, next) => {
  if (socket.handshake.query && socket.handshake.query.token){
    jwt.verify(socket.handshake.query.token, SECRET_KEY, function(err, decoded) {
      if(err) return next(new Error('Authentication error'));
      socket.userId = decoded.id;

      next();
    });
  } else {
    next(new Error('Authentication error'));  
    socket.disconnect();
  }
});

io.on('connection', function(socket){

    socketsByUserId[socket.userId] = socket;
    for (var userId in socketsByUserId) {
        socketsByUserId[userId].emit('user.joined', usersById[socket.userId]);
    }

    socket.on('disconnect', function(){
        if ('userId' in socket) {
            for (var userId in socketsByUserId) {
                if (socketsByUserId[userId] == socket) {
                    delete socketsByUserId[userId];
                } else {
                    socketsByUserId[userId].emit('user.left', {"id": socket.userId});  
                }
            }  
        }
    });

    // user.* events
    userEvents.handleListRequests(socket, socketsByUserId, usersById);
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
