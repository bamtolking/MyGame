// 클라이언트 ↔ 방 호스트 메시지. 호스트는 브라우저(P2P) 또는 Node 서버에서 같은 코드(room.ts)로 돕니다.
import type { BoardSnap, PlayerSummary } from '../sim/snapshot.ts';

export interface PlayerInfo { pid: string; name: string; host: boolean; connected: boolean; summary: PlayerSummary | null; eliminatedRound: number }
export type RoomPhase = 'lobby' | 'playing' | 'ended';

export type ClientMsg =
  | { t: 'hello'; name: string; token: string; create?: boolean; code?: string }
  | { t: 'start' }
  | { t: 'summary'; s: PlayerSummary }
  | { t: 'board'; b: BoardSnap }
  | { t: 'gold'; to: string; amount: number }
  | { t: 'emote'; text: string }
  | { t: 'eliminated'; round: number; reason: string }
  | { t: 'again' }
  | { t: 'leave' }
  | { t: 'ping' };

export interface ResultRow { pid: string; name: string; round: number; alive: boolean; kills: number; damage: number; mythics: number; peak: number }

export type HostMsg =
  | { t: 'room'; code: string; you: string; phase: RoomPhase; players: PlayerInfo[]; round: number }
  | { t: 'start'; seed: number; at: number; order: string[] }
  | { t: 'round'; n: number; at: number }
  | { t: 'peer'; pid: string; s: PlayerSummary }
  | { t: 'board'; pid: string; b: BoardSnap }
  | { t: 'gold'; from: string; fromName: string; amount: number }
  | { t: 'emote'; from: string; fromName: string; text: string }
  | { t: 'end'; results: ResultRow[]; won: boolean }
  | { t: 'error'; msg: string }
  | { t: 'pong' };

/** 전송 계층 추상화: 루프백 / PeerJS / WebSocket 모두 이 모양 */
export interface Conn {
  send(msg: unknown): void;
  onMessage(cb: (msg: unknown) => void): void;
  onClose(cb: () => void): void;
  close(): void;
  readonly open: boolean;
}

export function makeCode(rand: () => number = Math.random): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}
export function normCode(s: string): string { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }
export function makeToken(): string { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
/** 이름 정리: 제어문자·꺾쇠 제거, 12자 제한 */
export function cleanName(n: unknown): string { return String(n ?? '').split('').filter(ch => ch.charCodeAt(0) >= 32 && ch !== '<' && ch !== '>').join('').trim().slice(0, 12); }
