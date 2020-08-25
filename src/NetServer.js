/* 
    //NET SERVER SPEC DRAFT 1.0 (NO SECURITY FEATURES)
    ----PROTOCOL:
    COMMAND_HEADER {header,payload}

    ----SERVER COMMANDS:
    --SERVER CONTROL COMMANDS:
        SUBSCRIBE {PlayerName,HostName,IpAddress,port};
        UNSUBSCRIBE {POOL_ID}
        START_POOL {DATA}
        END_POOL {DATA}; RESPONSE TO CLIENTS: "STATUS:POOL ENEDED"
    --DATA STREAMING/BROADCASTING COMMANDS (both sides commands):
        UPSERT {PROPERTY_ID,{value}}; RESPONSE TO CLIENT: {propertyName, newValue}
        REMOVE   {PROPERTY_ID}; RESPONSE TO CLIENT : {propertyName}   
        SPAWN {PREFAB_NAME,TRANSFORM{VECTOR3,QUATERNION}}; RESPONSE TO CLIENT :{propertyName}
    --REQUEST COMMANDS 
        GET_ACTIVE_POOLS; RESPONSE TO CLIENT : {pools[]}  

        ACKNOLEDGE RESPONSE FOT BOTH SIDES...
*/

const MAX_CLIENTS = 128; // max number of upd conections
const DISPATCH_INTERVAL = 16; // dispatching delay(each N ms sends commands to clients) 

class pool {
    constructor(poolId, name) {
        this.poolName = name;
        this.poolId = poolId;
        this.dataMap = new Map();
    }
}

//MEMBERS
var poolsInstances = new Map()
var connectedClients = [];
var serverCommands = [];
var commandQueue = [];
var serverTicks = 0;
var udpServer = null;
var clientIdIndex = 64;

function executeCommand(command, endpoint) {
    try {
        let args = null;
        let incomingCommand = JSON.parse(command);
        let cmd = serverCommands.find((e) => {
            return incomingCommand.header == e.header;
        })
        if (!!cmd) {
            if (incomingCommand.payload != '') {
                args = JSON.parse(incomingCommand.payload);
            }
            else
                args = {};

            args['clientInfo'] = endpoint;
            cmd.evalute(args);
            if (cmd.header != "UPSERT") {
                console.log("SERVER COMMAND::::" + command);
            }
        }
    } catch (error) {
        console.log("ERROR EXECUTING COMMAND:", error);
    }
}

//Header, Payload, Owner, Broadcast
function pushCommand(command) {
    let jsonData = JSON.stringify(command.Payload);
    let commandObj = { header: command.Header, payload: jsonData, owner: command.Owner, broadcast: command.Broadcast };
    commandQueue.push(commandObj);
}


//si es broadcast, evitar que se envie el valor al dueño de la peticion, si no es broadcast mandar unicamente al dueño (para respuestas directas)
function shouldSendData(command, client) {
    if (command.broadcast)
        return client.clientInfo.address != command.owner.address || client.clientInfo.port != command.owner.port
    else
        return client.clientInfo.address == command.owner.address && client.clientInfo.port == command.owner.port
}

//socket.send(msg: string | any[] | Uint8Array, port?: number, address?: string, callback?: (error: Error, bytes: number) => void): void (+5 overloads
function dispatchDataToClients() {
    //Dispatch all the commands in the queue
    let commandQueueCopy = [...commandQueue];
    connectedClients.forEach(client => {
        let peek = commandQueueCopy.pop();
        if (peek != undefined && shouldSendData(peek, client)) {
            peek = { header: peek.header, payload: peek.payload };
            var dataToSend = new Buffer(JSON.stringify(peek), 'utf8');
            udpServer.send(dataToSend, client.Port, client.clientInfo.address, (err, number) => {
                if (peek.header != "UPPSERT")
                    console.log("SERVER REPLY:::" + JSON.stringify(peek), "packet size: " + number);
            })
        }
    });
    commandQueue.pop();
}

