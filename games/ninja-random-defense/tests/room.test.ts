import { describe, it, expect } from 'vitest';
import { RoomHost } from '../src/net/room.ts';
import { RoomClient } from '../src/net/client.ts';
import { loopbackPair } from '../src/net/loopback.ts';
import { makeCode, normCode, cleanName } from '../src/net/protocol.ts';
import { MAX_PLAYERS, TOTAL_ROUNDS } from '../src/data/economy.ts';
import type { PlayerSummary } from '../src/sim/snapshot.ts';

const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));
const sm = (over: Partial<PlayerSummary> = {}): PlayerSummary => ({ round: 1, gold: 0, phase: 'playing', monsters: 0, kills: 0, damage: 0, units: 0, peak: 0, mythics: 0, ...over });

function setup(opts: Partial<ConstructorParameters<typeof RoomHost>[0]> = {}) {
  const room = new RoomHost({ code: 'TEST01', countdown: 0.02, roundTime: 0.02, finalTime: 0.03, emptyGrace: 50, ...opts });
  const join = (name: string, token = name + '-tok') => { const [a, b] = loopbackPair(); const c = new RoomClient(a, name, token); b.onMessage(m => { const h = m as { t: string }; if (h.t === 'hello') room.attach(b, m as never); }); c.hello({ code: 'TEST01' }); return c; };
  return { room, join };
}

describe('프로토콜 유틸', () => {
  it('코드는 6자리 대문자/숫자, normCode는 소문자·공백·특수문자 정리, cleanName은 제어문자·꺾쇠 제거', () => {
    expect(makeCode()).toMatch(/^[A-Z2-9]{6}$/); expect(normCode(' ab-c1 2x')).toBe('ABC12X'); expect(cleanName(' <b>철수</b> ')).toBe('b철수/b');
    expect(cleanName('아주아주아주아주긴이름입니다')).toHaveLength(12);
  });
});

