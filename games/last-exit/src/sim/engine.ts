// 고정 시간 스텝 시뮬레이션 진입점
import type { RunState, Input, Action, ActionResult } from './types';
import { PLAYER, DT } from '../data/balance';
import { moveSpeed, dashCooldown, emit } from './state';
import { moveCircle, norm } from './geom';
import { updateEnemies, updateSpawns } from './enemies';
import { updatePlayerAttack, updateProjectiles } from './combat';
import { updateLoot, updateChests, dropLoot, openSafe, nearestSafe } from './loot';
import { updateWaves, updateCollapse, checkCleared, pickAbility, enterDoor, droneTrade, nearDoor, nearDrone } from './zone';
import { updateEscape, requestEscape, cancelEscape, padAvailable, insidePad } from './escape';
export { DT };

export function updatePlayer(s: RunState, input: Input, dt: number): void {
  const p = s.player; const rows = s.zoneRt.rows; const doorOpen = !!s.zoneRt.door?.open;
  p.invulnT = Math.max(0, p.invulnT - dt); p.hurtT = Math.max(0, p.hurtT - dt); p.dashCd = Math.max(0, p.dashCd - dt);
  let mx = input.mx, my = input.my; const mag = Math.hypot(mx, my);
  if (mag > 1) { mx /= mag; my /= mag; }
  const moving = mag > 0.01;
  if (input.dash && p.dashT <= 0 && p.dashCd <= 0) {
    const [dx, dy] = moving ? norm(mx, my) : [p.moveX, p.moveY];
    p.dashT = PLAYER.dashTime; p.dashDx = dx; p.dashDy = dy; p.dashCd = dashCooldown(s);
    p.invulnT = Math.max(p.invulnT, PLAYER.dashInvuln); s.stats.dashes++; emit(s, { t: 'dash' });
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    const [x, y] = moveCircle(rows, p.x, p.y, p.dashDx * PLAYER.dashSpeed * dt, p.dashDy * PLAYER.dashSpeed * dt, PLAYER.radius, doorOpen);
    p.x = x; p.y = y; p.moving = true; p.walk += dt * 20;
    return;
  }
  p.moving = moving;
  if (moving) {
    const [ux, uy] = norm(mx, my); p.moveX = ux; p.moveY = uy;
    const sp = moveSpeed(s) * Math.min(1, mag);   // 대각선도 같은 속력
    const [x, y] = moveCircle(rows, p.x, p.y, ux * sp * dt, uy * sp * dt, PLAYER.radius, doorOpen);
    p.x = x; p.y = y; p.walk += dt * (6 + 8 * Math.min(1, mag));
  }
}

/** 한 스텝. 일시정지·선택·종료 상태에서는 아무것도 진행하지 않는다 */
export function step(s: RunState, input: Input, dt = DT): void {
  if (s.status !== 'active' || s.phase === 'ability' || s.phase === 'done') return;
  s.time += dt; s.zoneTime += dt;
  updatePlayer(s, input, dt);
  updatePlayerAttack(s, dt);
  updateEnemies(s, dt);
  updateProjectiles(s, dt);
  updateWaves(s);
  updateSpawns(s, dt);
  updateCollapse(s, dt);
  if (s.status === 'active') {
    updateChests(s);
    updateLoot(s, dt);
    checkCleared(s);
    updateEscape(s, dt);   // 이 스텝의 피해 처리 후 생존 시에만 탈출 완료
  }
  for (let i = s.enemies.length - 1; i >= 0; i--) if (s.enemies[i].state === 'dead') s.enemies.splice(i, 1);
  if (s.projectiles.length > 400) s.projectiles.splice(0, s.projectiles.length - 400);
}

export function dispatch(s: RunState, a: Action): ActionResult {
  switch (a.type) {
    case 'requestEscape': return requestEscape(s);
    case 'cancelEscape': return cancelEscape(s);
    case 'drop': return dropLoot(s, a.loot, a.n);
    case 'pickAbility': return pickAbility(s, a.id);
    case 'enterDoor': return enterDoor(s);
    case 'openSafe': return openSafe(s, a.id);
    case 'droneTrade': return droneTrade(s);
    case 'interact': { const i = interactable(s); if (!i) return { ok: false }; return dispatch(s, i.action); }
  }
}

export interface Interact { kind: 'door' | 'safe' | 'drone' | 'escape' | 'escapeCancel' | 'final'; label: string; action: Action; danger?: boolean }
/** 현재 위치에서 가능한 상호작용 (UI 버튼용) */
export function interactable(s: RunState): Interact | null {
  if (s.status !== 'active' || s.phase === 'ability') return null;
  if (s.escape?.active) return { kind: 'escapeCancel', label: '탈출 취소', action: { type: 'cancelEscape' } };
  const safe = nearestSafe(s); if (safe) return { kind: 'safe', label: '경보 금고 열기', action: { type: 'openSafe', id: safe.id }, danger: true };
  if (nearDrone(s)) return { kind: 'drone', label: '정비 드론 거래', action: { type: 'droneTrade' } };
  if (padAvailable(s) && insidePad(s)) return s.zoneRt.exitPad!.final ? { kind: 'final', label: '최종 탈출', action: { type: 'requestEscape' } } : { kind: 'escape', label: '탈출 요청', action: { type: 'requestEscape' } };
  if (nearDoor(s)) return { kind: 'door', label: '다음 구역으로', action: { type: 'enterDoor' }, danger: true };
  return null;
}
