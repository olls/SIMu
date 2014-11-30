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
var screen = {x: 1400, y: 800};

var p_width = 72/2;
var p_height = 52/2;
var player_x = (screen.x - p_width) / 2;
var player_y = screen.y - p_height - 10;
var p_speed = 10;

var inv_w = 110/4;
var inv_h = 80/4;
var inv_d = 1;
var inv_speed = 15;
var inv_ny = 8;
var inv_nx = 15;

var entities = {};

gen_invaders();

function gen_invaders () {
  for (var y = 0; y < inv_ny; y++) {
    for (var x = 0; x < inv_nx; x++) {
      var e_id = id++;
      entities[e_id] = {
        type: 'invader_' + (4 - (Math.floor(y/2)%4)),
        x: x * (inv_w+25) + (( screen.x - ((inv_w+25) * inv_nx) )/2),
        y: y * (inv_h+25) + 10
      };
    }
  }
}

function move_invaders () {
  // Find left-most and right-most invaders
  var left = {x: 10000};
  var right = {x: -10000};
  for (var id in entities) {
    if (entities[id].type.indexOf('invader') > -1) {
      if (entities[id].x < left.x) {
        left = entities[id];
      }
      if (entities[id].x > right.x) {
        right = entities[id];
      }
    }
  }

  // Move invaders
  var edge = false;
  if (right.x >= (screen.x - inv_w - 30)) {
    inv_d = -1;
    edge = true;
  } else if (left.x <= inv_w + 30) {
    inv_d = 1;
    edge = true;
  }

  var update = {};
  for (var id in entities) {
    if (entities[id].type.indexOf('invader') > -1) {
      entities[id].x += inv_d * inv_speed;
      if (edge) {
        entities[id].y += inv_speed;
      }
      update[id] = entities[id];
    }
  }
  io.sockets.emit('update', update);
}

setInterval(move_invaders, 500);

function collides (bid) {
  for (var id in entities) {
    // If id is a invader and it collides with bullet
    if ((entities[id].type.indexOf('invader') > -1) &&
        (entities[bid].x >= entities[id].x && entities[bid].x <= (entities[id].x + inv_w) &&
         entities[bid].y >= entities[id].y && entities[bid].y <= (entities[id].y + inv_h))) {
      return id;
    }
  }
  return false;
}

function player_collides (bid) {
  for (var id in entities) {
    // If id is a player and it collides with bullet
    if ((entities[id].type == 'player' && entities[id].alive) &&
        (entities[bid].x >= entities[id].x && entities[bid].x <= (entities[id].x + p_width) &&
         entities[bid].y >= entities[id].y && entities[bid].y <= (entities[id].y + p_height))) {
      return id;
    }
  }
  return false;
}

function get_score(inv_id) {
  // Get the score value for a invader
  return entities[inv_id].type.split('_')[1];
}

function invader_fire () {
  var keys = Object.keys(entities);
  var inv_id = keys[keys.length * Math.random() << 0];
  if (entities[inv_id].type.indexOf('invader') > -1) {
    var bid = id++;
    entities[bid] = {
      type: 'bullet_inv',
      x: entities[inv_id].x + (inv_w / 2),
      y: entities[inv_id].y
    };
    var b_ent = {};
    b_ent[bid] = entities[bid];
    io.sockets.emit('new', b_ent);

    update_bullet(bid, entities);
    function update_bullet (bid, entities) {
      if (entities[bid].y >= screen.y) {
        // Bullet gone off bottom of screen
        io.sockets.emit('delete', [bid, entities[bid]]);
        delete entities[bid];

      } else {
        var p_id = player_collides(bid);
        if (p_id) {
          // Bullet hit player
          io.sockets.emit('delete', [bid, entities[bid]]);
          delete entities[bid];
          io.sockets.emit('explode', [p_id, entities[p_id]]);

        } else {
          // Bullet keeps moving
          entities[bid].y += 20;
          var update = {};
          update[bid] = entities[bid];
          io.sockets.emit('update', update);
          setTimeout(function () {update_bullet(bid, entities)}, 100);
        }
      }
    }
  }
}

setInterval(invader_fire, 2000);

// Sockets
io.on('connection', function (socket) {
  socket.id = id++;
  socket.emit('id', socket.id);
  socket.score = 0;
  socket.broadcast.emit('score', [socket.id, socket.score]);
  socket.bullet = false;
  console.log('New Player:', socket.id);
  entities[socket.id] = {
    type: 'player',
    x: player_x,
    y: player_y,
    alive: false
  };
  // Pass all entities to new client
  socket.emit('new', entities);
  var p_ent = {};
  p_ent[socket.id] = entities[socket.id];
  socket.broadcast.emit('new', p_ent);

  socket.on('disconnect', function () {
    console.log('Player left:', socket.id);
    socket.broadcast.emit('delete', [socket.id, entities[socket.id]]);
    delete entities[socket.id];
  });

  socket.on('start', function () {
    entities[socket.id].alive = true;
  });

  socket.on('die', function () {
    socket.score = 0;
    socket.broadcast.emit('score', [socket.id, socket.score]);
    entities[socket.id].alive = false;
    entities[socket.id].x = player_x;
    entities[socket.id].y = player_y;
    var update = {};
    update[socket.id] = entities[socket.id];
    socket.broadcast.emit('update', update);
  });

  socket.on('move', function (dir) {
    if (!entities[socket.id].alive) {
      return;
    }
    if (dir == 'left' && entities[socket.id].x > p_speed) {
      entities[socket.id].x -= p_speed;
    } else if (dir == 'right' && entities[socket.id].x < (screen.x - p_speed - p_width)) {
      entities[socket.id].x += p_speed;
    }
    var update = {};
    update[socket.id] = entities[socket.id];
    socket.broadcast.emit('update', update);
  });

  socket.on('fire', function () {
    if (!entities[socket.id].alive || socket.bullet) {
      return;
    }
    var bid = id++;
    entities[bid] = {
      type: 'bullet',
      x: entities[socket.id].x + (p_width / 2),
      y: entities[socket.id].y
    };
    socket.bullet = true;
    var b_ent = {};
    b_ent[bid] = entities[bid];
    socket.broadcast.emit('new', b_ent);

    update_bullet(bid, socket, entities);
    function update_bullet (bid, socket, entities) {
      if (entities[bid].y <= 0) {
        // Bullet gone off top of screen
        socket.bullet = false;
        socket.broadcast.emit('delete', [bid, entities[bid]]);
        delete entities[bid];

      } else {
        var inv_id = collides(bid);
        if (inv_id) {

          // Bullet hit invader
          socket.bullet = false;

          socket.score += get_score(inv_id);
          console.log(socket.score);
          socket.broadcast.emit('score', [socket.id, socket.score]);

          socket.broadcast.emit('delete', [bid, entities[bid]]);
          delete entities[bid];
          socket.broadcast.emit('explode', [inv_id, entities[inv_id]]);
          socket.broadcast.emit('delete', [inv_id, entities[inv_id]]);
          delete entities[inv_id];

        } else {
          // Bullet keeps moving
          entities[bid].y -= 20;
          var update = {};
          update[bid] = entities[bid];
          socket.broadcast.emit('update', update);
          setTimeout(function () {update_bullet(bid, socket, entities)}, 100);
        }
      }
    };
  });
});

server.listen(port, function () {
  console.log('Running on port', port);
});
