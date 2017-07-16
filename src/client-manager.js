const createUnityClient = require('./unity-client.js')
const createWebClient = require('./web-client.js')

var ClientManager = {
	unityClients: {}, //format roomCode: unity-client
	sockets: {}, //format socketId: socket, also appends a room code to the socket if applicable
}

ClientManager.checkValidRoomCode = function(roomCode) {
	return (roomCode in this.unityClients) 
}

// ClientManager.onDisconnect = function(socket) {
// 	if(!(socket.id in this.sockets))
// 		return //nothing ot handle since we aren't keeping track of it

// 	const storedSocket = this.sockets[socket.id]
	
// 	if(storedSocket.connectionType === 'web') { 
// 		//web client
// 		this.onWebDisconnect();
// 		return
// 	}

// 	this.onUnityDisconnect(socket)
// }


ClientManager.onUnityConnected = function(socket) {
	console.log('Unity Client connected')

	socket.connectionType = 'unity'
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
	console.log("Unity disconnected")
}

ClientManager.setupUnityEventListeners = function(roomCode) {
	const that = this
	const socketId = this.unityClients[roomCode].socketId
	var socket = this.sockets[socketId]
	socket.on('disconnect', () => that.onUnityDisconnect(roomCode))
	socket.on('connectToServer/accept', (e) => that.onUnityWebClientAccept(roomCode, e) );
	socket.on('connectToServer/reject', (e) => that.onUnityWebClientReject(roomCode, e) );
}

//roomCode: roomcode of the unity client that received this event
//acceptEventArgs: arguments sent by unity client
ClientManager.onUnityWebClientAccept = function(roomCode, acceptEventArgs) {
	console.log("client connected to unity room " + roomCode)
	const webClientSocket = this.sockets[acceptEventArgs.webClientSocketId]
	const unityClient = this.unityClients[roomCode]

	if(!webClientSocket) {
		const unitySocket = this.sockets[unityClient.socketId]
		unitySocket.emit('webClientDisconnect', { webClientSocketId: acceptEventArgs.webClientSocketId })
		return
	}

	unityClient.connectedWebClients[acceptEventArgs.playerId] = webClientSocket.id

	const messageData = Object.assign({messageType: 'connectToServer/accept'}, acceptEventArgs)
	webClientSocket.emit('message', messageData)
}

ClientManager.onUnityWebClientReject = function(roomCode, rejectEventArgs) {
	const webClientSocket = this.sockets[rejectEventArgs.webClientSocketId]
	const unityClient = this.unityClients[roomCode]

	delete this.sockets[rejectEventArgs.webClientSocketId]

	const messageData = Object.assign({messageType: 'connectToServer/reject'}, rejectEventArgs)
	webClientSocket.emit('message', messageData)
}

//callback for when a web client connects to the backend
ClientManager.onWebConnected = function(socket, e) {
	if(!this.checkValidRoomCode(e.roomCode)) {
		socket.emit('message',  
			{messageType: 'connectToServer/reject', message: 'invalid room code' });
		socket.disconnect(true);
		return;
	}

	console.log('Web Client connected')

	socket.roomCode = e.roomCode
	this.sockets[socket.id] = socket
	this.setupWebEventListeners(socket)

	const connectionRequestArgs = {
		playerName: e.name,
		socketId: socket.id
	}

	const unitySocketId = this.unityClients[e.roomCode].socketId
	const unitySocket = this.sockets[unitySocketId]
	unitySocket.emit('connectToServer', connectionRequestArgs)
}

ClientManager.setupWebEventListeners = function(socket) {
	const that = this
	socket.on('disconnect', () => that.onWebDisconnect(socket))
}

ClientManager.onWebDisconnect = function(socket) {

	//let unity know the client has disconnected
	if(this.checkValidRoomCode(socket.roomCode)) {
		const unity = this.unityClients[socket.roomCode]
		const unitySocket = this.sockets[unity.socketId]
		unitySocket.emit('webClientDisconnect', { webClientSocketId: socket.id })
	}

	//remove from list of sockets
	delete this.sockets['socket.id']
}

module.exports = ClientManager