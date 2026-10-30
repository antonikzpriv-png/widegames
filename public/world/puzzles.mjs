import {captchaChallenge} from '../../shared/captcha.mjs';
import {dom,control,setText,trapDialog} from './dom.mjs';

/** Local puzzles gate a real task request; their solved state has no server authority. */
function createLegacyPuzzle({task,kind,onSubmit,onClose,id}){
 let solved=false,closed=false,selected=null,sent=false;
 const node=dom('section','lw-task-modal');node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-labelledby',`${id}-title`);node.tabIndex=-1;
 const heading=dom('h2','',task.label);heading.id=`${id}-title`;
 const top=dom('div','lw-modal-title'),close=control('Close station',()=>onClose(),'lw-close');top.append(dom('p','lw-eyebrow','FIELD EQUIPMENT'),close);
 const copy=dom('p','lw-task-instruction'),area=dom('div',`lw-puzzle lw-puzzle-${kind}`),status=dom('p','lw-puzzle-status');status.setAttribute('role','status');
 const submit=control('Send completed task',()=>{if(!solved||sent||closed)return;onSubmit();},'lw-primary');submit.disabled=true;
 const footer=dom('p','lw-modal-footnote','The server confirms completion. Leaving this station or entering council closes the equipment.');
 node.append(top,heading,copy,area,status,submit,footer);
 function finish(){solved=true;setText(status,'Equipment ready. Send the completed task to the beacon.');submit.disabled=false;submit.focus();}
 if(kind==='wires'){
  copy.textContent='Match each cable to the same numbered symbol. Choose a left socket, then its right socket. Color is a second hint.';
  const left=dom('div','lw-wire-column'),links=dom('div','lw-wire-links'),right=dom('div','lw-wire-column'),done=new Set(),labels=['1 · SUN','2 · WAVE','3 · STAR'],colors=['#edbe70','#8ed8c3','#caafeb'],buttons=[];
  area.append(left,links,right);
  for(let i=0;i<3;i++){
   const b=control(labels[i],()=>{if(done.has(i))return;selected=i;buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===i)));setText(status,`Cable ${i+1} selected. Choose its matching right socket.`);},'lw-socket');b.style.setProperty('--wire-color',colors[i]);b.setAttribute('aria-label',`Left cable ${labels[i]}`);b.setAttribute('aria-pressed','false');left.append(b);buttons.push(b);
  }
  for(const i of [2,0,1]){
   const b=control(labels[i],()=>{if(done.has(i))return;if(selected===null){setText(status,'Select a left cable first.');return;}if(selected!==i){setText(status,'Those symbols differ. Try the matching socket.');return;}done.add(i);b.disabled=true;buttons[i].disabled=true;buttons[i].setAttribute('aria-pressed','false');const line=dom('span','lw-connected-wire',`${i+1} ━━━ ${i+1}`);line.style.setProperty('--wire-color',colors[i]);links.append(line);selected=null;setText(status,`${done.size} of 3 cables connected.`);if(done.size===3)finish();},'lw-socket');b.style.setProperty('--wire-color',colors[i]);b.setAttribute('aria-label',`Right socket ${labels[i]}`);right.append(b);
  }
 }else if(kind==='tuning'){
  const target=72;copy.textContent='Tune the beacon to 72 kHz. Use the slider or arrow keys; lock the frequency when the values match.';
  const dial=dom('div','lw-tuning-dial'),targetLabel=dom('strong','','TARGET 72 kHz'),value=dom('output','lw-frequency','20 kHz'),label=dom('label','','Frequency (0 to 100 kHz)'),slider=dom('input','lw-frequency-slider');slider.type='range';slider.min=0;slider.max=100;slider.step=1;slider.value=20;slider.id=`${id}-frequency`;label.htmlFor=slider.id;value.htmlFor=slider.id;
  slider.addEventListener('input',()=>{setText(value,`${slider.value} kHz`);dial.style.setProperty('--tune',`${Number(slider.value)*3.6}deg`);});
  const lock=control('Lock frequency',()=>{if(Math.abs(Number(slider.value)-target)>1){setText(status,'Signal is off target. Tune to 72 kHz.');return;}slider.disabled=true;lock.disabled=true;finish();});dial.append(targetLabel,value);area.append(dial,label,slider,lock);
 }else{
  const sequence=[2,4,1,3];let entered=[];
  copy.textContent='Restore the storm record. Press the numbered tiles in the shown order: 2 → 4 → 1 → 3.';
  const order=dom('p','lw-sequence-order','2 → 4 → 1 → 3'),grid=dom('div','lw-sequence-grid'),tiles=[];
  area.append(order,grid);
  for(let n=1;n<=4;n++){const tile=control(String(n),()=>{if(solved)return;if(n!==sequence[entered.length]){entered=[];tiles.forEach(t=>t.dataset.done='false');setText(status,'Sequence reset. Begin again with 2.');return;}entered.push(n);tile.dataset.done='true';setText(status,`${entered.length} of 4 steps restored.`);if(entered.length===4){tiles.forEach(t=>t.disabled=true);finish();}},'lw-sequence-tile');tile.setAttribute('aria-label',`Sequence tile ${n}`);tiles.push(tile);grid.append(tile);}
 }
 node.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();onClose();}else trapDialog(node,event);});
 return {node,focus(){close.focus();},setPending(value){sent=value;submit.disabled=value||!solved;close.disabled=value;setText(submit,value?'Sending…':'Send completed task');},dispose(){closed=true;node.remove();}};
}

