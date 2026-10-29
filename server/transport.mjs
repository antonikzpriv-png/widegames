// Runnable foundation. Room builder replaces this file with the real service.
import http from 'node:http';
import {serveStatic} from './static.mjs';
export async function createGameServer(){
 const server=http.createServer(async(req,res)=>{
  if(req.url==='/api/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,game:'Lantern Wake',protocol:1}));return;}
  if(req.url.startsWith('/api/')){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:'FOUNDATION',message:'Room service is not yet integrated.'}}));return;}
  await serveStatic(req,res);
 });
 return {server,rooms:new Map(),close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
