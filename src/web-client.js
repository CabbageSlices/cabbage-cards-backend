const WebClient = {
	socketId: null, //Id of underlying socket used for the connection
	roomCode: null //room code of the unity host that this web client is  connected to
}

const createWebClient = (socketId, roomCode) => {
	var webClient = Object.create(WebClient)
	webClient.socketId = socketId
	webClient.roomCode = roomCode
	return webClient
}

module.exports = createWebClient