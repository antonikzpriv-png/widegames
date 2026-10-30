import {canWorldAct} from '../features.mjs';
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
  // Only immutable public collision data may outlive a query. Cache entries
  // contain fixed grid legality, never targets, actors, routes or match state.
  const immutable=value=>Object.isFrozen(value),cacheable=immutable(geometry)&&immutable(WORLD)&&[WORLD_FLOORS,WORLD_OBSTACLES,fixtures.doors].every(rows=>immutable(rows)&&rows.every(immutable));
  let staticGrid=null;const doorGrids=new Map();
  const grid=nodes=>({safe:new Uint8Array(nodes),edges:new Uint8Array(nodes*2)});
  function gridFor(nodes,doors){
    if(!cacheable)return grid(nodes);
    staticGrid??=grid(nodes);if(!doors.length)return staticGrid;
    const signature=JSON.stringify(doors.map(d=>d.id).sort());
    let value=doorGrids.get(signature);if(value)doorGrids.delete(signature);else value=grid(nodes);
    doorGrids.set(signature,value);if(doorGrids.size>4)doorGrids.delete(doorGrids.keys().next().value);
    return value;
  }
  function collisionSweep(from,length,state,doorsOnly=false){
    const solids=doorsOnly?closed(state):[...WORLD_OBSTACLES,...closed(state)];
    const r=WORLD.bodyRadius,d=r/Math.SQRT2,probes=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[d,d],[-d,d],[d,-d],[-d,-d]];
    const localFloors=doorsOnly?[]:WORLD_FLOORS.filter(f=>f.x<=from.x+length+r&&f.x+f.width>=from.x-length-r&&f.y<=from.y+length+r&&f.y+f.height>=from.y-length-r);
    function interval(a,x,y,rect,strict=false){let low=0,high=1;for(const [v,delta,min,size] of [[a.x,x,rect.x,rect.width],[a.y,y,rect.y,rect.height]]){if(Math.abs(delta)<1e-12){if(strict?v<=min||v>=min+size:v<min||v>min+size)return null;}else{let first=(min-v)/delta,last=(min+size-v)/delta;if(first>last)[first,last]=[last,first];low=Math.max(low,first);high=Math.min(high,last);if(strict?low>=high:low>high)return null;}}return [low,high];}
    return function swept(a,x,y){
      let until=1;
      // Every body probe must remain in the union of floors for the WHOLE
      // segment, including concave corridor seams whose endpoints are valid.
      if(!doorsOnly)for(const [ox,oy] of probes){const ranges=[];for(const floor of localFloors){const span=interval({x:a.x+ox,y:a.y+oy},x,y,floor);if(span)ranges.push(span);}ranges.sort((a,b)=>a[0]-b[0]);let covered=0;for(const [low,high] of ranges){if(low>covered+1e-12)break;covered=Math.max(covered,high);}until=Math.min(until,covered);}
      for(const rect of solids){
        for(const expanded of [{x:rect.x-r,y:rect.y,width:rect.width+2*r,height:rect.height},{x:rect.x,y:rect.y-r,width:rect.width,height:rect.height+2*r}]){const span=interval(a,x,y,expanded,true);if(span)until=Math.min(until,span[0]);}
        const speed=x*x+y*y;if(!speed)continue;
        for(const cx of [rect.x,rect.x+rect.width])for(const cy of [rect.y,rect.y+rect.height]){const px=a.x-cx,py=a.y-cy,dot=px*x+py*y,disc=dot*dot-speed*(px*px+py*py-r*r);if(disc<=0||dot>=0)continue;const hit=(-dot-Math.sqrt(disc))/speed;if(hit>=-1e-9&&hit<=1)until=Math.min(until,Math.max(0,hit));}
      }
      return until;
    };
  }
  const segment=(a,b,walk,state)=>valid(a)&&valid(b)&&walk(a)&&walk(b)&&collisionSweep(a,distance(a,b),state)(a,b.x-a.x,b.y-a.y)>=1-1e-9;
  // Validate the accepted polyline itself, never a newly computed alternate path.
  function routeClear(start,waypoints,state){
    const walk=checker(state);let previous=start;
    for(const next of waypoints){if(!segment(previous,next,walk,state))return false;previous=next;}
    return true;
  }
  function radius(state,observerId){
    const rules={...DEFAULT_BEACON_RULES,...state?.beaconRules},observer=observerId===undefined||observerId===null?null:state?.players?.find(p=>p.id===observerId);
    if(observerId!==undefined&&observerId!==null&&(!observer||!canWorldAct(state,observer)||inTransit(state,observerId)))return 0;
    const base=state?.lobbySettings?.vision??(observer?.role==='saboteur'?rules.saboteurVisionRadius:rules.visionRadius);
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
    const norm=Math.hypot(dx,dy);if(!norm||!amount)return point(from);
    const length=Math.min(amount,WORLD.width+WORLD.height),n=Math.max(1,Math.ceil(length/4)),unitX=dx/Math.max(1,norm),unitY=dy/Math.max(1,norm);let current=point(from),contacted=false,stepX=0,stepY=0;
    // Reach contact rather than dropping a whole substep; project onto the
    // tangent of rounded props so diagonal input does not snag their corners.
    const solids=[...WORLD_OBSTACLES,...closed(state)];
    function normalAt(p){
      for(const r of solids){const x=p.x-Math.max(r.x,Math.min(p.x,r.x+r.width)),y=p.y-Math.max(r.y,Math.min(p.y,r.y+r.height)),d=Math.hypot(x,y);if(d>0&&d<WORLD.bodyRadius+.001)return {x:x/d,y:y/d};}
      const x=stepX&&!walk({x:p.x+Math.sign(stepX)*.001,y:p.y})?-Math.sign(stepX):0,y=stepY&&!walk({x:p.x,y:p.y+Math.sign(stepY)*.001})?-Math.sign(stepY):0,d=Math.hypot(x,y);
      return d?{x:x/d,y:y/d}:null;
    }
    const swept=collisionSweep(from,length,state);
    function advance(a,x,y){if(!x&&!y)return {position:a,fraction:1};let fraction=swept(a,x,y);if(fraction<1)fraction=Math.max(0,fraction-1e-7);const position={x:a.x+x*fraction,y:a.y+y*fraction};return {position,fraction};}
    for(let i=0;i<n;i++){
      // A partial final step samples the canonical full step's timed segments.
      // Re-solving a shorter contact can choose a different tangent and jitter.
      stepX=unitX*4;stepY=unitY*4;const take=Math.min(1,(length-i*4)/4);
      const before=current,normal=slide&&contacted?normalAt(current):null,dot=normal?Math.min(0,stepX*normal.x+stepY*normal.y):0;
      const x=stepX-(normal?.x??0)*dot,y=stepY-(normal?.y??0)*dot,moved=advance(current,x,y),first=moved.position,f=moved.fraction;
      const interpolate=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      if(f===1)current=interpolate(before,first,take);
      else if(take<=f)current=interpolate(before,first,f?take/f:0);
      else if(!slide)current=first;
      else{
        const hit=normalAt(first),remaining=1-f;let last;
        if(hit){const inward=Math.min(0,x*hit.x+y*hit.y);last=advance(first,(x-hit.x*inward)*remaining,(y-hit.y*inward)*remaining).position;}
        else{const horizontal=advance(first,x*remaining,0).position,vertical=advance(first,0,y*remaining).position;last=distance(first,horizontal)>=distance(first,vertical)?horizontal:vertical;}
        current=interpolate(first,last,(take-f)/remaining);
      }
      contacted=f<1||!!normal;
      if(take<1||distance(before,current)<1e-8||!slide&&f<1)break;
    }
    return current;
  }
  function path(start,target,state){
    const walk=checker(state);if(!walk(start)||!walk(target))return null;if(distance(start,target)<.01)return [];
    if(segment(start,target,walk,state))return [point(target)];
    const size=WORLD.grid,columns=Math.ceil(WORLD.width/size),rows=Math.ceil(WORLD.height/size),nodes=columns*rows;if(nodes>50000)return null;
    const doors=closed(state);
    if(cacheable&&!doors.length&&typeof geometry.findWorldPath==='function'){
      // The public helper owns static grid caches but uses an older sampled
      // segment check. Treat its result as a proposal and sweep EVERY segment.
      let candidate;try{candidate=geometry.findWorldPath(point(start),point(target));}catch{candidate=null;}
      if(Array.isArray(candidate)&&candidate.length>0&&candidate.length<=4096&&candidate.every(valid)&&distance(candidate.at(-1),target)<1e-7&&routeClear(start,candidate,state))return candidate.map(point);
    }
    const {safe,edges}=gridFor(nodes,doors),toPoint=id=>({x:id%columns*size,y:Math.floor(id/columns)*size});
    const staticCell=id=>{if(!staticGrid.safe[id])staticGrid.safe[id]=isWalkable(toPoint(id))?2:1;return staticGrid.safe[id]===2;};
    const cell=id=>{if(!safe[id])safe[id]=(cacheable?staticCell(id)&&walk(toPoint(id)):walk(toPoint(id)))?2:1;return safe[id]===2;};
    const edge=(a,b)=>{
      const key=Math.min(a,b)*2+(Math.abs(a-b)===columns?1:0);
      if(!edges[key]){
        if(cacheable&&edges!==staticGrid.edges){if(!staticGrid.edges[key])staticGrid.edges[key]=segment(toPoint(a),toPoint(b),isWalkable,undefined)?2:1;const from=toPoint(a),to=toPoint(b);edges[key]=staticGrid.edges[key]===2&&collisionSweep(from,distance(from,to),state,true)(from,to.x-from.x,to.y-from.y)>=1-1e-9?2:1;}
        else edges[key]=segment(toPoint(a),toPoint(b),walk,state)?2:1;
      }
      return edges[key]===2;
    };
    function anchor(p){const list=[],cx=Math.round(p.x/size),cy=Math.round(p.y/size);for(let y=cy-2;y<=cy+2;y++)for(let x=cx-2;x<=cx+2;x++){if(x<0||y<0||x>=columns||y>=rows)continue;const id=y*columns+x;list.push({id,d:distance(p,toPoint(id))});}list.sort((a,b)=>a.d-b.d||a.id-b.id);return list.find(v=>cell(v.id)&&segment(p,toPoint(v.id),walk,state))?.id;}
    const first=anchor(start),last=anchor(target);if(first===undefined||last===undefined)return null;
    const queue=new Int32Array(nodes),parents=new Int32Array(nodes);parents.fill(-1);parents[first]=first;queue[0]=first;let head=0,tail=1;
    while(head<tail&&parents[last]===-1){const id=queue[head++],x=id%columns,y=Math.floor(id/columns);for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=columns||ny<0||ny>=rows)continue;const next=ny*columns+nx;if(parents[next]!==-1||!cell(next)||!edge(id,next))continue;parents[next]=id;queue[tail++]=next;}}
    if(parents[last]===-1)return null;const raw=[];for(let id=last;;id=parents[id]){raw.push(toPoint(id));if(id===first)break;}raw.reverse();raw.push(point(target));
    const result=[];for(let i=0;i<raw.length;i++){const previous=i?raw[i-1]:start,next=raw[i+1],current=raw[i];if(next&&(current.x-previous.x)*(next.y-current.y)===(current.y-previous.y)*(next.x-current.x))continue;if(distance(result.at(-1)||start,current)>.01)result.push(current);}
    return result.length<=4096&&routeClear(start,result,state)?result:null;
  }
  const station=id=>{const value=Array.isArray(WORLD_STATIONS)?WORLD_STATIONS.find(s=>s.roomId===id||s.id===id):WORLD_STATIONS[id];return value?.position??value;};
  const spawnRoomId=geometry.WORLD_SPAWN_ROOM??(WORLD_ROOMS.some(r=>r.id==='bridge')?'bridge':geometry.ROOM_LAYOUT?.[0]?.id??WORLD_ROOMS[0]?.id);
  const spawnRoom=WORLD_ROOMS.find(r=>r.id===spawnRoomId);if(!spawnRoom)throw new TypeError('Invalid spatial spawn room');
  const viewpoint=point(geometry.WORLD_VIEWPOINT??spawnRoom.center??worldSpawn('p2'));if(!isWalkable(viewpoint))throw new TypeError('Spatial viewpoint must be walkable');
  return {WORLD,point,valid,floor,inTransit,walkable,motionGeometry,move,path,routeClear,sees,nearby,radius,station,bell:WORLD_BELL?.position??WORLD_BELL,worldRoomAt,worldSpawn,distance,viewpoint,staticWalkable:isWalkable,rooms:WORLD_ROOMS,spawnRoom,fixtures,viewpointMode:spawnRoom.id==='bridge'?'bridge':'viewpoint'};
}
