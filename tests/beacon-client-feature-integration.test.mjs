import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {descriptors,fieldNotes,fieldNoteText} from '../public/world/beacon-model.mjs';

// Real registered engine action and safe projection; no HTTP/browser/provider.
const root=process.env.BEACON_CLIENT_RUNTIME_ROOT?pathToFileURL(resolve(process.env.BEACON_CLIENT_RUNTIME_ROOT)+'/'):new URL('../',import.meta.url);
const ready=existsSync(new URL('server/features/abilities/index.mjs',root));
function capture(directory){const result={};for(const entry of readdirSync(new URL(directory,root),{withFileTypes:true})){const file=directory+'/'+entry.name;if(entry.isDirectory())Object.assign(result,capture(file));else if(entry.name.endsWith('.mjs'))result[file]=readFileSync(new URL(file,root));}return result;}
const sources=ready?Object.assign({},...['server/engine','server/features','shared'].map(capture)):null;
const hashes=values=>Object.fromEntries(Object.entries(values).map(([file,data])=>[file,createHash('sha256').update(data).digest('hex')]));
const before=sources&&hashes(sources),engine=ready?await import(new URL('server/engine/index.mjs',root)):null;
for(const [mode,count]of [['human',8],['spectator',12]])test(`registered field-note in ${mode} engine fixture with ${count} custom keepers`,{skip:!ready&&'Foundation feature seam absent; integrate runtime or set BEACON_CLIENT_RUNTIME_ROOT'},()=>{
 const roster=Array.from({length:count},(_,i)=>({id:'custom-'+(50+i),name:'Custom '+(50+i),color:'#bbaacc'})),actorId=roster.at(-1).id,now=100000;
 let state=engine.createMatch({id:'field-note-'+mode,mode,world:true,systems:true,roster,humanPlayerIds:mode==='human'?[actorId]:[],now,seed:'client-field-note-'+mode});
 let view=engine.getPlayerView(state,actorId,now),h=descriptors(view).find(h=>h.type==='ability'&&h.enabled);assert(h);assert.deepEqual(h.fields,{abilityId:'field-note',targetId:actorId});assert.equal(view.players.length,count);
 const wrong=engine.applyAction(state,actorId,{id:'field-note-wrong-target',type:'ability',abilityId:'field-note',targetId:roster[0].id},now);assert.equal(wrong.accepted,false);assert.equal(wrong.error.code,'INVALID_TARGET');state=wrong.state;
 const action={id:'field-note-fixture-1',type:h.type,...h.fields},result=engine.applyAction(state,actorId,action,now);assert.equal(result.accepted,true,result.error?.message);state=result.state;view=engine.getPlayerView(state,actorId,now);
 assert.equal(fieldNotes(view).length,1);assert.equal(fieldNotes(view)[0].at,now);assert.deepEqual(fieldNotes(view)[0].position,view.self.position);assert.match(fieldNoteText(fieldNotes(view)[0]),/Your recorded location/);assert.equal(descriptors(view).find(h=>h.type==='ability').enabled,false,'server cooldown is reflected in descriptor');
 const duplicate=engine.applyAction(state,actorId,action,now+1);assert.equal(duplicate.accepted,true);assert.equal(fieldNotes(engine.getPlayerView(duplicate.state,actorId,now+1)).length,1,'same request cannot invent another note');
 const denied=engine.applyAction(duplicate.state,actorId,{...action,id:'field-note-fixture-2'},now+1);assert.equal(denied.accepted,false);assert.equal(denied.error.code,'COOLDOWN');
 assert.deepEqual(engine.getPlayerView(denied.state,null,now+1).abilities.notes,[]);assert.deepEqual(engine.getPlayerView(denied.state,roster[0].id,now+1).abilities.notes,[]);
});
after(()=>{
 if(!ready)return;const current=hashes(Object.assign({},...['server/engine','server/features','shared'].map(capture)));assert.deepEqual(current,before,'runtime source changed during engine check');
 if(process.env.BEACON_CLIENT_FEATURE_RECEIPT){const target=process.env.BEACON_CLIENT_FEATURE_RECEIPT;mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify({root:root.href,sha256:before,sourceStable:true,limits:'Real engine registered action/projection, explicit seeded custom rosters; no HTTP/browser/provider.'},null,2)+'\n');}
});