function debugInfo() {
    serverTicks++;
    console.log(" tick " + serverTicks);
}

function startDispatching() {
    setInterval(() => {
        //send pendient data
        if (commandQueue.length > 0 && connectedClients.length > 0) {
            dispatchDataToClients();
        }
        //debugInfo();
    }, DISPATCH_INTERVAL);
}

//COMMANDS DEFINITIONS
function addClient(args) {
    // var exists = connectedClients.find((e) => {
    //     return e.ipAddress == args.ipAddress
    // });
    if (args.IpAddress == "")
        return;
    args.IpAddress = args.clientInfo.address;

    if (connectedClients.length < MAX_CLIENTS) {
        args['userId'] = clientIdIndex++;
        connectedClients.push(args);

        var clientInfoArgs = { ClientId: args['userId'], AccesToken: "NULL" }
        let commandArg = {
            Header: "CLIENT_INFO",
            Payload: clientInfoArgs,
            Owner: args.clientInfo,
            Broadcast: false
        }
        pushCommand(commandArg);
        console.log("client connected (" + args.IpAddress + ")");
    }
}

function removeClient(args) {
    if (args.IpAddress.trim() == "" && args.HostName.trim() == "")
        return;

    connectedClients = connectedClients.filter((e) => {
        return e.IpAddress != args.IpAddress;
    })
}

function startPool(args) {
    if (args.PoolName.trim() == "")
        return;

    let poolId = poolsInstances.size + 1;
    poolsInstances.set(poolId, new pool(poolId, args.PoolName));
}

function endPool(args) {
    if (args.PoolId == -1)
        return;

    poolsInstances.delete(args.PoolId);
}

var testDataMap = new Map();
function upsertProperty(args) {
    try {
        let dataMap = testDataMap;
        dataMap.set(args.Key, args.Value);
        let sanitizedDataMap = [];
        dataMap.forEach((val, key) => {
            sanitizedDataMap.push({ Key: key, Value: val.poolName })
        });
        let commandArg = {
            Header: "UPPSERT",
            Payload: sanitizedDataMap,
            Owner: args.clientInfo,
            Broadcast: true
        }
        pushCommand(commandArg);
    } catch (error) {
        console.log("error upserting:", args);
    }
}

function removeProperty(args) {

}

function spawnObject(args) {
    if (args.PrefabName.trim() == "")
        return;
    let spawnArgs = { PrefabName: args.PrefabName, PlayerId: args.PlayerId };
    let commandArg = {
        Header: "SPAWN",
        Payload: spawnArgs,
        Owner: args.clientInfo,
        Broadcast: true
    }
    pushCommand(commandArg);
}

function getActivePools(args) {
    let sanitizedPools = [];
    poolsInstances.forEach((val, key) => {
        sanitizedPools.push({ PoolId: key, PoolName: val.poolName })
    });
    let commandArg = {
        Header: "GET_POOLS",
        Payload: { pools: sanitizedPools },
        Owner: args.clientInfo,
        Broadcast: false
    }
    pushCommand(commandArg);
}


function initialize(server) {
    udpServer = server;
    serverCommands.push({ header: "SUBSCRIBE", evalute: addClient });
    serverCommands.push({ header: "UNSUBSCRIBE", evalute: removeClient });
    serverCommands.push({ header: "START_POOL", evalute: startPool });
    serverCommands.push({ header: "END_POOL", evalute: endPool });
    serverCommands.push({ header: "UPSERT", evalute: upsertProperty });
    serverCommands.push({ header: "REMOVE", evalute: removeProperty });
    serverCommands.push({ header: "SPAWN", evalute: spawnObject });
    serverCommands.push({ header: "GET_ACTIVE_POOLS", evalute: getActivePools });
    startDispatching();
    startPool({ PoolName: "DEFAULT POOL" })
}

module.exports.executeCommand = executeCommand;
module.exports.initialize = initialize;

