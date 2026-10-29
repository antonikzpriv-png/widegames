/** Public original beacon fixtures; never hidden roles or per-match state. */
export const BEACON_VERSION=1;
export const BEACON_ACTION_FIELDS=Object.freeze({systemSabotage:['kind','targetId'],systemRepair:['systemId','siteId'],vent:['entryId','exitId'],investigate:['deviceId'],deviceCancel:[],ability:['abilityId','targetId']});
export const DEFAULT_BEACON_RULES=Object.freeze({visionRadius:360,lightsVisionRadius:110,saboteurVisionRadius:400,lightsDurationMs:45000,communicationsDurationMs:35000,doorDurationMs:12000,ventTravelMs:1600,ventCooldownMs:15000,deviceReadMs:2000,deviceCooldownMs:5000,observationLimit:64});
export const BEACON_DOORS=Object.freeze([
{id:'west-upper',roomId:'archive',x:520,y:450,width:26,height:80},
{id:'east-upper',roomId:'lantern',x:1054,y:450,width:26,height:80},
{id:'west-lower',roomId:'galley',x:220,y:716,width:80,height:24},
{id:'east-lower',roomId:'engine',x:1300,y:716,width:80,height:24},
{id:'lower-spine',roomId:'workshop',x:750,y:880,width:100,height:24}]);
export const BEACON_VENTS=Object.freeze([
{id:'archive-hatch',roomId:'archive',position:{x:150,y:550},links:['workshop-hatch','lantern-hatch']},
{id:'workshop-hatch',roomId:'workshop',position:{x:650,y:780},links:['archive-hatch','lantern-hatch']},
{id:'lantern-hatch',roomId:'lantern',position:{x:1450,y:550},links:['archive-hatch','workshop-hatch']}]);
export const BEACON_REPAIRS=Object.freeze({
 lights:[{id:'relay',roomId:'workshop',position:{x:665,y:680},label:'Lighting relay'}],
 communications:[{id:'radio',roomId:'bridge',position:{x:930,y:230},label:'Radio relay'}],
 power:[{id:'power-east',roomId:'engine',position:{x:1450,y:960},label:'Turbine regulator'},{id:'power-west',roomId:'workshop',position:{x:930,y:730},label:'Power coupler'}],
 flood:[{id:'pump-galley',roomId:'galley',position:{x:370,y:960},label:'Galley pump'},{id:'pump-archive',roomId:'archive',position:{x:370,y:510},label:'Archive pressure valve'}]});
export const BEACON_DEVICES=Object.freeze([
{id:'security',kind:'cameras',label:'Security camera console',roomId:'bridge',position:{x:930,y:310}},
{id:'occupancy',kind:'occupancy',label:'Room occupancy console',roomId:'archive',position:{x:150,y:450}},
{id:'vitals',kind:'vitals',label:'Keeper vitals console',roomId:'galley',position:{x:150,y:900}}]);
export const BEACON_CAMERAS=Object.freeze([{id:'archive-camera',roomId:'archive',position:{x:260,y:510}},{id:'engine-camera',roomId:'engine',position:{x:1340,y:960}}]);

