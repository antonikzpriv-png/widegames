import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Limited CSS contract/layout evaluator, not a browser. It consumes the actual
// root and scoped sheets, including media order/specificity and calc dimensions.
// Text/layout inside a council is NOT simulated: overflow clipping gives the
// upper bound on every visible input/vote hit target in the real overlay.
const game=readFileSync(new URL('../public/game.css',import.meta.url),'utf8');
const scoped=readFileSync(new URL('../public/world/beacon.css',import.meta.url),'utf8');
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
const all=rules(game+'\n'+scoped);
function media(query,{width,height,forcedColors=false}){return query.split(',').some(branch=>branch.split(/\s+and\s+/).every(part=>{
 const m=part.trim().match(/^\((min|max)-(width|height):\s*(\d+)px\)$/);if(m){const value=m[2]==='width'?width:height;return m[1]==='min'?value>=+m[3]:value<=+m[3];}
 if(/\((?:hover:none|pointer:coarse)\)/.test(part))return true;
 if(/prefers-reduced-motion/.test(part))return false;
 if(/forced-colors\s*:\s*active/.test(part))return forcedColors;
 if(/forced-colors\s*:\s*none/.test(part))return !forcedColors;
 throw Error('Unsupported media contract: '+part);
}));}
const node=(classes,parent=null)=>({classes:classes.split(' '),parent});
const world=node('lw-world'),stage=node('lw-stage',world),nodes=Object.fromEntries(['lw-sound-toggle','lw-joystick','lw-actions','lw-action','lw-beacon','lw-beacon-toggle','lw-beacon-pane','lw-scene-overlay','lw-role-scene','lw-topbar','lw-exit'].map(name=>[name,node(name,stage)]));
nodes['lw-action'].parent=nodes['lw-actions'];nodes['lw-beacon-toggle'].parent=nodes['lw-beacon'];nodes['lw-beacon-pane'].parent=nodes['lw-beacon'];nodes['lw-exit'].parent=nodes['lw-topbar'];
function matches(selector,target){
 // The modeled nodes have no state attributes or pseudo-elements. Stateful
 // exceptions are reviewed by the dedicated contract assertions below.
 if(/[\[:>#]/.test(selector))return false;
 const parts=selector.trim().split(/\s+/);let current=target;
 for(let i=parts.length-1;i>=0;i--){const simple=parts[i],accept=n=>simple==='*'||simple.split('.').filter(Boolean).every(c=>n.classes.includes(c));
  if(i===parts.length-1){if(!accept(current))return false;}else{current=current.parent;while(current&&!accept(current))current=current.parent;if(!current)return false;}
 }return true;
}
function style(name,view){const output={},rank={};for(const r of all){if(!r.queries.every(q=>media(q,view))||!matches(r.selector,nodes[name]))continue;
 const specificity=(r.selector.match(/\./g)||[]).length;for(const [key,raw]of r.declarations){const important=/!important$/.test(raw),score=(important?1000:0)+specificity;if(score<(rank[key]??-1))continue;rank[key]=score;output[key]=raw.replace(/\s*!important$/,'');}
 }return output;}
function length(value,view,axis){
 if(value===undefined||value==='auto')return null;if(value==='0')return 0;
 if(value.startsWith('min(')){const m=value.match(/^min\((\d+)px,calc\((\d+)(vw|%) - (\d+)px\)\)$/);assert(m,'unsupported min '+value);return Math.min(+m[1],length(m[2]+m[3],view,axis)-+m[4]);}
 if(value.startsWith('calc(')){const m=value.match(/^calc\((\d+)(dvh|vh|vw|%) - (\d+)px\)$/);assert(m,'unsupported calc '+value);return length(m[1]+m[2],view,axis)-+m[3];}
 const m=value.match(/^(-?[\d.]+)(px|dvh|vh|vw|%)$/);assert(m,'unsupported length '+value);return +m[1]*(m[2]==='px'?1:m[2]==='vw'?view.width/100:m[2]==='%'?axis/100:view.height/100);
}
function rect(css,view,{width,height}={}){
 const x=k=>length(css[k],view,view.width),y=k=>length(css[k],view,view.height);
 width=x('width')??width??(x('left')!==null&&x('right')!==null?view.width-x('left')-x('right'):null);
 height=y('height')??height??(y('top')!==null&&y('bottom')!==null?view.height-y('top')-y('bottom'):null);
 assert(width!==null&&height!==null,'rectangle needs explicit or fixture dimensions');
 const left=x('left')??view.width-x('right')-width,top=y('top')??view.height-y('bottom')-height;
 return {left,top,right:left+width,bottom:top+height,width,height};
}
function disjoint(a,b){return a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top;}
function overlayStyle(css){const inset=(css.inset||'0').split(/\s+/);assert.equal(inset.length,1);return {top:inset[0],right:inset[0],bottom:inset[0],left:inset[0],...css};}
for(const view of [{width:320,height:740},{width:390,height:844},{width:844,height:390}]){
 test(`mobile mute has a separate touch slot at ${view.width}x${view.height}`,()=>{
  const sound=style('lw-sound-toggle',view),joy=style('lw-joystick',view),action=style('lw-action',view),actions=style('lw-actions',view),toggle=rect(sound,view,{width:88,height:44}),stick=rect(joy,view);
  assert.equal(joy.display,'block','touch joystick remains available');assert.notEqual(sound.display,'none');assert.notEqual(sound.visibility,'hidden');assert.notEqual(sound['pointer-events'],'none');
  assert(toggle.width>=44&&toggle.height>=44);assert(toggle.left>=0&&toggle.top>=0&&toggle.right<=view.width&&toggle.bottom<=view.height);
  assert(disjoint(toggle,stick),'mute must not take any joystick touch area');
  for(const count of [2,4]){const buttons=rect(actions,view,{width:length(action.width,view,view.width)*count+length(actions.gap,view,view.width)*(count-1),height:length(action['min-height'],view,view.height)});assert(disjoint(toggle,buttons),`mute must not intersect ${count} action buttons`);assert(disjoint(stick,buttons),'reserve cannot introduce a joystick/action collision');}
  // Scrolling council input/vote targets are clipped to this actual viewport,
  // regardless of roster count, draft height, scroll offset or IME composition.
  for(const name of ['lw-scene-overlay','lw-role-scene']){const css=style(name,view),bounds=rect(overlayStyle(css),view);assert(disjoint(toggle,bounds),name+' must not place content under mute');if(name==='lw-scene-overlay')assert(['auto','scroll','hidden'].includes(css.overflow),'council input/votes must stay inside reserved scrolling viewport');assert(+sound['z-index']>+css['z-index']);}
  // Equipment now has its own measured-by-CSS rail slot, not a floating
  // toggle over council inputs. Its pane opens above the rail and scrolls.
  const beacon=style('lw-beacon',view),pane=style('lw-beacon-pane',view),groupBottom=view.height-length(beacon.bottom,view,view.height),paneBottom=groupBottom-length(pane.bottom,view,view.height),paneTop=paneBottom-length(pane['max-height'],view,view.height);
  const equipmentStyle=style('lw-beacon-toggle',view),equipment=rect({...beacon,width:equipmentStyle.width,height:equipmentStyle.height},view,{width:150,height:44});
  assert(disjoint(toggle,equipment),'equipment toggle must not intersect mute');assert(equipment.width>=44&&equipment.height>=44);
  assert(equipment.left>=0&&equipment.top>=0&&equipment.right<=view.width&&equipment.bottom<=view.height);
  for(const name of ['lw-scene-overlay','lw-role-scene'])assert(disjoint(equipment,rect(overlayStyle(style(name,view)),view)),'equipment toggle must not cover council input/vote or modal targets');
  assert(paneTop>=0&&paneBottom<=equipment.top,'equipment pane must open above its own slot within the viewport');assert.equal(pane.overflow,'auto','historical evidence and equipment remain scrollable');
  const paneWidth=length(pane.width,view,view.width);assert(equipment.right-paneWidth>=0&&equipment.right<=view.width,'equipment pane must remain horizontally in the viewport');
  // Exit remains in the topbar; the rail must leave that entire band free.
  const header=style('lw-topbar',view);assert(toggle.top>length(header['min-height'],view,view.height));assert(paneTop>=length(header['min-height'],view,view.height),'equipment pane must not cover Exit');
 });
}

test('mute reservation changes only layout and leaves native input, modal and sound ownership intact',()=>{
 assert(!/lw-(?:joystick|sound-toggle)[^{]*\{[^}]*display\s*:\s*none/.test(scoped));
 assert(!/lw-(?:joystick|sound-toggle)[^{]*\{[^}]*pointer-events\s*:\s*none/.test(scoped));
 const source=readFileSync(new URL('../public/world/sound.mjs',import.meta.url),'utf8');assert.match(source,/let enabled=false/);assert.match(source,/createLocalSound/);
});
