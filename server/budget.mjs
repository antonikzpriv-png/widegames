/** Conservative deployment-wide daily reservations, never refunded after a send. */
import {mkdir,readFile,writeFile,rename,lstat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function createDailyBudget({directory,maxCostUsd=5,now=Date.now}){
 if(!Number.isFinite(maxCostUsd)||maxCostUsd<0||maxCostUsd>100)throw new Error('Invalid daily AI budget');
 await mkdir(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'ai-daily-budget.json');
 let ledger={version:1,day:new Date(now()).toISOString().slice(0,10),reservations:{},total:0},queue=Promise.resolve();
 try{
  const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>2000000)throw new Error('Invalid daily budget file');
  const saved=JSON.parse(await readFile(file,'utf8'));
  if(saved.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(saved.day)||!saved.reservations||Array.isArray(saved.reservations)||typeof saved.reservations!=='object'||Object.keys(saved.reservations).length>10000)throw new Error('Invalid daily budget data');
  const amounts=Object.values(saved.reservations);if(amounts.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(saved.total)||Math.abs(amounts.reduce((a,b)=>a+b,0)-saved.total)>1e-6)throw new Error('Invalid daily budget totals');
  ledger=saved;
 }catch(error){if(error.code!=='ENOENT')throw new Error('Daily AI budget cannot be restored safely; preserve and inspect its file.');}
 const day=()=>new Date(now()).toISOString().slice(0,10);
 const status=()=>({day:day(),reservedUsd:ledger.day===day()?ledger.total:0,limitUsd:maxCostUsd});
 async function reserve({id,amount}){
  const run=queue.catch(()=>{}).then(async()=>{
   if(typeof id!=='string'||!/^[A-Za-z0-9:._-]{1,180}$/.test(id)||!Number.isFinite(amount)||amount<0||amount>100)throw new Error('Invalid AI reservation');
   if(day()<ledger.day)throw new Error('Server clock precedes persisted AI budget day');
   const next=ledger.day===day()?structuredClone(ledger):{version:1,day:day(),reservations:{},total:0};
   if(Object.hasOwn(next.reservations,id)){if(next.reservations[id]!==amount)throw new Error('AI reservation ID conflict');return status();}
   if(Object.keys(next.reservations).length>=10000||next.total+amount>maxCostUsd+1e-9)throw new Error('Deployment daily AI budget exhausted');
   Object.defineProperty(next.reservations,id,{value:amount,enumerable:true,writable:true,configurable:true});next.total+=amount;
   const temporary=file+'.'+randomUUID()+'.tmp';
   try{await writeFile(temporary,JSON.stringify(next),{flag:'wx',mode:0o600});await rename(temporary,file);}catch(error){await unlink(temporary).catch(()=>{});throw error;}
   ledger=next;return status();
  });queue=run;return run;
 }
 return {reserve,status};
}
