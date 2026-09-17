import { MAX_GHOSTS, WEAPONS } from './constants';
import type { Recording } from './types';

export const MAX_RECORD_TICKS = 60 * 60; // hard cap: one minute of frames
const END_KINDS = new Set(['finish', 'death', 'timeout', 'escape']);

/** Validates an untrusted recording object (from storage). Returns null if anything is out of range. */
export function validateRecording(o: unknown, mapId?: string, mapVersion?: number): Recording | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  if (r.v !== 1 || typeof r.mapId !== 'string' || typeof r.mapVersion !== 'number') return null;
  if (mapId !== undefined && r.mapId !== mapId) return null;
  if (mapVersion !== undefined && r.mapVersion !== mapVersion) return null;
  if (typeof r.weapon !== 'string' || !(r.weapon in WEAPONS)) return null;
  if (typeof r.endKind !== 'string' || !END_KINDS.has(r.endKind)) return null;
  if (!Array.isArray(r.pos) || !Array.isArray(r.face) || !Array.isArray(r.shots) || !Array.isArray(r.dashes)) return null;
  const frames = r.pos.length >> 1;
  if (r.pos.length % 2 !== 0 || frames === 0 || frames > MAX_RECORD_TICKS || r.face.length !== frames) return null;
  if (typeof r.endTick !== 'number' || !Number.isInteger(r.endTick) || r.endTick !== frames) return null;
  for (const v of r.pos as unknown[]) if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e6) return null;
  for (const v of r.face as unknown[]) if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (r.shots.length > MAX_RECORD_TICKS * 8 || r.dashes.length > MAX_RECORD_TICKS) return null;
  for (const s of r.shots as unknown[]) {
    if (!s || typeof s !== 'object') return null; const q = s as Record<string, unknown>;
    if (!Number.isInteger(q.t) || (q.t as number) < 1 || (q.t as number) > frames) return null;
    if (typeof q.x !== 'number' || typeof q.y !== 'number' || typeof q.w !== 'string' || !(q.w in WEAPONS) || !Array.isArray(q.a) || q.a.length === 0 || q.a.length > 12) return null;
    for (const a of q.a as unknown[]) if (typeof a !== 'number' || !Number.isFinite(a)) return null;
  }
  for (const d of r.dashes as unknown[]) if (!Number.isInteger(d) || (d as number) < 1 || (d as number) > frames) return null;
  return { v: 1, mapId: r.mapId, mapVersion: r.mapVersion, weapon: r.weapon as Recording['weapon'], endKind: r.endKind as Recording['endKind'], endTick: r.endTick, pos: r.pos as number[], face: r.face as number[], shots: r.shots as Recording['shots'], dashes: r.dashes as number[], createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0 };
}

export function validateSlots(list: unknown, mapId: string, mapVersion: number): (Recording | null)[] {
  const out: (Recording | null)[] = [null, null, null];
  if (!Array.isArray(list)) return out;
  for (let i = 0; i < MAX_GHOSTS; i++) out[i] = validateRecording(list[i], mapId, mapVersion);
  return out;
}

export const recordingSeconds = (r: Recording): number => Math.round((r.endTick / 60) * 10) / 10;
export const endKindLabel: Record<Recording['endKind'], { icon: string; label: string; note: string }> = {
  finish: { icon: '⏹', label: '일찍 마침', note: '남은 시간 동안 마지막 위치를 지킵니다' },
  death: { icon: '✖', label: '사망', note: '사망 시각 이후 분신이 사라집니다' },
  timeout: { icon: '⏱', label: '시간 종료', note: '25초 행동을 재생한 뒤 사라집니다' },
  escape: { icon: '🏁', label: '탈출 성공', note: '탈출한 뒤 출구 위치를 지킵니다' },
};

/** Sparse path preview (≤ n points) for the slot UI. */
export function pathPreview(r: Recording, n = 40): { x: number; y: number }[] {
  const frames = r.pos.length >> 1; const pts: { x: number; y: number }[] = [];
  const step = Math.max(1, Math.floor(frames / n));
  for (let i = 0; i < frames; i += step) pts.push({ x: r.pos[i * 2] / 10, y: r.pos[i * 2 + 1] / 10 });
  const l = frames - 1; if (l >= 0 && (frames - 1) % step !== 0) pts.push({ x: r.pos[l * 2] / 10, y: r.pos[l * 2 + 1] / 10 });
  return pts;
}
