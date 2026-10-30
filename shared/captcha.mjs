/** Original game puzzles, not a third-party CAPTCHA or an anti-bot credential. */
export const CAPTCHA_KINDS=Object.freeze(['glyphs','count','order','rotate','oddity','code']);
export const CAPTCHA_SYMBOLS=Object.freeze(['SUN','WAVE','STAR','MOON']);

function generator(progress,stage=true){
 const source=`${progress.kind}|${progress.target}|${progress.sequence.join(',')}|${progress.pressure}|${stage?progress.index:0}`;
 let seed=2166136261;
 for(const character of source)seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
 return maximum=>{seed=(seed+0x6D2B79F5)>>>0;let value=seed;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return ((value^(value>>>14))>>>0)%maximum;};
}

/** Display data only. The engine independently derives and validates semantic input. */
export function captchaChallenge(progress){
 if(!progress||!CAPTCHA_KINDS.includes(progress.kind))return null;
 const random=generator(progress,!['order','code'].includes(progress.kind));
 if(progress.kind==='glyphs'||progress.kind==='count'){
  const target=CAPTCHA_SYMBOLS[random(CAPTCHA_SYMBOLS.length)];
  const tiles=Array.from({length:9},()=>CAPTCHA_SYMBOLS[random(CAPTCHA_SYMBOLS.length)]);
  // Every challenge has a target and a distractor, including unlucky random draws.
  tiles[random(8)]=target;tiles[8]=CAPTCHA_SYMBOLS[(CAPTCHA_SYMBOLS.indexOf(target)+1)%CAPTCHA_SYMBOLS.length];
  return {tiles,target};
 }
 if(progress.kind==='oddity'){
  const base=random(CAPTCHA_SYMBOLS.length),odd=random(9),other=(base+1+random(3))%CAPTCHA_SYMBOLS.length;
  return {tiles:Array.from({length:9},(_,index)=>CAPTCHA_SYMBOLS[index===odd?other:base])};
 }
 if(progress.kind==='order'){
  const base=1+random(25),items=[base,base+3,base+7,base+12];
  for(let i=items.length-1;i>0;i--){const j=random(i+1);[items[i],items[j]]=[items[j],items[i]];}
  return {items};
 }
 if(progress.kind==='rotate')return {direction:['north','east','south','west'][random(4)]};
 const alphabet='ACFHJKMNPQRTUVWXYZ2346789';
 return {code:Array.from({length:6},()=>alphabet[random(alphabet.length)]).join('')};
}
