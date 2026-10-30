/** Independent QA interpretation of the public equipment display, not engine solver code. */
import {taskDisplay} from '../shared/task-catalog.mjs';
import {captchaChallenge} from '../shared/captcha.mjs';
export function publicAnswer(c){
 const d=c.v===3?taskDisplay(c):captchaChallenge(c);
 switch(c.kind){
  case 'wires':return `${c.index}:${c.v===3?d.wireOrder.indexOf(c.index):c.index}`;
  case 'tuning':return String(c.target);
  case 'sequence':return c.v===3?c.sequence.slice(0,c.index+1).join(','):String(c.sequence[c.index]);
  case 'pressure':return c.index===0?(c.pressure<5?'right-to-left':'left-to-right'):String(Math.abs(5-c.pressure));
  case 'repair':return ['isolate','replace','start','test'][c.index];
  case 'glyphs':return d.tiles.map((v,i)=>v===d.target?i:null).filter(v=>v!==null).join(',');
  case 'count':return String(d.tiles.filter(v=>v===d.target).length);
  case 'order':return String([...d.items].sort((a,b)=>a-b)[c.index]);
  case 'rotate':return ({north:'aligned',east:'left',south:'half',west:'right'})[d.direction];
  case 'oddity':return String(d.tiles.findIndex(v=>d.tiles.filter(q=>q===v).length===1));
  case 'code':return d.code;
  case 'course':return String(d.course[c.index].id);
  case 'steering':return `${d.axes[c.index].id}:${d.axes[c.index].target}`;
  case 'shields':return d.cells.map((v,i)=>v?i:null).filter(v=>v!==null).join(',');
  case 'power':return c.index===0?`${d.channel}:100`:'accept';
  case 'transfer':return ['connect','transfer','verify'][c.index];
  case 'sample':return c.index===0?'start':c.index===1?'incubate':String(d.oddVial);
  case 'filter':return `remove:${c.index}`;
  case 'pairs':return d.tiles.map((v,i)=>d.tiles.filter(q=>q===v).length===2?i:null).filter(v=>v!==null).join(',');
  case 'arithmetic':return String(d.operator==='+'?d.left+d.right:d.left-d.right);
  case 'compare':return String(d.gauges.indexOf(Math.max(...d.gauges)));
  case 'pattern':return d.pattern[2];
  case 'frequency':return String(d.waves.findIndex(v=>v.every((bit,i)=>bit===d.signal[i])));
  case 'sorting':return d.item.material;
  case 'path':return String(d.route[c.index]);
  default:throw Error('QA has no semantic oracle for '+c.kind);
 }
}
