# Introduction


# REST / HTTP

## Authorization

```
/tokens
```

### Create a Token (HTTP POST)

#### Request Header
```
Content-type: application/json
```

#### Request Body
```json
{
    "name": "my name",
    "password": "secret"
}
```

#### Response
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ2M2MyODBhLTNiYjUtNGZlOC1iY2RhLWNlYWJlMmFiYzIyMiIsIm5hbWUiOiJteSBuYW1lIiwiaWF0IjoxNTAxMjY0Mzk2LCJleHAiOjE1MDEzNTA3OTZ9.50sT-mmp0OtdsHqsxrjOhwQnoyhFMAXdapcShnET8lsasd
```

## Users

```
/users
```

### Create a user (HTTP POST)
Request Header
```
Content-type: application/json
```

Request Body
```json
{
    "name": "my name",
    "password": "secret"
}
```

Response (JWT)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ2M2MyODBhLTNiYjUtNGZlOC1iY2RhLWNlYWJlMmFiYzIyMiIsIm5hbWUiOiJteSBuYW1lIiwiaWF0IjoxNTAxMjY0Mzk2LCJleHAiOjE1MDEzNTA3OTZ9.50sT-mmp0OtdsHqsxrjOhwQnoyhFMAXdapcShnET8lsasd
```

### Get all users (HTTP GET)

Request Header
```
Content-type: application/json
Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ2M2MyODBhLTNiYjUtNGZlOC1iY2RhLWNlYWJlMmFiYzIyMiIsIm5hbWUiOiJteSBuYW1lIiwiaWF0IjoxNTAxMjY0Mzk2LCJleHAiOjE1MDEzNTA3OTZ9.50sT-mmp0OtdsHqsxrjOhwQnoyhFMAXdapcShnET8lsasd
```


Response
```json
[
    {
        "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
        "name": "my name"
    },
    ...
]
```

# Websocket (socket.io)

Events emitted by the user always have a callback reponse. The response always contain a `status` key and indicates the result of the response using HTTP status codes. The `message` key in the response contains the response message if there is any.

Some events dont follow the request/response pattern. Those events just contain the data. They dont have the `status` and `message` key

## Connect
```javascript
io.connect("localhost", {
    query: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImQ2M2MyODBhLTNiYjUtNGZlOC1iY2RhLWNlYWJlMmFiYzIyMiIsIm5hbWUiOiJteSBuYW1lIiwiaWF0IjoxNTAxMjY0Mzk2LCJleHAiOjE1MDEzNTA3OTZ9.50sT-mmp0OtdsHqsxrjOhwQnoyhFMAXdapcShnET8lsasd"
    }
});
```
## Users

### Events
`id` in request/reponse events is always the user id

#### user.joined
Recipients: all users connected to the socket
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
    "name": "my name"
}
```

#### user.list
Lists all connetecd users

Request
```json
```

Response
```
{
    "status": 200, // 401 if not joined
    "message": [
        {
            "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
            "name": "my name"
        },
        ...
    ]
}
```

#### user.left
Recipients: all users connected to the socket
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

#### user.groups
Lists all group ids you are joined
```
```

Response
```json
{
    "status": 200, // 401 if not joined
    "message": [
        "7686d130-2223-4769-ab9f-5cebcf795e80",
        ...
    ]
}
```

## Groups

### Events
`id` in request/reponse events are group ids

#### group.create

Request
```json
{
    "name": "my group name", // min. 3 characters; max. 64 characters;
    "password": "secret" // min. 8 characters
}
```

Response
```json
{
    "status": 200, // 401 if not joined
    "message": {
        "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
        "name": "my group name",
        "userId": "7686d130-2223-4769-ab9f-5cebcf795e80",
        "poker": false
    }
}
```

#### group.created
Recipients: all connected users
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
    "name": "my group nyme",
    "userId": "7686d130-2223-4769-ab9f-5cebcf795e80",
    "poker": false
}
```

=== group.list
Lists all available groups

Request
```
```

Response
List of all available groups
```json
{
    "status": 200, // 401 if not joined
    "message": [
        {
            "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
            "name": "my group name",
            "userId": "7686d130-2223-4769-ab9f-5cebcf795e80",
            "poker": false
        },
        ...
    ]
}
```

#### group.users
Request user ids for given group
```
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

Response:
List of user ids
```json
{
    "status": 200, // 401 if not joined
    "message": [
        "7686d130-2223-4769-ab9f-5cebcf795e80",
        ...
    ]
}
```

#### group.join
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
    "password": "secret"
}
```

Response
```json
{
    "status": 200 // 400 if password is invalid; 401 if not joined; 404 if group does not exist; 500 if `id` or  `password` is not set
}
```

#### group.joined
Recipients: users in group
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
    "userId": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

#### group.poker.start
Request to start poker by group owner
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

Response
```json
{
    "status": 200 // 401 if not joined; 403 if not owner of the group; 404 if group not found; 500 if `id` not valid
}

#### group.poker.started
If poker has been started all bets in this group going to be deleted
Recipients: users in group
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

#### group.poker.bets
Lists current bets in this group. If group is in poker state, actual bet values are hidden 
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

Response
```json
{
    "status": 200, // 401 if not joined; 403 if not in group; 404 if group does not exists
    "message": [
        {
            "userId": "7686d130-2223-4769-ab9f-5cebcf795e80",
            "bet": 30 // optional
        },
        ...
    ]
}
```


#### group.poker.bet
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
    "bet": 13 // allowed values: 1, 2, 3, 5, 8, 13, 20, 30, 40, 100
}
```

Response
```json
{
    "status": 200 // 401 if not joined; 404 if not in group; 500 if `bet` not valid, `id` not valid or poker has not started yet
}
```

#### group.poker.betted
Recipients: users in group
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
    "userId": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

#### group.poker.end
Request to end current poker by group onwer
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80"
}
```

Response
```json
{
    "status": 200 // 401 if not joined; 403 if not owner of the group; 404 if group not found; 500 if `id` not valid
}
```

#### group.poker.ended
Recipients: users in group
```json
{
    "id": "7686d130-2223-4769-ab9f-5cebcf795e80",
    "bets": [
        {
            "userId": "7686d130-2223-4769-ab9f-5cebcf795e80",
            "bet": 13
        },
        ...
    ]
}
```

