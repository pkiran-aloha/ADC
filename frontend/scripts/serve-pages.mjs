// Preview only: emulate GitHub Pages' /ADC/ project path and real 404 responses.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const base = '/ADC/';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json' };
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://preview.invalid').pathname;
  if (pathname === '/' || pathname === '/ADC') { response.writeHead(302, { Location: base }); response.end(); return; }
  try {
    if (!pathname.startsWith(base)) throw new Error('Not a project path');
    const relative = decodeURIComponent(pathname.slice(base.length)) || 'index.html';
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root)) throw new Error('Invalid path');
    const data = await readFile(filename);
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(data);
  } catch {
    try { const fallback = await readFile(path.join(root, '404.html')); response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(fallback); }
    catch { response.writeHead(500); response.end('Build the frontend before starting the Pages preview.'); }
  }
});
server.listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log(`Pages preview ready at /ADC/ on port ${process.env.PORT || 4173}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
