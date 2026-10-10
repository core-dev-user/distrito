import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||5173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.woff':'font/woff','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  let requested;
  try { requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end('Bad request');return;}
  const relative=requested==='/'?'index.html':requested.slice(1);
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||relative.split('/').some(p=>p.startsWith('.'))||!['index.html','src','assets'].includes(relative.split('/')[0])) {res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data);
  });
}).listen(port,'0.0.0.0',()=>console.log(`DISTRITO running on port ${port}`));
