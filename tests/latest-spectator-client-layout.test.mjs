import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/game.css',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../public/world/beacon.css',import.meta.url),'utf8');
// Limited CSS cascade/band reservations. Native line wrapping, keyboard geometry
// and pointer rectangles remain coordinator browser checks.
function rules(source,queries=[],output=[]){
 source=source.replace(/\/\*[\s\S]*?\*\//g,'');let at=0;
 while(at<source.length){const open=source.indexOf('{',at);if(open<0)break;let end=open+1,depth=1;while(depth&&end<source.length){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;end++;}
  const head=source.slice(at,open).trim(),body=source.slice(open+1,end-1);at=end;
  if(head.startsWith('@media')){rules(body,[...queries,head.slice(6).trim()],output);continue;}
  if(head.startsWith('@'))continue;
  const declarations=body.split(';').flatMap(item=>{const m=item.trim().match(/^([\w-]+)\s*:\s*(.*)$/s);return m?[[m[1],m[2].trim()]]:[];});
  for(const selector of head.split(','))output.push({selector:selector.trim(),queries,declarations});
 }return output;
}
function media(query,{width,height}){return query.split(',').some(branch=>branch.split(/\s+and\s+/).every(part=>{
 const m=part.trim().match(/^\((min|max)-(width|height):\s*(\d+)px\)$/);if(m){const value=m[2]==='width'?width:height;return m[1]==='min'?value>=+m[3]:value<=+m[3];}
 if(/\((?:hover:none|pointer:coarse)\)/.test(part))return true;
 if(/prefers-reduced-motion|forced-colors/.test(part))return false;
 throw Error('Unsupported media contract: '+part);
}));}


const world={classes:['lw-world'],parent:null},stage={classes:['lw-stage'],parent:world};
const nodes={inspector:{classes:['lw-inspector'],parent:stage},menu:{classes:['lw-spectator'],parent:stage},joystick:{classes:['lw-joystick'],parent:stage},sound:{classes:['lw-sound-toggle'],parent:stage},systems:{classes:['lw-beacon'],parent:stage},critical:{classes:['lw-critical'],parent:stage},map:{classes:['lw-map-toggle'],parent:stage},head:{classes:['lw-inspector-head'],parent:{classes:['lw-inspector'],parent:stage}}};
function matches(selector,node,critical){if(/:|>|#/.test(selector))return false;selector=selector.replace(/\[data-spectator=true\]/g,'').replace(/\[data-inspector=true\]/g,'');if(selector.includes('[data-critical=true]')){if(!critical)return false;selector=selector.replaceAll('[data-critical=true]','');}if(selector.includes('['))return false;const parts=selector.split(/\s+/).filter(Boolean);let cursor=node;for(let i=parts.length-1;i>=0;i--){const classes=parts[i].split('.').filter(Boolean);if(i===parts.length-1){if(!classes.every(c=>cursor.classes.includes(c)))return false;}else{cursor=cursor.parent;while(cursor&&!classes.every(c=>cursor.classes.includes(c)))cursor=cursor.parent;if(!cursor)return false;}}return true;}
const sheet=rules(source);function style(name,view,critical){const values={},ranks={};for(const rule of sheet){if(!rule.queries.every(q=>media(q,view))||!matches(rule.selector,nodes[name],critical))continue;const rank=(rule.selector.match(/\.|\[/g)||[]).length;for(const [key,value]of rule.declarations)if(rank>=(ranks[key]??-1)){ranks[key]=rank;values[key]=value;}}return values;}
function px(v){assert.match(v,/^[\d.]+px$/);return parseFloat(v);}
for(const [width,height]of [[320,740],[390,844],[844,390],[1440,1000]])for(const critical of [false,true])test(`observer reservations ${width}x${height} critical=${critical}`,()=>{const v={width,height},pane=style('inspector',v,critical),joy=style('joystick',v,critical),sound=style('sound',v,critical),systems=style('systems',v,critical),map=style('map',v,critical),top=px(pane.top),bottom=height-px(pane.bottom);assert.equal(pane.overflow,'auto');assert(bottom-top>=160,'a complete Close row plus bounded content remains');assert.equal(style('head',v,critical).position,'sticky');assert.equal(px(map['min-height']),44);assert.equal(px(map['max-width']),76);if(width<=700){const joystickTop=height-px(joy.bottom)-px(joy.height||joy.width);assert(bottom<=joystickTop,'open pane ends above the joystick');assert(top>=px(map.top)+px(map['min-height']),'Close begins below Map');assert.equal(style('menu',v,critical).display,'none','the modal inspector yields a separate selection menu on narrow screens');}else if(height<=540){const left=width-px(pane.right)-px(pane.width);assert(left>=px(joy.left)+px(joy.width),'pane is horizontally separate from joystick');assert(bottom<=height-60,'inspector ends above control rail');}else{assert(px(pane.bottom)>=px(systems.bottom)+44,'desktop pane leaves the equipment toggle band');assert(px(style('menu',v,critical).bottom)>=px(sound.bottom)+px(sound['min-height']),'desktop selection menu leaves sound accessible');}if(critical){const banner=style('critical',v,true);assert(top>=px(banner.top)+px(banner['max-height']),'inspector starts below critical timer band');}});
