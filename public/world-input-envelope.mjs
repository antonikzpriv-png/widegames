/** Translate local analogue steering into the server's eight-direction contract. */
export function worldInputEnvelope(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==3||!['seq','dx','dy'].every(key=>Object.hasOwn(input,key))||!Number.isSafeInteger(input.seq)||input.seq<=0||![input.dx,input.dy].every(axis=>Number.isFinite(axis)&&axis>=-1&&axis<=1))throw new TypeError('Invalid movement input.');
 const axis=value=>Math.abs(value)<.3?0:Math.sign(value);
 return {seq:input.seq,dx:axis(input.dx),dy:axis(input.dy)};
}
