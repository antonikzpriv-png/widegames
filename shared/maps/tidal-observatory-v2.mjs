/** Original cutaway observatory. Revision 2 deliberately leaves the old saved deck intact. */
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const polygon=points=>points.map(([x,y])=>({x,y}));
const room=(id,name,description,bounds,points,center,palette,theme,labelPosition)=>({id,name,description,x:bounds[0],y:bounds[1],width:bounds[2],height:bounds[3],outline:polygon(points),center:{x:center[0],y:center[1]},neighbors:[],palette,theme,labelPosition:{x:labelPosition[0],y:labelPosition[1]}});

// The north instrument crown, western service hull and lower greenhouse are deliberately
// different silhouettes. Shared passages form useful routes around the open tide wells.
const rooms=[
 room('bridge','Observation Bridge','A sloping glass prow, captain’s tide chart, dispatch screens and a sheltered emergency bell.',[650,180,650,360],[[730,180],[1200,180],[1300,270],[1300,460],[1220,540],[650,540],[650,270]],[1000,440],['#416c83','#93b6bd'],'bridge',[980,510]),
 room('archive','Tide Archive','A narrow vaulted stack of weather cylinders, listening records and rolling survey ladders.',[100,350,390,490],[[180,350],[410,350],[490,430],[490,780],[430,840],[160,840],[100,780],[100,430]],[310,620],['#665781','#afa0bd'],'archive',[300,805]),
 room('lantern','Great Orrery','The eight-sided brass crown contains an armillary globe, lens towers and an elevated observation ring.',[1450,100,800,600],[[1590,100],[2120,100],[2250,230],[2250,550],[2100,700],[1600,700],[1450,550],[1450,240]],[1850,570],['#8f754d','#c8bd91'],'orrery',[1850,652]),
 room('charts','Chart Atelier','An east-facing drafting bay with rolled charts, pinned surveys, a light table and exposed navigation cabling.',[2400,250,590,350],[[2470,250],[2890,250],[2990,350],[2990,500],[2890,600],[2460,600],[2400,520],[2400,330]],[2740,480],['#46677c','#a5b8be'],'charts',[2700,566]),
 room('lens','Lens Laboratory','A cut-corner optical laboratory with a long testing rail, shielded projector and racks of hand-ground glass.',[420,1000,500,400],[[480,1000],[860,1000],[920,1060],[920,1340],[860,1400],[420,1400],[420,1060]],[700,1220],['#8f7668','#c6b39b'],'lens',[665,1382]),
 room('radio','Radio Cloister','A staggered listening gallery where curved signal consoles flank an open communication aisle.',[1150,950,700,350],[[1150,950],[1740,950],[1850,1060],[1850,1200],[1750,1300],[1400,1300],[1400,1220],[1150,1220]],[1530,1110],['#4e6d7f','#9fbcc3'],'radio',[1550,1282]),
 room('spectrum','Spectrum Gallery','The eastern stepped wing houses spectral coils, prism cages and a rainbow calibration screen.',[2540,850,450,500],[[2600,850],[2890,850],[2990,950],[2990,1350],[2740,1350],[2740,1270],[2540,1270],[2540,930]],[2760,1120],['#78617e','#bdacc5'],'spectrum',[2860,1330]),
 room('sonar','Sonar Hall','An angled acoustic chamber with a circular depth display, paired hydrophones and vibration-isolated benches.',[1970,1240,500,460],[[2040,1240],[2410,1240],[2470,1300],[2470,1640],[2410,1700],[1970,1700],[1970,1310]],[2200,1510],['#3c7b80','#94bcba'],'sonar',[2220,1664]),
 room('workshop','Instrument Workshop','An offset service shop with tool walls, an inspection hoist and a lower cabinet alcove.',[140,1580,620,440],[[220,1580],[760,1580],[760,1860],[660,1860],[660,2020],[140,2020],[140,1660]],[450,1780],['#7a7654','#c3b997'],'workshop',[435,1978]),
 room('ballast','Ballast Vault','A low aft vault of blue trim tanks, suspended counterweights and exposed return plumbing.',[330,2160,520,260],[[390,2160],[790,2160],[850,2220],[850,2420],[330,2420],[330,2220]],[610,2290],['#536d7e','#a5b8bb'],'ballast',[590,2388]),
 room('conservatory','Salt Conservatory','A broad glazed winter garden with seed beds, mist pipes, salt-tolerant trees and a potting island.',[1050,1810,650,580],[[1160,1810],[1600,1810],[1700,1910],[1700,2270],[1580,2390],[1050,2390],[1050,1930]],[1370,2150],['#5c7e62','#b3c0a1'],'conservatory',[1350,2345]),
 room('galley','Keeper Refectory','A warm southern mess with round meal tables, copper kettles, a tiled serving hatch and provision lockers.',[1870,1930,560,420],[[1930,1930],[2370,1930],[2430,1990],[2430,2290],[2370,2350],[1930,2350],[1870,2290],[1870,1990]],[2140,2160],['#99705f','#cbb19a'],'galley',[2150,2320]),
 room('engine','Pressure House','A tall starboard machinery hold with a ribbed pressure engine, regulator racks and twin accumulators.',[2600,1570,470,570],[[2680,1570],[2990,1570],[3070,1650],[3070,2050],[2980,2140],[2600,2140],[2600,1650]],[2810,1965],['#536f83','#a9b6b9'],'engine',[2825,2098]),
 room('intake','Seawater Intake','A shallow aft pump bay with a seawater inspection window, filter basket and isolation-wheel manifold.',[2590,2250,480,210],[[2650,2250],[3020,2250],[3070,2300],[3070,2420],[3030,2460],[2590,2460],[2590,2310]],[2830,2370],['#3b7b80','#9bbeb4'],'intake',[2830,2280])
];
const passage=(id,x,y,width,height,name)=>({id,x,y,width,height,name,theme:'passage'});
const corridors=[
 passage('archive-dispatch-neck',460,440,260,120,'Cylinder passage'),
 passage('north-glass-neck',1260,350,230,120,'Crown approach'),
 passage('east-survey-neck',2210,400,240,120,'Survey gallery'),
 passage('archive-downshaft',280,800,120,280,'West stack stair'),
 passage('optics-west-elbow',280,1000,190,120,'Optics landing'),
 passage('dispatch-downshaft',1070,500,120,500,'Dispatch service spine'),
 passage('dispatch-radio-elbow',1070,950,180,120,'Listening approach'),
 passage('optics-listening-crossing',880,1130,320,120,'West transept'),
 passage('crown-instrument-spine',1620,660,120,320,'Orrery service walk'),
 passage('radio-sonar-elbow',1810,1100,380,120,'Acoustic approach'),
 passage('sonar-north-neck',2070,1100,120,200,'Acoustic vestibule'),
 passage('east-calibration-spine',2740,560,120,340,'Spectral service walk'),
 passage('spectrum-acoustic-crossing',2330,1140,250,120,'East transept'),
 passage('sonar-east-elbow',2330,1140,120,240,'Hydrophone landing'),
 passage('radio-greenhouse-neck',1530,1270,120,250,'South signal neck'),
 passage('greenhouse-upper-elbow',1370,1400,280,120,'Winter walk'),
 passage('winter-service-walk',1370,1400,120,460,'Glasshouse approach'),
 passage('optical-workshop-shaft',530,1370,120,260,'Tool stair'),
 passage('workshop-ballast-shaft',390,1980,120,230,'Counterweight stair'),
 passage('workshop-garden-crossing',700,1740,430,120,'Potting supplies walk'),
 passage('garden-west-elbow',1010,1740,120,310,'Garden vestibule'),
 passage('ballast-garden-walk',810,2250,280,120,'Aft trim passage'),
 passage('garden-refectory-neck',1660,2130,260,120,'Mess approach'),
 passage('sonar-refectory-shaft',2180,1660,120,310,'Acoustic service stair'),
 passage('engine-north-neck',2430,1540,260,140,'Pressure vestibule'),
 passage('engine-intake-shaft',2850,2100,120,180,'Seawater return stair'),
 passage('refectory-intake-crossing',2390,2190,320,130,'Aft water gallery')
];
const links=[['bridge','archive'],['bridge','lantern'],['bridge','radio'],['archive','lens'],['lantern','charts'],['lantern','radio'],['charts','spectrum'],['lens','radio'],['lens','workshop'],['radio','sonar'],['radio','conservatory'],['spectrum','sonar'],['sonar','galley'],['sonar','engine'],['workshop','ballast'],['workshop','conservatory'],['ballast','conservatory'],['conservatory','galley'],['galley','intake'],['engine','intake']];
for(const [a,b]of links){rooms.find(r=>r.id===a).neighbors.push(b);rooms.find(r=>r.id===b).neighbors.push(a);}