describe('방 호스트', () => {
  it('첫 참가자가 방장, 최대 인원 초과는 거절, 방장이 나가면 다음 사람이 방장', async () => {
    const { room, join } = setup();
    const cs = []; for (let i = 0; i < MAX_PLAYERS + 1; i++) cs.push(join('p' + i));
    let err = ''; cs[MAX_PLAYERS].on('error', m => { err = m; });
    await tick();
    expect(room.players.size).toBe(MAX_PLAYERS); expect(err).toContain('가득'); expect(cs[0].isHost).toBe(true); expect(cs[1].isHost).toBe(false);
    cs[0].leave(); await tick(80);
    expect(room.players.size).toBe(MAX_PLAYERS - 1); expect(cs[1].isHost).toBe(true);
    room.destroy();
  });
  it('방장만 시작 가능, 시작 후 참가 불가, 라운드 신호가 40까지 가고 종료·결과가 온다', async () => {
    const { room, join } = setup();
    const a = join('a'), b = join('b');
    const rounds: number[] = []; let ended: { won: boolean; names: string[] } | null = null; let err = '';
    b.on('round', n => rounds.push(n)); a.on('end', (r, won) => { ended = { won, names: r.map(x => x.name) }; }); b.on('error', m => { err = m; });
    await tick(); b.start(); await tick(); expect(room.phase).toBe('lobby'); expect(err).toContain('방장');
    a.start(); await tick();
    expect(room.phase).toBe('playing');
    const late = join('late'); let lateErr = ''; late.on('error', m => { lateErr = m; }); await tick(); expect(lateErr).toContain('시작');
    await tick(TOTAL_ROUNDS * 20 + 150);
    expect(rounds[0]).toBe(1); expect(rounds[rounds.length - 1]).toBe(TOTAL_ROUNDS); expect(rounds.length).toBe(TOTAL_ROUNDS);
    expect(ended).not.toBeNull(); expect(ended!.won).toBe(true); expect(ended!.names.sort()).toEqual(['a', 'b']);
    room.destroy();
  });
  it('모두 탈락하면 즉시 종료, 결과는 생존/라운드/피해 순 정렬, 다시하기는 방장만', async () => {
    const { room, join } = setup({ roundTime: 10, finalTime: 10 });
    const a = join('a'), b = join('b'), c = join('c'); let results: { name: string; alive: boolean; round: number }[] = []; let won = true;
    c.on('end', (r, w) => { results = r; won = w; }); await tick(); a.start(); await tick(40);
    a.summary(sm({ round: 5, damage: 500 })); b.summary(sm({ round: 3, phase: 'eliminated', damage: 100 })); await tick();
    expect(room.phase).toBe('playing');
    a.summary(sm({ round: 7, phase: 'eliminated', damage: 900 })); c.eliminated(6, 'test'); await tick();
    expect(room.phase).toBe('ended'); expect(won).toBe(false);
    expect(results.map(r => r.name)).toEqual(['a', 'c', 'b']); expect(results.every(r => !r.alive)).toBe(true);
    b.again(); await tick(); expect(room.phase).toBe('ended'); a.again(); await tick(); expect(room.phase).toBe('lobby'); expect(room.round).toBe(0);
    room.destroy();
  });
  it('요약/판 스냅샷은 다른 참가자에게만 중계, 골드는 대상에게만, 이모티콘은 모두에게', async () => {
    const { room, join } = setup({ roundTime: 10 });
    const a = join('a'), b = join('b'), c = join('c');
    const got: string[] = [];
    a.on('peer', (pid, s) => got.push(`a<peer ${pid} r${s.round}`)); a.on('board', (pid, bd) => got.push(`a<board ${pid} ${bd.u.length}u`)); a.on('gold', (_f, n, amt) => got.push(`a<gold ${n} ${amt}`)); a.on('emote', (_f, n, t) => got.push(`a<emote ${n} ${t}`));
    b.on('peer', (pid) => got.push(`b<peer ${pid}`)); b.on('gold', (_f, n, amt) => got.push(`b<gold ${n} ${amt}`)); b.on('emote', (_f, n, t) => got.push(`b<emote ${n} ${t}`));
    c.on('gold', (_f, n, amt) => got.push(`c<gold ${n} ${amt}`)); c.on('emote', (_f, n, t) => got.push(`c<emote ${n} ${t}`));
    let err = ''; c.on('error', m => { err = m; });
    await tick(); a.start(); await tick();
    b.summary(sm({ round: 2 })); b.board({ r: 2, g: 0, ph: 'playing', n: 0, k: 0, bt: -1, u: [[0, 0, 0]], m: [], t: 0 }); await tick();
    c.sendGold(b.room!.you, 50); c.sendGold(c.room!.you, 50); c.sendGold(b.room!.you, 5); c.emote('gg'); await tick();
    expect(got).toContain('a<peer p2 r2'); expect(got).toContain('a<board p2 1u'); expect(got.filter(x => x.startsWith('b<peer'))).toHaveLength(0);
    expect(got.filter(x => x.includes('<gold'))).toEqual(['b<gold c 50']); expect(err).toContain('골드');
    expect(got.filter(x => x.includes('<emote')).sort()).toEqual(['a<emote c gg', 'b<emote c gg', 'c<emote c gg']);
    room.destroy();
  });
  it('연결이 끊긴 참가자는 게임 중 자리가 유지되고 같은 토큰으로 재접속하면 start/round를 다시 받는다', async () => {
    const { room, join } = setup({ roundTime: 10 });
    const a = join('a'), b = join('b', 'b-token'); await tick(); a.start(); await tick(40);
    b.conn.close(); await tick();
    expect(room.players.size).toBe(2); expect(a.room!.players.find(p => p.name === 'b')!.connected).toBe(false);
    const b2 = join('b', 'b-token'); const got: string[] = []; b2.on('start', () => got.push('start')); b2.on('round', n => got.push('round' + n)); await tick();
    expect(got).toEqual(['start', 'round1']); expect(room.players.size).toBe(2); expect(a.room!.players.find(p => p.name === 'b')!.connected).toBe(true);
    room.destroy();
  });
  it('모두 나가면 유예 후 방이 비워진다', async () => {
    let emptied = false; const { room, join } = setup({ onEmpty: () => { emptied = true; } });
    const a = join('a'); await tick(); a.leave(); await tick(120); expect(emptied).toBe(true); expect(room.destroyed).toBe(true);
  });
});
