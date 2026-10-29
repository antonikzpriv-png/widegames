import {loadConfig} from './config.mjs';
import {createGameServer} from './transport.mjs';
const config=loadConfig();
const game=await createGameServer(config);
game.server.once('error',async error=>{console.error(error.code==='EADDRINUSE'?`Port ${config.port} is already in use. Stop the earlier npm start terminal with Ctrl+C, or configure PORT and PUBLIC_ORIGIN together.`:'The beacon could not start listening.');try{await game.close();}finally{process.exitCode=1;}});
game.server.listen(config.port,config.host,()=>{console.log(`Lantern Wake — open ${config.publicOrigin}`);console.log(`Listening on ${config.host}:${game.server.address().port}. AI provider: ${config.ai.provider}. Provider credentials stay server-side.`);});
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;try{await game.close();process.exitCode=0;}catch{process.exitCode=1;}});
