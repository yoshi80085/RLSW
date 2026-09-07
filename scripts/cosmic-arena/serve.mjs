// Local-only preview server. Serves the exported arena folder, never the repo.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../output/cosmic-arena');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.glb':'model/gltf-binary','.map':'application/json'};
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const info=await stat(target);if(!info.isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:await readFile(target));
  }catch{res.writeHead(404).end('Not found');}
});
server.listen(4318,'127.0.0.1',()=>console.log('Cosmic arena: http://127.0.0.1:4318'));
