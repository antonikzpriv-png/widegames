import {spatialGeometry} from './geometry.mjs';
import {spatialMotion} from './motion.mjs';
/** Schema3 implementation only. Schema1/2 remain on the immutable legacy runtime. */
export function createSpatialWorld(geometry){
  const g=spatialGeometry(geometry),motion=spatialMotion(g);
  function initialize(state,now){
    if(!Number.isSafeInteger(now)||now<0||!Array.isArray(state.players)||!state.players.length||state.players.length>32||new Set(state.players.map(p=>p.id)).size!==state.players.length)throw new TypeError('Invalid spatial initialization');
    const used=[];for(const p of state.players){let position=g.worldSpawn(p.id);if(!g.staticWalkable(position)||used.some(q=>g.distance(q,position)<g.WORLD.bodyRadius*2)){
      const bridge=g.rooms.find(r=>r.id==='bridge'),candidates=[];for(let y=bridge.y+bridge.height-g.WORLD.bodyRadius-5;y>=bridge.y+g.WORLD.bodyRadius;y-=32)for(let x=bridge.x+g.WORLD.bodyRadius+5;x<=bridge.x+bridge.width-g.WORLD.bodyRadius;x+=32)candidates.push({x,y});position=candidates.find(q=>g.staticWalkable(q)&&used.every(other=>g.distance(other,q)>=g.WORLD.bodyRadius*2));}
      if(!position)throw new TypeError('No safe roster spawn');p.position=g.point(position);used.push(p.position);p.motion={seq:0,dx:0,dy:0,leaseUntil:now,at:now,manual:false,path:[],destination:null,recordedAt:now,error:null};const room=g.worldRoomAt(position);if(room)p.roomId=typeof room==='string'?room:room.id;
    }
    state.spatial={version:1,spectator:{position:g.point(g.viewpoint)}};
  }
  // Conservative milestone projection: observation implementation follows next.
  function projectWorld(state,viewerId,now){const self=state.players.find(p=>p.id===viewerId),ended=state.phase==='ended',origin=self?.position??g.viewpoint;return {players:state.players.map(p=>{const visible=ended||(p.id===viewerId&&!state.systems?.transit?.[p.id]);return{id:p.id,name:p.name,color:p.color,status:ended||p.id===viewerId?(p.alive?'alive':'dead'):'unknown',alive:ended||p.id===viewerId?p.alive:null,roomId:visible?p.roomId:null,position:visible?g.point(p.position):null,...(ended?{role:p.role}:{})};}),localEvents:[],vision:{radius:g.radius(state,viewerId),origin:g.point(origin),mode:self?'player':'bridge'}};}
  return {WORLD:g.WORLD,point:g.point,walkable:g.walkable,station:g.station,bell:g.bell,sees:g.sees,nearby:g.nearby,initialize,...motion,observe(){return false;},projectWorld};
}
