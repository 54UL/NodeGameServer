/* 
    PROTOCOL:
    COMMAND_HEADER {header,argCount} |****| ARG {DATA..} |****| RESPONSE {status}
    
    COMANDOS
    SERVIDOR:
    SUBSCRIBE {USERTOKEN}
    UNSUBSCRIBE {USERTOKEN}
    SEND_TO_POOL {DATA},POOL_ID
    START_POOL {DATA}
    REMOVE_POOL {DATA}
    GET_LOOBY

    CLIENTE:
    UPDATE {PROPERTY_ID,{value}}
    REMOVED_FROM_POOL {MSG}
    REMOVE   {PROPERTY_ID}
    SPAWN {PROPERTY_NAME}
*/




const MAX_CLIENTS = 128;
var poolObject = { keys: [], values: [] };
var poolsInstances = { pools: [{ poolId: 0, pool: Object.assign(pool,poolObject )}] }; //HAS A DEFAULT INSTANCE FOR BROADCAST MESSAGES
var connectedClients = [];
var serverCommands = [];



//SYSTEM CALLS

function executeCommand(command) {
    let cmd = serverCommands[command.header];
    if (!!cmd) {
        console.log(cmd);
        cmd.execute();
    }
}


function dispatchDataToClients()
{
    
}

function tickExecution() {
    //SEND DATA TO SUBSCRIBED USERS
    setInterval(() => {
        //send pendient data
        dispatchDataToClients();
    }, 200);
}

//COMMANDS DEFINITIONS
function addClient(client) {
    if (connectedClients.length < MAX_CLIENTS) {
        connectedClients.push(client);
    }
}

function removeClient(client) {
    connectedClients = connectedClients.filter((e) => {
        return e.hostName != client.hostName;
    })
}

function startPool()
{

}


function initialize() {
    serverCommands.push({ header: "SUBSCRIBE", command: addClient });
    serverCommands.push({ header: "UNSUBSCRIBE", command: removeClient });
}

module.exports.executeCommand = executeCommand;
