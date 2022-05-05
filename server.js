// Main

// variables

const express = require('express');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const urlencodedParser = bodyParser.urlencoded({ extended: false });
const app = express();
app.use(express.static(__dirname + '/public'));
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

//ressources

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/tree_matter_engine.html');
});

server.listen(80, function() {
  console.log('listening on *:80');
});