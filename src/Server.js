const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const netServer = require('./NetServer');
const SERVER_PORT = 8090

server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});

server.on('message', (msg, rinfo) => {
    // console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
    netServer.executeCommand(msg.toString());
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
    netServer.initialize(server);
});
server.bind(SERVER_PORT);