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
*/


class pool {
    constructor(poolId, name) {
        this.poolName = name;
        this.poolId = poolId;
        this.dataMap = [{ 'defaultKey': "3.141516" }];
    }
}

const MAX_CLIENTS = 128;
var poolsInstances = { pools: [new pool(-1, "DEFAULT_MATCH")] }; //HAS A DEFAULT INSTANCE FOR BROADCAST MESSAGES
var connectedClients = [];
var serverCommands = [];
var commandQueue = []; // {COMMAND_HEADER,CLIENT} CONTINUAR AQUI!!!
var serverTicks = 0;
var udpServer = null;

function executeCommand(command) {
    try {
        let command = JSON.parse(command);
        let cmd = serverCommands[command.header];
        if (!!cmd) {
            console.log(cmd);
            let args = JSON.parse(command.payload);
            cmd.execute(args);
        }
    } catch (error) {
        console.log("CORRUPT DATA FORMAT RECIVED; LOG:", error);
    }
}


//ocket.send(msg: string | any[] | Uint8Array, port?: number, address?: string, callback?: (error: Error, bytes: number) => void): void (+5 overloads)

function dispatchDataToClients() {
    //Dispatch all the commands in the queue
    let peek = commandQueue.pop();
    connectedClients.forEach(client => {
        var dataToSend = new Buffer(JSON.stringify(peek), 'utf8');
        udpServer.send(dataToSend, client.port, client.ipAddress, (err, number) => {
            console.log(err);
            console.log(number);
        })
    });
}

function startDispatching() {
    //SEND DATA TO SUBSCRIBED USERS
    setInterval(() => {
        //send pendient data
        dispatchDataToClients();
        serverTicks++;
        console.log(" tick " + serverTicks);
    }, 200);
}

//COMMANDS DEFINITIONS
function addClient(args) {
    if (connectedClients.length < MAX_CLIENTS) {
        connectedClients.push(args);
    }
}

function removeClient(args) {
    connectedClients = connectedClients.filter((e) => {
        return e.hostName != client.hostName;
    })
}


function startPool(args) {
    if (!!args.poolName && args.poolName.trim() == "")
        return;

    let poolId = poolsInstances.pools.length + 1;
    poolsInstances.pools.push(new pool(poolId, args.poolName));
}

function endPool(args) {
    if (!!args.poolId && args.poolId == -1)
        return;

    poolsInstances = poolsInstances.filter((e) => {
        return e.poolId != args.polId;
    })
}

function upsertProperty(args) {
    try {
        poolsInstances.pools[args.poolId].dataMap[args.propertyName] = args.propertyValue
    } catch (error) {
        console.log("error upserting:", args);
    }
}

function removeProperty(args) {

}

function spawnObject(args) {

}

function getActivePools(args) {
    let pools = JSON.stringify(poolsInstances);
    commandQueue.push({ header: 'GET_POOLS', payload: pools });
}


function initialize(server) {
    udpServer = server;
    serverCommands.push({ header: "SUBSCRIBE", command: addClient });
    serverCommands.push({ header: "UNSUBSCRIBE", command: removeClient });
    serverCommands.push({ header: "START_POOL", command: startPool });
    serverCommands.push({ header: "END_POOL", command: endPool });
    serverCommands.push({ header: "UPSERT", command: upsertProperty });
    serverCommands.push({ header: "REMOVE", command: removeProperty });
    serverCommands.push({ header: "SPAWN", command: spawnObject });
    serverCommands.push({ header: "GET_ACTIVE_POOLS", command: getActivePools });
    startDispatching();
}

module.exports.executeCommand = executeCommand;
module.exports.initialize = initialize;

