// 데이헝거 협동 서버: 정적 파일 제공 + WebSocket 방(룸) 관리.
// 방마다 Game 인스턴스 하나를 20틱/초로 돌리고, 10회/초로 상태를 보냅니다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game } from '../shared/game.js';
import * as C from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res) {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/' || url === '/index.html') url = '/index.html';
  if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return; }
  const file = path.normalize(path.join(ROOT, url));
  const allowedDirs = ['client', 'shared', 'icons'].map((d) => path.join(ROOT, d) + path.sep);
  const allowedFiles = ['index.html', 'manifest.webmanifest', 'sw.js'].map((f) => path.join(ROOT, f));
  if (!allowedDirs.some((d) => file.startsWith(d)) && !allowedFiles.includes(file)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
}

// ---------- 방 ----------
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}

class Room {
  constructor(code) {
    this.code = code;
    this.game = null;
    this.state = 'lobby'; // lobby | playing
    this.members = new Map(); // ws -> { name, playerId }
    this.hostWs = null;
    this.timer = null;
    this.tickNo = 0;
    this.emptySince = null;
  }
  get size() { return this.members.size; }
  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const ws of this.members.keys()) if (ws !== except && ws.readyState === ws.OPEN) ws.send(s);
  }
  lobbyInfo() {
    return { type: 'lobby', code: this.code, state: this.state, members: [...this.members.values()].map((m) => ({ name: m.name, host: m.ws === this.hostWs })) };
  }
  // 각자에게 '당신이 방장인지'를 붙여서 보냄
  sendLobby() {
    const info = this.lobbyInfo();
    for (const ws of this.members.keys()) if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ ...info, youHost: ws === this.hostWs }));
  }
  join(ws, name) {
    if (this.size >= C.MAX_PLAYERS) return { error: '방이 가득 찼어요 (최대 4명)' };
    const m = { ws, name: String(name || '생존자').slice(0, 10), playerId: null };
    this.members.set(ws, m);
    if (!this.hostWs) this.hostWs = ws;
    this.emptySince = null;
    if (this.state === 'playing') this.spawnMember(m);
    return { member: m };
  }
  spawnMember(m) {
    const p = this.game.addPlayer(m.name);
    m.playerId = p.id;
    m.ws.send(JSON.stringify({ type: 'start', playerId: p.id, code: this.code }));
    m.ws.send(JSON.stringify(this.game.fullState()));
  }
  leave(ws) {
    const m = this.members.get(ws);
    if (!m) return;
    this.members.delete(ws);
    if (this.game && m.playerId != null) this.game.removePlayer(m.playerId);
    if (this.hostWs === ws) this.hostWs = this.members.keys().next().value || null;
    if (this.size === 0) { this.emptySince = Date.now(); this.stop(); }
    else this.sendLobby();
  }
  start() {
    if (this.state === 'playing') return;
    this.state = 'playing';
    this.game = new Game();
    for (const m of this.members.values()) this.spawnMember(m);
    this.timer = setInterval(() => this.tick(), 1000 / C.TICK_RATE);
  }
  tick() {
    try {
      this.game.tick();
      this.tickNo++;
      if (this.tickNo % Math.round(C.TICK_RATE / C.NET_RATE) === 0) this.broadcast(this.game.delta());
    } catch (err) {
      console.error('[room ' + this.code + '] tick error', err);
    }
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  restart() {
    // 게임 종료 후 같은 방에서 다시 시작
    this.stop();
    this.state = 'lobby';
    this.game = null;
    for (const m of this.members.values()) m.playerId = null;
    this.sendLobby();
  }
  handle(ws, msg) {
    const m = this.members.get(ws);
    if (!m) return;
    const g = this.game;
    switch (msg.type) {
      case 'start': if (ws === this.hostWs && this.state === 'lobby') { this.start(); } break;
      case 'restart': if (ws === this.hostWs && this.state === 'playing' && g && g.over) this.restart(); break;
      case 'continue': if (ws === this.hostWs && g && g.over && g.won) { g.continueEndless(); } break;
      case 'input': if (g && m.playerId != null) g.setInput(m.playerId, msg); break;
      case 'build': if (g && m.playerId != null) reply(ws, g.build(m.playerId, msg.key, msg.x, msg.y)); break;
      case 'repair': if (g && m.playerId != null) reply(ws, g.repair(m.playerId, msg.x, msg.y)); break;
      case 'dismantle': if (g && m.playerId != null) reply(ws, g.dismantle(m.playerId, msg.x, msg.y)); break;
      case 'eat': if (g && m.playerId != null) reply(ws, g.eat(m.playerId)); break;
      case 'say': if (g && m.playerId != null) g.say(m.playerId, msg.index); break;
      case 'ping': ws.send(JSON.stringify({ type: 'pong', t: msg.t })); break;
      default: break;
    }
  }
}
function reply(ws, result) {
  if (result && result.ok === false && result.reason) ws.send(JSON.stringify({ type: 'toast', msg: result.reason }));
}

// 빈 방 정리
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (room.size === 0 && room.emptySince && now - room.emptySince > 60_000) { room.stop(); rooms.delete(code); }
}, 15_000);

// ---------- 서버 ----------
const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  ws.room = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'create') {
      if (ws.room) ws.room.leave(ws);
      const room = new Room(makeCode());
      rooms.set(room.code, room);
      room.join(ws, msg.name); ws.room = room;
      room.sendLobby();
      return;
    }
    if (msg.type === 'join') {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) { ws.send(JSON.stringify({ type: 'error', msg: '그 코드의 방이 없어요' })); return; }
      if (room.game && room.game.over) { ws.send(JSON.stringify({ type: 'error', msg: '이미 끝난 게임이에요' })); return; }
      if (ws.room) ws.room.leave(ws);
      const r = room.join(ws, msg.name);
      if (r.error) { ws.send(JSON.stringify({ type: 'error', msg: r.error })); return; }
      ws.room = room;
      room.sendLobby();
      return;
    }
    if (msg.type === 'leave') { if (ws.room) { ws.room.leave(ws); ws.room = null; } return; }
    if (ws.room) ws.room.handle(ws, msg);
  });
  ws.on('close', () => { if (ws.room) { ws.room.leave(ws); ws.room = null; } });
});
// 끊긴 연결 감지
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; ws.ping(); }
}, 30_000);

server.listen(PORT, HOST, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`데이헝거 서버 실행 중: http://localhost:${PORT}`);
  for (const ip of ips) console.log(`  같은 Wi-Fi의 휴대폰에서: http://${ip}:${PORT}`);
});
