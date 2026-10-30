import {parseFeatures} from '../shared/features.mjs';
import path from 'node:path';
import {validatePublicOrigin} from './origin.mjs';
function integer(env,name,fallback,min,max){const raw=env[name];if(raw===undefined||raw==='')return fallback;const n=Number(raw);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${name} must be ${min}..${max}`);return n;}
export function loadConfig(env=process.env){
 if(env.GAME_ABILITIES!==undefined&&!['true','false'].includes(env.GAME_ABILITIES))throw new Error('GAME_ABILITIES must be true or false');
 const features=parseFeatures({deathPolicy:env.GAME_DEATH_POLICY||'transfer',abilities:env.GAME_ABILITIES==='true'});
 const provider=env.AI_PROVIDER||'demo';if(!['demo','anthropic'].includes(provider))throw new Error('AI_PROVIDER must be demo or anthropic');
 const strategy=env.AI_STRATEGY||'hybrid';if(!['hybrid','strategic'].includes(strategy))throw new Error('AI_STRATEGY must be hybrid or strategic');
 const cost=Number(env.MAX_AI_COST_USD||'0.50');if(!Number.isFinite(cost)||cost<0||cost>10)throw new Error('MAX_AI_COST_USD must be 0..10');
 const dailyCost=Number(env.MAX_DAILY_AI_COST_USD||'5');if(!Number.isFinite(dailyCost)||dailyCost<0||dailyCost>100)throw new Error('MAX_DAILY_AI_COST_USD must be 0..100');
 const port=integer(env,'PORT',3000,0,65535),host=env.HOST||'127.0.0.1';
 const publicOrigin=validatePublicOrigin(env.PUBLIC_ORIGIN===undefined||env.PUBLIC_ORIGIN===''?`http://localhost:${port}`:env.PUBLIC_ORIGIN);
 return {host,port,features,dataDir:path.resolve(env.DATA_DIR||'data'),publicOrigin,worldMode:true,maxActiveRooms:integer(env,'MAX_ACTIVE_ROOMS',12,1,100),roomTtlMs:3600000,maxBodyBytes:8192,tickMs:100,
 ai:{provider,strategy,apiKey:env.ANTHROPIC_API_KEY||'',model:env.ANTHROPIC_MODEL||'claude-haiku-4-5-20251001',maxCalls:integer(env,'MAX_AI_CALLS',48,0,500),maxTokens:integer(env,'MAX_AI_TOKENS',120000,0,250000),maxCostUsd:cost,maxDailyCostUsd:dailyCost,timeoutMs:10000,decisionIntervalMs:1800}};
}
