import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export async function serveStatic(req,res){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch{res.writeHead(400);res.end();return;}
 const rel=pathname.startsWith('/shared/')?pathname.slice(1):(pathname==='/'||/^\/r\/[A-Za-z0-9_-]+$/.test(pathname))?'public/index.html':'public/'+pathname.slice(1);
 const file=path.resolve(root,rel),base=path.join(root,rel.startsWith('shared/')?'shared':'public');
 if(!file.startsWith(base+path.sep)||pathname.includes('\0')||pathname.includes('\\')){res.writeHead(404);res.end();return;}
 try{const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(404);res.end('Not found');}
}
