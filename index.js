var express = require('express');
var io = require('socket.io');
var path = require('path');
var app = express();

var id = 0;
var players = {};

app.get('/players', function (req, res) {
  res.send(players);
});

app.get('/new', function (req, res) {
  var player = {id: id++, x: 0, y: 0};
  players[player.id] = player;
  res.send(player);
});

app.get('/update/:id/:x/:y', function (req, res) {
  players[req.params.id].x = req.params.x;
  players[req.params.id].y = req.params.y;
  res.send();
});

app.use(express.static(path.join(__dirname, 'client')));

var port = 3000;
app.listen(port, function () {
  console.log('Running on port:', port);
});
