/** Static map-scoped geometry; bounded caches belong only to this immutable descriptor. */
import {deepFreeze} from './freeze.mjs';
export function createMapGeometry(data){
 deepFreeze(data);
 const {WORLD,WORLD_ROOMS,WORLD_FLOORS,WORLD_OBSTACLES,WORLD_STATIONS,WORLD_BELL,spawns}=data;
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=(p,r)=>p.x>=r.x&&p.x<=r.x+r.width&&p.y>=r.y&&p.y<=r.y+r.height;
const floor=p=>point(p)&&WORLD_FLOORS.some(r=>inside(p,r));
// Static geometry caches have at most one entry per fixed grid node/edge.
const gridSafety=new Map(),gridEdges=new Map();
function distance(a,b){return point(a)&&point(b)?Math.hypot(a.x-b.x,a.y-b.y):Infinity;}
function worldRoomAt(position){return WORLD_ROOMS.find(room=>point(position)&&inside(position,room))?.id??null;}
function worldSpawn(playerId){const number=/^p[1-9][0-9]*$/.test(playerId)?Number(playerId.slice(1))-1:0;return {...spawns[Number.isSafeInteger(number)&&number<spawns.length?number:0]};}
function isWalkable(position,radius=WORLD.bodyRadius){
 if(!point(position)||!Number.isFinite(radius)||radius<0||radius>100)return false;
 const diagonal=radius/Math.SQRT2;
 for(const [x,y] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius],[diagonal,diagonal],[-diagonal,diagonal],[diagonal,-diagonal],[-diagonal,-diagonal]]){
  if(!floor({x:position.x+x,y:position.y+y}))return false;
 }
 return !WORLD_OBSTACLES.some(r=>{
  const x=Math.max(r.x,Math.min(position.x,r.x+r.width)),y=Math.max(r.y,Math.min(position.y,r.y+r.height));
  return Math.hypot(position.x-x,position.y-y)<radius||(radius===0&&inside(position,r));
 });
}
function clearSegment(from,to,radius=WORLD.bodyRadius){
 if(!point(from)||!point(to))return false;
 const length=distance(from,to),steps=Math.max(1,Math.ceil(length/7));
 for(let i=0;i<=steps;i++)if(!isWalkable({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps},radius))return false;
 return true;
}
function canSeeWorldPoint(from,to){
 if(distance(from,to)>WORLD.visibilityRadius||!floor(from)||!floor(to))return false;
 // Static props are opaque on Annex; dynamic doors belong to authoritative spatial state.
 for(const r of WORLD_OBSTACLES){let low=0,high=1,hit=true;for(const axis of ['x','y']){const size=axis==='x'?'width':'height',delta=to[axis]-from[axis];if(Math.abs(delta)<1e-12){if(from[axis]<r[axis]||from[axis]>r[axis]+r[size]){hit=false;break;}}else{let a=(r[axis]-from[axis])/delta,b=(r[axis]+r[size]-from[axis])/delta;if(a>b)[a,b]=[b,a];low=Math.max(low,a);high=Math.min(high,b);if(low>high){hit=false;break;}}}if(hit)return false;}
 const steps=Math.max(1,Math.ceil(distance(from,to)/7));
 for(let i=0;i<=steps;i++)if(!floor({x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps}))return false;
 return true;
}
function moveWorldPoint(position,dx,dy,amount){
 if(!isWalkable(position)||![dx,dy,amount].every(Number.isFinite)||amount<0)return {...position};
 const magnitude=Math.hypot(dx,dy);if(!magnitude)return {...position};
 const scale=Math.max(1,magnitude),length=Math.min(amount,WORLD.width+WORLD.height),steps=Math.max(1,Math.ceil(length/6));
 const x=dx/scale*length/steps,y=dy/scale*length/steps;let current={...position};
 for(let i=0;i<steps;i++){
  const next={x:current.x+x,y:current.y+y};
  if(isWalkable(next)){current=next;continue;}
  const horizontal={x:current.x+x,y:current.y};if(isWalkable(horizontal))current=horizontal;
  const vertical={x:current.x,y:current.y+y};if(isWalkable(vertical))current=vertical;
 }
 return current;
}
/** A bounded grid route. Waypoints exclude the input start and end at the target. */
function findWorldPath(start,target){
 if(!isWalkable(start)||!isWalkable(target))return null;
 if(distance(start,target)<.01)return [];
 if(clearSegment(start,target))return [{x:target.x,y:target.y}];
 const size=WORLD.grid,columns=Math.ceil(WORLD.width/size),rows=Math.ceil(WORLD.height/size);
 if(columns*rows>50000)return null;
 const toPoint=id=>({x:(id%columns)*size,y:Math.floor(id/columns)*size});
 const walkable=id=>{if(!gridSafety.has(id))gridSafety.set(id,isWalkable(toPoint(id)));return gridSafety.get(id);};
 const edge=(a,b)=>{const key=a<b?`${a}:${b}`:`${b}:${a}`;if(!gridEdges.has(key))gridEdges.set(key,clearSegment(toPoint(a),toPoint(b)));return gridEdges.get(key);};
 const nodeFor=p=>{
  const candidates=[];const cx=Math.round(p.x/size),cy=Math.round(p.y/size);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const x=cx+dx,y=cy+dy;if(x<0||x>=columns||y<0||y>=rows)continue;
   const id=y*columns+x,q=toPoint(id);candidates.push({id,d:distance(p,q)});
  }
  candidates.sort((a,b)=>a.d-b.d||a.id-b.id);
  return candidates.find(candidate=>walkable(candidate.id)&&clearSegment(p,toPoint(candidate.id)))?.id;
 };
 const first=nodeFor(start),last=nodeFor(target);if(first===undefined||last===undefined)return null;
 const queue=[first],parents=new Map([[first,null]]);let head=0;
 while(head<queue.length&&!parents.has(last)){
  const id=queue[head++],x=id%columns,y=Math.floor(id/columns);
  for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=columns||ny<0||ny>=rows)continue;
   const next=ny*columns+nx;if(parents.has(next)||!walkable(next)||!edge(id,next))continue;
   parents.set(next,id);queue.push(next);
  }
 }
 if(!parents.has(last))return null;
 const raw=[];for(let id=last;id!==null;id=parents.get(id))raw.push(toPoint(id));raw.reverse();raw.push({x:target.x,y:target.y});
 // Merge only collinear grid edges: linear work, with no new untested shortcuts.
 const route=[];
 for(let i=0;i<raw.length;i++){
  const previous=i?raw[i-1]:start,next=raw[i+1],current=raw[i];
  if(next&&(current.x-previous.x)*(next.y-current.y)===(current.y-previous.y)*(next.x-current.x))continue;
  if(distance(route.at(-1)||start,current)>.01)route.push(current);
 }
 return route;
}

 return deepFreeze({WORLD,WORLD_ROOMS,WORLD_FLOORS,WORLD_OBSTACLES,WORLD_STATIONS,WORLD_BELL,ROOM_LAYOUT:data.ROOM_LAYOUT,WORLD_VIEWPOINT:data.WORLD_VIEWPOINT,WORLD_SPAWN_ROOM:data.WORLD_SPAWN_ROOM,fixtures:data.fixtures,worldRoomAt,worldSpawn,distance,isWalkable,moveWorldPoint,canSeeWorldPoint,findWorldPath});
}
