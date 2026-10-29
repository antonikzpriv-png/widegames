import {loadConfig} from './config.mjs';
import {createGameServer} from './transport.mjs';
const config=loadConfig();
const game=await createGameServer(config);
game.server.listen(config.port,config.host,()=>{console.log(`Lantern Wake — open ${config.publicOrigin}`);console.log(`Listening on ${config.host}:${game.server.address().port}. AI provider: ${config.ai.provider}. Provider credentials stay server-side.`);});
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;try{await game.close();process.exitCode=0;}catch{process.exitCode=1;}});
