/** Native controls driven by an independent interpretation of public displays.
 * This helper never submits answers directly or changes authoritative state. */
import {taskDisplay} from '../../shared/task-catalog.mjs';
import {publicAnswer} from '../../tests/task-depth-oracle.mjs';

export function createTaskPanelDriver(page){
 async function click(selector){
  const node=await page.waitForSelector(selector,{visible:true});
  await node.evaluate(n=>n.scrollIntoView({block:'center'}));
  if(page.viewport().width<=400){const box=await node.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
  else await node.click();
 }
 async function drag(from,to){
  await page.$eval(from,n=>n.scrollIntoView({block:'center'}));
  const center=n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};
  const a=await page.$eval(from,center),b=await page.$eval(to,center);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
 }
 async function slider(selector,value){await page.focus(selector);await page.keyboard.press('Home');for(let n=0;n<Number(value);n++)await page.keyboard.press('ArrowRight');}
 async function step(c){
  const input=publicAnswer(c),display=taskDisplay(c);
  if(c.kind==='wires'&&c.index===0)await drag('[data-task-control=wire-source][data-wire-index="0"]',`[data-task-control=wire-destination][data-task-input="${input.split(':')[1]}"]`);
  else if(c.kind==='wires'){await click(`[data-task-control=wire-source][data-wire-index="${c.index}"]`);await click(`[data-task-control=wire-destination][data-task-input="${input.split(':')[1]}"]`);}
  else if(c.kind==='filter'&&c.index===0)await drag('[data-task-control=filter-debris][data-active=true]','[data-task-control=filter-bin]');
  else if(c.kind==='tuning'){await slider('.lw-frequency-slider',c.target);await click('[data-task-control=frequency-lock]');}
  else if(c.kind==='sequence'){
   await click('[data-task-control=memory-playback]');
   await page.waitForFunction(()=>!!document.querySelector('[data-task-control=sequence-key]:not(:disabled)'));
   for(const n of c.sequence.slice(0,c.index+1))await click(`[data-task-control=sequence-key][data-task-input="${n}"]`);
  }
  else if(c.kind==='steering'){await slider('.lw-instrument-slider',display.axes[c.index].target);await click('[data-task-control=axis-lock]');}
  else if(c.kind==='power'&&c.index===0){await slider(`[data-task-control=power-slider][data-channel="${display.channel}"]`,100);await click('[data-task-control=power-divert]');}
  else if(['glyphs','pairs','shields'].includes(c.kind)){for(const index of input.split(','))await click(`[data-captcha-index="${index}"]`);await click(c.kind==='glyphs'?'[data-captcha-submit=glyphs]':'[data-task-control=selection-submit]');}
  else if(c.kind==='oddity')await click(`[data-captcha-index="${input}"]`);
  else if(c.kind==='code'){await page.type('[data-captcha-code]',input.toLowerCase());await page.focus('[data-captcha-code]');await page.keyboard.press('Enter');}
  else await click(['count','order','rotate'].includes(c.kind)?`[data-captcha-answer="${input}"]`:`[data-task-input="${input}"]`);
 }
 return {step};
}
