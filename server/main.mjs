import {loadConfig} from './config.mjs';
import {createGameServer} from './transport.mjs';
const config=loadConfig();
const game=await createGameServer(config);
game.server.listen(config.port,config.host,()=>{console.log(`Lantern Wake listening on http://${config.host}:${game.server.address().port}`);console.log(`AI provider: ${config.ai.provider}. Credentials and private roles stay server-side.`);});
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;try{await game.close();process.exitCode=0;}catch{process.exitCode=1;}});
