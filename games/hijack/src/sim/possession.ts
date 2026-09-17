// 빙의(몸 탈취) 조건·대상 선택·실행. 순수 로직.
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import type { Entity } from './types';
import { World } from './world';

/** 한국어 조사 '(으)로' */
export function roJosa(word: string): string { const c = word.charCodeAt(word.length - 1); if (c < 0xac00 || c > 0xd7a3) return '로'; const jong = (c - 0xac00) % 28; return jong === 0 || jong === 8 ? '로' : '으로'; }

/** 빙의 가능: 살아있는 적 + 빙의 가능한 몸 + (체력 35% 이하 또는 기절) */
export function isPossessable(w: World, e: Entity): boolean {
  if (!e.alive || e.controlled || e.team !== 'enemy') return false;
  if (!BODIES[e.body].possessable) return false;
  return e.hp / e.hpMax <= RULES.possessHpRatio + 1e-9 || e.stunUntil > w.time;
}

export function possessCandidates(w: World): Entity[] { return w.entities.filter((e) => isPossessable(w, e)); }

/** 사거리 안 가장 가까운 유효 대상(중심 거리 - 반지름 기준). 동률이면 id가 작은 쪽 */
export function findPossessTarget(w: World, p: Entity, range: number): Entity | null {
  let best: Entity | null = null; let bd = range;
  for (const e of w.entities) {
    if (!isPossessable(w, e)) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius;
    if (d < bd - 1e-6 || (best && Math.abs(d - bd) <= 1e-6 && e.id < best.id)) { bd = d; best = e; }
  }
  return best;
}

/** 빙의가 안 되는 이유(HUD 안내용) */
export function possessBlockReason(w: World, p: Entity, range: number): string {
  if (w.possessCd > 0) return `빙의 재사용 대기 ${w.possessCd.toFixed(1)}초`;
  let nearest: Entity | null = null; let nd = Infinity;
  for (const e of w.entities) {
    if (!e.alive || e.team !== 'enemy') continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius; if (d < nd) { nd = d; nearest = e; }
  }
  const cands = possessCandidates(w);
  if (cands.length) {
    return '빙의 가능한 적이 너무 멀다 — 더 가까이';
  }
  if (nearest && nd <= range * 1.5) {
    if (nearest.body === 'boss') return '코어 잠금 — 보스는 빙의할 수 없다';
    if (nearest.body === 'turret' || nearest.body === 'node') return '기계 장치는 빙의할 수 없다';
    return `${BODIES[nearest.body].name}이(가) 아직 약하지 않다 (체력 ${Math.round(RULES.possessHpRatio * 100)}% 이하 필요)`;
  }
  return '빙의할 대상이 없다 — 적을 먼저 약화시켜라';
}

/** 빙의 실행. 이전 몸은 붕괴, 대상은 즉시 플레이어 몸이 됨(남은 체력 유지, 안정도는 새 몸 최대치). */
export function possess(w: World, p: Entity, target: Entity): void {
  const wasLastChance = !!w.lastChance;
  const d = BODIES[target.body];
  w.emit({ type: 'possess', fromX: p.x, fromY: p.y, x: target.x, y: target.y, body: target.body, id: target.id });
  // 이전 몸 붕괴(처치로 세지 않음)
  p.alive = false; p.controlled = false; p.deathT = w.time; p.hp = 0;
  w.emit({ type: 'die', x: p.x, y: p.y, body: p.body, id: p.id, text: 'collapse' });
  // 새 몸
  target.team = 'player'; target.controlled = true; target.possessedAt = w.time;
  const healed = Math.max(target.hp, Math.round(target.hpMax * RULES.possessMinHpRatio));
  if (healed > target.hp) w.emit({ type: 'repair', x: target.x, y: target.y, amount: healed - target.hp, id: target.id });
  target.hp = healed;
  target.stability = d.stability; target.stabilityMax = d.stability;
  target.collapsing = false; target.stabWarned = false;
  target.shock = 0; target.stunUntil = 0; target.slowUntil = 0; target.windup = 0; target.burstLeft = 0; target.aimshotPending = false;
  target.invulnUntil = w.time + RULES.possessInvuln; target.attackCd = 0.15; target.skillCd = 0; target.skillUntil = 0;
  target.vx = 0; target.vy = 0; target.hitFlash = 0.2;
  // 이 몸이 날린 투사체는 이제 플레이어 편
  for (const pr of w.projectiles) if (pr.ownerId === target.id) pr.team = 'player';
  w.playerId = target.id;
  w.possessCd = RULES.possessCooldown;
  w.hitstop = 0.12;
  w.channel = null;
  if (wasLastChance) { w.stats.lastChanceSaves++; w.savedFlash = 1.2; }
  w.lastChance = null;
  w.stats.possessions++;
  if (!w.stats.bodiesUsed.includes(target.body)) w.stats.bodiesUsed.push(target.body);
  if (target.body === 'shield') w.stats.usedShield = true;
  // 주변 적 경계
  for (const e of w.entities) if (e.alive && e.team === 'enemy' && Math.hypot(e.x - target.x, e.y - target.y) < 140 && e.ai.state === 'idle') { e.ai.state = 'alert'; e.ai.alertedAt = w.time; }
  w.say(`${d.name}${roJosa(d.name)} 갈아탐 — ${d.swapHint}`, 3.2, 'hint');
}
