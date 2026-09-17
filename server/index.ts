// Node WebSocket 서버: 정적 파일(dist/) + /ws 방 호스트. `npm run build && npm run server`
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { RoomHost } from '../src/net/room.ts';
import { makeCode, normCode, type Conn, type ClientMsg } from '../src/net/protocol.ts';

const PORT = Number(process.env.PORT || 8080);
const ROOT = resolve(process.env.STATIC_DIR || 'dist');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

export const rooms = new Map<string, RoomHost>();

function wrap(ws: WebSocket): Conn {
  let recv: ((m: unknown) => void) | null = null; let closed: (() => void) | null = null;
  ws.on('message', (d: Buffer | string) => { try { recv?.(JSON.parse(d.toString())); } catch { /* ignore */ } });
  ws.on('close', () => closed?.()); ws.on('error', () => closed?.());
  return {
    get open() { return ws.readyState === ws.OPEN; },
    send(m) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); },
    onMessage(cb) { recv = cb; }, onClose(cb) { closed = cb; },
    close() { try { ws.close(); } catch { /* ignore */ } },
  };
}

function newRoom(): RoomHost {
  let code = makeCode(); while (rooms.has(code)) code = makeCode();
  const room = new RoomHost({ code, onEmpty: () => rooms.delete(code) });
  rooms.set(code, room);
  return room;
}

export function startServer(port = PORT, staticDir = ROOT) {
  const http = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    if (url.pathname === '/api/ping') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return; }
    let p = decodeURIComponent(url.pathname); if (p.endsWith('/')) p += 'index.html';
    const file = join(staticDir, p);
    if (!file.startsWith(staticDir)) { res.writeHead(403); res.end(); return; }
    try {
      const st = await stat(file); if (!st.isFile()) throw new Error('nf');
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(await readFile(file));
    } catch { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('not found (먼저 npm run build)'); }
  });
  const wss = new WebSocketServer({ server: http, path: '/ws' });
  wss.on('connection', ws => {
    const conn = wrap(ws);
    const first = (d: Buffer | string) => {
      let m: ClientMsg; try { m = JSON.parse(d.toString()); } catch { ws.close(); return; }
      if (!m || m.t !== 'hello') { conn.send({ t: 'error', msg: '첫 메시지는 hello' }); ws.close(); return; }
      ws.off('message', first);
      let room: RoomHost | undefined;
      if (m.create) room = newRoom();
      else { room = rooms.get(normCode(m.code || '')); if (!room) { conn.send({ t: 'error', msg: '그 코드의 방이 없습니다' }); ws.close(); return; } }
      room.attach(conn, m);
    };
    ws.on('message', first);
  });
  http.listen(port);
  return { http, wss, close: () => new Promise<void>(r => { wss.close(); http.close(() => r()); }) };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  startServer();
  console.log(`닌자 랜덤 디펜스 서버: http://localhost:${PORT}  (정적: ${ROOT}, WebSocket: /ws)`);
}
