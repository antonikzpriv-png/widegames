import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.TACTICAL_COORDINATOR_FINAL_ROOT?pathToFileURL(resolve(process.env.TACTICAL_COORDINATOR_FINAL_ROOT)+'/'):new URL('../',import.meta.url);
const engine=await import(new URL('server/engine/index.mjs',root));
const {createRoom,issueIdentity}=await import(new URL('server/rooms.mjs',root));
const {validateRoomSnapshot}=await import(new URL('server/store.mjs',root));
const clone=value=>structuredClone(value);
function saved(){const room=createRoom('human',1000,{}, {tactical:true,mapId:'stormbreak-annex'});issueIdentity(room,true);room.startId='final-review:start';room.state=engine.createMatch({id:room.id,tactical:true,map:room.map,mode:'human',now:1000,seed:5});assert.equal(room.state.schemaVersion,4);return room;}

// Positive requirements, deliberately red on b9c1a44. No future timestamps or
// runtime placement is invented: only persisted metadata is corrupted here.
test('schema4 restore rejects off-map coordinates in a real accepted private field-note',async()=>{
 const room=saved(),seat=room.lobby.humanPlayerIds[0],result=engine.applyAction(room.state,seat,{id:'final-review:note',type:'ability',abilityId:'field-note',targetId:seat},1000);assert.equal(result.accepted,true);room.state=result.state;await validateRoomSnapshot(room);const broken=clone(room);broken.state.abilities[seat].notes[0].position={x:-99999,y:99999};const before=JSON.stringify(broken);await assert.rejects(()=>validateRoomSnapshot(broken),undefined,'Off-map historical notes must not be accepted as a valid checkpoint');assert.equal(JSON.stringify(broken),before);
});

test('schema4 restore rejects off-map replay-snapshot coordinates and a foreign room identity',async()=>{
 const room=saved();await validateRoomSnapshot(room);assert.equal(engine.getReplaySnapshots(room.state),null);const broken=clone(room);broken.state.replaySnapshots[0].players[0].position={x:-99999,y:99999};broken.state.replaySnapshots[0].players[0].roomId='bridge';const before=JSON.stringify(broken);await assert.rejects(()=>validateRoomSnapshot(broken),undefined,'Snapshots must be validated against the selected Annex map');assert.equal(JSON.stringify(broken),before);
});
