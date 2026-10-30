/** Lantern Beacon v2: original four-deck storm-service ship, not a reference-game layout. */
import {deepFreeze} from './freeze.mjs';
import {createMapGeometry} from './geometry.mjs';
import {STATION_TASK_KINDS} from '../station-contract.mjs';
const rect=(id,x,y,width,height)=>({id,x,y,width,height});
// Coordinates are world units. Six historical room IDs retain their meaning, not their old coordinates.
const plan=[
 ['bridge','Watch Bridge',1200,360,'chartwork','console','signal','Chart windows and a central muster bell command the forward watch.'],
 ['navigation','Tide Navigation',2000,360,'tidal-brass','console','alignment','Brass tide wheels align the forward crossing with the east service gallery.'],
 ['conservatory','Salt Conservatory',2800,360,'sea-glass','plant','glyphs','Salt-tolerant plants shelter behind east-facing storm glass.'],
 ['archive','Sounding Archive',400,900,'paper-copper','locker','sequence','Dry sounding records sit above the western flood-pressure valve.'],
 ['infirmary','Keeper Infirmary',1200,900,'linen-teal','bench','glyphs','A clean central ward holds the private keeper-vitals terminal.'],
 ['communications','Signal Exchange',2000,900,'signal-violet','console','signal','Insulated radio cabinets connect the forward and middle decks.'],
 ['lantern','Lantern Optics',2800,900,'amber-lens','fan','alignment','The beacon lens and shutter motor face the eastern weather.'],
 ['ballast','Ballast Control',400,1440,'pressure-blue','pump','manifolds','Pressure pumps guard the west gallery and lower dock connection.'],
 ['workshop','Copper Workshop',1200,1440,'tool-ochre','bench','circuit','Copper repair benches flank the lighting relay and power coupler.'],
 ['cargo','Supply Hold',2000,1440,'canvas-rust','crate','sequence','Secured supply crates leave a clear cross-deck walking lane.'],
 ['engine','Storm Engine',2800,1440,'turbine-red','fan','circuit','A sheltered turbine regulator feeds the eastern power circuit.'],
 ['docking','Mooring Dock',400,1980,'rope-slate','locker','sequence','Mooring lockers and weather windows overlook the aft berth.'],
 ['galley','Watch Galley',1200,1980,'warm-enamel','bench','manifolds','A warm mess room shelters the lower flood pump.'],
 ['reservoir','Freshwater Vault',2000,1980,'water-jade','pump','manifolds','Freshwater manifolds close the aft loop below the supply hold.']
];
const rooms=plan.map(([id,,x,y])=>({...rect(id,x-250,y-170,500,340),center:{x,y}}));
const byId=Object.fromEntries(rooms.map(r=>[r.id,r]));
const links=[];
for(const a of rooms)for(const b of rooms)if(a.id<b.id&&((a.center.y===b.center.y&&Math.abs(a.center.x-b.center.x)===800)||(a.center.x===b.center.x&&Math.abs(a.center.y-b.center.y)===540)))links.push([a.id,b.id]);
const passages=links.map(([a,b])=>{const p=byId[a].center,q=byId[b].center;return p.y===q.y?rect(`${a}-${b}-walk`,Math.min(p.x,q.x)+230,p.y-60,340,120):rect(`${a}-${b}-walk`,p.x-60,Math.min(p.y,q.y)+150,120,240);});
const roomLayout=plan.map(([id,name,x,y,,,,description])=>({id,name,x:x/32,y:y/24,description,neighbors:links.filter(pair=>pair.includes(id)).map(pair=>pair.find(other=>other!==id)).sort()}));
const taskKinds=Object.fromEntries(plan.map(([id,,,,,,kind])=>{if(!STATION_TASK_KINDS.includes(kind))throw new TypeError('Unsupported station kind');return [id,kind];}));
const art={rooms:Object.fromEntries(plan.map(([id,,, ,theme,machine])=>{const r=byId[id];return [id,{theme,props:[
 {id:`${id}-control`,kind:'console',x:r.x+32,y:r.y+28,width:130,height:35,solid:true},
 {id:`${id}-equipment`,kind:machine,x:r.x+65,y:r.y+90,width:100,height:70,solid:true},
 {id:`${id}-locker`,kind:'locker',x:r.x+440,y:r.y+50,width:30,height:100,solid:true},
 {id:`${id}-bench`,kind:'bench',x:r.x+60,y:r.y+280,width:100,height:28,solid:true},
 {id:`${id}-window`,kind:'window',x:r.x+210,y:r.y+8,width:170,height:12,solid:false},
 {id:`${id}-service-pipe`,kind:'pipe',x:r.x+210,y:r.y+317,width:175,height:8,solid:false}
 ]}];}))};
