#!/usr/bin/env node
// _site/ 를 GitHub Pages 와 같은 경로(기본 /MyGame/)로 서비스하는 아주 작은 정적 서버 (의존성 없음).
// 로컬 확인용:  node scripts/build-site.mjs && node scripts/serve-site.mjs
//   → PC: http://localhost:8080/MyGame/   휴대폰(같은 Wi-Fi): http://<PC의 IP>:8080/MyGame/
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, '_site');
const base = JSON.parse(readFileSync(join(root, 'games.json'), 'utf8')).site.basePath; // e.g. /MyGame/
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.wasm': 'application/wasm', '.webp': 'image/webp', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.woff': 'font/woff' };

if (!existsSync(site)) { console.error('_site/ 가 없습니다. 먼저 node scripts/build-site.mjs 를 실행하세요.'); process.exit(1); }

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === base.slice(0, -1)) { res.writeHead(302, { Location: base }); return res.end(); }
  if (!p.startsWith(base)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not under ' + base); }
  let rel = normalize(p.slice(base.length)).replace(/^(\.\.[\\/])+/, '');
  let file = join(site, rel);
  if (!file.startsWith(site)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' + url.search }); return res.end(); } // GitHub Pages 와 동일하게 슬래시 추가
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) { const nf = join(site, '404.html'); res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(existsSync(nf) ? readFileSync(nf) : 'Not found'); }
  res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(file));
}).listen(port, '0.0.0.0', () => {
  console.log(`허브 미리보기: http://localhost:${port}${base}`);
  for (const list of Object.values(networkInterfaces())) for (const n of list) if (n.family === 'IPv4' && !n.internal) console.log(`  휴대폰(같은 Wi-Fi): http://${n.address}:${port}${base}`);
});
