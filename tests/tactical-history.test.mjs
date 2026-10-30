import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../server/engine/index.mjs';
import {createRoom,issueIdentity} from '../server/rooms.mjs';
import {validateRoomSnapshot} from '../server/store.mjs';
import {getMap,MAP_CATALOG} from '../shared/maps/index.mjs';
import {createSpatialWorld} from '../server/engine/world/index.mjs';
for(const entry of MAP_CATALOG)test('tactical history accepts legal corridor records and rejects misplaced evidence on '+entry.id,async()=>{
 const map=getMap(entry.id),room=createRoom('human',1000,{}, {tactical:true,mapId:map.id});issueIdentity(room,true);room.startId='history:start';room.state=engine.createMatch({id:room.id,tactical:true,map:room.map,now:1000,seed:5});
 const actor=room.lobby.humanPlayerIds[0],p=room.state.players.find(p=>p.id===actor),floor=map.geometry.WORLD_FLOORS.find(f=>!f.center),target={x:floor.x+floor.width/2,y:floor.y+floor.height/2},path=createSpatialWorld(map.geometry).navigation(p,target,1000,room.state);assert(path);let cost=0,last=p.position;for(const q of path){cost+=map.geometry.distance(last,q);last=q;}
 const go=engine.applyAction(room.state,actor,{id:'history:go',type:'navigate',...target},1000);assert.equal(go.accepted,true);const at=1000+Math.ceil(cost/180*1000)+1;room.state=engine.tick(go.state,at).state;assert.deepEqual(room.state.players.find(p=>p.id===actor).position,target);
 const note=engine.applyAction(room.state,actor,{id:'history:note',type:'ability',abilityId:'field-note',targetId:actor},at);assert.equal(note.accepted,true);room.state=note.state;const original=JSON.stringify(room);await validateRoomSnapshot(room);assert.equal(JSON.stringify(room),original);
 const wall=structuredClone(room);wall.state.abilities[actor].notes[0].position={x:0,y:0};await assert.rejects(()=>validateRoomSnapshot(wall),/historical note map/);
 const wrongRoom=structuredClone(room),snapshot=wrongRoom.state.replaySnapshots[0],keeper=snapshot.players[0];keeper.roomId=map.roomLayout.find(r=>r.id!==keeper.roomId).id;await assert.rejects(()=>validateRoomSnapshot(wrongRoom),/replay map/);
 const foreign=structuredClone(room);foreign.state.replaySnapshots[0].players[0].roomId=map.id==='beacon'?'muster':'bridge';await assert.rejects(()=>validateRoomSnapshot(foreign),/replay map/);
});