const glyphs={SUN:'☀',WAVE:'≈',STAR:'✦',MOON:'☾'};
function captchaTile(value,index,choose){
 const node=choose?control('',choose,'lw-captcha-tile'):dom('span','lw-captcha-tile');
 const symbol=dom('span','lw-captcha-symbol',glyphs[value]||value),name=dom('span','lw-captcha-name',value);
 symbol.setAttribute('aria-hidden','true');node.append(symbol,name);node.setAttribute('aria-label',`Tile ${index+1}: ${value}`);node.dataset.captchaIndex=String(index);return node;
}
/** Original, readable in-game challenges; no external CAPTCHA service or image dependency. */
function renderCaptcha(area,c,{id,copy,status,send}){
 const display=captchaChallenge(c);if(!display)return false;
 area.classList.add('lw-captcha');area.dataset.captchaKind=c.kind;
 const board=()=>{const grid=dom('div','lw-captcha-grid');grid.setAttribute('role','group');area.append(grid);return grid;};
 const answer=(label,value)=>{const button=control(label,()=>send(String(value)),'lw-secondary lw-captcha-answer');button.dataset.captchaAnswer=String(value);return button;};
 if(c.kind==='glyphs'){
  copy.textContent=`Mark every ${display.target} tile, then send your selection. Names and symbols identify the same tiles; color is only decoration.`;
  const selected=new Set(),grid=board();grid.setAttribute('aria-label',`Find every ${display.target}`);
  for(const [index,value]of display.tiles.entries()){
   const tile=captchaTile(value,index,()=>{if(selected.has(index))selected.delete(index);else selected.add(index);tile.setAttribute('aria-pressed',String(selected.has(index)));status.textContent=`${selected.size} tile${selected.size===1?'':'s'} selected. Send the complete selection when ready.`;});
   tile.setAttribute('aria-pressed','false');grid.append(tile);
  }
  const submit=control('Send tile selection',()=>{if(!selected.size){status.textContent='Select at least one tile before sending.';return;}send([...selected].sort((a,b)=>a-b).join(','));},'lw-primary');submit.dataset.captchaSubmit='glyphs';area.append(submit);
 }else if(c.kind==='count'){
  copy.textContent=`Count the ${display.target} symbols in the nine-tile panel. Choose the number you counted.`;
  const grid=board();grid.setAttribute('aria-label',`Count the ${display.target} tiles`);for(const [index,value]of display.tiles.entries())grid.append(captchaTile(value,index));
  const choices=dom('div','lw-captcha-choices');choices.setAttribute('role','group');choices.setAttribute('aria-label','Number of matching tiles');for(let n=0;n<=9;n++)choices.append(answer(String(n),n));area.append(choices);
 }else if(c.kind==='order'){
  copy.textContent='Restore the numbered cargo tags in ascending order. Select the smallest remaining number; confirmed tags stay marked.';
  const choices=dom('div','lw-captcha-choices'),done=new Set([...display.items].sort((a,b)=>a-b).slice(0,c.index));choices.setAttribute('role','group');choices.setAttribute('aria-label','Ascending cargo tags');
  for(const value of display.items){const button=answer(String(value),value);button.dataset.confirmed=String(done.has(value));button.disabled=done.has(value);button.setAttribute('aria-label',`${done.has(value)?'Confirmed':'Select'} cargo tag ${value}`);choices.append(button);}area.append(choices);
 }else if(c.kind==='rotate'){
  copy.textContent='Align the direction signal with NORTH ↑. Choose the turn that brings the shown arrow to north.';
  const signal=dom('div','lw-captcha-heading'),arrow=dom('span','lw-captcha-arrow',({north:'↑',east:'→',south:'↓',west:'←'})[display.direction]);arrow.setAttribute('aria-hidden','true');signal.append(arrow,dom('strong','',`Signal points ${display.direction}`));signal.setAttribute('role','img');signal.setAttribute('aria-label',`Signal arrow points ${display.direction}`);area.append(signal);
  const choices=dom('div','lw-captcha-choices');for(const [value,label]of [['aligned','Keep heading'],['left','Turn left 90°'],['right','Turn right 90°'],['half','Turn 180°']])choices.append(answer(label,value));area.append(choices);
 }else if(c.kind==='oddity'){
  copy.textContent='Find the one symbol that differs from all the others. Select that tile. Each symbol has a readable name.';
  const grid=board();grid.setAttribute('aria-label','Find the unique symbol');for(const [index,value]of display.tiles.entries())grid.append(captchaTile(value,index,()=>send(String(index))));
 }else if(c.kind==='code'){
  copy.textContent='Read the six-character signal code and enter it below. Characters avoid look-alikes and case does not matter. Press Enter or Check code.';
  const code=dom('p','lw-captcha-code',display.code),label=dom('label','','Signal code'),input=dom('input','lw-captcha-code-input');input.id=`${id}-signal-code`;label.htmlFor=input.id;input.type='text';input.maxLength=6;input.autocomplete='off';input.autocapitalize='characters';input.spellcheck=false;input.setAttribute('data-captcha-code','');input.setAttribute('aria-describedby',`${id}-code-panel`);code.id=`${id}-code-panel`;
  const submit=()=>{const value=input.value.trim().toUpperCase();if(value.length!==6){status.textContent='Enter all six code characters before checking.';return;}send(value);};input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();submit();}});
  const check=control('Check code',submit,'lw-primary');check.dataset.captchaSubmit='code';area.append(code,label,input,check);
 }else return false;
 return true;
}

