/** Development qualification snapshot. Reads exact Git blobs without checkout
 * filters, writes only a new owned _artifacts directory, never changes a branch. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const pin=process.argv[2]?.toLowerCase();assert.match(pin??'',/^[a-f0-9]{40}$/,'Supply the exact40-character committed revision');
const root=fileURLToPath(new URL('../',import.meta.url)),run=promisify(execFile),options={cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024};
assert.equal((await run('git',['cat-file','-t',pin],options)).stdout.trim(),'commit','Snapshot revision must name a commit');
const tree=(await run('git',['ls-tree','-r','-z','--full-tree',pin],options)).stdout.split('\0').filter(Boolean).map(row=>{const tab=row.indexOf('\t'),[mode,type,blob]=row.slice(0,tab).split(' '),file=row.slice(tab+1);assert.equal(type,'blob');assert(['100644','100755'].includes(mode),'Only regular tracked files are supported');assert(!path.isAbsolute(file)&&!file.includes('\\')&&!file.split('/').some(p=>p==='.'||p==='..'),'Safe tracked path');return{mode,blob,file};});
assert(tree.length>0);const ids=[...new Set(tree.map(row=>row.blob))];
const bytes=await new Promise((resolve,reject)=>{
 const child=spawn('git',['cat-file','--batch'],{cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']}),chunks=[];let size=0,stderr='';
 const timer=setTimeout(()=>{child.kill();reject(Error('Git snapshot read exceeded30s'));},30000);
 child.on('error',error=>{clearTimeout(timer);reject(error);});
 child.stdout.on('data',chunk=>{size+=chunk.length;if(size>64*1024*1024){child.kill();reject(Error('Git snapshot exceeds64MiB'));}else chunks.push(chunk);});
 child.stderr.on('data',chunk=>stderr+=chunk.toString());child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(Buffer.concat(chunks));else reject(Error('Git blob reader failed: '+stderr.slice(0,300)));});
 child.stdin.end(ids.join('\n')+'\n');
});
let offset=0;const blobs=new Map();for(const id of ids){const end=bytes.indexOf(10,offset);assert(end>=offset);const [actual,type,number]=bytes.toString('ascii',offset,end).split(' '),length=Number(number);assert.equal(actual,id);assert.equal(type,'blob');assert(Number.isSafeInteger(length)&&length>=0&&length<=16*1024*1024);offset=end+1;const blob=bytes.subarray(offset,offset+length);assert.equal(blob.length,length);assert.equal(createHash('sha1').update(Buffer.from('blob '+length+'\0')).update(blob).digest('hex'),id);offset+=length;assert.equal(bytes[offset++],10);blobs.set(id,blob);}assert.equal(offset,bytes.length);
const artifacts=path.join(root,'_artifacts');await mkdir(artifacts,{recursive:true});const output=await mkdtemp(path.join(artifacts,'quality-source-'+pin.slice(0,7)+'-raw-')),files=Object.create(null);
for(const row of tree){const target=path.resolve(output,row.file),relative=path.relative(output,target);assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));await mkdir(path.dirname(target),{recursive:true});const blob=blobs.get(row.blob);await writeFile(target,blob);files[row.file]={mode:row.mode,blob:row.blob,sha256:createHash('sha256').update(blob).digest('hex')};}
const manifest=JSON.stringify({revision:pin,files},null,2)+'\n';await writeFile(path.join(output,'source-manifest.json'),manifest);
const receipt={pin,root:output,sourceFileCount:tree.length,method:'git-cat-file-batch',manifestSha256:createHash('sha256').update(manifest).digest('hex')};await writeFile(path.join(artifacts,'quality-native-source-latest.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
