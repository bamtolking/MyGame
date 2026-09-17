import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer, rooms } from '../server/index.ts';
import { RoomClient } from '../src/net/client.ts';
import type { Conn } from '../src/net/protocol.ts';

// Node 22의 내장 WebSocket 클라이언트로 서버 검증
function wsConn(url: string): Promise<Conn> {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url); let recv: ((m: unknown) => void) | null = null; let closed: (() => void) | null = null; let open = false;
    ws.onopen = () => { open = true; res(c); }; ws.onerror = () => rej(new Error('connect failed'));
    ws.onmessage = ev => recv?.(JSON.parse(String(ev.data))); ws.onclose = () => { open = false; closed?.(); };
    const c: Conn = { get open() { return open; }, send(m) { ws.send(JSON.stringify(m)); }, onMessage(cb) { recv = cb; }, onClose(cb) { closed = cb; }, close() { ws.close(); } };
  });
}
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const PORT = 18765; let srv: ReturnType<typeof startServer>;
beforeAll(() => { srv = startServer(PORT, 'dist-not-needed'); });
afterAll(async () => { await srv.close(); });

describe('WebSocket 서버', () => {
  it('/api/ping 응답, 정적 파일 없으면 404', async () => {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/ping`); expect(r.ok).toBe(true); expect(((await r.json()) as { ok: boolean }).ok).toBe(true);
    const n = await fetch(`http://127.0.0.1:${PORT}/`); expect(n.status).toBe(404);
  });
  it('서버가 내보내는 HTML에는 nrd-server 표식이 들어간다', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'nrd-')); writeFileSync(join(dir, 'index.html'), '<!doctype html><html><head><title>x</title></head><body></body></html>');
    const s2 = startServer(PORT + 1, dir);
    try { const html = await (await fetch(`http://127.0.0.1:${PORT + 1}/`)).text(); expect(html).toContain('<meta name="nrd-server" content="ws" />'); expect(html).toContain('<title>x</title>'); }
    finally { await s2.close(); }
  });
  it('방 만들기 → 코드로 참가 → 시작 → 라운드/골드 중계 → 나가기', async () => {
    const a = new RoomClient(await wsConn(`ws://127.0.0.1:${PORT}/ws`), '방장', 'tokA'); a.hello({ create: true }); await tick();
    expect(a.room).not.toBeNull(); const code = a.room!.code; expect(rooms.has(code)).toBe(true);
    const bad = new RoomClient(await wsConn(`ws://127.0.0.1:${PORT}/ws`), 'x', 'tokX'); let err = ''; bad.on('error', m => { err = m; }); bad.hello({ code: 'ZZZZZZ' }); await tick(); expect(err).toContain('없습니다');
    const b = new RoomClient(await wsConn(`ws://127.0.0.1:${PORT}/ws`), '친구', 'tokB'); b.hello({ code: code.toLowerCase() }); await tick();
    expect(a.room!.players.map(p => p.name)).toEqual(['방장', '친구']); expect(b.isHost).toBe(false);
    let gold = 0; b.on('gold', (_f, _n, amt) => { gold = amt; }); let started = false; b.on('start', () => { started = true; });
    a.start(); await tick(); expect(started).toBe(true); expect(rooms.get(code)!.phase).toBe('playing');
    a.sendGold(b.room!.you, 70); await tick(); expect(gold).toBe(70);
    b.leave(); await tick(80); expect(a.room!.players.map(p => p.name)).toEqual(['방장']);
    a.leave(); await tick(80);
  });
  it('첫 메시지가 hello가 아니면 연결을 끊는다', async () => {
    const c = await wsConn(`ws://127.0.0.1:${PORT}/ws`); let closed = false; c.onClose(() => { closed = true; }); c.send({ t: 'start' }); await tick(80); expect(closed).toBe(true);
  });
});
