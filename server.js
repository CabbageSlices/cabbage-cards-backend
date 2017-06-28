'use strict';

const ClientManager = require('./src/client-manager.js');
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');

const PORT = process.env.PORT || 3000;
const INDEX = path.join(__dirname, 'index.html');

const server = express()
  .use((req, res) => res.sendFile(INDEX) )
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));

const io = socketIO(server);

io.on('connection', (socket) => {
  console.log(`client connected`);
  socket.on('unityClient', () => ClientManager.onUnityConnected(socket) )
  socket.on('webClient', (e) => ClientManager.onWebConnected(socket, e))
  socket.on('disconnect', () => console.log('Client disconnected'));
  socket.on('error', (e) => console.log("sumthin"));
  socket.on('test', () => console.log('test'));
});