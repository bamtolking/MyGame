import { describe, it, expect, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { decodeSnap, PF } from '../src/shared/protocol.ts';
import { mkServer, FakeConn, MemStore } from './helpers.ts';
import { PROTOCOL_VERSION } from '../src/shared/constants.ts';

const asciiTok = (n: string) => 'tok_' + [...n].map(c => c.charCodeAt(0).toString(36)).join('').padEnd(16, 'x').slice(0, 60);
const hello = (name: string, cls = 'sword', token = asciiTok(name)) => JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token, name, cls });

describe('game server sessions (in-process)', () => {
  it('welcome → snapshots → both players see each other; chat is broadcast', () => {
    const { gs } = mkServer(); const c1 = new FakeConn(), c2 = new FakeConn();
    const s1 = gs.connect(c1), s2 = gs.connect(c2);
    gs.message(s1, hello('하나')); gs.message(s2, hello('둘', 'archer'));
    expect(c1.of('welcome').length).toBe(1); const w1 = c1.of('welcome')[0];
    expect(w1.map.tiles.length).toBeGreaterThan(1000); expect(w1.me.name).toBe('하나');
    expect(s1.world).toBe(s2.world); // both land in the busiest channel
    for (let i = 0; i < 4; i++) gs.tick();
    const snap = decodeSnap(c1.bins[c1.bins.length - 1]); const ids = snap.players.map(p => p.id).sort();
    expect(ids).toEqual([s1.player!.id, s2.player!.id].sort());
    gs.message(s2, JSON.stringify({ t: 'chat', text: '같이 사냥해요' })); gs.tick(); gs.tick();
    expect(c1.of('chat').some(m => m.text === '같이 사냥해요' && m.name === '둘')).toBe(true);
    expect(c1.of('roster').some(m => m.add?.some((r: any) => r.name === '둘'))).toBe(true);
  });
  it('input moves the player and the ack comes back in the snapshot', () => {
    const { gs } = mkServer(); const c = new FakeConn(); const s = gs.connect(c); gs.message(s, hello('걷기'));
    const p = s.player!; const x0 = p.x;
    for (let i = 1; i <= 10; i++) { gs.message(s, JSON.stringify({ t: 'i', s: i, x: 127, y: 0 })); gs.tick(); }
    gs.tick(); const snap = decodeSnap(c.bins[c.bins.length - 1]);
    expect(snap.ack).toBe(10); expect(p.x).toBeGreaterThan(x0 + 50);
    expect(snap.players.find(q => q.id === p.id)!.x).toBe(p.x);
  });
  it('progress is saved on disconnect and restored on reconnect; a second login kicks the first', () => {
    const store = new MemStore(); const { gs } = mkServer(0, store); const c = new FakeConn(); const s = gs.connect(c);
    gs.message(s, hello('저장', 'shaman', 'tok_persist_000000001'));
    s.player!.prof.gold = 777; s.player!.prof.level = 4;
    const c2 = new FakeConn(); const s2 = gs.connect(c2); gs.message(s2, hello('저장', 'shaman', 'tok_persist_000000001'));
    expect(c.closed).toBe(true); expect(c.of('err').some(m => m.fatal)).toBe(true);
    expect(c2.of('welcome')[0].me.gold).toBe(777); expect(c2.of('welcome')[0].me.level).toBe(4);
    gs.close(s2); expect(store.load('tok_persist_000000001')!.gold).toBe(777);
  });
  it('rejects bad hellos and survives garbage input', () => {
    const { gs } = mkServer(); const c = new FakeConn(); const s = gs.connect(c);
    gs.message(s, JSON.stringify({ t: 'hello', v: 999, token: 'tok_aaaaaaaaaaaaaaaa', name: 'x', cls: 'sword' })); expect(c.closed).toBe(true);
    const c2 = new FakeConn(); const s2 = gs.connect(c2); gs.message(s2, JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token: '../../etc', name: 'x', cls: 'sword' })); expect(c2.closed).toBe(true);
    const c3 = new FakeConn(); const s3 = gs.connect(c3); gs.message(s3, hello('퍼징'));
    const junk = ['', '{', 'null', '[]', '{"t":1}', '{"t":"equip","uid":{"a":1}}', '{"t":"i","s":"x","x":1e99,"y":null}', '{"t":"sell","uids":"all"}', '{"t":"talslot","slot":-1,"uid":null}', '{"t":"tp","shrine":999}', '{"t":"chat","text":123}', 'x'.repeat(5000), '{"t":"__proto__"}', '{"t":"buytal","kind":"constructor"}'];
    for (const j of junk) expect(() => gs.message(s3, j)).not.toThrow();
    for (let i = 0; i < 5; i++) gs.tick();
    expect(s3.player!.hp).toBeGreaterThan(0); expect(Number.isFinite(s3.player!.x)).toBe(true);
  });
  it('names that impersonate AI companions are refused', () => {
    const { gs } = mkServer(); const c = new FakeConn(); const s = gs.connect(c); gs.message(s, hello('AI 달래'));
    expect(c.of('welcome')[0].me.name).not.toMatch(/^AI/);
  });
  it('offline mode adds clearly-tagged AI companions that follow the human', () => {
    const { gs } = mkServer(6); const c = new FakeConn(); const s = gs.connect(c); gs.message(s, hello('혼자'));
    const w = s.world!; const bots = [...w.players.values()].filter(p => p.bot);
    expect(bots.length).toBe(6); expect(bots.every(b => b.prof.name.startsWith('AI '))).toBe(true);
    for (let i = 0; i < 20 * 20; i++) gs.tick();
    const snap = decodeSnap(c.bins[c.bins.length - 1]); expect(snap.players.filter(p => p.f & PF.BOT).length).toBeGreaterThan(0);
  });
});

