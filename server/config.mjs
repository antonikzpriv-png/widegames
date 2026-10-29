import path from 'node:path';
function integer(env,name,fallback,min,max){const raw=env[name];if(raw===undefined||raw==='')return fallback;const n=Number(raw);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${name} must be ${min}..${max}`);return n;}
export function loadConfig(env=process.env){
 const provider=env.AI_PROVIDER||'demo';if(!['demo','anthropic'].includes(provider))throw new Error('AI_PROVIDER must be demo or anthropic');
 const cost=Number(env.MAX_AI_COST_USD||'0.50');if(!Number.isFinite(cost)||cost<0||cost>10)throw new Error('MAX_AI_COST_USD must be 0..10');
 const dailyCost=Number(env.MAX_DAILY_AI_COST_USD||'5');if(!Number.isFinite(dailyCost)||dailyCost<0||dailyCost>100)throw new Error('MAX_DAILY_AI_COST_USD must be 0..100');
 const port=integer(env,'PORT',3000,0,65535),host=env.HOST||'127.0.0.1';
 return {host,port,dataDir:path.resolve(env.DATA_DIR||'data'),publicOrigin:env.PUBLIC_ORIGIN||`http://localhost:${port}`,maxActiveRooms:integer(env,'MAX_ACTIVE_ROOMS',12,1,100),roomTtlMs:3600000,maxBodyBytes:8192,tickMs:500,
 ai:{provider,apiKey:env.ANTHROPIC_API_KEY||'',model:env.ANTHROPIC_MODEL||'claude-haiku-4-5-20251001',maxCalls:integer(env,'MAX_AI_CALLS',48,0,500),maxTokens:integer(env,'MAX_AI_TOKENS',24000,0,250000),maxCostUsd:cost,maxDailyCostUsd:dailyCost,timeoutMs:10000,decisionIntervalMs:1800}};
}