// Each footprint is a real collider; the artwork is drawn from these same pieces.
// Unlike the original deck, no room shares a generated furniture arrangement.
const props={
 bridge:[
  ['panoramic-console','console',780,218,330,62,'#365d70'],['dispatch-desk','chart',1125,300,90,90,'#9b865e'],
  ['weather-radar','scope',700,300,76,84,'#587b81'],['communications-rack','server',1205,305,44,100,'#4d697a'],
  ['captains-locker','shelf',705,455,115,42,'#85745b'],['tide-repeater','console',1135,445,70,44,'#4c7184']
 ],
 archive:[
  ['west-cylinder-stack','shelf',145,450,65,225,'#756275'],['east-forecast-stack','shelf',380,460,65,175,'#756275'],
  ['return-desk','table',250,390,115,56,'#a78e75'],['record-player','console',240,695,105,60,'#5e7280'],
  ['salvage-chest','crate',365,708,64,74,'#a68b62'],['archive-cart','shelf',150,720,66,50,'#a89079']
 ],
 lantern:[
  ['armillary-foundation','orrery',1735,280,230,230,'#ba9b62'],['west-projector','telescope',1535,275,110,110,'#7b8991'],
  ['east-projector','telescope',2065,280,105,115,'#7b8991'],['crown-console','console',1745,160,200,65,'#527889'],
  ['astrolabe-cabinet','shelf',1530,460,90,75,'#aa8c58'],['brass-prism','prism',2060,490,100,70,'#b9a277'],
  ['ephemeris-desk','chart',1935,560,110,58,'#c2a77a'],['lens-pallet','crate',1625,560,70,62,'#a48b66']
 ],
 charts:[
  ['survey-light-table','chart',2520,320,190,92,'#b3aa8c'],['drafting-island','chart',2780,375,100,96,'#b49d74'],
  ['chart-roller','shelf',2490,480,100,50,'#9b8874'],['navigation-printer','console',2795,290,90,52,'#67808d'],
  ['survey-tubes','shelf',2870,490,60,46,'#8f7969'],['instrument-case','crate',2630,470,72,48,'#b59a73']
 ],
 lens:[
  ['optical-testing-rail','telescope',490,1060,225,70,'#78949b'],['lens-grinding-lathe','coil',480,1240,135,70,'#768b88'],
  ['shielded-projector','scope',770,1065,80,95,'#66828c'],['glass-blank-rack','shelf',790,1240,70,74,'#b7ad99'],
  ['polishing-bench','table',635,1310,100,45,'#b6a582'],['lens-return-case','crate',470,1145,60,52,'#9e896a']
 ],
 radio:[
  ['listening-console','console',1260,995,260,60,'#476c80'],['valve-receivers','server',1610,1000,110,62,'#6c7186'],
  ['frequency-island','scope',1480,1140,115,75,'#7c9a9a'],['recording-deck','console',1710,1140,66,65,'#587b91'],
  ['emergency-batteries','coil',1200,1100,90,60,'#7c947d'],['signal-records','shelf',1630,1210,90,40,'#9b8d79']
 ],
 spectrum:[
  ['dispersion-coil','coil',2610,935,110,155,'#a385a4'],['prism-cage','prism',2800,930,100,115,'#809bb3'],
  ['calibration-screen','console',2745,875,110,40,'#61728c'],['spectrum-bench','table',2785,1175,120,55,'#aaa5a5'],
  ['filter-cabinet','shelf',2880,1100,65,62,'#8b7f96'],['optical-power-box','server',2590,1140,62,75,'#7c8998'],
  ['spare-coil','crate',2810,1260,65,42,'#a9967f']
 ],
 sonar:[
  ['depth-display','sonar',2155,1340,150,135,'#496c7d'],['port-hydrophone','coil',2025,1375,80,105,'#749ba0'],
  ['starboard-hydrophone','coil',2340,1415,72,105,'#749ba0'],['acoustic-analysis','console',2110,1585,150,50,'#57838c'],
  ['vibration-recorder','console',2025,1540,80,48,'#6f8a89'],['receiver-case','crate',2320,1570,75,60,'#9a977e']
 ],
 workshop:[
  ['wall-tools','shelf',250,1620,220,65,'#918164'],['inspection-hoist','engine',535,1630,140,95,'#8f9584'],
  ['instrument-bench','table',190,1740,130,65,'#a79a76'],['precision-lathe','coil',520,1815,90,70,'#7c908c'],
  ['spares-cabinet','shelf',190,1890,130,65,'#917d60'],['meter-storage','server',500,1900,110,55,'#7b8d87'],
  ['calibration-pallet','crate',355,1880,70,65,'#b29b70']
 ],
 ballast:[
  ['port-trim-tank','tank',385,2220,110,100,'#688995'],['starboard-trim-tank','tank',670,2220,110,100,'#688995'],
  ['trim-console','console',735,2190,60,35,'#57788a'],['counterweight-crate','crate',515,2320,70,44,'#898c81'],
  ['valve-box','pump',725,2335,60,42,'#7d9292'],['weight-cabinet','shelf',365,2340,100,38,'#8b8d84']
 ],
 conservatory:[
  ['western-seed-bed','hydroponic',1110,1980,130,170,'#7d9b73'],['east-salt-forest','plant',1500,1940,125,155,'#7d9b73'],
  ['potting-island','table',1320,2010,105,90,'#a39d7a'],['algae-vat','tank',1505,2190,105,95,'#7d9e91'],
  ['seed-library','shelf',1185,1855,180,55,'#a99e7e'],['mist-regulator','pump',1500,1855,75,55,'#6d938c'],
  ['low-root-bed','hydroponic',1120,2240,150,70,'#77946e'],['potting-crates','crate',1325,2260,80,55,'#a89975']
 ],
 galley:[
  ['copper-galley','kitchen',1945,1980,170,70,'#ac8869'],['kettle-counter','kitchen',2220,1980,120,65,'#9e8d76'],
  ['port-meal-table','cafeteria',1945,2110,100,90,'#8caaa7'],['starboard-meal-table','cafeteria',2235,2150,100,90,'#8caaa7'],
  ['provision-lockers','shelf',2070,2245,100,55,'#a28c73'],['cold-cabinet','medical',2320,2045,58,82,'#b2c4c1'],
  ['bread-cart','crate',1935,2240,70,42,'#b8a17b']
 ],
 engine:[
  ['main-pressure-engine','engine',2750,1700,165,230,'#778f99'],['port-accumulator','tank',2645,1770,65,120,'#849b9d'],
  ['starboard-accumulator','tank',2950,1750,65,160,'#849b9d'],['regulator-rack','console',2715,1615,200,48,'#5a7a8a'],
  ['feed-pump','pump',2645,1970,100,80,'#6d8b94'],['pressure-returns','coil',2930,1980,80,60,'#7b9092'],
  ['valve-cabinet','server',2790,2000,90,60,'#71858f']
 ],
 intake:[
  ['intake-filter','pump',2660,2300,95,85,'#688e94'],['isolation-manifold','coil',2900,2305,95,70,'#839e9b'],
  ['sediment-tray','tank',2785,2305,70,40,'#8baaa4'],['pump-control','console',2620,2370,65,38,'#5c828c'],
  ['salinity-meter','console',2770,2395,85,30,'#6d8f97'],['filter-pallet','crate',2930,2395,65,35,'#aaa284']
 ]
};
const obstacles=Object.entries(props).flatMap(([roomId,items])=>items.map(([id,kind,x,y,width,height,color])=>({id:`${roomId}-${id}`,roomId,kind,x,y,width,height,color})));
const stations={
 bridge:{x:1010,y:350},archive:{x:300,y:540},lantern:{x:1850,y:555},charts:{x:2740,y:475},
 lens:{x:740,y:1225},radio:{x:1380,y:1130},spectrum:{x:2780,y:1105},sonar:{x:2175,y:1535},
 workshop:{x:450,y:1760},ballast:{x:610,y:2315},conservatory:{x:1380,y:2170},galley:{x:2130,y:2150},
 engine:{x:2810,y:1965},intake:{x:2840,y:2370}
};
for(const [id,position]of Object.entries(stations))position.id=`station-${id}`;

