const createUnityClient = require('./unity-client.js')
const createWebClient = require('./web-client.js')

var ClientManager = {
	unityClients: {}, //format roomCode: unity-client
	sockets: {}, //format socketId: socket
}

ClientManager.checkValidRoomCode = function(roomCode) {
	return (roomCode in this.unityClients) 
}

ClientManager.onUnityConnected = function(socket) {
	console.log('Unity Client connected')

	this.sockets[socket.id] = socket

	//random 5 digit room code econsisting of letters and numbers
	const roomCode = (Math.random() + 1).toString(36).substr(2, 5)
	socket.emit('generateRoomCode', {roomCode})

	this.unityClients[roomCode] = createUnityClient(socket.id)
	
	this.setupUnityEventListeners(roomCode)
}

ClientManager.onUnityDisconnect = function(roomCode) {
	//unity room with given room code doesn't exist, ignore it
	if(!this.checkValidRoomCode(roomCode))
		return;

	var client = this.unityClients[roomCode]

	//disconnect all web clients
	for(var webClientKey in client.connectedWebClients) {
		var socketId = client.connectedWebClients[webClientKey];
		const socket = this.sockets[socketId]
		socket.emit('unityDisconnected');
		socket.disconnect(true);
	}

	//erase room
	delete this.unityClients[roomCode]
}

ClientManager.setupUnityEventListeners = function(roomCode) {
	const that = this
	const socketId = this.unityClients[roomCode].socketId
	var socket = this.sockets[socketId]
	socket.on('disconnect', () => that.onUnityDisconnect(roomCode))
	socket.on('webClientConnectionRequest/accept', (e) => this.onUnityWebClientAccept(roomCode, e) );
	socket.on('webClientConnectionRequest/reject', (e) => this.onUnityWebClientReject(roomCode, e) );
}

//roomCode: roomcode of the unity client that received this event
//acceptEventArgs: arguments sent by unity client
ClientManager.onUnityWebClientAccept = function(roomCode, acceptEventArgs) {
	console.log("client connected to unity room " + roomCode)
	const webClientSocket = this.sockets[acceptEventArgs.webClientSocketId]
	const unityClient = this.unityClients[roomCode]

	unityClient[acceptEventArgs.playerId] = webClientSocket.id

	webClientSocket.emit('webClientConnectionRequest/accept', acceptEventArgs)
}

//callback for when a web client connects to the backend
ClientManager.onWebConnected = function(socket, e) {

	if(!this.checkValidRoomCode(e.roomCode)) {
		socket.emit('invalidRoomCode');
		socket.disconnect(true);
		return;
	}

	console.log('Web Client connected')

	this.sockets[socket.id] = socket

	const connectionRequestArgs = {
		playerName: e.name,
		socketId: socket.id
	}

	const unitySocketId = this.unityClients[e.roomCode].socketId
	const unitySocket = this.sockets[unitySocketId]
	unitySocket.emit('webClientConnectionRequest', connectionRequestArgs)
	this.onUnityWebClientAccept(e.roomCode, { playerId: 1, webClientSocketId: socket.id})
}

module.exports = ClientManager