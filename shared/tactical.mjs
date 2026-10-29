/** Public tactical preset identity. Mutable clocks remain private match state. */
export const TACTICAL_PRESET=Object.freeze({id:'tactical',version:1,cooldownScope:'faction',criticalLimit:1,doorLimit:2,doorGraceMs:1000});
export const isTactical=value=>value?.tacticalVersion===1&&value?.schemaVersion===4;
export function validateMapSelection(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2||typeof value.id!=='string'||!Number.isSafeInteger(value.version)||value.version<1)throw new TypeError('Invalid map selection');return {id:value.id,version:value.version};}
