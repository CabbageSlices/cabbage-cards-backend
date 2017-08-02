const createUnityClient = require('./unity-client.js')
const createWebClient = require('./web-client.js')

var ClientManager = {
	unityClients: {}, //format roomCode: unity-client
	sockets: {}, //format socketId: socket, also appends a room code to the socket if applicable
}

ClientManager.checkValidRoomCode = function(roomCode) {
	return (roomCode in this.unityClients) 
}

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
	socket.on('messageToClient', (e) => that.onUnityMessageToClient(roomCode, e));
}

ClientManager.onUnityMessageToClient = function(roomCode, messageEventArgs) {
	const messageType = messageEventArgs.messageType
	let targets = messageEventArgs.messageTargets
	const target = messageEventArgs.messageTarget

	messageEventArgs.messageType = undefined
	messageEventArgs.messageTargets = undefined
	
	if(target !== undefined) {

		const socket = this.sockets[target]
		if(socket)
			socket.emit('message', Object.assign({ messageType }, messageEventArgs ))

		return
	}

	if(typeof targets === 'string') {
		targets = []

		for(var key in this.unityClients[roomCode].connectedWebClients)
			targets.push(this.unityClients[roomCode].connectedWebClients[key])

		console.log(targets)
	}

	for(let i = 0; i < targets.length; ++i) {
		const key = targets[i]
		const socket = this.sockets[key]

		if(socket)
			socket.emit('message', Object.assign({ messageType }, messageEventArgs))
	}
}

//roomCode: roomcode of the unity client that received this event
//acceptEventArgs: arguments sent by unity client
ClientManager.onUnityWebClientAccept = function(roomCode, acceptEventArgs) {
	console.log("client connected to unity room " + roomCode)
	const webClientSocket = this.sockets[acceptEventArgs.webClientSocketId]
	const unityClient = this.unityClients[roomCode]

	//console.log(acceptEventArgs)
	if(!webClientSocket) {
		const unitySocket = this.sockets[unityClient.socketId]
		unitySocket.emit('webClientDisconnect', { webClientSocketId: acceptEventArgs.webClientSocketId })
		return
	}

	unityClient.connectedWebClients[webClientSocket.id] = webClientSocket.id
	this.unityClients[roomCode] = unityClient

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

	//console.log('Web Client connected')

	socket.roomCode = e.roomCode
	this.sockets[socket.id] = socket
	this.setupWebEventListeners(socket)

	const connectionRequestArgs = {
		playerName: e.playerName,
		webClientSocketId: socket.id
	}

	const unitySocketId = this.unityClients[e.roomCode].socketId
	const unitySocket = this.sockets[unitySocketId]
	unitySocket.emit('connectToServer', connectionRequestArgs)
}

ClientManager.setupWebEventListeners = function(socket) {
	const that = this
	//console.log('setup web listeners')
	socket.on('disconnect', () => that.onWebDisconnect(socket) )
	socket.on('sendToUnity', (e) => that.onWebMessageToUnity(socket, e))
}

ClientManager.onWebMessageToUnity = function(socket, messageArgs) {

	const messageType = messageArgs.messageType
	if(!this.checkValidRoomCode(socket.roomCode)) {
		socket.emit('message', {messageType: `${messageType}/error`, message: 'Not connected to Server'})
		return
	}

	delete messageArgs.messageType

	const unity = this.unityClients[socket.roomCode]
	const unitySocket = this.sockets[unity.socketId]
	unitySocket.emit(messageType, messageArgs)
}

ClientManager.onWebDisconnect = function(socket) {

	//console.log('webClientDisconnect');
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