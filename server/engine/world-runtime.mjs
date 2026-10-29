/** Continuous world state is private. Geometry is supplied by the shared map. */
export function worldRuntime(geometry) {
  const {WORLD,worldRoomAt,isWalkable,moveWorldPoint,findWorldPath,canSeeWorldPoint,worldSpawn,distance,WORLD_STATIONS,WORLD_BELL}=geometry;
  const speed=WORLD.speed,lease=WORLD.inputLeaseMs,vision=WORLD.visibilityRadius;
  const point=p=>({x:p.x,y:p.y});
  const same=(a,b)=>Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7;
  const station=roomId=>{
    const value=Array.isArray(WORLD_STATIONS)?WORLD_STATIONS.find(s=>s.roomId===roomId||s.id===roomId):WORLD_STATIONS[roomId];
    return value?.position??value;
  };
  const sees=(from,to)=>!!from&&!!to&&distance(from,to)<=vision&&canSeeWorldPoint(from,to);
  const nearby=(from,to,range)=>!!from&&!!to&&distance(from,to)<=range&&canSeeWorldPoint(from,to);
  function initialize(state,now) {
    state.schemaVersion=2;state.worldVersion=1;
    state.players.forEach((p,i)=>{
      p.position=point(worldSpawn(p.id));
      p.motion={seq:0,dx:0,dy:0,leaseUntil:now,at:now,manual:false,path:[],destination:null,recordedAt:now};
      const room=worldRoomAt(p.position);if(room)p.roomId=typeof room==='string'?room:room.id;
    });
  }
  function stop(state,p,at,reason,record) {
    const m=p.motion;if(!m)return false;
    const active=m.manual||m.path.length>0||m.destination!==null;
    if(active)record(state,'motion',at,{playerId:p.id,position:point(p.position),reason});
    m.manual=false;m.path=[];m.destination=null;m.leaseUntil=Math.min(m.leaseUntil,at);m.at=at;
    return active;
  }
  function stopAll(state,at,reason,record) {for(const p of state.players)stop(state,p,at,reason,record);}
  function settle(state,until,record) {
    let changed=false;
    if(state.phase!=='roam')return false;
    for(const p of state.players){
      const m=p.motion;if(!p.alive||!m||until<=m.at)continue;
      const active=m.manual||m.path.length>0;if(!active)continue;
      const start=m.at,end=m.manual?Math.min(until,m.leaseUntil):until;
      const initial=point(p.position);let budget=Math.max(0,end-start)*speed/1000,used=0,finishedAt=end,reason=null;
      if(m.manual&&budget>0){
        const norm=Math.hypot(m.dx,m.dy);if(norm)p.position=point(moveWorldPoint(p.position,m.dx/norm,m.dy/norm,budget));
      }else if(m.path.length&&budget>0){
        while(m.path.length&&budget>1e-8){
          const target=m.path[0],gap=distance(p.position,target);
          if(gap<1e-6){p.position=point(target);m.path.shift();continue;}
          const amount=Math.min(gap,budget),next=point(moveWorldPoint(p.position,(target.x-p.position.x)/gap,(target.y-p.position.y)/gap,amount));
          const actual=distance(p.position,next);p.position=next;used+=amount;budget-=amount;
          if(distance(p.position,target)<1e-5){p.position=point(target);m.path.shift();}
          else if(actual<amount-1e-5){reason='blocked';m.path=[];m.destination=null;break;}
        }
        if(!m.path.length){reason??='arrived';m.destination=null;finishedAt=start+used/speed*1000;}
      }
      m.at=until;changed=true;
      const room=worldRoomAt(p.position);if(room)p.roomId=typeof room==='string'?room:room.id;
      if(m.manual&&until>=m.leaseUntil){m.manual=false;reason='lease_expired';finishedAt=m.leaseUntil;}
      if(reason||(!same(initial,p.position)&&end-m.recordedAt>=1000)){
        record(state,'motion',reason?finishedAt:end,{playerId:p.id,position:point(p.position),reason:reason??'sample'});m.recordedAt=reason?finishedAt:end;
      }
    }
    return changed;
  }
  function navigation(p,target,now) {
    if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y)||!isWalkable(target))return null;
    const found=findWorldPath(p.position,target);
    if(!Array.isArray(found)||found.length>4096||(!found.length&&!same(p.position,target)))return null;
    const path=found.map(point).filter(q=>!same(q,p.position));
    if(path.some(q=>!Number.isFinite(q.x)||!Number.isFinite(q.y)||!isWalkable(q)))return null;
    if(path.length&&!same(path.at(-1),target))return null;
    return path;
  }
  function navigate(p,target,path,now) {
    const m=p.motion;m.manual=false;m.leaseUntil=Math.min(m.leaseUntil,now);m.path=path;m.destination=path.length?point(target):null;m.at=now;
  }
  function input(p,request,now) {
    const m=p.motion;const changed=m.dx!==request.dx||m.dy!==request.dy||m.path.length>0||m.manual!==!!(request.dx||request.dy);
    m.seq=request.seq;m.dx=request.dx;m.dy=request.dy;m.leaseUntil=now+lease;m.at=now;m.manual=!!(request.dx||request.dy);m.path=[];m.destination=null;
    return changed;
  }
  const moving=(state,p,now)=>state.phase==='roam'&&p.alive&&!!(p.motion.path.length||(p.motion.manual&&now<p.motion.leaseUntil));
  return {WORLD,walkable:isWalkable,station,bell:WORLD_BELL?.position??WORLD_BELL,initialize,settle,stop,stopAll,navigation,navigate,input,moving,sees,nearby,point};
}
