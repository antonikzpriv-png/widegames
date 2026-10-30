import {captchaChallenge} from '../../shared/captcha.mjs';
import {taskDisplay} from '../../shared/task-catalog.mjs';
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

const glyphs={SUN:'☀',WAVE:'≈',STAR:'✦',MOON:'☾',COMET:'☄',ANCHOR:'⚓'};
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


const instrumentNames={wires:'CIRCUIT PATCH BAY',tuning:'BEACON FREQUENCY',sequence:'RECORD SEQUENCER',pressure:'HYDRAULIC BALANCE',repair:'FUSE SERVICE UNIT',course:'NAVIGATION PLOTTER',steering:'ATTITUDE ALIGNMENT',shields:'SHIELD ARRAY',power:'POWER DISTRIBUTION',transfer:'DATA TRANSFER TERMINAL',sample:'SPECIMEN ANALYZER',filter:'AIRFLOW FILTER',glyphs:'SYMBOL VERIFICATION',count:'OPTICAL INVENTORY',order:'CARGO TAG SORTER',rotate:'DIRECTION CALIBRATION',oddity:'ANOMALY SCANNER',code:'SIGNAL TRANSCRIPTION',pairs:'DUPLICATE SIGNATURES',arithmetic:'LOAD CALCULATION',compare:'GAUGE COMPARISON',pattern:'PATTERN RECOVERY',frequency:'WAVEFORM MATCHING',sorting:'MATERIAL SEPARATOR',path:'CIRCUIT ROUTING'};
const colors=['#f4bf61','#76e2d0','#c9a8ff','#f58b9a'];
const symbols=['SUN','WAVE','STAR','MOON'];
const labelFor=value=>glyphs[value]||String(value);
function group(label,className='lw-equipment-controls'){const node=dom('div',className);node.setAttribute('role','group');node.setAttribute('aria-label',label);return node;}
function readout(label,value){const node=dom('div','lw-instrument-readout');node.append(dom('span','',label),dom('strong','',value));return node;}
function terminal(label,value){const node=dom('div','lw-terminal-display');node.append(dom('span','lw-terminal-label',label),dom('strong','',value));return node;}
function gauge(label,value,max=10){const node=dom('div','lw-reservoir'),scale=dom('div','lw-reservoir-scale');node.setAttribute('role','img');node.setAttribute('aria-label',`${label}: ${value} of ${max}`);for(let n=0;n<=10;n++)scale.append(dom('span','',String(max-n*max/10)));const tube=dom('div','lw-reservoir-tube'),liquid=dom('div','lw-reservoir-liquid');liquid.style.height=`${value/max*100}%`;tube.append(liquid);node.append(dom('strong','',label),scale,tube,dom('span','lw-reservoir-value',`${value} / ${max}`));return node;}
function sliderControl({area,id,label,value=0,min=0,max=100,onChange,className=''}){const wrap=dom('div','lw-equipment-slider'),text=dom('label','',label),input=dom('input',className||'lw-instrument-slider'),output=dom('output','lw-slider-readout',String(value));input.type='range';input.min=min;input.max=max;input.step=1;input.value=value;input.id=id;text.htmlFor=id;input.setAttribute('aria-label',label);output.htmlFor=id;input.addEventListener('input',()=>{output.textContent=input.value;onChange?.(input.value);});wrap.append(text,input,output);area.append(wrap);return input;}

