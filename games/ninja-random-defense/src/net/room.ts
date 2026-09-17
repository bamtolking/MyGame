// 방 호스트 로직. 라운드 시계(호스트 기준), 참가자 관리, 요약/관전 스냅샷 중계, 골드 전달, 결과 집계.
// 브라우저(P2P 호스트)와 Node 서버 양쪽에서 실행되므로 DOM/Node 전용 API를 쓰지 않습니다.
import type { Conn, ClientMsg, HostMsg, PlayerInfo, ResultRow, RoomPhase } from './protocol.ts';
import { cleanName } from './protocol.ts';
import type { PlayerSummary } from '../sim/snapshot.ts';
import { ROUND_TIME, COUNTDOWN, TOTAL_ROUNDS, FINAL_TIME, MAX_PLAYERS, MIN_SEND_GOLD } from '../data/economy.ts';

interface Player { pid: string; name: string; token: string; conn: Conn | null; host: boolean; summary: PlayerSummary | null; eliminatedRound: number; alive: boolean; joinedAt: number }

export interface RoomOptions { code: string; onEmpty?: () => void; now?: () => number; roundTime?: number; countdown?: number; finalTime?: number; emptyGrace?: number }

export class RoomHost {
  code: string; phase: RoomPhase = 'lobby'; round = 0; seed = 0;
  players = new Map<string, Player>();
  lastResults: ResultRow[] = []; lastWon = false;
  destroyed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private emptyTimer: ReturnType<typeof setTimeout> | null = null;
  private nextPid = 1;
  private now: () => number; private roundTime: number; private countdown: number; private finalTime: number; private emptyGrace: number;
  private onEmpty?: () => void;

  constructor(opts: RoomOptions) {
    this.code = opts.code;
    this.now = opts.now ?? (() => Date.now());
    this.roundTime = opts.roundTime ?? ROUND_TIME; this.countdown = opts.countdown ?? COUNTDOWN; this.finalTime = opts.finalTime ?? FINAL_TIME;
    this.emptyGrace = opts.emptyGrace ?? 60_000; this.onEmpty = opts.onEmpty;
  }

  /** 새 연결 + 첫 hello 메시지 */
  attach(conn: Conn, hello: ClientMsg & { t: 'hello' }): void {
    let p = [...this.players.values()].find(x => x.token === hello.token);
    if (p) { // 재접속
      if (p.conn && p.conn !== conn) { try { p.conn.close(); } catch { /* ignore */ } }
      p.conn = conn; p.name = cleanName(hello.name) || p.name;
    } else {
      if (this.phase !== 'lobby') { conn.send({ t: 'error', msg: '이미 시작된 방입니다' } satisfies HostMsg); conn.close(); return; }
      if (this.players.size >= MAX_PLAYERS) { conn.send({ t: 'error', msg: `방이 가득 찼습니다 (최대 ${MAX_PLAYERS}명)` } satisfies HostMsg); conn.close(); return; }
      const pid = 'p' + this.nextPid++;
      p = { pid, name: cleanName(hello.name) || `닌자${this.nextPid - 1}`, token: String(hello.token ?? ''), conn, host: this.players.size === 0, summary: null, eliminatedRound: 0, alive: true, joinedAt: this.now() };
      this.players.set(pid, p);
    }
    if (this.emptyTimer) { clearTimeout(this.emptyTimer); this.emptyTimer = null; }
    const me = p;
    conn.onMessage(m => this.onMessage(me, m as ClientMsg));
    conn.onClose(() => { if (me.conn === conn) { me.conn = null; this.onDisconnect(me); } });
    this.broadcastRoom();
    if (this.phase === 'playing') { // 재접속: 현재 라운드 알림
      conn.send({ t: 'start', seed: this.seed, at: this.now(), order: this.order() } satisfies HostMsg);
      if (this.round > 0) conn.send({ t: 'round', n: this.round, at: this.now() } satisfies HostMsg);
    } else if (this.phase === 'ended') conn.send({ t: 'end', results: this.lastResults, won: this.lastWon } satisfies HostMsg);
  }

  private order(): string[] { return [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt || a.pid.localeCompare(b.pid)).map(p => p.pid); }
  private info(): PlayerInfo[] { return this.order().map(pid => { const p = this.players.get(pid)!; return { pid, name: p.name, host: p.host, connected: !!p.conn, summary: p.summary, eliminatedRound: p.eliminatedRound }; }); }
  private send(p: Player, m: HostMsg): void { if (p.conn && p.conn.open) { try { p.conn.send(m); } catch { /* ignore */ } } }
  broadcast(m: HostMsg, except?: Player): void { for (const p of this.players.values()) if (p !== except) this.send(p, m); }
  broadcastRoom(): void { const players = this.info(); for (const p of this.players.values()) this.send(p, { t: 'room', code: this.code, you: p.pid, phase: this.phase, players, round: this.round }); }

