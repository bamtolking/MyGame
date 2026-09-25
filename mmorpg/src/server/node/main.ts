// Node entry point: HTTP (static client + /api/info) and WebSocket (/ws) on one port.
//   node src/server/node/main.ts            (Node ≥ 22.18 runs TypeScript directly)
// Env: PORT=8080 CHANNELS=2 BOTS=0 SEED=20260925 DATA_DIR=./server-data WB_INTERVAL=600 NAME="달빛 서버"
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync, createReadStream } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import { GameServer, type ProfileStore } from '../server.ts';
import { TICK_HZ } from '../../shared/constants.ts';
import type { Profile } from '../../shared/types.ts';

const env = (k: string, d: string) => process.env[k] ?? d;
const PORT = Number(env('PORT', '8080'));
const DATA = resolve(env('DATA_DIR', './server-data'));
const STATIC = resolve(env('STATIC_DIR', './dist'));
mkdirSync(join(DATA, 'players'), { recursive: true });

/** One JSON file per character, written atomically (tmp + rename). */
class FileStore implements ProfileStore {
  private pending = new Map<string, string>(); private writing = false;
  private file(token: string) { return join(DATA, 'players', createHash('sha256').update(token).digest('hex').slice(0, 32) + '.json'); }
  load(token: string): Profile | null {
    const q = this.pending.get(this.file(token)); if (q) return JSON.parse(q);
    try { return JSON.parse(readFileSync(this.file(token), 'utf8')); } catch { return null; }
  }
  save(token: string, p: Profile): void { this.pending.set(this.file(token), JSON.stringify(p)); void this.drain(); }
  async drain(): Promise<void> {
    if (this.writing) return; this.writing = true;
    try { while (this.pending.size) { const [f, data] = this.pending.entries().next().value!; this.pending.delete(f); await writeFile(f + '.tmp', data); await rename(f + '.tmp', f); } }
    catch (e) { console.error('[store] write failed', e); } finally { this.writing = false; }
  }
}
const store = new FileStore();
const gs = new GameServer({
  seed: Number(env('SEED', '20260925')), channels: Number(env('CHANNELS', '2')), name: env('NAME', '달빛 서버'), online: true,
  bots: Number(env('BOTS', '0')), wbInterval: Number(env('WB_INTERVAL', '600')), wbFirst: Number(env('WB_FIRST', '240')), store,
});

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
function serve(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/api/info') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify({ game: 'moonlit', ...gs.info() })); return; }
  if (url.pathname === '/health') { res.writeHead(200); res.end('ok'); return; }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!path || path.endsWith('/')) path += 'index.html';
  const full = join(STATIC, path);
  if (!full.startsWith(STATIC) || !existsSync(full) || !statSync(full).isFile()) {
    if (!existsSync(join(STATIC, 'index.html'))) { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end('달빛 퇴마단 서버 실행 중. 클라이언트를 먼저 빌드하세요: npm run build'); return; }
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(full)] ?? 'application/octet-stream', 'cache-control': path === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
  createReadStream(full).pipe(res);
}
const http = createServer(serve);
const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 4096, perMessageDeflate: false });
const alive = new WeakMap<WebSocket, boolean>();
wss.on('connection', (ws) => {
  alive.set(ws, true); ws.on('pong', () => alive.set(ws, true));
  const s = gs.connect({ send: (d) => { if (ws.readyState === ws.OPEN) ws.send(d, { binary: typeof d !== 'string' }); }, close: () => ws.close(), buffered: () => ws.bufferedAmount });
  ws.on('message', (data, isBinary) => { if (!isBinary) gs.message(s, data.toString()); });
  ws.on('close', () => gs.close(s));
  ws.on('error', () => gs.close(s));
});
setInterval(() => { for (const ws of wss.clients) { if (!alive.get(ws)) { ws.terminate(); continue; } alive.set(ws, false); ws.ping(); } }, 20000);

// fixed-rate tick loop with catch-up (never more than 5 ticks per wake)
const STEP = 1000 / TICK_HZ; let next = performance.now();
function loop() {
  const now = performance.now(); let n = 0;
  while (now >= next && n < 5) { gs.tick(); next += STEP; n++; }
  if (now - next > 1000) next = now; // fell far behind (debugger / suspend): resync
  setTimeout(loop, Math.max(0, Math.min(STEP, next - performance.now())));
}
loop();
setInterval(() => { const i = gs.info(); console.log(`[${new Date().toISOString()}] ` + i.channels.map(c => `ch${c.ch}: ${c.humans} humans/${c.players} players, ${c.mons} mons, tick ${c.tickMs}ms (max ${c.maxMs})`).join(' | ')); }, 60000);

http.listen(PORT, () => console.log(`달빛 퇴마단 서버: http://localhost:${PORT}  (ws: /ws, data: ${DATA}, static: ${STATIC}${existsSync(STATIC) ? '' : ' — 없음, npm run build 필요'})`));
function shutdown() { console.log('saving…'); gs.saveAll(); void store.drain().then(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