/** All equipment is a view of saved progress. Local gestures never award credit. */
export function createTaskPuzzle(options){
 if(!options.task.progress)return createLegacyPuzzle(options);
 const {id,onClose,onSubmit}=options;let task=options.task,pending=false,closed=false,key='',focusBeforePending=null,refreshTimer=()=>{};
 const now=()=>options.getServerNow?.()??Date.now();
 const node=dom('section','lw-task-modal lw-instrument-modal');node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.tabIndex=-1;
 const heading=dom('h2','',task.label);heading.id=`${id}-title`;node.setAttribute('aria-labelledby',heading.id);
 const close=control('Close station',onClose,'lw-close'),top=dom('div','lw-instrument-top'),title=dom('p','lw-equipment-type'),serial=dom('span','lw-equipment-serial',`STATION ${task.roomId.toUpperCase()} · ${task.id.slice(-6).toUpperCase()}`);
 top.append(dom('span','lw-equipment-brand','LANTERN / FIELD SYSTEMS'),close);const copy=dom('p','lw-task-instruction'),area=dom('div','lw-puzzle'),status=dom('p','lw-puzzle-status'),progress=dom('progress','lw-task-step-meter'),stages=dom('div','lw-task-stage-track'),ack=dom('span','lw-equipment-ack','AWAITING INPUT');area.tabIndex=-1;area.setAttribute('role','group');area.setAttribute('aria-label','Equipment controls and progress');status.setAttribute('role','status');status.setAttribute('aria-live','polite');progress.setAttribute('aria-label','Server-confirmed task steps');stages.setAttribute('aria-hidden','true');
 const footer=dom('div','lw-equipment-footer');footer.append(ack,dom('span','','↵ / SPACE SELECT · ESC CLOSE'));
 node.append(top,title,heading,serial,copy,stages,progress,area,status,footer,dom('p','lw-modal-footnote','Confirmed steps are saved. Meetings or leaving close the panel. Running diagnostics restart; completed steps remain.'));
 const firstAvailable=()=>[...area.querySelectorAll('button,input')].find(control=>!control.disabled);
 function restoreEquipmentFocus(previous){const active=document.activeElement;if(active&&active!==document.body&&active!==previous&&!area.contains(active))return;const target=area.contains(previous)&&!previous.disabled?previous:firstAvailable()??area;target.focus();}
 function lockControls(){for(const control of node.querySelectorAll('button,input'))control.disabled=pending||control.dataset.confirmed==='true'||control.dataset.blocked==='true';}
 function send(input){if(!pending&&!closed)onSubmit(input===undefined?undefined:{step:task.progress.index,input});}
 function render(){
  const c=task.progress,next=JSON.stringify(c);if(next===key){refreshTimer();return;}key=next;refreshTimer=()=>{};
  const sendStep=input=>{if(key===next&&!closed)send(input);};
  area.replaceChildren();area.className=`lw-puzzle lw-instrument lw-puzzle-${c.kind}`;area.dataset.taskKind=c.kind;area.dataset.taskStep=String(c.index);node.dataset.taskKind=c.kind;status.dataset.error='false';
  title.textContent=instrumentNames[c.kind]||'FIELD EQUIPMENT';status.textContent=`${c.index} / ${c.total} steps confirmed by the beacon`;progress.max=c.total;progress.value=c.index;stages.replaceChildren(...Array.from({length:c.total},(_,i)=>{const step=dom('span','lw-task-stage',String(i+1));step.dataset.state=i<c.index?'done':i===c.index?'current':'waiting';return step;}));
  const answer=(label,value,className='lw-secondary',code='answer')=>{const b=control(label,()=>sendStep(String(value)),className);b.dataset.taskControl=code;b.dataset.taskInput=String(value);return b;};
  const finish=()=>{copy.textContent='All equipment checks are confirmed. Send the completed task to restore the beacon.';const seal=dom('div','lw-task-success-seal');seal.append(dom('span','','✓'),dom('strong','','SYSTEM READY'),dom('small','','All checks confirmed'));area.append(seal,control('Send completed task',()=>sendStep(),'lw-primary'));};
  if(c.index===c.total){finish();return;}
  const display=c.v===3?taskDisplay(c):null;
  if(c.kind==='wires'){
   const count=c.v===3?4:3,left=group('Source cables','lw-wire-column'),right=group('Destination sockets','lw-wire-column'),links=dom('div','lw-wire-links');let selected=null;const controls=[];
   copy.textContent='Drag the highlighted cable to its matching numbered symbol, or select the source and destination with taps / keyboard. Color is a second clue. The beacon checks each connection.';
   const order=display?.wireOrder||[2,0,1];area.append(left,links,right);
   for(let n=0;n<count;n++){
    const b=control(`Left cable ${n+1}`,()=>{if(n!==c.index){status.textContent=`Cable ${c.index+1} is ready to patch next.`;return;}selected=n;for(const [i,other]of controls.entries())other.setAttribute('aria-pressed',String(i===n));status.textContent=`Cable ${n+1} selected. Match ${symbols[n]} / ${n+1} on the right.`;},'lw-socket lw-source-socket');b.style.setProperty('--wire-color',colors[n]);b.setAttribute('aria-label',`Left cable ${n+1}`);b.setAttribute('aria-pressed','false');b.dataset.taskControl='wire-source';b.dataset.wireIndex=String(n);b.dataset.active=String(n===c.index);b.dataset.confirmed=String(n<c.index);b.disabled=n<c.index;
    let suppressClick=false;
    b.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.stopImmediatePropagation();}},true);
    b.addEventListener('pointerdown',event=>{if(pending||closed||key!==next||n!==c.index||event.button>0)return;selected=n;b.setPointerCapture?.(event.pointerId);b.setAttribute('aria-pressed','true');status.textContent=`Drag cable ${n+1} to ${symbols[n]} / ${n+1}, then release.`;});
    b.addEventListener('pointerup',event=>{if(pending||closed||key!==next||selected!==n)return;const target=document.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-task-control="wire-destination"]');if(target&&area.contains(target)&&!target.disabled){suppressClick=true;sendStep(`${n}:${target.dataset.taskInput}`);}});
    b.dataset.wireSymbol=`${symbols[n]} · ${n+1}`;left.append(b);controls.push(b);const line=dom('span','lw-connected-wire',n<c.index?'━━ ● ━━':'┄┄ ◇ ┄┄');line.style.setProperty('--wire-color',colors[n]);line.dataset.connected=String(n<c.index);links.append(line);
   }
   const socketOrder=c.v===3?order:[2,0,1];for(const [position,n]of socketOrder.entries()){const b=control(`Right socket ${c.v===3?position+1:n+1}`,()=>{if(selected===null){status.textContent='Choose the highlighted left cable first.';return;}sendStep(`${selected}:${c.v===3?position:n}`);},'lw-socket lw-destination-socket');b.dataset.wireSymbol=`${symbols[n]} · ${n+1}`;b.style.setProperty('--wire-color',colors[n]);b.setAttribute('aria-label',`Right socket ${c.v===3?position+1:n+1}`);b.dataset.taskControl='wire-destination';b.dataset.taskInput=String(c.v===3?position:n);b.dataset.confirmed=String(n<c.index);b.disabled=n<c.index;right.append(b);}
  }else if(c.kind==='tuning'){
   copy.textContent=`Match the transmitter to ${c.target} kHz, then lock the frequency. Use the slider or Left / Right arrow keys for one-kHz adjustments.`;
   const scope=dom('div','lw-oscilloscope'),wave=dom('div','lw-scope-wave'),dial=dom('div','lw-tuning-dial');scope.append(dom('span','lw-scope-caption','RX SIGNAL · AUTO GAIN'),wave,dom('span','lw-scope-axis','0 ┄ 25 ┄ 50 ┄ 75 ┄ 100 kHz'));dial.append(dom('span','','TARGET'),dom('strong','lw-frequency',`${c.target} kHz`));area.append(scope,dial);
   const input=sliderControl({area,id:`${id}-dial`,label:'Frequency',className:'lw-frequency-slider',onChange:value=>{wave.style.setProperty('--frequency',String(Number(value)/20+1));scope.dataset.aligned=String(Number(value)===c.target);}});const actual=control('Lock frequency',()=>sendStep(input.value),'lw-primary');actual.dataset.taskControl='frequency-lock';area.append(actual);
  }else if(c.kind==='sequence'){
   const memory=c.v===3,required=memory?c.index+1:1,grid=group('Sequence keyboard','lw-sequence-grid');
   copy.textContent=memory?`Watch and repeat the recorded pattern. Round ${c.index+1} uses ${required} key${required===1?'':'s'}. Each new round adds one signal; the server checks the complete order.`:`Restore record: ${c.sequence.join(' → ')}. Enter step ${c.index+1}. The server checks each key.`;
   const tape=dom('div','lw-memory-tape');let entered=[],watching=false,played=!memory;
   const monitor=dom('strong','lw-memory-monitor',memory?'PLAY THE PATTERN':'REPEAT THE RECORD');monitor.setAttribute('aria-live','polite');
   if(memory){
    const replay=control('Play pattern',()=>{if(watching||closed||key!==next||pending)return;watching=true;played=false;entered=[];for(const b of keys)b.dataset.blocked='true';lockControls();replay.disabled=true;monitor.textContent='WATCH';let step=0;if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){watching=false;played=true;monitor.textContent=`PATTERN: ${c.sequence.slice(0,required).join(' → ')}`;keys.forEach(b=>b.dataset.blocked='false');replay.disabled=pending;lockControls();return;}
     const flash=()=>{if(closed||key!==next)return;if(step>=required){watching=false;played=true;monitor.textContent=`REPEAT ${required} KEY${required===1?'':'S'}`;keys.forEach(b=>{b.dataset.flash='false';b.dataset.blocked='false';});replay.disabled=pending;lockControls();keys[0]?.focus();return;}
      keys.forEach((b,i)=>b.dataset.flash=String(i+1===c.sequence[step]));monitor.textContent=`SIGNAL ${step+1}: ${c.sequence[step]}`;step++;setTimeout(()=>{if(closed||key!==next)return;keys.forEach(b=>b.dataset.flash='false');setTimeout(flash,180);},480);
     };flash();
    },'lw-secondary');replay.dataset.taskControl='memory-playback';const assist=control('Show accessible pattern',()=>{if(watching||closed||key!==next)return;played=true;entered=[];monitor.textContent=`PATTERN: ${c.sequence.slice(0,required).join(' → ')}`;keys.forEach(b=>b.dataset.blocked='false');lockControls();},'lw-secondary');assist.dataset.taskControl='memory-assist';area.append(monitor,replay,assist);
   }else for(const [i,value]of c.sequence.entries()){const n=dom('span','',String(value));n.dataset.state=i<c.index?'done':i===c.index?'current':'waiting';tape.append(n);}
   const keys=[];for(let n=1;n<=4;n++){
    const b=control(String(n),()=>{if(!memory){sendStep(String(n));return;}if(!played||watching||pending||closed||key!==next)return;entered.push(n);monitor.textContent=`${entered.length} / ${required} KEYS ENTERED`;if(entered.length===required){const input=entered.join(',');entered=[];sendStep(input);}},'lw-sequence-tile');b.dataset.taskControl='sequence-key';b.dataset.taskInput=String(n);b.dataset.blocked=String(memory&&!played);b.setAttribute('aria-label',`Sequence tile ${n}`);keys.push(b);grid.append(b);
   }
   if(!memory)area.append(tape);area.append(grid);

  }else if(c.kind==='pressure'){
   copy.textContent=`Equalize both reservoirs to 5 bar. ${c.index===0?'Open the flow in the correct direction.':'Choose the exact pressure to move through the valve.'}`;
   const tanks=dom('div','lw-reservoirs');tanks.append(gauge('PORT',c.pressure),dom('div','lw-pressure-valve','↔'),gauge('STARBOARD',10-c.pressure));area.append(tanks,readout('TARGET','5 / 5 BAR'));const choices=group('Pressure valve controls');if(c.index===0)choices.append(answer('Flow left to right','left-to-right'),answer('Flow right to left','right-to-left'));else for(let n=1;n<=4;n++)choices.append(answer(`Transfer ${n} bar`,n));area.append(choices);
  }else if(c.kind==='repair'){
   const labels=['Isolate power','Replace fuse','Start diagnostic','Verify diagnostic'],inputs=['isolate','replace','start','test'];copy.textContent=c.index===3?'The analyzer is checking the replacement fuse. Wait for its timer, then verify the result.':'Make the circuit safe, seat a new fuse, then run and verify the diagnostic. The interlock advances only after confirmation.';
   const cabinet=dom('div','lw-fuse-cabinet');for(const [i,label]of ['POWER ISOLATED','FUSE SEATED','DIAGNOSTIC','LINE VERIFIED'].entries()){const row=dom('div','lw-fuse-row');row.dataset.state=i<c.index?'done':i===c.index?'current':'waiting';row.append(dom('span','lw-led'),dom('strong','',label),dom('span','',i<c.index?'OK':i===c.index?'CHECK':'LOCK'));cabinet.append(row);}area.append(cabinet);
   const action=answer(labels[c.index],inputs[c.index],'lw-primary','repair-step');area.append(action);if(c.index===3)timer(c.readyAt,action,'DIAGNOSTIC RUNNING');
  }else if(c.v===2&&renderCaptcha(area,c,{id,copy,status,send:sendStep})){
   // Historic CAPTCHA task semantics and persisted progress remain unchanged.
  }else if(c.v===3&&renderExtended(area,c,display,{id,copy,status,answer,send:sendStep,timer,sliderControl})){
  }else if(renderCaptcha(area,c,{id,copy,status,send:sendStep})){
  }else{copy.textContent='This equipment type is unavailable. Close the panel and resynchronize the watch.';area.append(terminal('UNAVAILABLE',c.kind));}
  lockControls();
  function timer(deadline,action,label){const line=dom('div','lw-diagnostic-timer'),clock=dom('strong'),meter=dom('progress');meter.max=1;line.append(dom('span','',label),clock,meter);area.append(line);const duration=Math.max(1,deadline-now());refreshTimer=()=>{const left=Math.max(0,deadline-now());clock.textContent=left>0?`${(left/1000).toFixed(1)} SEC`:'READY TO VERIFY';meter.value=Math.min(1,1-left/duration);action.dataset.blocked=String(left>0);action.disabled=pending||left>0;line.dataset.ready=String(left===0);};refreshTimer();}
 }
 node.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();onClose();}else trapDialog(node,e);});render();
 return {node,focus(){close.focus();},update(next){if(next){const restore=area.contains(document.activeElement),before=key;task=next;render();lockControls();if(restore&&before!==key)restoreEquipmentFocus(null);}},setPending(value){if(value)focusBeforePending=area.contains(document.activeElement)?document.activeElement:null;pending=value;node.dataset.pending=String(value);ack.textContent=value?'TRANSMITTING…':'AWAITING INPUT';lockControls();if(!value&&focusBeforePending){restoreEquipmentFocus(focusBeforePending);focusBeforePending=null;}},feedback(message){status.textContent=message;status.dataset.error='true';},dispose(){closed=true;refreshTimer=()=>{};node.remove();}};
}