// ---------------- real WebSocket server ----------------
let proc: ChildProcess | null = null; let dataDir = '';
afterAll(() => { proc?.kill('SIGTERM'); if (dataDir) rmSync(dataDir, { recursive: true, force: true }); });
function client(port: number, name: string, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); const msgs: any[] = []; const snaps: ReturnType<typeof decodeSnap>[] = [];
  ws.on('message', (d, bin) => { if (bin) snaps.push(decodeSnap(new Uint8Array(d as Buffer))); else msgs.push(JSON.parse(String(d))); });
  const ready = new Promise<void>(res => ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token, name, cls: 'archer' })); res(); }));
  return { ws, msgs, snaps, ready };
}
const until = async (f: () => boolean, ms = 5000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 25)); } };

describe('real WebSocket server', () => {
  it('two clients connect, see each other move, chat, and the character is written to disk', async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'moonlit-')); const port = 18000 + Math.floor(Math.random() * 1000);
    proc = spawn(process.execPath, ['src/server/node/main.ts'], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, CHANNELS: '1' }, stdio: 'pipe' });
    await new Promise<void>((res, rej) => { proc!.stdout!.on('data', (d) => { if (String(d).includes('서버')) res(); }); proc!.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('boot timeout')), 8000); });
    const info = await (await fetch(`http://127.0.0.1:${port}/api/info`)).json(); expect(info.game).toBe('moonlit');
    const a = client(port, '에이', 'tok_ws_aaaaaaaaaaaa'), b = client(port, '비', 'tok_ws_bbbbbbbbbbbb');
    await Promise.all([a.ready, b.ready]);
    await until(() => a.msgs.some(m => m.t === 'welcome') && b.msgs.some(m => m.t === 'welcome'));
    const idA = a.msgs.find(m => m.t === 'welcome').id, idB = b.msgs.find(m => m.t === 'welcome').id;
    await until(() => b.snaps.some(s => s.players.some(p => p.id === idA)));
    const x0 = b.snaps[b.snaps.length - 1].players.find(p => p.id === idA)!.x;
    for (let i = 1; i <= 30; i++) { a.ws.send(JSON.stringify({ t: 'i', s: i, x: 0, y: 127 })); await new Promise(r => setTimeout(r, 50)); }
    await until(() => { const s = b.snaps[b.snaps.length - 1]; const p = s.players.find(q => q.id === idA); return !!p && (Math.abs(p.x - x0) > 1 || p.y > 0); });
    const ackA = a.snaps[a.snaps.length - 1].ack; expect(ackA).toBeGreaterThan(20);
    a.ws.send(JSON.stringify({ t: 'chat', text: '안녕 비!' }));
    await until(() => b.msgs.some(m => m.t === 'chat' && m.text === '안녕 비!'));
    const bytesPerSec = b.snaps.length; expect(bytesPerSec).toBeGreaterThan(10); void idB;
    a.ws.close(); b.ws.close();
    await until(() => readdirSync(join(dataDir, 'players')).filter(f => f.endsWith('.json')).length === 2, 5000);
  }, 30000);
});
