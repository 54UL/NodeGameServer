/* 
    //NET SERVER SPEC DRAFT 1.0 (NO SECURITY FEATURES)

    ----PROTOCOL:
    COMMAND_HEADER {header,payload}

    ----SERVER COMMANDS:
    --SERVER CONTROL COMMANDS:
        SUBSCRIBE {PlayerName,HostName,IpAddress,port};
        UNSUBSCRIBE {POOL_ID}
        START_POOL {DATA}
        END_POOL {DATA}
    --DATA STREAMING/BROADCASTING COMMANDS (both sides commands):
        UPSERT {PROPERTY_ID,{value}}; RESPONSE TO CLIENT: {propertyName, newValue}
        REMOVE   {PROPERTY_ID}; RESPONSE TO CLIENT : {propertyName}   
        SPAWN {PREFAB_NAME,TRANSFORM{VECTOR3,QUATERNION}}; RESPONSE TO CLIENT :{propertyName}
    --REQUEST COMMANDS 
        GET_ACTIVE_POOLS; RESPONSE TO CLIENT : {pools[]}  
*/

const MAX_CLIENTS = 128;
var poolObject = { keys: [], values: [] };
var poolsInstances = { pools: [{ poolId: 0, pool: Object.assign(pool, poolObject) }] }; //HAS A DEFAULT INSTANCE FOR BROADCAST MESSAGES
var connectedClients = [];
var serverCommands = [];
var commandQueue = []; // {COMMAND_HEADER,CLIENT} CONTINUAR AQUI!!!

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

function dispatchDataToClients() {
    //Dispatch all the commands in the queue
    
}

function tickExecution() {
    //SEND DATA TO SUBSCRIBED USERS
    setInterval(() => {
        //send pendient data
        dispatchDataToClients();
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

}

function endPool(args) {

}

function upsertProperty(args)
{

}

function removeProperty(args)
{

}

function spawnObject(args)
{

}

function getActivePools(args) {

}


function initialize() {
    serverCommands.push({ header: "SUBSCRIBE", command: addClient });
    serverCommands.push({ header: "UNSUBSCRIBE", command: removeClient });
    serverCommands.push({ header: "START_POOL", command: startPool });
    serverCommands.push({ header: "END_POOL", command: endPool });
    serverCommands.push({ header: "UPSERT", command: upsertProperty });
    serverCommands.push({ header: "REMOVE", command: removeProperty });
    serverCommands.push({ header: "SPAWN", command: spawnObject });
    serverCommands.push({ header: "GET_ACTIVE_POOLS", command: getActivePools });
}

module.exports.executeCommand = executeCommand;
