// 방 클라이언트: 하나의 Conn 위에서 프로토콜을 다루고 이벤트를 넘겨줍니다.
import type { Conn, ClientMsg, HostMsg, PlayerInfo, ResultRow, RoomPhase } from './protocol.ts';
import type { BoardSnap, PlayerSummary } from '../sim/snapshot.ts';

export interface RoomView { code: string; you: string; phase: RoomPhase; players: PlayerInfo[]; round: number }
export interface ClientEvents {
  room: (r: RoomView) => void;
  start: (m: { seed: number; at: number; order: string[] }) => void;
  round: (n: number, at: number) => void;
  peer: (pid: string, s: PlayerSummary) => void;
  board: (pid: string, b: BoardSnap) => void;
  gold: (from: string, fromName: string, amount: number) => void;
  emote: (from: string, fromName: string, text: string) => void;
  end: (results: ResultRow[], won: boolean) => void;
  error: (msg: string) => void;
  close: () => void;
}

export class RoomClient {
  room: RoomView | null = null;
  conn: Conn; name: string; token: string;
  private handlers: Map<keyof ClientEvents, ((...a: never[]) => void)[]> = new Map();
  constructor(conn: Conn, name: string, token: string) {
    this.conn = conn; this.name = name; this.token = token;
    conn.onMessage(m => this.onMessage(m as HostMsg));
    conn.onClose(() => this.emit('close'));
  }
  on<K extends keyof ClientEvents>(k: K, fn: ClientEvents[K]): this { let list = this.handlers.get(k); if (!list) { list = []; this.handlers.set(k, list); } list.push(fn as (...a: never[]) => void); return this; }
  private emit<K extends keyof ClientEvents>(k: K, ...args: Parameters<ClientEvents[K]>): void { for (const fn of this.handlers.get(k) ?? []) (fn as (...a: unknown[]) => void)(...args); }
  send(m: ClientMsg): void { if (this.conn.open) this.conn.send(m); }
  hello(opts: { create?: boolean; code?: string } = {}): void { this.send({ t: 'hello', name: this.name, token: this.token, ...opts }); }
  start(): void { this.send({ t: 'start' }); }
  summary(s: PlayerSummary): void { this.send({ t: 'summary', s }); }
  board(b: BoardSnap): void { this.send({ t: 'board', b }); }
  sendGold(to: string, amount: number): void { this.send({ t: 'gold', to, amount }); }
  emote(text: string): void { this.send({ t: 'emote', text }); }
  eliminated(round: number, reason: string): void { this.send({ t: 'eliminated', round, reason }); }
  again(): void { this.send({ t: 'again' }); }
  leave(): void { this.send({ t: 'leave' }); setTimeout(() => this.conn.close(), 50); }
  get me(): PlayerInfo | undefined { return this.room?.players.find(p => p.pid === this.room!.you); }
  get isHost(): boolean { return !!this.me?.host; }
  private onMessage(m: HostMsg): void {
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'room': this.room = { code: m.code, you: m.you, phase: m.phase, players: m.players, round: m.round }; this.emit('room', this.room); break;
      case 'start': this.emit('start', { seed: m.seed, at: m.at, order: m.order }); break;
      case 'round': this.emit('round', m.n, m.at); break;
      case 'peer': this.emit('peer', m.pid, m.s); break;
      case 'board': this.emit('board', m.pid, m.b); break;
      case 'gold': this.emit('gold', m.from, m.fromName, m.amount); break;
      case 'emote': this.emit('emote', m.from, m.fromName, m.text); break;
      case 'end': this.emit('end', m.results, m.won); break;
      case 'error': this.emit('error', m.msg); break;
    }
  }
}