  private onMessage(p: Player, m: ClientMsg): void {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'start': if (p.host && this.phase === 'lobby') this.start(); else if (!p.host) this.send(p, { t: 'error', msg: '방장만 시작할 수 있습니다' }); break;
      case 'summary': if (m.s && typeof m.s === 'object') { p.summary = m.s; if (m.s.phase === 'eliminated' && p.alive) { p.alive = false; p.eliminatedRound = m.s.round; } this.broadcast({ t: 'peer', pid: p.pid, s: m.s }, p); this.checkEnd(); } break;
      case 'board': if (m.b && typeof m.b === 'object') this.broadcast({ t: 'board', pid: p.pid, b: m.b }, p); break;
      case 'gold': {
        const to = this.players.get(String(m.to)); const amount = Math.floor(Number(m.amount));
        if (!to || to === p || !(amount >= MIN_SEND_GOLD) || this.phase !== 'playing') { this.send(p, { t: 'error', msg: '골드를 보낼 수 없습니다' }); break; }
        this.send(to, { t: 'gold', from: p.pid, fromName: p.name, amount });
        break;
      }
      case 'emote': { const text = cleanName(m.text).slice(0, 40); if (text) this.broadcast({ t: 'emote', from: p.pid, fromName: p.name, text }); break; }
      case 'eliminated': if (p.alive) { p.alive = false; p.eliminatedRound = Number(m.round) || this.round; this.broadcastRoom(); this.checkEnd(); } break;
      case 'again': if (p.host && this.phase === 'ended') this.reset(); break;
      case 'leave': { const c = p.conn; p.conn = null; this.players.delete(p.pid); if (c) { try { c.close(); } catch { /* ignore */ } } this.afterLeave(); break; }
      case 'ping': this.send(p, { t: 'pong' }); break;
    }
  }

  private onDisconnect(p: Player): void {
    if (this.destroyed) return;
    if (this.phase === 'lobby') { this.players.delete(p.pid); this.afterLeave(); return; }
    // 진행 중: 자리를 유지(재접속 가능), 접속 상태만 갱신
    this.broadcastRoom();
    if (![...this.players.values()].some(x => x.conn)) this.scheduleEmpty();
  }
  private afterLeave(): void {
    if (this.players.size === 0) { this.scheduleEmpty(); return; }
    if (![...this.players.values()].some(p => p.host)) { const first = this.players.get(this.order()[0]); if (first) first.host = true; }
    this.broadcastRoom();
    this.checkEnd();
  }
  private scheduleEmpty(): void {
    if (this.emptyTimer) clearTimeout(this.emptyTimer);
    this.emptyTimer = setTimeout(() => { if (![...this.players.values()].some(x => x.conn)) this.destroy(); }, this.emptyGrace);
  }

  start(): void {
    if (this.phase !== 'lobby' || this.players.size === 0) return;
    this.phase = 'playing'; this.round = 0;
    this.seed = (Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    for (const p of this.players.values()) { p.alive = true; p.eliminatedRound = 0; p.summary = null; }
    this.broadcastRoom();
    this.broadcast({ t: 'start', seed: this.seed, at: this.now(), order: this.order() });
    this.setTimer(() => this.nextRound(), this.countdown * 1000);
  }
  private nextRound(): void {
    if (this.phase !== 'playing') return;
    this.round++;
    this.broadcast({ t: 'round', n: this.round, at: this.now() });
    if (this.round >= TOTAL_ROUNDS) this.setTimer(() => this.end(), this.finalTime * 1000);
    else this.setTimer(() => this.nextRound(), this.roundTime * 1000);
  }
  private setTimer(fn: () => void, ms: number): void { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(fn, ms); }
  private checkEnd(): void {
    if (this.phase !== 'playing') return;
    if (![...this.players.values()].some(p => p.alive)) this.end();
  }
  end(): void {
    if (this.phase !== 'playing') return;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.phase = 'ended';
    const results: ResultRow[] = this.order().map(pid => { const p = this.players.get(pid)!; const s = p.summary; const alive = p.alive && s?.phase !== 'eliminated';
      return { pid, name: p.name, round: alive ? this.round : (p.eliminatedRound || s?.round || this.round), alive, kills: s?.kills ?? 0, damage: s?.damage ?? 0, mythics: s?.mythics ?? 0, peak: s?.peak ?? 0 }; });
    results.sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.round - a.round || b.damage - a.damage);
    const won = results.some(r => r.alive) && this.round >= TOTAL_ROUNDS;
    this.lastResults = results; this.lastWon = won;
    this.broadcast({ t: 'end', results, won });
    this.broadcastRoom();
  }
  reset(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.phase = 'lobby'; this.round = 0;
    for (const [pid, p] of [...this.players]) { if (!p.conn) this.players.delete(pid); else { p.alive = true; p.eliminatedRound = 0; p.summary = null; } }
    if (this.players.size && ![...this.players.values()].some(p => p.host)) this.players.get(this.order()[0])!.host = true;
    this.broadcastRoom();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer); if (this.emptyTimer) clearTimeout(this.emptyTimer);
    this.timer = null; this.emptyTimer = null;
    for (const p of this.players.values()) { if (p.conn) { try { p.conn.close(); } catch { /* ignore */ } } }
    this.players.clear();
    this.onEmpty?.();
  }
}
