/** Driver-unit controls, not native-browser qualification. All game views/actions
 * below come from the actual engine; only the browser control surface is stubbed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {exerciseNativeStationTask} from '../scripts/quality-browser-check.mjs';
const root=process.env.QUALITY_REVIEW_ROOT?pathToFileURL(path.resolve(process.env.QUALITY_REVIEW_ROOT)+path.sep):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root)),{getMap}=await import(new URL('shared/maps/index.mjs',root)),{nextStationInput}=await import(new URL('shared/station-challenges.mjs',root));
function finalTask(){let state,actor;for(let seed=0;seed<40;seed++){state=engine.createMatch({id:'quality-driver-final-task',mode:'human',tactical:true,stationTasks:true,map:{id:'beacon',version:2},seed,now:1000,config:{tasksPerCrew:1,roamDeadlineMs:600000,maxMatchMs:900000,meetingCooldownMs:1}});actor=state.players.find(p=>p.human);if(actor.role==='crew'&&actor.tasks[0].challenge.kind==='signal')break;}assert.equal(actor.tasks[0]?.challenge.kind,'signal');const id=actor.id,taskId=actor.tasks[0].id,map=getMap(state.map);let now=1000,seq=0;
 const view=()=>engine.getPlayerView(state,id,now),act=(who,type,fields={})=>{const r=engine.applyAction(state,who,{id:'driver:'+ ++seq,type,...fields},now);assert.equal(r.accepted,true,JSON.stringify(r.error));state=r.state;},walk=(who,point)=>{act(who,'navigate',{x:point.x,y:point.y});let length=0,last=state.players.find(p=>p.id===who).position;for(const q of state.players.find(p=>p.id===who).motion.path){length+=map.geometry.distance(last,q);last=q;}now+=Math.ceil(length/map.geometry.WORLD.speed*1000)+1;state=engine.tick(state,now).state;};
 for(const p of state.players.filter(p=>p.role==='crew'&&p.id!==id)){const task=p.tasks[0];walk(p.id,map.geometry.WORLD_STATIONS[task.roomId]);while(!state.players.find(q=>q.id===p.id).tasks[0].completed){act(p.id,'taskInteract',{taskId:task.id,...nextStationInput(state.players.find(q=>q.id===p.id).tasks[0].challenge)});}}
 walk(id,map.geometry.WORLD_STATIONS[actor.tasks[0].roomId]);assert.equal(view().phase,'roam');assert.equal(view().tasks.completed,view().tasks.total-1);let chosen;
 const page={waitForSelector:async()=>{},waitForFunction:async()=>{},$eval:async(_selector,_fn,target)=>{chosen=target;},locator:()=>({async click(){act(id,'taskInteract',{taskId,interactionId:'tune',value:String(chosen)});}})};
 return {page,taskId,readRoom:async()=>({game:view()}),view,interrupt(){const caller=state.players.find(p=>p.id!==id&&p.role==='crew').id;walk(caller,map.geometry.WORLD_BELL);act(caller,'meeting');assert.equal(view().phase,'discussion');}};
}
test('driver permits a final native-input acknowledgement only when the real engine completes the task and outcome',async()=>{const f=finalTask(),records=[];assert.equal(await exerciseNativeStationTask({...f,record:r=>records.push(r)}),'signal');assert.equal(f.view().phase,'ended');assert.deepEqual({winner:f.view().outcome.winner,reason:f.view().outcome.reason},{winner:'crew',reason:'tasks'});assert(f.view().self.tasks.find(t=>t.id===f.taskId).completed);assert.equal(records.length,1);});
test('driver does not misclassify an actual incomplete council interruption as a solved station',async()=>{const f=finalTask();f.interrupt();assert.equal(f.view().self.tasks.find(t=>t.id===f.taskId).completed,false);await assert.rejects(exerciseNativeStationTask(f),/actual completed task\/outcome/);assert.equal(f.view().phase,'discussion');});
