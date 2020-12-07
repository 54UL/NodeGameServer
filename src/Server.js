const dgram = require('dgram');
const server = dgram.createSocket('udp4');
const netServer = require('./NetServer');
const { env } = require('process');
const SERVER_PORT = 8090
const SERVER_ADDRESS = "192.168.0.104";

server.on('error', (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
});

server.on('message', (msg, rinfo) => {
    netServer.executeCommand(msg.toString(), rinfo);
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
    netServer.initialize(server);
});

server.bind({
    address: SERVER_ADDRESS,
    // port: process.env.port,
    port: "5140",
    exclusive: true
});