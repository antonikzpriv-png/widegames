/** Original expanded map data. Collision props match the visible industrial landmarks. */
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const roomSpecs=[
 ['archive','Tide Archive','Shelves of brass weather cylinders, tide records and a chart-restoration bench.',0,0,['#7d7caa','#b5b3d0'],'records'],
 ['bridge','Foundry Bridge','The elevated command deck: storm chart, emergency bell and six keeper berths.',1,0,['#5a9dac','#a2cdc6'],'navigation'],
 ['lantern','Prism Lantern','A prism workshop and shielded optical bench feed the foundry’s storm lens.',2,0,['#c89f59','#ecd49a'],'optics'],
 ['observatory','Cloud Observatory','A rotating telescope cradle and cloud instruments watch the northern squall.',3,0,['#827faf','#c1bfd8'],'telescope'],
 ['foundry','Casting Hall','Two furnace banks, alloy molds and a cooling trough flank the central casting dais.',0,1,['#a36759','#d8a58d'],'furnace'],
 ['workshop','Relay Workshop','Insulated relay cabinets and repair benches surround a serviceable signal console.',1,1,['#648f7f','#a9c9ad'],'tools'],
 ['signal','Signal Laboratory','Antenna tuners, oscilloscope racks and a Faraday test stand protect the radio relay.',2,1,['#628d9c','#aed1d4'],'signal'],
 ['filtration','Rain Filtration','Condensers and freshwater filters turn captured storm rain into drinking water.',3,1,['#629d9c','#afd4c5'],'filters'],
 ['cargo','Freight Gallery','Cargo crates, a manifest desk and loading winches secure the foundry’s supply chain.',0,2,['#9b8266','#d6c29b'],'crates'],
 ['galley','Keeper Galley','A kettle bank, provision cupboards and meal preparation tables serve the night watch.',1,2,['#ad7c68','#e2b69a'],'kitchen'],
 ['dynamo','Dynamo Chamber','Armature housings and capacitor banks stabilize the foundry’s emergency power.',2,2,['#7e8caa','#bec7d8'],'generator'],
 ['engine','Turbine Engine','The aft turbine hall, governor controls and pressure regulators keep every deck alive.',3,2,['#6d829c','#adbfcf'],'turbine']
];
const width=3000,height=2200,roomWidth=560,roomHeight=500;
const rooms=roomSpecs.map(([id,name,description,column,row,palette,theme])=>({id,name,description,x:140+column*680,y:120+row*680,width:roomWidth,height:roomHeight,center:{x:420+column*680,y:450+row*680},neighbors:[],palette,theme}));
const corridors=[];
for(let row=0;row<3;row++)for(let column=0;column<4;column++){
 const here=rooms[row*4+column];
 if(column<3){const next=rooms[row*4+column+1];here.neighbors.push(next.id);next.neighbors.push(here.id);corridors.push({id:`foundry-crosswalk-${row}-${column}`,x:here.x+here.width-20,y:here.y+190,width:160,height:120,name:'Riveted crosswalk'});}
 if(row<2){const next=rooms[(row+1)*4+column];here.neighbors.push(next.id);next.neighbors.push(here.id);corridors.push({id:`foundry-stairwell-${row}-${column}`,x:here.x+220,y:here.y+here.height-20,width:120,height:220,name:'Storm-shielded passage'});}
}
const obstacles=rooms.flatMap(room=>[
 {id:`${room.id}-left-bank`,x:room.x+55,y:room.y+50,width:145,height:70,kind:room.theme,color:room.palette[0]},
 {id:`${room.id}-right-bank`,x:room.x+335,y:room.y+50,width:160,height:65,kind:room.theme,color:room.palette[0]},
 {id:`${room.id}-landmark`,x:room.x+215,y:room.y+170,width:110,height:85,kind:room.theme,color:room.palette[0]},
 {id:`${room.id}-service-locker`,x:room.x+55,y:room.y+370,width:130,height:65,kind:'locker',color:room.palette[0]}
]);
const stations=Object.fromEntries(rooms.map(room=>[room.id,{id:`station-${room.id}`,x:room.x+480,y:room.y+250}]));
const bridge=rooms.find(room=>room.id==='bridge');
const decor=rooms.flatMap(room=>[
 {id:`${room.id}-label`,kind:'label',x:room.x+280,y:room.y+470,text:room.name.toUpperCase(),color:'#17384a'},
 {id:`${room.id}-floor-stripes`,kind:'stripes',x:room.x+220,y:room.y+330,width:260,height:100,color:'#e9d9a8'},
 {id:`${room.id}-lamps`,kind:'lamps',x:room.x+35,y:room.y+150,width:490,height:250,color:'#f8dda0'}
]);
export const STORM_FOUNDRY=freeze({
 id:'storm-foundry',name:'Storm Foundry',description:'A sprawling twelve-room industrial station with furnace galleries, optical laboratories and seventeen looping crosswalks.',
 width,height,tasksPerCrew:12,rooms,floors:[...rooms,...corridors],corridors,obstacles,stations,
 bell:{x:bridge.x+280,y:bridge.y+130},
 spawns:Array.from({length:6},(_,i)=>({x:bridge.x+290+(i%3)*62,y:bridge.y+330+Math.floor(i/3)*52})),
 decor
});
export const stormFoundry=STORM_FOUNDRY;
export default STORM_FOUNDRY;
