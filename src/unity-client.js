const UnityClient = {
	socketId: null, //id of underlying socket used for the connection
	connectedWebClients: {} //all clients connected to this unity host, each entry is playerId: socketId, map the playerId given by unity to a socket Id
}

const createUnityClient = socketId => {
	var client = Object.create(UnityClient)
	client.socketId = socketId
	return client
}

module.exports = createUnityClient