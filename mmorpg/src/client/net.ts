// Transports: a real WebSocket to the game server, or the whole server running inside this page (offline world).
import type { C2S } from '../shared/protocol.ts';
import { GameServer } from '../server/server.ts';
import type { Session } from '../server/session.ts';
import { TICK_HZ } from '../shared/constants.ts';
import { LocalProfileStore } from './storage.ts';

export interface Transport {
  onMessage: (d: string | Uint8Array) => void;
  onStatus: (s: 'open' | 'closed' | 'error', why?: string) => void;
  connect(): void; send(m: C2S): void; close(): void; readonly kind: 'offline' | 'online';
}

export const WORLD_SEED = 20260925;

export class LocalTransport implements Transport {
  kind = 'offline' as const; onMessage: Transport['onMessage'] = () => {}; onStatus: Transport['onStatus'] = () => {};
  gs: GameServer; store = new LocalProfileStore(); private s: Session | null = null; private timer = 0; private next = 0; private open = false;
  constructor(bots = 6) {
    this.gs = new GameServer({ seed: WORLD_SEED, channels: 1, name: '오프라인 체험 월드', online: false, bots, wbInterval: 420, wbFirst: 210, store: this.store, now: () => performance.now() / 1000 });
  }
  connect(): void {
    this.open = true;
    this.s = this.gs.connect({ send: (d) => { if (this.open) this.onMessage(d); }, close: () => { this.open = false; this.onStatus('closed', '연결이 종료되었습니다'); } });
    this.onStatus('open');
    const STEP = 1000 / TICK_HZ; this.next = performance.now();
    const loop = () => {
      const now = performance.now(); let n = 0;
      while (now >= this.next && n < 4) { this.gs.tick(); this.next += STEP; n++; }
      if (now - this.next > 500) this.next = now; // tab was hidden: don't fast-forward the world
    };
    this.timer = window.setInterval(loop, 10);
  }
  send(m: C2S): void { if (this.s && this.open) this.gs.message(this.s, JSON.stringify(m)); }
  close(): void { if (this.s) this.gs.close(this.s); this.open = false; clearInterval(this.timer); }
  saveNow(): void { this.gs.saveAll(); }
}

export class WsTransport implements Transport {
  kind = 'online' as const; onMessage: Transport['onMessage'] = () => {}; onStatus: Transport['onStatus'] = () => {};
  private ws: WebSocket | null = null; url: string;
  constructor(url: string) { this.url = url; }
  connect(): void {
    try { this.ws = new WebSocket(this.url); } catch (e) { this.onStatus('error', '서버 주소가 올바르지 않습니다'); return; }
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.onStatus('open');
    this.ws.onmessage = (e) => this.onMessage(typeof e.data === 'string' ? e.data : new Uint8Array(e.data as ArrayBuffer));
    this.ws.onclose = () => this.onStatus('closed', '서버와 연결이 끊어졌습니다');
    this.ws.onerror = () => this.onStatus('error', '서버에 연결할 수 없습니다');
  }
  send(m: C2S): void { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  close(): void { if (this.ws) { this.ws.onclose = null; this.ws.close(); } }
}
/** ws URL for a server address typed by the user, or the page's own host when served by the game server. */
export function wsUrl(addr: string): string {
  let a = addr.trim(); if (!a) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  if (!/^wss?:\/\//.test(a)) a = (a.startsWith('localhost') || /^\d/.test(a) ? 'ws://' : 'wss://') + a;
  if (!/\/ws$/.test(a)) a = a.replace(/\/$/, '') + '/ws';
  return a;
}
export async function detectServer(): Promise<{ name: string; channels: { humans: number }[] } | null> {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
  try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1500); const r = await fetch('./api/info', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t); if (!r.ok) return null; const j = await r.json(); return j.game === 'moonlit' ? j : null; } catch { return null; }
}
