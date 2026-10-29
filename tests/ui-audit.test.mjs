import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {request,roomFrom,ApiError} from '../public/api.mjs';
import {aiLabel,replayText} from '../public/presentation.mjs';

test('hybrid labels never claim model-driven movement, including live summaries without new metadata',()=>{
 assert.equal(aiLabel({mode:'live',strategy:'hybrid',navigation:'local',council:'model',model:'configured-model'}),'Hybrid: live council / local navigation');
 assert.equal(aiLabel({mode:'live'}),'Hybrid: live council / local navigation');
 assert.equal(aiLabel({mode:'demo',strategy:'demo',navigation:'local',council:'demo'}),'Demo: local bots');
 assert.equal(aiLabel({}),'AI mode pending');
});

test('ended replay attributes named ballots, skips, roles, ejections and actual witnesses',()=>{
 const game={phase:'ended',players:[{id:'p1',name:'Iona',role:'crew'},{id:'p2',name:'Pax',role:'saboteur'},{id:'p3',name:'Vale',role:'crew'}]};
 const target={type:'action',playerId:'p1',action:{type:'vote',targetId:'p2'}};
 const skip={type:'action',playerId:'p3',action:{type:'vote',targetId:'skip'}};
 assert.equal(replayText(target,game),'Iona (crew) voted to eject Pax (saboteur).');
 assert.equal(replayText(skip,game),'Vale (crew) voted to skip ejection.');
 const tally=replayText({type:'vote_result',ejectedId:'p2',votes:[{playerId:'p1',targetId:'p2'},{playerId:'p3',targetId:'skip'}]},game);
 assert.match(tally,/Pax \(saboteur\) was ejected/);assert.match(tally,/Iona \(crew\) voted to eject Pax/);assert.match(tally,/Vale \(crew\) voted to skip/);
 const witness=replayText({type:'witness',playerId:'p2',targetId:'p1',roomId:'bridge',visibleTo:['p3']},game);
 assert.equal(witness,'Pax (saboteur) eliminated Iona (crew) in Bridge. Observed by: Vale (crew).');
 assert.doesNotMatch(witness,/You saw|\{"/);
 assert.match(replayText({type:'role_reveal',players:[{id:'p2',role:'saboteur'}]},game),/Pax \(saboteur\)/);
 assert.doesNotMatch(replayText(target,{...game,phase:'voting'}),/\(crew\)|\(saboteur\)/);
});

test('request errors preserve real HTTP status, cancellation and uncertain successful response bodies',async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/slow'){req.once('close',()=>res.destroy());return;}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/denied'){res.writeHead(401);res.end(JSON.stringify({error:{code:'ROOM_AUTH_REQUIRED',message:'Join this room to continue.'}}));}
  else if(req.url==='/null'){res.writeHead(503);res.end('null');}
  else if(req.url==='/broken'){res.writeHead(200);res.end('{');}
  else{res.writeHead(503);res.end(JSON.stringify({error:{message:{unsafe:'object'}}}));}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  await assert.rejects(request(origin+'/denied'),error=>error instanceof ApiError&&error.status===401&&error.code==='ROOM_AUTH_REQUIRED');
  await assert.rejects(request(origin+'/null'),error=>error instanceof ApiError&&error.status===503);
  await assert.rejects(request(origin+'/broken'),error=>error instanceof ApiError&&error.status===undefined&&error.code==='RESPONSE');
  await assert.rejects(request(origin+'/object'),error=>error instanceof ApiError&&typeof error.message==='string'&&error.message==='The request could not be completed.');
  const abort=new AbortController(),pending=request(origin+'/slow',{signal:abort.signal});abort.abort();
  await assert.rejects(pending,error=>error.name==='AbortError');
  assert.throws(()=>roomFrom(null),/incomplete/);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
