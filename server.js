#!/usr/bin/env node

var express = require('express');
var app = express();
var bodyParser = require('body-parser');

var http = require('http').Server(app);
var io = require('socket.io')(http);
var os = require('os');
var db = require('node-localdb');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcrypt');
var cors = require('cors');
const fs = require('fs');
const process = require('process');
const pidFile = "/tmp/scrumpoker.pid";

if (fs.existsSync(pidFile)) {
    const pid = fs.readFileSync(pidFile).toString();
    console.log('already running pid: ' + pid);
    return;
}

fs.appendFileSync(pidFile, process.pid);
var deletePid = function() {
    if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
    }
};
process.on('exit', deletePid);
process.on('SIGINT', deletePid);

const defaultConfig = {
    "host": "0.0.0.0",
    "port": 3000,
    "data": {
        "dir": "."
    },
    "log": {
        "dir": "."
    }
}

const config = Object.assign(
    defaultConfig,
    process.argv.length >= 3 ? JSON.parse(fs.readFileSync(process.argv[2]).toString()) : {}
);

const output = fs.createWriteStream(config.log.dir + '/stdout.log');
const errorOutput = fs.createWriteStream(config.log.dir + '/stderr.log');
const logger = new console.Console(output, errorOutput);

const saltRounds = 10;

var userEvents = require("./src/main/js/events/user.js");
var groupEvents = require("./src/main/js/events/group.js");

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
                    'userId': groups[key].userId,
                    'poker': false
                };
                groupsById[group.id] = group;
                userIdsByGroupId[group.id] = [];
                betsByGroupId[group.id] = {};
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
});
app.post('/tokens', function(req, res) {
    var userReq = req.body;
    try {
        if (!('name' in userReq)) {
            res.status(400).send('name not set');
            return;
        }
        if (typeof userReq.name !== 'string') {
            res.status(400).send('name is not a string');
            return;
        }
        if (!('password' in userReq)) {
            res.status(400).send('password not set');
            return;
        }
        if (typeof userReq.password !== 'string') {
            res.status(400).send('password not set');
            return;
        }

        usersDB.findOne({'name': userReq.name}).then(function(user, err) {
            if (user && bcrypt.compareSync(userReq.password, user.password)) {
                res.send(jwt.sign(usersById[user._id], SECRET_KEY, { expiresIn: '24h' }));
            } else {
                res.status(400).send('login invalid');
            }
        });

    } catch (e) {
        logger.error(e);
        res.status(500).send(e);
    }
})
app.post('/users', function(req, res) {
    var user = req.body;
    try {
            // name validation
            if (!('name' in user)) {
                res.status(400).send('name not set');
                return;
            }
            if (typeof user.name !== 'string') {
                res.status(400).send('name is not a string');
                return;
            }
            if (user.name.length < 3 || user.name.length > 64) {
                res.status(400).send('name length < 3 or > 64');
                return;
            }
            
            // password validation
            if (!('password' in user)) {
                res.status(400).send('password not set');
                return;
            }
            if (typeof user.password !==  'string') {
                res.status(400).send('password is not a string');
                return;
            }
            if (user.password.length < 8) {
                res.status(400).send('password min length 8');
                return;
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
                    groupIdsByUserId[r._id] = [];
                    res.send(jwt.sign(usersById[r._id], SECRET_KEY, { expiresIn: '24h' }));
                });
            });
        } catch (e) {
            logger.error(e);
            res.status(500).send(e);
        }
});
app.use(express.static(process.cwd() + '/public'));

io.use((socket, next) => {
  if (socket.handshake.query && socket.handshake.query.token){
    jwt.verify(socket.handshake.query.token, SECRET_KEY, function(err, decoded) {
      if(err) {
        next(new Error('Authentication error'));
        socket.disconnect();
        return;
      }
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
    groupEvents.handlePokerBetsRequests(socket, userIdsByGroupId, groupsById, betsByGroupId);
    groupEvents.handlePokerStartRequests(socket, socketsByUserId, userIdsByGroupId, groupsById, betsByGroupId);
    groupEvents.handlePokerBetRequests(socket, betsByGroupId, groupIdsByUserId, userIdsByGroupId, socketsByUserId, groupsById);
    groupEvents.handlePokerEndRequests(socket, betsByGroupId, socketsByUserId, userIdsByGroupId, groupsById);

});

var server = http.listen(config.port, config.host, function(a,b,c){
    console.log('listening on ' + config.host + ':' + config.port);
});
process.on('SIGINT', function() {
    server.close();
});
