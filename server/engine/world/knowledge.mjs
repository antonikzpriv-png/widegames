import {BEACON_DEVICES,BEACON_VENTS} from '../../../shared/beacon.mjs';
const clone=value=>structuredClone(value);
const time=value=>Number.isFinite(value)&&value>=0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const hasTransit=(state,id)=>!!state.systems?.transit&&Object.hasOwn(state.systems.transit,id)&&!!state.systems.transit[id];
export function spatialKnowledge(g){
  const limit=state=>Math.min(64,Math.max(1,Number.isSafeInteger(state.beaconRules?.observationLimit)?state.beaconRules.observationLimit:64));
  const blank=players=>({version:1,roster:players.map(p=>({id:p.id,status:'unknown',alive:null,at:null,source:null})),events:[],bodies:[],sequence:0,witnessCursor:0,traceCursor:0,musterId:null});
  function initialize(state){for(const p of state.players)p.knowledge=blank(state.players);state.spatial.spectator.knowledge=blank(state.players);}
  function remember(k,id,alive,at,source){const row=k.roster.find(p=>p.id===id);if(!row||!time(at)||(row.at!==null&&at<row.at)||row.status==='dead'&&alive)return false;const status=alive?'alive':'dead';if(row.status===status)return false;Object.assign(row,{status,alive,at,source});return true;}
  function append(state,k,viewerId,event,record){const local={...event,id:'o:'+String(viewerId??'bridge')+':'+ ++k.sequence};k.events.push(local);if(k.events.length>limit(state))k.events.splice(0,k.events.length-limit(state));if(record)record(state,'observation',event.observedAt??event.at,{playerId:viewerId,observation:clone(local),visibleTo:viewerId===null?[]:[viewerId]});}
  function visibleBody(state,b,origin,viewerId){return b.id==='body-'+b.playerId&&!b.reported&&g.rooms.some(r=>r.id===b.roomId)&&g.valid(b.position)&&time(b.at)&&state.players.some(p=>p.id===b.playerId&&!p.alive)&&!hasTransit(state,b.playerId)&&g.sees(origin,b.position,state,viewerId);}
  function adoptVitals(state,viewerId,sample,now,record){
    // Root/Investigation normalizes one owner's validated terminal sample here.
    // This is never an action endpoint or a client-provided observation.
    const viewer=state.players.find(p=>p.id===viewerId);
    if(!viewer||!viewer.knowledge||!object(sample)||Object.keys(sample).some(k=>!['at','players'].includes(k))||!time(now)||!time(sample.at)||sample.at>now||!Array.isArray(sample.players)||sample.players.length>state.players.length||new Set(sample.players.map(p=>p?.id)).size!==sample.players.length)return false;
    if(sample.players.some(row=>!object(row)||Object.keys(row).some(k=>!['id','alive'].includes(k))||typeof row.alive!=='boolean'||!state.players.some(p=>p.id===row.id)||(!row.alive&&state.players.find(p=>p.id===row.id).alive)))return false;
    let changed=false;const learned=[];
    for(const row of sample.players)if(remember(viewer.knowledge,row.id,row.alive,sample.at,'vitals')){changed=true;learned.push({id:row.id,alive:row.alive});}
    if(changed)append(state,viewer.knowledge,viewerId,{type:'vitals',at:sample.at,observedAt:now,players:learned},record);
    return changed;
  }
  function observe(state,now,record){
    if(!time(now)||Number.isFinite(state.updatedAt)&&now<state.updatedAt||state.phase==='ended')return false;let changed=false;
    const witnesses=(state.replay??[]).filter(e=>e.type==='witness'&&time(e.at)&&e.at<=now&&/^r[0-9]+$/.test(e.id??'')),cursor=witnesses.reduce((n,e)=>Math.max(n,Number(e.id.slice(1))),0);
    const traces=(state.replay??[]).filter(e=>['vent_enter','vent_exit'].includes(e.type)&&time(e.at)&&e.at<=now&&/^r[0-9]+$/.test(e.id??'')),traceCursor=traces.reduce((n,e)=>Math.max(n,Number(e.id.slice(1))),0);
    const views=state.players.map(p=>({id:p.id,self:p,origin:p.position,k:p.knowledge}));views.push({id:null,self:null,origin:g.viewpoint,k:state.spatial?.spectator?.knowledge});
    for(const {id,self,origin,k}of views){if(!k)continue;
      if(self)changed=remember(k,id,self.alive,now,'self')||changed;
      if(['discussion','voting'].includes(state.phase)){
        const muster=String(state.meeting?.id??state.meetingCount??'council');
        if(k.musterId!==muster){const roster=[];for(const player of state.players){remember(k,player.id,player.alive,now,'muster');roster.push({id:player.id,alive:player.alive});}k.musterId=muster;for(const event of k.events)if(event.type==='body')event.reported=true;append(state,k,id,{type:'muster',at:now,players:roster},record);changed=true;}
      }
      const observerCanSee=!self||self.alive&&!hasTransit(state,id);
      if(observerCanSee){
        for(const player of state.players)if(player.alive&&!hasTransit(state,player.id)&&g.sees(origin,player.position,state,id))changed=remember(k,player.id,true,now,'sight')||changed;
        for(const body of state.bodies??[]){if(!visibleBody(state,body,origin,id)||body.at>now)continue;changed=remember(k,body.playerId,false,now,'body')||changed;
          if(!k.bodies.includes(body.id)){k.bodies.push(body.id);append(state,k,id,{type:'body',bodyId:body.id,playerId:body.playerId,roomId:body.roomId,position:g.point(body.position),at:body.at,observedAt:now,reported:false},record);changed=true;}}
      }
      if(self){
        // Investigation's exact owner-scoped native vitals sample. No other
        // actor's terminal reads are consulted or shared with the spectator.
        const observations=state.investigation?.observations;
        const samples=observations&&Object.hasOwn(observations,id)?observations[id]:[];
        if(Array.isArray(samples))for(const sample of samples.slice(-64)){
          if(!sample||sample.kind!=='vitals'||!BEACON_DEVICES.some(d=>d.id===sample.deviceId&&d.kind==='vitals')||sample.id!=='obs:'+id+':'+sample.deviceId+':'+sample.at||!time(sample.at)||sample.at>now||!Array.isArray(sample.data?.players)||sample.data.players.length!==state.players.length||sample.data.players.some(row=>!row||!['alive','dead'].includes(row.status)||Object.keys(row).some(k=>!['id','status'].includes(k))))continue;
          changed=adoptVitals(state,id,{at:sample.at,players:sample.data.players.map(row=>({id:row.id,alive:row.status==='alive'}))},now,record)||changed;
        }
        for(const event of witnesses){const sequence=Number(event.id.slice(1));if(sequence<=k.witnessCursor||event.playerId===event.targetId||!g.rooms.some(r=>r.id===event.roomId)||!Array.isArray(event.visibleTo)||!event.visibleTo.includes(id)||!time(event.at)||event.at>now||!state.players.some(p=>p.id===event.playerId)||!state.players.some(p=>p.id===event.targetId))continue;
          changed=remember(k,event.targetId,false,event.at,'witness')||changed;append(state,k,id,{type:'witness',at:event.at,observedAt:now,playerId:event.playerId,targetId:event.targetId,roomId:event.roomId,...(g.valid(event.position)?{position:g.point(event.position)}:{})},record);changed=true;}
        if(cursor>k.witnessCursor){k.witnessCursor=cursor;changed=true;}
        // Systems selects recipients at the actual entry/exit, before transit
        // hides the actor. Keep only that observed hatch, never the other end.
        for(const event of traces){
          if(Number(event.id.slice(1))<=(k.traceCursor??0)||!Array.isArray(event.visibleTo)||!event.visibleTo.includes(id)||!state.players.some(p=>p.id===event.playerId))continue;
          const field=event.type==='vent_enter'?'entryId':'exitId',other=field==='entryId'?'exitId':'entryId',hatch=BEACON_VENTS.find(v=>v.id===event[field]);
          if(Object.hasOwn(event,other)||!hatch||event.roomId!==hatch.roomId||!g.valid(event.position)||g.distance(event.position,hatch.position)>1e-7)continue;
          changed=remember(k,event.playerId,true,event.at,'sight')||changed;
          append(state,k,id,{type:event.type,at:event.at,observedAt:now,playerId:event.playerId,roomId:hatch.roomId,position:g.point(hatch.position),[field]:hatch.id},record);changed=true;
        }
        if(traceCursor>(k.traceCursor??0)){k.traceCursor=traceCursor;changed=true;}
      }
    }
    return changed;
  }
  function projectWorld(state,viewerId,now){
    const self=state.players.find(p=>p.id===viewerId),ended=state.phase==='ended',origin=self?.position??g.viewpoint,k=self?.knowledge??state.spatial?.spectator?.knowledge;
    if(viewerId!==null&&!self)throw new TypeError('Unknown spatial viewer');
    const players=state.players.map(player=>{
      const own=player.id===viewerId,known=k?.roster.find(row=>row.id===player.id),body=(state.bodies??[]).find(b=>b.playerId===player.id&&visibleBody(state,b,origin,viewerId));
      const visible=!hasTransit(state,player.id)&&((own&&player.alive)||player.alive&&g.sees(origin,player.position,state,viewerId)||!!body);
      const status=ended||own||visible?(player.alive?'alive':'dead'):known?.status??'unknown',alive=status==='unknown'?null:status==='alive';
      const position=ended?player.position:visible?(body?.position??player.position):null,roomId=position?(body?.roomId??player.roomId):null;
      return {id:player.id,name:player.name,color:player.color,status,alive,roomId,position:position?g.point(position):null,...(ended?{role:player.role}:{})};
    });
    return {players,localEvents:clone(k?.events??[]).slice(-limit(state)),vision:{radius:g.radius(state,viewerId),origin:g.point(origin),mode:ended?'reveal':self?'player':'bridge',lights:!!state.systems?.lights?.active}};
  }
  function validate(state){
    if(!time(state.updatedAt))throw new TypeError('Invalid spatial checkpoint');
    const checkpoint=state.updatedAt,ids=state.players.map(p=>p.id),keys=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key));
    const rosterRow=row=>keys(row,['id','alive'])&&ids.includes(row.id)&&typeof row.alive==='boolean';
    const check=(k,spectator=false)=>{
      if(!keys(k,['version','roster','events','bodies','sequence','witnessCursor','traceCursor','musterId'])||k.version!==1||!Array.isArray(k.roster)||k.roster.length!==ids.length||new Set(k.roster.map(p=>p.id)).size!==ids.length||k.roster.some(p=>!keys(p,['id','status','alive','at','source'])||!ids.includes(p.id)||!['unknown','alive','dead'].includes(p.status)||p.alive!==(p.status==='unknown'?null:p.status==='alive')||(p.status==='unknown'?(p.at!==null||p.source!==null):(!time(p.at)||p.at>checkpoint||!['self','sight','body','witness','muster','vitals'].includes(p.source))))||!Array.isArray(k.events)||k.events.length>64||k.events.length>limit(state)||!Array.isArray(k.bodies)||k.bodies.length>ids.length||k.bodies.some(id=>!ids.some(playerId=>id==='body-'+playerId))||new Set(k.bodies).size!==k.bodies.length||!Number.isSafeInteger(k.sequence)||k.sequence<k.events.length||!Number.isSafeInteger(k.witnessCursor)||k.witnessCursor<0||k.witnessCursor>(state.replaySequence??k.witnessCursor)||Object.hasOwn(k,'traceCursor')&&(!Number.isSafeInteger(k.traceCursor)||k.traceCursor<0||k.traceCursor>(state.replaySequence??k.traceCursor))||!(k.musterId===null||typeof k.musterId==='string'))throw new TypeError('Invalid spatial knowledge');
      if(spectator&&(k.witnessCursor!==0||(k.traceCursor??0)!==0||k.roster.some(row=>['self','witness','vitals'].includes(row.source))||k.events.some(e=>!['body','muster'].includes(e.type))))throw new TypeError('Invalid spatial spectator knowledge');
      if(new Set(k.events.map(e=>e.id)).size!==k.events.length)throw new TypeError('Invalid spatial observation');
      for(const e of k.events){
        const fields={body:['bodyId','playerId','roomId','position','reported'],witness:['playerId','targetId','roomId','position'],muster:['players'],vitals:['players'],vent_enter:['playerId','roomId','position','entryId'],vent_exit:['playerId','roomId','position','exitId']};
        if(!object(e)||!Object.hasOwn(fields,e.type)||!keys(e,['id','type','at','observedAt',...fields[e.type]])||typeof e.id!=='string'||e.id.length>180||!time(e.at)||e.at>checkpoint||Object.hasOwn(e,'observedAt')&&(!time(e.observedAt)||e.observedAt<e.at||e.observedAt>checkpoint))throw new TypeError('Invalid spatial observation');
        if(e.type==='vent_enter'||e.type==='vent_exit'){
          const field=e.type==='vent_enter'?'entryId':'exitId',hatch=BEACON_VENTS.find(v=>v.id===e[field]);
          if(!Number.isSafeInteger(k.traceCursor)||!ids.includes(e.playerId)||!hatch||e.roomId!==hatch.roomId||!g.valid(e.position)||Object.keys(e.position).some(key=>!['x','y'].includes(key))||g.distance(e.position,hatch.position)>1e-7||!time(e.observedAt))throw new TypeError('Invalid spatial hatch trace');
        }else if(e.type==='body'||e.type==='witness'){
          if(!ids.includes(e.playerId)||!g.rooms.some(r=>r.id===e.roomId)||e.position!==undefined&&(!g.valid(e.position)||!g.staticWalkable(e.position)))throw new TypeError('Invalid spatial observation');
          if(e.type==='body'&&(!g.valid(e.position)||e.bodyId!=='body-'+e.playerId||typeof e.reported!=='boolean')||e.type==='witness'&&(!ids.includes(e.targetId)||e.targetId===e.playerId))throw new TypeError('Invalid spatial observation');
        }else if(!Array.isArray(e.players)||e.players.length>ids.length||!e.players.every(rosterRow)||new Set(e.players.map(p=>p.id)).size!==e.players.length)throw new TypeError('Invalid spatial observation');
      }
    };
    for(const p of state.players)check(p.knowledge);check(state.spatial.spectator.knowledge,true);return true;
  }
  return {initialize,observe,projectWorld,adoptVitals,validate};
}
