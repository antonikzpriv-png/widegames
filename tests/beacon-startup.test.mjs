import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('occupied-port main startup explains recovery, exits1 and releases its storage lock',{timeout:20000},async t=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),directory=await mkdtemp(path.join(tmpdir(),'beacon-startup-')),holder=net.createServer();await new Promise(resolve=>holder.listen(0,'127.0.0.1',resolve));const port=holder.address().port;let child;
 t.after(async()=>{if(child?.exitCode===null&&!child.killed)child.kill();if(holder.listening)await new Promise(resolve=>holder.close(resolve));assert(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep));await rm(directory,{recursive:true,force:true});});
 const env={...process.env,HOST:'127.0.0.1',PORT:String(port),PUBLIC_ORIGIN:'http://127.0.0.1:'+port,DATA_DIR:directory,AI_PROVIDER:'demo',ANTHROPIC_API_KEY:'',MAX_AI_COST_USD:'0',MAX_DAILY_AI_COST_USD:'0'};
 child=spawn(process.execPath,['server/main.mjs'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>output+=chunk.toString());const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Owned startup did not close after bind failure'));},12000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});});
 assert.equal(result.code,1);assert.equal(result.signal,null);assert.match(output,/already in use.*Ctrl\+C/s);assert.doesNotMatch(output,/Unhandled|node:events|x-api-key/);await assert.rejects(access(path.join(directory,'service.lock')),{code:'ENOENT'});await assert.rejects(access(path.join(directory,'service.lock.recovery')),{code:'ENOENT'});
});