function renderExtended(area,c,d,{id,copy,status,answer,send,timer}){
 const choices=label=>{const node=group(label);area.append(node);return node;};
 const selectMany=(values,label,submitLabel,required)=>{const selected=new Set(),grid=group(label,'lw-captcha-grid');area.classList.add('lw-captcha');for(const [i,value]of values.entries()){const b=captchaTile(value,i,()=>{if(selected.has(i))selected.delete(i);else selected.add(i);b.setAttribute('aria-pressed',String(selected.has(i)));status.textContent=`${selected.size} selected${required?` / ${required} required`:''}. Check the full selection when ready.`;});b.setAttribute('aria-pressed','false');if(String(value).startsWith('◇ '))b.dataset.sector='red';else if(String(value).startsWith('✓ '))b.dataset.sector='clear';b.dataset.taskControl='tile-select';grid.append(b);}area.append(grid);const button=control(submitLabel,()=>{if(!selected.size||required&&selected.size!==required){status.textContent=required?`Select exactly ${required} tiles.`:'Select the complete set of matching sectors.';return;}send([...selected].sort((a,b)=>a-b).join(','));},'lw-primary');button.dataset.taskControl='selection-submit';area.append(button);};
 if(c.kind==='course'){
  copy.textContent='Plot each waypoint in numbered route order. Connect all four beacons to chart a safe course through the storm.';const chart=group('Navigation chart','lw-course-chart'),svg=document.createElementNS?.('http://www.w3.org/2000/svg','svg');if(svg){svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','lw-course-svg');chart.append(svg);}for(const [i,p]of d.course.entries()){const b=answer(String(i+1),p.id,'lw-course-point','course-waypoint');b.style.left=`${p.x}%`;b.style.top=`${p.y}%`;b.dataset.confirmed=String(i<c.index);b.setAttribute('aria-label',`Plot waypoint ${i+1}`);chart.append(b);if(i){const prior=d.course[i-1],line=dom('span','lw-course-line'),dx=p.x-prior.x,dy=p.y-prior.y;line.style.left=`${prior.x}%`;line.style.top=`${prior.y}%`;line.style.width=`${Math.hypot(dx,dy)}%`;line.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;line.dataset.confirmed=String(i<=c.index);if(svg){const segment=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [attr,value]of Object.entries({x1:prior.x,y1:prior.y,x2:p.x,y2:p.y,'vector-effect':'non-scaling-stroke','data-confirmed':String(i<=c.index)}))segment.setAttribute(attr,String(value));svg.append(segment);}else chart.append(line);}}area.append(chart,readout('NEXT CHECKPOINT',String(c.index+1)));
 }else if(c.kind==='steering'){
  const axis=d.axes[c.index];copy.textContent=`Align the ${axis.id==='x'?'horizontal':'vertical'} navigation axis to ${axis.target}. Center the crosshair over the target marker and lock the axis.`;const scope=dom('div','lw-steering-scope'),crosshair=dom('span','lw-steering-crosshair','+'),target=dom('span','lw-steering-target','⊕');target.style.left=`${d.axes[0].target}%`;target.style.top=`${100-d.axes[1].target}%`;crosshair.style.left=c.index===0?'50%':`${d.axes[0].target}%`;crosshair.style.top='50%';scope.append(target,crosshair);area.append(scope,readout(`${axis.id.toUpperCase()} AXIS TARGET`,String(axis.target)));const slider=sliderControl({area,id:`${id}-${axis.id}`,label:`${axis.id.toUpperCase()} axis`,value:50,onChange:value=>{crosshair.style[axis.id==='x'?'left':'top']=`${axis.id==='x'?value:100-Number(value)}%`;}}),lock=control('Lock axis',()=>send(`${axis.id}:${slider.value}`),'lw-primary');lock.dataset.taskControl='axis-lock';area.append(lock);
 }else if(c.kind==='shields'){
  copy.textContent='Prime every red sector in the shield array, then confirm the complete circuit. Red sectors also carry a hollow diamond; no color guessing is required.';selectMany(d.cells.map((red,i)=>red?`◇ ${i+1}`:`✓ ${i+1}`),'Shield sectors','Prime selected sectors');area.classList.add('lw-shields');
 }else if(c.kind==='power'){
  copy.textContent=c.index===0?`Route all power to ${d.channels[d.channel]}. Raise the requested circuit to 100%, then divert here. Travel to the destination shown in your task list to accept the routed power.`:'Accept the routed power at this destination station. Close the acceptance breaker to complete the route.';const rack=dom('div','lw-power-rack');area.append(rack);const sliders=[];for(const [i,label]of d.channels.entries()){const row=dom('div','lw-power-channel');row.dataset.requested=String(i===d.channel);row.append(dom('span','lw-led'),dom('strong','',label));const slider=sliderControl({area:row,id:`${id}-power-${i}`,label:`${label} power`,value:c.index&&i===d.channel?100:20});if(c.index){slider.dataset.confirmed='true';slider.disabled=true;}slider.dataset.taskControl='power-slider';slider.dataset.channel=String(i);sliders.push(slider);rack.append(row);}const b=c.index===0?control('Divert power',()=>send(`${d.channel}:${sliders[d.channel].value}`),'lw-primary'):answer('Accept routed power','accept','lw-primary','power-accept');b.dataset.taskControl=c.index===0?'power-divert':'power-accept';area.append(b);
 }else if(c.kind==='transfer'){
  copy.textContent=['Connect the uplink cable to begin transferring the station records.','Keep the uplink connected while the server transfers the complete packet. Verify only when the terminal is ready.','Compare the received checksum and confirm the verified station records.'][c.index];const network=dom('div','lw-data-link');network.dataset.connected=String(c.index>0);network.append(terminal('STATION ARCHIVE',`${d.fileCount} FILES`),dom('span','lw-data-stream','▰ · ▰ · ▰ →'),terminal('BEACON UPLINK',c.index===0?'OFFLINE':c.index===1?'RECEIVING':'RECEIVED'));area.append(network,readout('PACKET CHECKSUM',d.checksum));const b=answer(['Connect uplink','Transfer records','Verify checksum'][c.index],['connect','transfer','verify'][c.index],'lw-primary','transfer-step');area.append(b);if(c.index===1)timer(c.readyAt,b,'TRANSFERRING RECORDS');
 }else if(c.kind==='sample'){
  copy.textContent=['Load the culture tray and start incubation. The analyzer will compare all five samples.','The culture tray is incubating. Saved incubation continues if you leave, but the server will not accept an early reading.','Select the one vial with the red anomaly marker. All normal vials have a clear circular marker.'][c.index];const rack=group('Culture sample tray','lw-vial-rack');for(let i=0;i<d.vials;i++){const vial=dom('span','lw-vial'),liquid=dom('span','lw-vial-liquid'),number=dom('strong','',String(i+1));vial.dataset.anomaly=String(c.index===2&&i===d.oddVial);liquid.textContent=c.index===2&&i===d.oddVial?'◇':'○';vial.append(liquid,number);if(c.index===2){const b=answer(`Inspect vial ${i+1}`,i,'lw-vial-button','sample-vial');b.append(vial);rack.append(b);}else rack.append(vial);}area.append(rack);if(c.index<2){const b=answer(c.index===0?'Start incubation':'Read incubated samples',c.index===0?'start':'incubate','lw-primary','sample-step');area.append(b);if(c.index===1)timer(c.readyAt,b,'CULTURE INCUBATION');}
 }else if(c.kind==='filter'){
  copy.textContent='Drag the highlighted obstruction into the collection chute, or select it to extract with keyboard / touch. Remove all three objects to restore intake airflow.';const duct=group('Intake grille','lw-filter-duct'),chute=dom('div','lw-filter-bin','↓ COLLECTION CHUTE');chute.dataset.taskControl='filter-bin';for(const [i,item]of d.debris.entries()){const b=answer(item.label,`remove:${item.id}`,'lw-debris','filter-debris');let suppressClick=false;b.addEventListener('click',event=>{if(suppressClick){suppressClick=false;event.stopImmediatePropagation();}},true);b.addEventListener('pointerdown',event=>{if(i!==c.index||b.disabled)return;b.setPointerCapture?.(event.pointerId);b.dataset.dragging='true';});b.addEventListener('pointerup',event=>{b.dataset.dragging='false';const target=document.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-task-control="filter-bin"]');if(i===c.index&&target===chute&&!b.disabled){suppressClick=true;send(`remove:${item.id}`);}});b.style.left=`${item.x}%`;b.style.top=`${item.y}%`;b.dataset.confirmed=String(i<c.index);b.dataset.active=String(i===c.index);b.setAttribute('aria-label',`Remove ${item.label.toLowerCase()}`);duct.append(b);}area.append(duct,chute,readout('AIRFLOW',`${Math.round(c.index/3*100)}%`));
 }else if(c.kind==='pairs'){
  copy.textContent='Find the only symbol that appears twice. Select both matching signal tokens and verify the pair. Each token has a readable symbol name.';selectMany(d.tiles,'Find the matching pair','Verify matching pair',2);
 }else if(c.kind==='arithmetic'){
  copy.textContent='Check the cargo manifest calculation. Choose the exact total; the operator is shown between the quantities.';area.append(terminal('MANIFEST CHECK',`${d.left} ${d.operator} ${d.right} = ?`));const list=choices('Manifest total');for(const n of d.choices)list.append(answer(String(n),n,'lw-calculation-key','arithmetic-answer'));
 }else if(c.kind==='compare'){
  copy.textContent='Compare the actual gauge readings and select the instrument with the highest value. Both numeric readings and liquid levels show the same measurement.';const row=choices('Select highest gauge');for(const [i,value]of d.gauges.entries()){const b=answer(`Select gauge ${i+1}`,i,'lw-gauge-button','compare-gauge');b.append(gauge(`GAUGE ${i+1}`,value,100));row.append(b);}
 }else if(c.kind==='pattern'){
  copy.textContent='Recover the repeating three-symbol pattern. Read the five confirmed symbols, then choose the symbol that comes next.';const strip=dom('div','lw-pattern-strip');for(const value of d.pattern)strip.append(dom('span','',`${labelFor(value)} ${value}`));strip.append(dom('span','lw-pattern-missing','?'));area.append(strip);const row=choices('Missing pattern symbol');for(const value of d.choices)row.append(answer(`${labelFor(value)} ${value}`,value,'lw-captcha-answer','pattern-symbol'));
 }else if(c.kind==='frequency'){
  copy.textContent='Match the received waveform to the reference signal. Read each high/low segment from left to right. Exactly one trace matches all eight segments.';const draw=bits=>{const wave=dom('span','lw-bit-wave');wave.setAttribute('role','img');wave.setAttribute('aria-label',bits.map(bit=>bit?'high':'low').join(', '));for(const bit of bits){const segment=dom('span');segment.dataset.bit=String(bit);wave.append(segment);}return wave;};const reference=terminal('REFERENCE TRACE','');reference.append(draw(d.signal));area.append(reference);const row=choices('Choose matching waveform');for(const [i,wave]of d.waves.entries()){const b=answer(`Trace ${i+1}`,i,'lw-wave-button','frequency-trace');b.append(draw(wave));row.append(b);}
 }else if(c.kind==='sorting'){
  copy.textContent='Identify the recovered item and put it in the correct material bin. The item card names its material as an accessible second clue.';const item=dom('div','lw-material-item');item.dataset.material=d.item.material;item.append(dom('span','lw-material-icon',({metal:'⚙',glass:'◇',organic:'❧',polymer:'◒'})[d.item.material]),dom('strong','',d.item.label),dom('span','',`Material: ${d.item.material}`));area.append(item);const row=choices('Recycling bins');for(const bin of d.bins)row.append(answer(bin.label,bin.id,'lw-material-bin','sorting-bin'));
 }else if(c.kind==='path'){
  copy.textContent=`Follow the four adjacent navigation checkpoints in order: ${d.route.map(i=>i+1).join(' → ')}. Start at the lit checkpoint and trace the route without skipping a node.`;const grid=group('Navigation circuit grid','lw-path-grid');for(let i=0;i<9;i++){const b=answer(String(i+1),i,'lw-path-node','path-node');b.dataset.route=d.route.includes(i)?String(d.route.indexOf(i)+1):'';b.dataset.confirmed=String(d.route.slice(0,c.index).includes(i));b.dataset.active=String(i===d.route[c.index]);b.setAttribute('aria-label',`Checkpoint ${i+1}`);grid.append(b);}area.append(grid);
 }else return false;
 return true;
}
