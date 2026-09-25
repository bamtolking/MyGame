// Load test.  node scripts/loadtest.ts [players=80] [seconds=120]        — in-process: N AI-driven "humans" with full sessions
//             node scripts/loadtest.ts ws [clients=60] [seconds=30]      — real WebSocket clients against a spawned server
import { GameServer } from '../src/server/server.ts';
import { BotBrain, makeBotProfile } from '../src/server/bots.ts';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import type { World } from '../src/server/world.ts';

const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
if (process.argv[2] === 'ws') await wsTest(Number(process.argv[3] ?? 60), Number(process.argv[4] ?? 30));
else inProcess(Number(process.argv[2] ?? 80), Number(process.argv[3] ?? 120));

function inProcess(N: number, secs: number) {
  let W: World | null = null; const store = { m: new Map<string, any>(), load(t: string) { return this.m.get(t) ?? null; }, save(t: string, p: any) { this.m.set(t, p); } };
  const gs = new GameServer({ seed: 20260925, channels: Math.ceil(N / 80), name: 'load', online: true, bots: 0, wbInterval: 300, wbFirst: Number(process.env.WB_FIRST ?? 99999), store, now: () => (W ? W.time : 0) + 1000 });
  W = gs.worlds[0]; let bytes = 0;
  for (let i = 0; i < N; i++) {
    const tok = 'tok_load_' + String(i).padStart(10, '0'); const lv = [1, 4, 9, 13, 17, 22, 27][i % 7];
    store.save(tok, makeBotProfile('부하' + i, (['sword', 'archer', 'shaman'] as const)[i % 3], lv, i + 1));
    const s = gs.connect({ send: (d) => { bytes += d.length; }, close() {} });
    gs.message(s, JSON.stringify({ t: 'hello', v: 1, token: tok, name: 'x', cls: 'sword' }));
    const b = new BotBrain(i % 2 ? 'quester' : 'roamer', i); s.world!.brains.set(s.player!.id, b);
  }
  const times: number[] = []; const t0 = performance.now();
  for (let t = 0; t < secs * 20; t++) { const a = performance.now(); gs.tick(); times.push(performance.now() - a); }
  const wall = (performance.now() - t0) / 1000; const warm = times.slice(200);
  console.log(`in-process: ${N} players in ${gs.worlds.length} channel(s) · ${secs}s simulated in ${wall.toFixed(1)}s wall · monsters now ${gs.worlds.map(x => x.mons.size).join('+')}`);
  console.log(`server tick incl. ${N} snapshots/diffs: p50 ${pct(warm, 0.5).toFixed(2)} ms · p95 ${pct(warm, 0.95).toFixed(2)} ms · p99 ${pct(warm, 0.99).toFixed(2)} ms · max ${Math.max(...warm).toFixed(1)} ms  (budget 50 ms)`);
  console.log(`bandwidth: ${(bytes / secs / N / 1024).toFixed(1)} KB/s per client · ${(bytes / secs / 1024 / 1024 * 8).toFixed(2)} Mbit/s total`);
}

async function wsTest(N: number, secs: number) {
  const port = 19000 + Math.floor(Math.random() * 500);
  const proc = spawn(process.execPath, ['src/server/node/main.ts'], { env: { ...process.env, PORT: String(port), DATA_DIR: '/tmp/moonlit-load-' + port, CHANNELS: '2', WB_FIRST: '20' }, stdio: 'pipe' });
  await new Promise<void>((res) => proc.stdout!.on('data', d => { if (String(d).includes('서버')) res(); }));
  let bytes = 0, snaps = 0, welcomed = 0; const socks: WebSocket[] = [];
  for (let i = 0; i < N; i++) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); socks.push(ws); let seq = 0; let a = Math.random() * 6.28;
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', v: 1, token: 'tok_wsload_' + String(i).padStart(8, '0'), name: '부하' + i, cls: ['sword', 'archer', 'shaman'][i % 3] })); });
    ws.on('message', (d, bin) => { bytes += (d as Buffer).length; if (bin) snaps++; else if (String(d).includes('"welcome"')) welcomed++; });
    const it = setInterval(() => { if (ws.readyState !== ws.OPEN) return; if (Math.random() < 0.05) a += Math.random() - 0.5; ws.send(JSON.stringify({ t: 'i', s: ++seq, x: Math.round(Math.cos(a) * 127), y: Math.round(Math.sin(a) * 127) })); }, 50);
    ws.on('close', () => clearInterval(it));
  }
  const infos: any[] = []; const t0 = Date.now();
  while (Date.now() - t0 < secs * 1000) { await new Promise(r => setTimeout(r, 2000)); try { infos.push(await (await fetch(`http://127.0.0.1:${port}/api/info`)).json()); } catch { /* ignore */ } }
  const last = infos[infos.length - 1];
  console.log(`real ws: ${N} clients, ${welcomed} in game, ${secs}s · per client ${(bytes / secs / N / 1024).toFixed(1)} KB/s · snapshots/client/s ${(snaps / secs / N).toFixed(1)}`);
  console.log('channels:', JSON.stringify(last.channels));
  for (const s of socks) s.close(); proc.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 500)); process.exit(0);
}
