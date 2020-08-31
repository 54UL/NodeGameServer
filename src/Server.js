const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const netServer = require('./netServer');
const SERVER_PORT = 80

server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});

server.on('message', (msg, rinfo) => {
    netServer.executeCommand(msg.toString(),rinfo);
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
    netServer.initialize(server);
});
server.bind(SERVER_PORT);