// 같은 프로세스 안의 두 끝점을 잇는 연결 (P2P 호스트 자신의 클라이언트, 테스트용)
import type { Conn } from './protocol.ts';

class LoopEnd implements Conn {
  peer!: LoopEnd;
  private _open = true;
  private recv: ((m: unknown) => void) | null = null;
  private closed: (() => void) | null = null;
  private delay: number;
  constructor(delay: number) { this.delay = delay; }
  get open(): boolean { return this._open; }
  send(m: unknown): void {
    if (!this._open) return;
    const data = JSON.parse(JSON.stringify(m)); const p = this.peer;
    const deliver = () => { if (p._open) p.recv?.(data); };
    if (this.delay > 0) setTimeout(deliver, this.delay); else queueMicrotask(deliver);
  }
  onMessage(cb: (m: unknown) => void): void { this.recv = cb; }
  onClose(cb: () => void): void { this.closed = cb; }
  close(): void {
    if (!this._open) return;
    this._open = false; const p = this.peer;
    queueMicrotask(() => { this.closed?.(); if (p._open) { p._open = false; p.closed?.(); } });
  }
}

export function loopbackPair(delay = 0): [Conn, Conn] {
  const a = new LoopEnd(delay), b = new LoopEnd(delay);
  a.peer = b; b.peer = a;
  return [a, b];
}
