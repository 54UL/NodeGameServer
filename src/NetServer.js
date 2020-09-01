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
const DISPATCH_INTERVAL = 0; // dispatching delay(each N ms sends commands to clients) 
const NS_PER_MS = 1e6;
var beginUpsertPropertyTime = null;

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

function getCommandInfo(clientId) {
    if (connectedClients != undefined) {
        let commandOwner = connectedClients.find((e) => {
            return e.userId == clientId;
        });
        return commandOwner;
    }
    else
        return null;
}

function executeCommand(command, endpoint) {
    let args = null;
    let commandInfo = null;
    try {
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

            commandInfo = getCommandInfo(incomingCommand.clientId);
            if (commandInfo != null)
                args['clientInfo'] = commandInfo;

            cmd.evalute(args);
            if (cmd.header != "UPSERT") {
                console.log("SERVER COMMAND::::" + command);
            }
        }
    } catch (error) {
        console.log("ERROR EXECUTING COMMAND:", error);
    }
}

function pushCommand(command) {
    let jsonData = JSON.stringify(command.Payload);
    let commandObj = {
        header: command.Header,
        payload: jsonData,
        owner: command.owner,
        broadcast: command.Broadcast
    };
    commandQueue.push(commandObj);
    if (connectedClients.length > 0) {
        dispatchDataToClients();
    }
}

//si es broadcast, evitar que se envie el valor al dueño de la peticion, si no es broadcast mandar unicamente al dueño (para respuestas directas)
function shouldSendData(command, client) {
    if (command.broadcast)
        return command.owner.userId != client.userId;
    else
        return command.owner.userId == client.userId;
}

function dispatchDataToClients() {
    //Dispatch all the commands in the queue
    connectedClients.forEach(client => {
        let commandQueueCopy = [...commandQueue];
        let peek = commandQueueCopy.pop();
        if (peek != undefined && shouldSendData(peek, client)) {
            peek = { header: peek.header, payload: peek.payload };// sanitization of the data
            var dataToSend = new Buffer(JSON.stringify(peek), 'utf8');
            udpServer.send(dataToSend, client.Port, client.IpAddress, (err, number) => {
                if (peek.header != "UPPSERT") {
                    console.log("SERVER REPLY:::" + JSON.stringify(peek), "packet size: " + number);
                }
                else {
                    var end = process.hrtime(beginUpsertPropertyTime);
                    console.log("[UPPSERT TIME :" + end[1] / NS_PER_MS + "ms  ]")
                }
            })
        }
    });
    commandQueue.pop();
}

function debugInfo() {
    serverTicks++;
    console.log(" tick " + serverTicks);
}


//COMMANDS DEFINITIONS
function addClient(args) {
    if (args.IpAddress == "")
        return;

    if (connectedClients.length < MAX_CLIENTS) {
        args['userId'] = clientIdIndex++;
        connectedClients.push(args);
        var clientInfoArgs = { ClientId: args['userId'], AccesToken: "NULL" }

        let commandArg = {
            Header: "CLIENT_INFO",
            Payload: clientInfoArgs,
            owner: args,
            Broadcast: false
        }

        pushCommand(commandArg);
        console.log("client connected " + args.IpAddress + " port: " + args.Port);
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
        beginUpsertPropertyTime = process.hrtime();
        let dataMap = testDataMap;
        dataMap.set(args.Key, args.Value);
        let UppsertArgs = { Key: args.Key, Value: args.Value };
        let commandArg = {
            Header: "UPPSERT",
            Payload: UppsertArgs,
            owner: args.clientInfo,
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
        owner: args.clientInfo,
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
        owner: args.clientInfo,
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
    startPool({ PoolName: "DEFAULT POOL" })
    //startDispatching();
    console.log("server initialized...");
}

module.exports.executeCommand = executeCommand;
module.exports.initialize = initialize;

