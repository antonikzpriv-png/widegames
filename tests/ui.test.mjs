import test from 'node:test';
import assert from 'node:assert/strict';
import {actionEnvelope,roomIdFromPath,roomPath,roomFrom} from '../public/api.mjs';
import {canAct,localBodies,localTargets,eventText,replayEvents} from '../public/presentation.mjs';
import {secondsUntil,clockText} from '../public/ui.mjs';

test('shared room links cannot inject paths and action retries retain a distinct identity',()=>{
 assert.equal(roomIdFromPath('/r/abc_123-def'),'abc_123-def');
 for(const path of ['/r/a/b','/r/../secret','/r/a?token=x','/r/%2Fsecret'])assert.equal(roomIdFromPath(path),null);
 assert.equal(roomPath('a/b','/action'),'/api/rooms/a%2Fb/action');
 const a=actionEnvelope('vote',{targetId:'skip'}),b=actionEnvelope('vote',{targetId:'skip'});
 assert.notEqual(a.id,b.id);assert.equal(a.targetId,'skip');assert.equal(a.type,'vote');
 assert.equal(roomFrom({room:{roomId:'test'}}).roomId,'test');
});
test('spectators and fallen keepers cannot gain controls from action hints',()=>{
 assert.equal(canAct({self:null,availableActions:['vote']},'vote'),false);
 assert.equal(canAct({self:{alive:false},availableActions:['vote']},'vote'),false);
 assert.equal(canAct({self:{alive:true},availableActions:['vote']},'vote'),true);
 assert.equal(canAct({self:{alive:true},availableActions:['vote']},'vote',true),false);
});
test('report and eliminate targets come only from local observations',()=>{
 const game={self:{id:'p1',roomId:'bridge'},players:[{id:'p1',alive:true,roomId:'bridge'},{id:'p2',alive:true,roomId:'bridge'},{id:'p3',alive:true,roomId:null},{id:'p4',alive:false,roomId:'bridge'}],events:[{type:'body',bodyId:'body-p4',roomId:'bridge'},{type:'body',bodyId:'body-p5',roomId:'engine'},{type:'eliminated',playerId:'p6'}]};
 assert.deepEqual(localTargets(game).map(p=>p.id),['p2']);assert.deepEqual(localBodies(game).map(b=>b.bodyId),['body-p4']);
});
test('timeline does not invent a hidden eliminator or vote target',()=>{
 const game={players:[{id:'p1',name:'Iona'},{id:'p2',name:'Pax'}]};
 assert.equal(eventText({type:'eliminated',playerId:'p2'},game),'Pax fell during the watch.');
 assert.equal(eventText({type:'vote_result',ejectedId:null},game),'No keeper was ejected.');
 assert.match(eventText({type:'witness',playerId:'p1',targetId:'p2',roomId:'bridge'},game),/Iona eliminate Pax/);
});
test('replay accepts the actual transport envelope and timers clamp elapsed deadlines',()=>{
 const replay=[{type:'ended',winner:'crew'}];assert.equal(replayEvents({roomId:'r',replay}),replay);
 assert.throws(()=>replayEvents({roomId:'r'}),/incomplete/);
 assert.equal(secondsUntil(10,100),0);assert.equal(clockText(75),'1:15');
});
