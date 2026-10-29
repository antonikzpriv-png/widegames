/** Conservative deployment-wide daily reservations, never refunded after a send. */
import {mkdir,readFile,open,rename,lstat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function createDailyBudget({directory,maxCostUsd=5,now=Date.now}){
 if(!Number.isFinite(maxCostUsd)||maxCostUsd<0||maxCostUsd>100)throw new Error('Invalid daily AI budget');
 await mkdir(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'ai-daily-budget.json'),limitNanos=Math.floor(maxCostUsd*1e9);
 const nanos=value=>Math.ceil(value*1e9);
 const totalNanos=reservations=>Object.values(reservations).reduce((sum,value)=>sum+nanos(value),0);
 let ledger={version:1,day:new Date(now()).toISOString().slice(0,10),reservations:{},total:0},queue=Promise.resolve();
 try{
  const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>2000000)throw new Error('Invalid daily budget file');
  const saved=JSON.parse(await readFile(file,'utf8'));
  if(saved.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(saved.day)||!saved.reservations||Array.isArray(saved.reservations)||typeof saved.reservations!=='object'||Object.keys(saved.reservations).length>10000)throw new Error('Invalid daily budget data');
  const amounts=Object.values(saved.reservations);if(amounts.some(x=>!Number.isFinite(x)||x<0||x>100)||!Number.isFinite(saved.total)||saved.total<0||Math.abs(amounts.reduce((a,b)=>a+b,0)-saved.total)>1e-6||new Date(saved.day+'T00:00:00Z').toISOString().slice(0,10)!==saved.day||Object.keys(saved.reservations).some(id=>!/^[A-Za-z0-9:._-]{1,180}$/.test(id)))throw new Error('Invalid daily budget totals');
  // Restore canonical conservative integer accounting, never a tolerated
  // under-reported decimal total. Existing version-1 entries stay compatible.
  ledger={...saved,total:totalNanos(saved.reservations)/1e9};
 }catch(error){if(error.code!=='ENOENT')throw new Error('Daily AI budget cannot be restored safely; preserve and inspect its file.');}
 const day=()=>new Date(now()).toISOString().slice(0,10);
 const status=()=>({day:day(),reservedUsd:ledger.day===day()?ledger.total:0,limitUsd:maxCostUsd});
 async function reserve({id,amount}){
  const run=queue.catch(()=>{}).then(async()=>{
   if(typeof id!=='string'||!/^[A-Za-z0-9:._-]{1,180}$/.test(id)||!Number.isFinite(amount)||amount<0||amount>100)throw new Error('Invalid AI reservation');
   if(day()<ledger.day)throw new Error('Server clock precedes persisted AI budget day');
   const next=ledger.day===day()?structuredClone(ledger):{version:1,day:day(),reservations:{},total:0};
   if(Object.hasOwn(next.reservations,id)){if(next.reservations[id]!==amount)throw new Error('AI reservation ID conflict');return status();}
   const reservedNanos=totalNanos(next.reservations)+nanos(amount);
   if(Object.keys(next.reservations).length>=10000||reservedNanos>limitNanos)throw new Error('Deployment daily AI budget exhausted');
   Object.defineProperty(next.reservations,id,{value:amount,enumerable:true,writable:true,configurable:true});next.total=reservedNanos/1e9;
   const temporary=file+'.'+randomUUID()+'.tmp';
   try{const handle=await open(temporary,'wx',0o600);try{await handle.writeFile(JSON.stringify(next));await handle.sync();}finally{await handle.close();}await rename(temporary,file);}catch(error){await unlink(temporary).catch(()=>{});throw error;}
   ledger=next;return status();
  });queue=run;return run;
 }
 return {reserve,status};
}
