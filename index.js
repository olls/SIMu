var express = require('express');
var path = require('path');
var app = express();

//app.get('players', function (req, res) {

//});

app.use(express.static(path.join(__dirname, 'client')));
app.listen(3000);
