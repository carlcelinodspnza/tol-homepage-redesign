import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(process.argv[2]);
const PORT = Number(process.argv[3] || 8099);
const TYPES = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml',
 '.gif':'image/gif','.ico':'image/x-icon','.webm':'video/webm','.mp4':'video/mp4','.woff':'font/woff',
 '.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.resolve(path.join(ROOT, p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(fp,(e,d)=>{
    if (e) { res.writeHead(404,{'Content-Type':'text/plain'}); return res.end('404 '+p); }
    res.writeHead(200,{'Content-Type':TYPES[path.extname(fp).toLowerCase()]||'application/octet-stream',
                       'Access-Control-Allow-Origin':'*'});
    res.end(d);
  });
}).listen(PORT,'127.0.0.1',()=>console.log('SERVING '+ROOT+' on http://127.0.0.1:'+PORT));
