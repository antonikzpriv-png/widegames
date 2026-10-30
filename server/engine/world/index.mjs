import {spatialGeometry} from './geometry.mjs';
import {spatialMotion} from './motion.mjs';
import {spatialKnowledge} from './knowledge.mjs';
/** Schema3 implementation only. Schema1/2 remain on the immutable legacy runtime. */
export function createSpatialWorld(geometry){
  const g=spatialGeometry(geometry),motion=spatialMotion(g),knowledge=spatialKnowledge(g);
  function initialize(state,now){
    if(!Number.isSafeInteger(now)||now<0||!Array.isArray(state.players)||!state.players.length||state.players.length>32||state.players.some(p=>!p||typeof p.id!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(p.id))||new Set(state.players.map(p=>p.id)).size!==state.players.length)throw new TypeError('Invalid spatial initialization');
    const used=[];for(const p of state.players){let position=g.worldSpawn(p.id);if(!g.staticWalkable(position)||used.some(q=>g.distance(q,position)<g.WORLD.bodyRadius*2)){
      const room=g.spawnRoom,candidates=[];for(let y=room.y+room.height-g.WORLD.bodyRadius-5;y>=room.y+g.WORLD.bodyRadius;y-=32)for(let x=room.x+g.WORLD.bodyRadius+5;x<=room.x+room.width-g.WORLD.bodyRadius;x+=32)candidates.push({x,y});position=candidates.find(q=>g.staticWalkable(q)&&used.every(other=>g.distance(other,q)>=g.WORLD.bodyRadius*2));}
      if(!position)throw new TypeError('No safe roster spawn');p.position=g.point(position);used.push(p.position);p.motion={seq:0,dx:0,dy:0,leaseUntil:now,at:now,manual:false,path:[],destination:null,recordedAt:now,error:null};const room=g.worldRoomAt(position);if(room)p.roomId=typeof room==='string'?room:room.id;
    }
    state.spatial={version:1,spectator:{position:g.point(g.viewpoint)}};knowledge.initialize(state);
  }
  function validateSpatialState(state){
    const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
    if(!keys(state.spatial,['version','spectator'])||state.spatial.version!==1||!keys(state.spatial.spectator,['position','knowledge'])||!keys(state.spatial.spectator.position,['x','y'])||state.spatial.spectator.position.x!==g.viewpoint.x||state.spatial.spectator.position.y!==g.viewpoint.y||!Array.isArray(state.players)||!state.players.length||state.players.length>32||new Set(state.players.map(p=>p.id)).size!==state.players.length)throw new TypeError('Invalid spatial state');
    for(const p of state.players){const m=p.motion;if(!g.valid(p.position)||!g.staticWalkable(p.position)||!m||!Number.isSafeInteger(m.seq)||m.seq<0||![m.dx,m.dy].every(n=>Number.isInteger(n)&&n>=-1&&n<=1)||typeof m.manual!=='boolean'||![m.at,m.leaseUntil,m.recordedAt].every(n=>Number.isFinite(n)&&n>=0)||!Array.isArray(m.path)||m.path.length>4096||m.path.some(q=>!g.valid(q)||!g.staticWalkable(q))||(m.destination!==null&&!g.valid(m.destination))||(m.path.length===0)!==(m.destination===null)||m.manual&&(!(m.dx||m.dy)||m.path.length)||m.leaseUntil>m.at+g.WORLD.inputLeaseMs+1e-6||m.recordedAt>m.at+1e-6||m.error!==null&&(!m.error||typeof m.error.code!=='string'||typeof m.error.message!=='string'||Object.keys(m.error).some(k=>!['code','message'].includes(k)))||(!p.alive||state.phase!=='roam'||g.inTransit(state,p.id))&&(m.manual||m.path.length))throw new TypeError('Invalid spatial motion');}
    for(const p of state.players){const a=p.motion.anchor;if(a!==undefined&&(!keys(a,['position','at','doors'])||!keys(a.position,['x','y'])||!g.staticWalkable(a.position)||!Number.isFinite(a.at)||a.at<0||a.at>p.motion.at||p.motion.at-a.at>g.WORLD.inputLeaseMs||typeof a.doors!=='string'||a.doors.length>2048||!p.motion.manual))throw new TypeError('Invalid spatial steering anchor');}
    return knowledge.validate(state);
  }
  return {WORLD:g.WORLD,point:g.point,walkable:g.walkable,station:g.station,bell:g.bell,sees:g.sees,nearby:g.nearby,initialize,...motion,observe:knowledge.observe,projectWorld:knowledge.projectWorld,adoptVitals:knowledge.adoptVitals,validateSpatialState};
}
