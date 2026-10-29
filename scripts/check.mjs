import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
let count=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(/\.(mjs|js)$/.test(file)){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);count++;}}}
for(const dir of ['shared','server','public','tests','scripts'])await walk(dir);
console.log(`Syntax checked ${count} JavaScript modules.`);