const position=(id,dx=0,dy=0)=>({x:byId[id].center.x+dx,y:byId[id].center.y+dy});
const site=(id,roomId,dx,dy,label)=>({id,roomId,position:position(roomId,dx,dy),label});
const fixtures={
 // Every threshold lies in a service corridor; the room graph remains connected with any two closed.
 doors:[
 {id:'beacon2-forward-crossing',roomId:'bridge',x:1586,y:300,width:28,height:120},
 {id:'beacon2-west-gallery',roomId:'archive',x:340,y:1156,width:120,height:28},
 {id:'beacon2-middle-crossing',roomId:'workshop',x:1586,y:1380,width:28,height:120},
 {id:'beacon2-east-gallery',roomId:'lantern',x:2740,y:1156,width:120,height:28},
 {id:'beacon2-aft-crossing',roomId:'galley',x:1586,y:1920,width:28,height:120}
 ],
 vents:[['archive',['navigation','ballast']],['navigation',['archive','engine']],['engine',['navigation','reservoir']],['reservoir',['engine','docking']],['docking',['reservoir','ballast']],['ballast',['docking','archive']]].map(([id,links])=>({id:`${id}-service-hatch`,roomId:id,position:position(id,-40,85),links:links.map(room=>`${room}-service-hatch`)})),
 repairs:{lights:[site('beacon2-light-relay','workshop',-80,70,'Copper lighting relay')],communications:[site('beacon2-radio','communications',100,-90,'Signal exchange relay')],power:[site('beacon2-turbine','engine',70,90,'Storm turbine regulator'),site('beacon2-coupler','workshop',70,-90,'Copper power coupler')],flood:[site('beacon2-galley-pump','galley',70,-90,'Mess flood pump'),site('beacon2-archive-valve','archive',70,-90,'Sounding pressure valve')]},
 devices:[{...site('beacon2-security','bridge',80,-90,'Service gallery camera console'),kind:'cameras'},{...site('beacon2-occupancy','navigation',80,80,'Deck occupancy console'),kind:'occupancy'},{...site('beacon2-vitals','infirmary',80,-90,'Keeper vitals console'),kind:'vitals'}],
 cameras:[{id:'beacon2-workshop-camera',roomId:'workshop',position:position('workshop',180,0),radius:300,facingRad:Math.PI,fovRad:Math.PI/2},{id:'beacon2-exchange-camera',roomId:'communications',position:position('communications',0,110),radius:300,facingRad:-Math.PI/2,fovRad:Math.PI/2},{id:'beacon2-dock-camera',roomId:'docking',position:position('docking',0,-100),radius:280,facingRad:Math.PI/2,fovRad:Math.PI/2}]
};
const geometry=createMapGeometry({WORLD:{version:1,width:3200,height:2400,speed:180,bodyRadius:14,visibilityRadius:360,interactionRadius:92,killRadius:70,reportRadius:130,inputLeaseMs:600,grid:28},WORLD_ROOMS:rooms,WORLD_FLOORS:[...rooms,...passages],WORLD_OBSTACLES:Object.values(art.rooms).flatMap(r=>r.props.filter(p=>p.solid).map(({id,x,y,width,height})=>({id,x,y,width,height}))),WORLD_STATIONS:Object.fromEntries(rooms.map(r=>[r.id,{id:`station-${r.id}`,x:r.center.x+150,y:r.center.y+65}])),WORLD_BELL:position('bridge',0,-70),ROOM_LAYOUT:roomLayout,WORLD_VIEWPOINT:position('bridge'),WORLD_SPAWN_ROOM:'bridge',spawns:Array.from({length:12},(_,i)=>position('bridge',-100+i%4*60,-20+Math.floor(i/4)*50)),fixtures});
export const BEACON_V2=deepFreeze({id:'beacon',version:2,name:'Lantern Beacon',description:'Fourteen original storm-ship rooms across four linked decks, with twin service galleries and alternate crossings.',theme:'beacon',roomLayout,geometry,fixtures,taskKinds,art});
