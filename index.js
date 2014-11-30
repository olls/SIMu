var express = require('express');
var http = require('http');
var socketio = require('socket.io');
var path = require('path');

// Server Setup
var port = 6005;
var app = express();
var server = http.Server(app);
var io = socketio(server);

app.use(express.static(path.join(__dirname, 'client')));

// Game Setup
var id = 0;
var screen = {x: 1000, y:800};
var p_width = 72;
var p_height = 52;
var player_x = (screen.x - p_width) / 2;
var player_y = screen.y - p_height;
var p_speed = 10;
var entities = {};

// Sockets
io.on('connection', function (socket) {
  socket.id = id++;
  console.log('New Player:', socket.id);
  entities[socket.id] = {
    type: 'player',
    x: player_x,
    y: player_y
  };
  // Pass all entities to new client
  socket.broadcast.emit('new', entities);

  socket.on('leave', function () {
    console.log('Player left:', socket.id);
    socket.emit('delete', [socket.id, entities[socket.id]]);
    delete entities[socket.id];
  });

  socket.on('move', function (dir) {
    if (dir == 'left') {
      entities[socket.id].x -= p_speed;
    } else if (dir == 'right') {
      entities[socket.id].x += p_speed;
    }
    socket.broadcast.emit('update', [socket.id, entities[socket.id]]);
  });

  socket.on('fire', function () {
    var bid = id++;
    entities[bid] = {
      type: 'bullet',
      x: entities[socket.id].x + (p_width / 2),
      y: entities[socket.id].y
    };
    socket.broadcast.emit('new', {bid: entities[bid]});

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