const d=(id,kind,x,y,width,height,color,extra={})=>({id,kind,x,y,width,height,color,...extra});
const decor=[
 d('bridge-prow-window','window',775,187,355,18,'#a7d5dc'),d('bridge-west-window','window',657,294,15,112,'#a7d5dc'),
 d('bridge-floor-chevron','stripe',925,455,140,0,'#e5dab6'),d('bridge-return-grate','grate',1190,420,45,22,'#4b6874'),
 d('bridge-route-plate','poster',680,405,22,35,'#bba76f',{text:'01'}),
 d('archive-west-window','window',108,500,14,150,'#b5c8dd'),d('archive-return-pipe','pipe',445,445,14,270,'#a7adb5'),
 d('archive-ladder','railing',225,465,12,150,'#bba67f'),d('archive-grate','grate',255,645,95,26,'#6d6579'),
 d('archive-record-sign','poster',220,752,22,28,'#d9ba7a',{text:'T'}),
 d('orrery-north-window','window',1660,108,380,17,'#b5d4dc'),d('orrery-east-window','window',2226,280,16,180,'#b5d4dc'),
 d('orrery-west-window','window',1458,280,16,175,'#b5d4dc'),d('orrery-ring-rail','railing',1690,530,315,10,'#cfb579'),
 d('orrery-brass-feed','pipe',1640,190,20,250,'#a69365'),d('orrery-power-cable','cable',2010,220,105,0,'#c9ab60'),
 d('orrery-walk-grate','grate',1780,600,140,25,'#93866c'),
 d('charts-east-window','window',2968,370,14,100,'#c3d8df'),d('charts-upper-window','window',2510,258,300,14,'#c3d8df'),
 d('charts-survey-rolls','pipe',2440,390,18,92,'#c4ba9d'),d('charts-paper-note','poster',2740,325,25,30,'#e5d7ab',{text:'N'}),
 d('lens-upper-window','window',500,1008,240,15,'#bfd7d6'),d('lens-cable-rail','cable',535,1160,190,0,'#a3b1ac'),
 d('lens-floor-grate','grate',600,1190,110,22,'#8b8b82'),d('lens-filter-note','poster',865,1155,20,35,'#d6caa5',{text:'UV'}),
 d('radio-array-west','vent',1320,1085,65,22,'#75888b'),d('radio-array-east','vent',1630,1100,55,22,'#75888b'),
 d('radio-return-pipe','pipe',1190,975,16,95,'#92a5a5'),d('radio-signal-cable','cable',1310,1180,125,0,'#b4a27f'),
 d('radio-listening-sign','poster',1765,1080,25,38,'#d8c68d',{text:'RX'}),
 d('spectrum-east-window','window',2968,980,14,255,'#c5c7e1'),d('spectrum-calibration-cable','cable',2735,990,0,130,'#bbaa99'),
 d('spectrum-return-grate','grate',2660,1230,68,22,'#8b8296'),d('spectrum-band-note','poster',2895,1230,22,28,'#d0c2da',{text:'λ'}),
 d('sonar-east-window','window',2448,1360,14,185,'#a5d4d6'),d('sonar-isolation-grate','grate',2140,1500,130,22,'#577f83'),
 d('sonar-signal-line','cable',2080,1300,250,0,'#89aaa5'),d('sonar-left-return','pipe',1995,1420,12,190,'#8db4af'),
 d('workshop-upper-rail','railing',280,1590,300,12,'#c8ba8f'),d('workshop-hoist-cable','cable',650,1745,0,60,'#c7b784'),
 d('workshop-lower-grate','grate',350,1975,100,20,'#827e68'),d('workshop-tool-plate','poster',185,1695,25,30,'#d6c793',{text:'05'}),
 d('ballast-return-main','pipe',380,2398,360,12,'#a8bfc0'),d('ballast-trim-grate','grate',570,2255,80,20,'#687d86'),
 d('ballast-pressure-note','poster',795,2285,20,35,'#cbd1bb',{text:'PSI'}),
 d('garden-glazed-roof','window',1200,1818,325,17,'#bde0c1'),d('garden-east-glass','window',1676,1950,16,250,'#bde0c1'),
 d('garden-west-glass','window',1058,2035,15,240,'#bde0c1'),d('garden-mist-main','pipe',1260,1910,230,12,'#a5c2ae'),
 d('garden-walkway-grate','grate',1300,2200,150,28,'#8c9b7c'),d('garden-seed-note','poster',1435,2280,22,30,'#dce1ae',{text:'SEED'}),
 d('galley-serving-tiles','stripe',1950,2065,390,0,'#dfd2b7'),d('galley-aft-window','window',1980,2330,320,14,'#c5d8ca'),
 d('galley-drain','grate',2115,2045,60,20,'#7c8275'),d('galley-provisions-note','poster',2350,2250,22,30,'#e1cd9e',{text:'MESS'}),
 d('engine-hot-return','pipe',3025,1695,16,330,'#b6b7ac'),d('engine-cold-return','pipe',2620,1680,13,245,'#a5bdc2'),
 d('engine-hazard-band','stripe',2725,1940,210,0,'#d2bb75'),d('engine-lower-drain','grate',2655,2080,90,25,'#6d828c'),
 d('engine-pressure-note','poster',2915,1640,25,32,'#dcc591',{text:'BAR'}),
 d('intake-seawater-window','window',2670,2443,300,13,'#a9e0cf'),d('intake-filter-return','pipe',3038,2320,13,65,'#acd0c1'),
 d('intake-floor-channel','grate',2700,2400,45,18,'#688c8c'),
 d('north-neck-grating','grate',1320,385,105,35,'#678391'),d('west-transept-grating','grate',960,1170,135,25,'#758e93'),
 d('east-transept-grating','grate',2450,1185,80,25,'#758e93'),d('south-walk-grating','grate',1430,1590,35,120,'#768e89'),
 d('aft-water-hazard','stripe',2450,2270,170,0,'#d1c58c')
];
for(const r of rooms){decor.push(d(`${r.id}-floor-label`,'label',r.labelPosition.x,r.labelPosition.y,0,0,'#263c48',{text:r.name.toUpperCase(),size:r.id==='intake'?17:21}));}
for(const [i,p]of corridors.entries()){
 const horizontal=p.width>=p.height;
 if((horizontal?p.width:p.height)>180){decor.push(d(`${p.id}-guide`,'stripe',p.x+(horizontal?22:p.width/2),p.y+(horizontal?p.height/2:22),horizontal?p.width-44:0,horizontal?0:p.height-44,'#adbbb066'));
  decor.push(d(`${p.id}-guide-light`,'light',p.x+(horizontal?30:p.width/2),p.y+(horizontal?p.height/2:30),0,0,i%3===0?'#f4d99a':'#b6ded7'));}
}

export default freeze({id:'tidal-observatory',revision:2,name:'Tidal Observatory',description:'An asymmetric cutaway tide station: an octagonal orrery crown, vaulted archive, stepped spectral wing and glazed winter garden joined by branching service walks.',width:3200,height:2500,tasksPerCrew:12,rooms,floors:[...rooms,...corridors],corridors,obstacles,stations,bell:{x:905,y:340},spawns:[{x:855,y:390},{x:925,y:390},{x:995,y:430},{x:855,y:460},{x:925,y:460},{x:1065,y:430}],decor});
