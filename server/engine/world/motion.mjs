export function spatialMotion(g){
  const same=(a,b)=>g.distance(a,b)<1e-7;
  function stop(state,p,at,reason,record){const m=p.motion;if(!Number.isFinite(at)||at<0||m&&at<m.at)throw new TypeError('Invalid spatial stop time');if(!m)return false;const active=m.manual||m.path.length>0||m.destination!==null;if(active)record(state,'motion',at,{playerId:p.id,position:g.point(p.position),reason});m.manual=false;delete m.anchor;m.path=[];m.destination=null;m.leaseUntil=Math.min(m.leaseUntil,at);m.at=at;return active;}
  function stopAll(state,at,reason,record){let changed=false;for(const p of state.players)changed=stop(state,p,at,reason,record)||changed;return changed;}
  function settle(state,until,record){
    if(!Number.isFinite(until)||until<0||state.phase!=='roam')return false;let changed=false;
    for(const p of state.players){const m=p.motion;if(!m||until<=m.at)continue;
      if(!p.alive||g.inTransit(state,p.id)){changed=stop(state,p,until,!p.alive?'death':'transit',record)||changed;continue;}
      if(!m.manual&&!m.path.length)continue;
      const start=m.at,end=m.manual?Math.min(until,m.leaseUntil):until,initial=g.point(p.position);let budget=Math.max(0,end-start)*g.WORLD.speed/1000,used=0,finishedAt=end,reason=null;
      if(m.manual&&budget>0){
        const doors=g.motionGeometry(state);
        // Re-evaluate the bounded (<=600ms) held-input trajectory from its own
        // origin, not from a tick-dependent rounded contact. JSON preserves the
        // anchor. Geometry boundaries rebase at the already settled position.
        if(!m.anchor||m.anchor.doors!==doors)m.anchor={position:g.point(p.position),at:start,doors};
        const norm=Math.hypot(m.dx,m.dy),elapsed=Math.max(0,end-m.anchor.at);
        if(norm)p.position=g.move(m.anchor.position,m.dx/norm,m.dy/norm,elapsed*g.WORLD.speed/1000,state);
      }
      else while(m.path.length&&budget>1e-8){const target=m.path[0],gap=g.distance(p.position,target);if(gap<1e-6){p.position=g.point(target);m.path.shift();continue;}const amount=Math.min(gap,budget),next=g.move(p.position,(target.x-p.position.x)/gap,(target.y-p.position.y)/gap,amount,state,false),actual=g.distance(p.position,next);p.position=next;used+=actual;budget-=amount;
        if(g.distance(p.position,target)<1e-5){p.position=g.point(target);m.path.shift();}else if(actual<amount-1e-5){reason='blocked';m.path=[];break;}}
      if(!m.manual&&!m.path.length){reason??='arrived';m.destination=null;finishedAt=start+used/g.WORLD.speed*1000;}
      m.at=until;changed=true;const room=g.worldRoomAt(p.position);if(room)p.roomId=typeof room==='string'?room:room.id;
      if(m.manual&&until>=m.leaseUntil){m.manual=false;delete m.anchor;reason='lease_expired';finishedAt=m.leaseUntil;}
      if(reason||(!same(initial,p.position)&&end-m.recordedAt>=1000)){record(state,'motion',reason?finishedAt:end,{playerId:p.id,position:g.point(p.position),reason:reason??'sample'});m.recordedAt=reason?finishedAt:end;}
    }
    return changed;
  }
  /** Called after settling to a geometry-change boundary and applying systems. */
  function invalidateRoutes(state,at,record){
    if(!Number.isFinite(at)||at<0||typeof record!=='function'||state.players.some(p=>p.motion?.path?.length&&at<p.motion.at))throw new TypeError('Invalid route invalidation time');
    let changed=false;
    for(const p of state.players)if(p.motion?.path?.length&&!g.routeClear(p.position,p.motion.path,state))changed=stop(state,p,at,'route_invalidated',record)||changed;
    return changed;
  }
  function navigation(p,target,now,state){if(!Number.isFinite(now)||now<0||!p.alive||g.inTransit(state,p.id)||!g.valid(target))return null;return g.path(p.position,target,state);}
  function navigate(p,target,path,now){if(!p.alive||!g.valid(target)||!Array.isArray(path)||path.length>4096||path.some(q=>!g.valid(q)||!g.staticWalkable(q))||path.length&&g.distance(path.at(-1),target)>1e-7||!path.length&&g.distance(p.position,target)>=.01||!Number.isSafeInteger(now)||now<p.motion.at)throw new TypeError('Invalid spatial route');const m=p.motion;m.manual=false;delete m.anchor;m.leaseUntil=Math.min(m.leaseUntil,now);m.path=path.map(g.point);m.destination=path.length?g.point(target):null;m.at=now;}
  function input(p,request,now){if(!p.alive||!request||Array.isArray(request)||Object.keys(request).some(k=>!['seq','dx','dy'].includes(k))||!Number.isSafeInteger(request.seq)||request.seq<=0||![request.dx,request.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1)||!Number.isSafeInteger(now)||now<p.motion.at)throw new TypeError('Invalid spatial input');const m=p.motion;if(request.seq<=m.seq)return false;const changed=m.dx!==request.dx||m.dy!==request.dy||m.path.length>0||m.manual!==!!(request.dx||request.dy);m.error=null;delete m.anchor;m.seq=request.seq;m.dx=request.dx;m.dy=request.dy;m.leaseUntil=now+g.WORLD.inputLeaseMs;m.at=now;m.manual=!!(request.dx||request.dy);m.path=[];m.destination=null;return changed;}
  const moving=(state,p,now)=>state.phase==='roam'&&p.alive&&!g.inTransit(state,p.id)&&!!(p.motion.path.length||(p.motion.manual&&now<p.motion.leaseUntil));
  return {stop,stopAll,settle,invalidateRoutes,navigation,navigate,input,moving};
}