/** Controls submit semantic inputs; only an authoritative snapshot advances them. */
export function createTaskPuzzle(options){
 if(!options.task.progress)return createLegacyPuzzle(options);
 const {id,onClose,onSubmit}=options;let task=options.task,pending=false,closed=false,key='',focusBeforePending=null;
 const node=dom('section','lw-task-modal');node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.tabIndex=-1;
 const heading=dom('h2','',task.label);heading.id=`${id}-title`;node.setAttribute('aria-labelledby',heading.id);
 const close=control('Close station',onClose,'lw-close'),copy=dom('p','lw-task-instruction'),area=dom('div','lw-puzzle'),status=dom('p','lw-puzzle-status');status.setAttribute('role','status');
 node.append(close,heading,copy,area,status,dom('p','lw-modal-footnote','Progress is saved by the server. Leaving or council closes equipment; an unfinished diagnostic must restart.'));
 const firstAvailable=()=>[...area.querySelectorAll('button,input')].find(control=>!control.disabled);
 function send(input){if(!pending&&!closed)onSubmit(input===undefined?undefined:{step:task.progress.index,input});}
 function render(){const c=task.progress,next=JSON.stringify(c);if(next===key)return;key=next;const sendStep=input=>{if(key===next)send(input);};area.replaceChildren();area.className=`lw-puzzle lw-puzzle-${c.kind}`;status.textContent=`${c.index} / ${c.total} steps confirmed`;
  if(c.index===c.total){copy.textContent='Equipment ready. Send the completed task.';area.append(control('Send completed task',()=>sendStep(),'lw-primary'));return;}
  if(c.v===2&&renderCaptcha(area,c,{id,copy,status,send:sendStep}))return;
  if(c.kind==='wires'){copy.textContent=`Connect cable ${c.index+1} to the same numbered socket.`;let selected=false;area.append(control(`Left cable ${c.index+1}`,()=>{selected=true;status.textContent='Choose the matching right socket.';}));for(let n=0;n<3;n++)area.append(control(`Right socket ${n+1}`,()=>{if(selected)sendStep(`${c.index}:${n}`);else status.textContent='Select the left cable first.';}));}
  else if(c.kind==='sequence'){copy.textContent=`Restore record: ${c.sequence.join(' → ')}. Enter step ${c.index+1}.`;for(let n=1;n<=4;n++){const tile=control(String(n),()=>sendStep(String(n)),'lw-sequence-tile');tile.setAttribute('aria-label',`Sequence tile ${n}`);area.append(tile);}}
  else if(c.kind==='pressure'){copy.textContent=`Reservoirs: left ${c.pressure} bar, right ${10-c.pressure} bar. Equalize to 5 bar each by transferring pressure. ${c.index===0?'Choose flow direction.':'Choose how many bar to transfer.'}`;if(c.index===0){area.append(control('Flow left to right',()=>sendStep('left-to-right')),control('Flow right to left',()=>sendStep('right-to-left')));}else for(let n=1;n<=4;n++)area.append(control(`Transfer ${n} bar`,()=>sendStep(String(n))));}
  else if(c.kind==='tuning'){copy.textContent=`Tune the beacon to ${c.target} kHz.`;const label=dom('label','','Frequency'),slider=dom('input','lw-frequency-slider'),value=dom('output','','0');slider.id=`${id}-dial`;slider.type='range';slider.min=0;slider.max=100;slider.step=1;slider.value=0;label.htmlFor=slider.id;slider.addEventListener('input',()=>value.textContent=slider.value);area.append(label,slider,value,control('Lock frequency',()=>sendStep(slider.value)));}
  else {const labels=['Isolate power','Replace fuse','Start diagnostic','Verify diagnostic'],inputs=['isolate','replace','start','test'];copy.textContent=c.index===3?'Wait at least 1.5 seconds after starting, then verify. The server checks elapsed time.':'Repair in order: isolate power, replace fuse, start diagnostic, verify.';area.append(control(labels[c.index],()=>sendStep(inputs[c.index])));}
 }
 node.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();onClose();}else trapDialog(node,e);});render();
 return {node,focus(){close.focus();},update(next){if(next){const restore=area.contains(document.activeElement),before=key;task=next;render();if(pending)for(const control of node.querySelectorAll('button,input'))control.disabled=true;if(restore&&before!==key)firstAvailable()?.focus();}},setPending(value){if(value)focusBeforePending=area.contains(document.activeElement)?document.activeElement:null;pending=value;for(const control of node.querySelectorAll('button,input'))control.disabled=value||control.dataset.confirmed==='true';if(!value&&focusBeforePending){const target=area.contains(focusBeforePending)&&!focusBeforePending.disabled?focusBeforePending:firstAvailable();target?.focus();focusBeforePending=null;}},feedback(message){status.textContent=message;},dispose(){closed=true;node.remove();}};
}
