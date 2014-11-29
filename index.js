var express = require('express');
var http = require('http');
var socketio = require('socket.io');
var path = require('path');

// Server Setup
var port = 3000;
var app = express();
var server = http.Server(app);
var io = socketio(server);

app.use(express.static(path.join(__dirname, 'client')));

// Game Setup
var id = 0;
var screen = {x: 1000, y:800};
var player_x = (screen.x - 73) / 2;
var player_y = screen.y - 52;
var entities = {};

// Sockets
io.on('connection', function (socket) {
  socket.id = id++;
  entities[socket.id] = {
    type: 'player',
    x: player_x,
    y: player_y
  };
  socket.broadcast.emit('new', [socket.id, entities[socket.id]]);

  socket.on('move', function (dir) {
    if (dir == 'left') {
      entities[socket.id].x -= p_speed;
    } else if (dir == 'right') {
      entities[socket.id].x += p_speed;
    }
    socket.broadcast.emit('update', [socket.id, entities[socket.id]]);
  });

  socket.on('fire', function (data) {
    var bid = id++;
    entities[bid] = {
      type: 'bullet',
      x: entities[socket.id].x,
      y: entities[socket.id].y
    };
    socket.broadcast.emit('new', [bid, entities[bid]]);

    update_bullet(bid, socket, entities);
    function update_bullet (bid, socket, entities) {
      if (entities[bid].y > 0) {
        entities[bid].y -= 20;
        socket.broadcast.emit('update', [bid, entities[bid]]);
        setTimeout(function () {update_bullet(bid, socket, entities)}, 200);
      } else {
        socket.broadcast.emit('delete', [bid, entities[bid]]);
        delete entities[bid];
      }
    };
  });

});

server.listen(port, function () {
  console.log('Running on port', port);
});
