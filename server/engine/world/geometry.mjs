import {BEACON_DOORS,BEACON_VENTS,BEACON_DEVICES,DEFAULT_BEACON_RULES} from '../../../shared/beacon.mjs';
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
const point=p=>({x:p.x,y:p.y});
function intersects(a,b,r){
  let low=0,high=1;
  for(const axis of ['x','y']){const size=axis==='x'?'width':'height',delta=b[axis]-a[axis];if(Math.abs(delta)<1e-12){if(a[axis]<r[axis]||a[axis]>r[axis]+r[size])return false;}else{let first=(r[axis]-a[axis])/delta,last=(r[axis]+r[size]-a[axis])/delta;if(first>last)[first,last]=[last,first];low=Math.max(low,first);high=Math.min(high,last);if(low>high)return false;}}
  return true;
}
export function spatialGeometry(geometry){
  const {WORLD,WORLD_FLOORS,WORLD_OBSTACLES,WORLD_ROOMS,isWalkable,worldRoomAt,worldSpawn,distance,WORLD_STATIONS,WORLD_BELL}=geometry;
  if(!WORLD||!Array.isArray(WORLD_FLOORS)||!Array.isArray(WORLD_OBSTACLES)||!Array.isArray(WORLD_ROOMS)||![WORLD.width,WORLD.height,WORLD.speed,WORLD.bodyRadius,WORLD.grid,WORLD.inputLeaseMs].every(n=>Number.isFinite(n)&&n>0)||typeof isWalkable!=='function'||typeof distance!=='function')throw new TypeError('Invalid spatial geometry');
  const fixtures=geometry.fixtures??{doors:BEACON_DOORS,vents:BEACON_VENTS,devices:BEACON_DEVICES};
  if(!['doors','vents','devices'].every(key=>Array.isArray(fixtures[key])))throw new TypeError('Invalid spatial fixtures');
  const floor=p=>valid(p)&&WORLD_FLOORS.some(r=>inside(p,r));
  const inTransit=(state,id)=>!!state?.systems?.transit&&Object.hasOwn(state.systems.transit,id)&&!!state.systems.transit[id];
  const closed=state=>fixtures.doors.filter(d=>state?.systems?.doors?.some(s=>s.id===d.id&&s.closed===true));
  const checker=state=>{const doors=closed(state);return p=>valid(p)&&isWalkable(p)&&!doors.some(r=>{const x=Math.max(r.x,Math.min(p.x,r.x+r.width)),y=Math.max(r.y,Math.min(p.y,r.y+r.height));return Math.hypot(p.x-x,p.y-y)<WORLD.bodyRadius||inside(p,r);});};
  const walkable=(p,state)=>checker(state)(p);
  const motionGeometry=state=>closed(state).map(d=>d.id).sort().join("|");
  const segment=(a,b,walk)=>{if(!valid(a)||!valid(b))return false;const n=Math.max(1,Math.ceil(distance(a,b)/4));for(let i=0;i<=n;i++)if(!walk({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n}))return false;return true;};
  // Validate the accepted polyline itself, never a newly computed alternate path.
  function routeClear(start,waypoints,state){
    const walk=checker(state);let previous=start;
    for(const next of waypoints){if(!segment(previous,next,walk))return false;previous=next;}
    return true;
  }
  function radius(state,observerId){
    const rules={...DEFAULT_BEACON_RULES,...state?.beaconRules},observer=observerId===undefined||observerId===null?null:state?.players?.find(p=>p.id===observerId);
    if(observerId!==undefined&&observerId!==null&&(!observer||!observer.alive||inTransit(state,observerId)))return 0;
    const base=observer?.role==='saboteur'?rules.saboteurVisionRadius:rules.visionRadius;
    const value=state?.systems?.lights?.active&&observer?.role!=='saboteur'?Math.min(base,rules.lightsVisionRadius):base;
    return Number.isFinite(value)&&value>=0?value:0;
  }
  function sees(from,to,state,observerId){
    const vision=radius(state,observerId);
    if(!valid(from)||!valid(to)||vision<=0||distance(from,to)>vision||!floor(from)||!floor(to))return false;
    if([...WORLD_OBSTACLES,...closed(state)].some(r=>intersects(from,to,r)))return false;
    // Use raw floors, deliberately bypassing the legacy helper's fixed360 cap.
    const n=Math.max(1,Math.ceil(distance(from,to)/4));for(let i=0;i<=n;i++)if(!floor({x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n}))return false;
    return true;
  }
  const nearby=(from,to,range=WORLD.interactionRadius,state,actorId)=>Number.isFinite(range)&&range>=0&&distance(from,to)<=range&&sees(from,to,state,actorId);
  function move(from,dx,dy,amount,state,slide=true){
    const walk=checker(state);if(!walk(from)||![dx,dy,amount].every(Number.isFinite)||amount<0)return point(from);
    const norm=Math.hypot(dx,dy);if(!norm)return point(from);
    const length=Math.min(amount,WORLD.width+WORLD.height),n=Math.max(1,Math.ceil(length/4)),unitX=dx/Math.max(1,norm),unitY=dy/Math.max(1,norm);let current=point(from),contacted=false,stepX=0,stepY=0;
    // Reach contact rather than dropping a whole substep; project onto the
    // tangent of rounded props so diagonal input does not snag their corners.
    const solids=[...WORLD_OBSTACLES,...closed(state)];
    function normalAt(p){
      for(const r of solids){const x=p.x-Math.max(r.x,Math.min(p.x,r.x+r.width)),y=p.y-Math.max(r.y,Math.min(p.y,r.y+r.height)),d=Math.hypot(x,y);if(d>0&&d<WORLD.bodyRadius+.001)return {x:x/d,y:y/d};}
      const x=stepX&&!walk({x:p.x+Math.sign(stepX)*.001,y:p.y})?-Math.sign(stepX):0,y=stepY&&!walk({x:p.x,y:p.y+Math.sign(stepY)*.001})?-Math.sign(stepY):0,d=Math.hypot(x,y);
      return d?{x:x/d,y:y/d}:null;
    }
    function advance(a,x,y){if(!x&&!y)return {position:a,fraction:1};const next={x:a.x+x,y:a.y+y};if(walk(next))return {position:next,fraction:1};let low=0,high=1;for(let j=0;j<14;j++){const t=(low+high)/2;if(walk({x:a.x+x*t,y:a.y+y*t}))low=t;else high=t;}return {position:{x:a.x+x*low,y:a.y+y*low},fraction:low};}
    for(let i=0;i<n;i++){
      stepX=unitX*Math.min(4,length-i*4);stepY=unitY*Math.min(4,length-i*4);
      const before=current,normal=slide&&contacted?normalAt(current):null,dot=normal?Math.min(0,stepX*normal.x+stepY*normal.y):0;
      const x=stepX-(normal?.x??0)*dot,y=stepY-(normal?.y??0)*dot,moved=advance(current,x,y);current=moved.position;
      if(moved.fraction<1){
        if(!slide)break;contacted=true;
        const hit=normalAt(current),remaining=1-moved.fraction;
        if(hit){const inward=Math.min(0,x*hit.x+y*hit.y);current=advance(current,(x-hit.x*inward)*remaining,(y-hit.y*inward)*remaining).position;}
        else{current=advance(current,x*remaining,0).position;current=advance(current,0,y*remaining).position;}
      }else contacted=!!normal;
      if(distance(before,current)<1e-8)break;
    }
    return current;
  }
  function path(start,target,state){
    const walk=checker(state);if(!walk(start)||!walk(target))return null;if(distance(start,target)<.01)return [];
    if(segment(start,target,walk))return [point(target)];
    const size=WORLD.grid,columns=Math.ceil(WORLD.width/size),rows=Math.ceil(WORLD.height/size);if(columns*rows>50000)return null;
    const toPoint=id=>({x:id%columns*size,y:Math.floor(id/columns)*size}),safe=new Map(),edges=new Map();
    const cell=id=>{if(!safe.has(id))safe.set(id,walk(toPoint(id)));return safe.get(id);};
    const edge=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(!edges.has(key))edges.set(key,segment(toPoint(a),toPoint(b),walk));return edges.get(key);};
    function anchor(p){const list=[],cx=Math.round(p.x/size),cy=Math.round(p.y/size);for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++){if(x<0||y<0||x>=columns||y>=rows)continue;const id=y*columns+x;list.push({id,d:distance(p,toPoint(id))});}list.sort((a,b)=>a.d-b.d||a.id-b.id);return list.find(v=>cell(v.id)&&segment(p,toPoint(v.id),walk))?.id;}
    const first=anchor(start),last=anchor(target);if(first===undefined||last===undefined)return null;
    const queue=[first],parents=new Map([[first,null]]);let head=0;
    while(head<queue.length&&!parents.has(last)){const id=queue[head++],x=id%columns,y=Math.floor(id/columns);for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=columns||ny>=rows)continue;const next=ny*columns+nx;if(parents.has(next)||!cell(next)||!edge(id,next))continue;parents.set(next,id);queue.push(next);}}
    if(!parents.has(last))return null;const raw=[];for(let id=last;id!==null;id=parents.get(id))raw.push(toPoint(id));raw.reverse();raw.push(point(target));
    const result=[];for(let i=0;i<raw.length;i++){const previous=i?raw[i-1]:start,next=raw[i+1],current=raw[i];if(next&&(current.x-previous.x)*(next.y-current.y)===(current.y-previous.y)*(next.x-current.x))continue;if(distance(result.at(-1)||start,current)>.01)result.push(current);}
    return result.length<=4096?result:null;
  }
  const station=id=>{const value=Array.isArray(WORLD_STATIONS)?WORLD_STATIONS.find(s=>s.roomId===id||s.id===id):WORLD_STATIONS[id];return value?.position??value;};
  const spawnRoomId=geometry.WORLD_SPAWN_ROOM??(WORLD_ROOMS.some(r=>r.id==='bridge')?'bridge':geometry.ROOM_LAYOUT?.[0]?.id??WORLD_ROOMS[0]?.id);
  const spawnRoom=WORLD_ROOMS.find(r=>r.id===spawnRoomId);if(!spawnRoom)throw new TypeError('Invalid spatial spawn room');
  const viewpoint=point(geometry.WORLD_VIEWPOINT??spawnRoom.center??worldSpawn('p2'));if(!isWalkable(viewpoint))throw new TypeError('Spatial viewpoint must be walkable');
  return {WORLD,point,valid,floor,inTransit,walkable,motionGeometry,move,path,routeClear,sees,nearby,radius,station,bell:WORLD_BELL?.position??WORLD_BELL,worldRoomAt,worldSpawn,distance,viewpoint,staticWalkable:isWalkable,rooms:WORLD_ROOMS,spawnRoom,fixtures,viewpointMode:spawnRoom.id==='bridge'?'bridge':'viewpoint'};
}
