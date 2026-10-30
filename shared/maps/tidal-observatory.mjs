/** Original expanded map data. No engine state or generated navigation caches live here. */
const freeze=value=>{
 if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
 return value;
};
const room=(id,name,description,x,y,width,height,neighbors,palette)=>({id,name,description,x,y,width,height,center:{x:x+width/2,y:y+height/2},neighbors,palette});
const rooms=[
 room('archive','Tide Archive','Double-height forecast stacks and salvaged voyage records.',120,120,560,400,['bridge','lens'],['#9789b8','#c9bedc']),
 room('bridge','Observation Bridge','A glass-roofed chart gallery overlooking the whole tide ring.',900,80,600,440,['archive','lantern','radio'],['#69aebb','#afd5d1']),
 room('lantern','Great Orrery','A brass celestial instrument tracks the beacon through the storm.',1720,120,560,400,['bridge','charts','sonar'],['#d2a35c','#edcf8c']),
 room('charts','Chart Atelier','Drafting benches, survey plates and a long illuminated star chart.',2500,120,560,400,['lantern','spectrum'],['#7e9db4','#b6cbd6']),
 room('spectrum','Spectrum Gallery','Prism racks divide the lighthouse signal into calibrated bands.',2500,820,560,400,['charts','engine','sonar'],['#ac8eb3','#d1bbd3']),
 room('engine','Pressure House','Working pumps and isolated accumulators keep the observatory afloat.',2500,1520,560,400,['spectrum','intake'],['#8198ac','#b5c5cc']),
 room('intake','Seawater Intake','Heavy filter tanks admit seawater beneath the east service walk.',2500,2080,560,300,['engine','galley'],['#6eaaa5','#abd0be']),
 room('galley','Keeper Refectory','Copper kettles, water filters and provisions for a long watch.',1720,2080,560,300,['intake','conservatory','sonar'],['#bc8f7e','#e1baa0']),
 room('conservatory','Salt Conservatory','Hardy storm plants grow beside the south instruments and windows.',900,2080,600,300,['galley','workshop','radio'],['#86aa83','#b8cea3']),
 room('workshop','Instrument Workshop','Meter benches, spare lens mounts and carefully labeled tool cabinets.',120,2080,560,300,['conservatory','ballast'],['#b59e6f','#d6c598']),
 room('ballast','Ballast Vault','A quiet lower vault of counterweights, trim tanks and pressure gauges.',120,1520,560,400,['workshop','lens'],['#849eac','#b8c8cc']),
 room('lens','Lens Laboratory','Original lens blanks and optical benches surround a clear testing lane.',120,820,560,400,['archive','ballast','radio'],['#ae917d','#d3bba0']),
 room('radio','Radio Cloister','A cross-deck listening hall connects the west ring to the central spines.',900,930,600,460,['bridge','conservatory','lens','sonar'],['#809eaf','#b8ced5']),
 room('sonar','Sonar Hall','An acoustic survey room and paired tide receivers anchor the east crossing.',1720,930,560,460,['lantern','galley','radio','spectrum'],['#77aaa6','#b4d4c5'])
];
const corridor=(id,x,y,width,height)=>({id,x,y,width,height});
const corridors=[
 corridor('north-west-walk',660,250,260,140),
 corridor('north-middle-walk',1480,250,260,140),
 corridor('north-east-walk',2260,250,260,140),
 corridor('west-upper-ring',330,500,140,340),
 corridor('west-middle-ring',330,1200,140,340),
 corridor('west-lower-ring',330,1900,140,200),
 corridor('east-upper-ring',2710,500,140,340),
 corridor('east-middle-ring',2710,1200,140,340),
 corridor('east-lower-ring',2710,1900,140,200),
 corridor('south-west-walk',660,2160,260,140),
 corridor('south-middle-walk',1480,2160,260,140),
 corridor('south-east-walk',2260,2160,260,140),
 corridor('bridge-service-spine',1130,500,140,450),
 corridor('orrery-service-spine',1930,500,140,450),
 corridor('conservatory-service-spine',1130,1370,140,730),
 corridor('refectory-service-spine',1930,1370,140,730),
 corridor('west-cross-deck',660,1090,260,140),
 corridor('central-cross-deck',1480,1090,260,140),
 corridor('east-cross-deck',2260,1090,260,140)
];
const focalKinds={archive:'shelf',bridge:'table',lantern:'machine',charts:'table',spectrum:'machine',engine:'tank',intake:'tank',galley:'table',conservatory:'planter',workshop:'machine',ballast:'tank',lens:'table',radio:'machine',sonar:'machine'};
const obstacles=rooms.flatMap(r=>[
 {id:`${r.id}-north-cabinet`,kind:'shelf',x:r.x+55,y:r.y+55,width:110,height:65,color:'#627783'},
 {id:`${r.id}-north-instruments`,kind:'machine',x:r.x+r.width/2-55,y:r.y+55,width:110,height:65,color:'#486c7a'},
 {id:`${r.id}-south-supplies`,kind:'crate',x:r.x+70,y:r.y+r.height-115,width:100,height:55,color:'#b69562'},
 {id:`${r.id}-south-unit`,kind:r.id==='conservatory'?'planter':'tank',x:r.x+r.width/2-55,y:r.y+r.height-130,width:110,height:70,color:r.id==='conservatory'?'#699e76':'#728d97'},
 {id:`${r.id}-central-equipment`,kind:focalKinds[r.id],x:r.x+125,y:r.y+r.height/2-40,width:100,height:80,color:r.id==='conservatory'?'#75a279':'#8b9b91'}
]);
const stations=Object.fromEntries(rooms.map(r=>[r.id,{id:`station-${r.id}`,x:r.x+r.width-85,y:r.y+r.height/2}]));
const decor=rooms.flatMap(r=>[
 {id:`${r.id}-wall-label`,kind:'label',x:r.x+r.width/2,y:r.y+r.height-28,text:r.name.toUpperCase(),color:'#244b58'},
 {id:`${r.id}-window-west`,kind:'light',x:r.x+26,y:r.y+r.height/2,color:'#c8f0e1'},
 {id:`${r.id}-window-east`,kind:'light',x:r.x+r.width-26,y:r.y+r.height/2,color:'#c8f0e1'}
]);
decor.push(
 {id:'north-ring-sign',kind:'label',x:1610,y:320,text:'NORTH OBSERVATION WALK',color:'#e9edd5'},
 {id:'west-crossing-sign',kind:'label',x:790,y:1160,text:'WEST CROSSING',color:'#e9edd5'},
 {id:'east-crossing-sign',kind:'label',x:2390,y:1160,text:'EAST CROSSING',color:'#e9edd5'},
 {id:'south-ring-sign',kind:'label',x:1610,y:2230,text:'SOUTH SERVICE WALK',color:'#e9edd5'}
);

export default freeze({
 id:'tidal-observatory',name:'Tidal Observatory',
 description:'Fourteen detailed observatory rooms around a broad tide ring, with twin instrument halls and two long service spines.',
 width:3200,height:2500,tasksPerCrew:12,
 rooms,floors:[...rooms,...corridors],obstacles,stations,
 bell:{x:1200,y:235},
 spawns:[{x:1170,y:270},{x:1260,y:270},{x:1350,y:270},{x:1170,y:330},{x:1260,y:330},{x:1350,y:330}],
 decor
});
