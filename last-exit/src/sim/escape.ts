// 탈출: 요청·취소·진행·추격·완료. 완료 판정은 해당 스텝의 피해 처리 후 수행한다.
import type { RunState, ActionResult } from './types';
import { ESCAPE } from '../data/balance';
import { zoneDef } from '../data/zones';
import { emit, bagValue, toast } from './state';
import { scheduleSpawns } from './enemies';
import { dist } from './geom';

export function padAvailable(s: RunState): boolean {
  const pad = s.zoneRt.exitPad; if (!pad) return false;
  if (pad.final) return s.zoneRt.bossDead;
  return s.zoneRt.cleared;
}
export function insidePad(s: RunState): boolean { const pad = s.zoneRt.exitPad; return !!pad && dist(s.player.x, s.player.y, pad.x, pad.y) <= pad.r; }

export function requestEscape(s: RunState): ActionResult {
  if (s.status !== 'active') return { ok: false };
  if (s.phase === 'ability') return { ok: false, msg: '능력을 먼저 고르세요' };
  if (!padAvailable(s)) return { ok: false, msg: zoneDef(s.zone).boss ? '보스를 먼저 처치하세요' : '구역 목표를 먼저 완료하세요' };
  if (!insidePad(s)) return { ok: false, msg: '탈출 지점 안에서 요청하세요' };
  if (s.escape?.active) return { ok: false, msg: '이미 탈출 준비 중' };
  const pad = s.zoneRt.exitPad!;
  if (!s.escape) {
    const waves = pad.final ? [] : (ESCAPE.pursuers[s.zone]?.[s.difficulty] || []).map(w => ({ ...w }));
    s.escape = { progress: 0, need: pad.final ? ESCAPE.finalNeed : ESCAPE.need, active: true, inside: true, waves, waveIdx: 0, elapsed: 0, final: pad.final };
  } else s.escape.active = true;
  s.phase = 'escaping';
  emit(s, { t: 'escapeStart' });
  return { ok: true };
}
export function cancelEscape(s: RunState): ActionResult {
  if (!s.escape?.active) return { ok: false };
  s.escape.active = false; s.phase = 'cleared';
  emit(s, { t: 'escapeCancel' }); toast(s, '탈출 준비를 멈췄습니다 (진행도는 유지)', 'info');
  return { ok: true };
}

export function updateEscape(s: RunState, dt: number): void {
  const es = s.escape; if (!es || !es.active || s.status !== 'active') return;
  const pad = s.zoneRt.exitPad!;
  es.elapsed += dt;
  while (es.waveIdx < es.waves.length && es.elapsed >= es.waves[es.waveIdx].at) {
    const w = es.waves[es.waveIdx]; scheduleSpawns(s, [{ type: w.type, n: w.n }], true, pad.x, pad.y); es.waveIdx++;
  }
  es.inside = insidePad(s);
  if (es.inside) es.progress = Math.min(es.need, es.progress + dt);
  if (es.progress >= es.need && s.player.hp > 0) completeEscape(s);
}

export function completeEscape(s: RunState): void {
  if (s.status !== 'active') return;
  s.status = 'escaped'; s.phase = 'done';
  s.stats.time[s.zone] = s.zoneTime;
  s.result = { kind: 'escaped', value: bagValue(s), items: { ...s.bag.items }, zone: s.zone, cause: '', time: s.time, boss: s.zoneRt.bossDead };
  if (s.escape) s.escape.active = false;
  emit(s, { t: 'escaped' });
}
