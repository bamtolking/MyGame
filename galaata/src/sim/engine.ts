// 고정 시간 스텝 엔진: 입력 → 플레이어 → 적 → 투사체 → 장치 → 승패. 순수 로직.
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import { moveEntity, separateEntities, updateEnemies } from './ai';
import { fireWeapon, resolveAim, updateFiring, updateProjectiles } from './combat';
import { updateDevices } from './devices';
import { findPossessTarget, possess, possessBlockReason, possessCandidates } from './possession';
import { speedMul, useSkill } from './skills';
import type { Entity, Input } from './types';
import { World } from './world';

export const EMPTY_INPUT: Input = { mx: 0, my: 0, attack: false, skill: false, possess: false, interact: false };

/** 한 스텝(dt는 실제 초. 시간 배속은 내부에서 적용) */
export function step(w: World, input: Input, dt: number = RULES.fixedDt): void {
  if (w.phase !== 'playing') return;
  const pressed = { skill: input.skill && !w.prevInput.skill, possess: input.possess && !w.prevInput.possess, interact: input.interact && !w.prevInput.interact };
  w.prevInput = { ...input };
  // 시간 배속(히트스톱·마지막 기회)
  let scale = 1;
  if (w.hitstop > 0) { w.hitstop -= dt; scale = 0.15; }
  if (w.lastChance) scale = RULES.lastChanceTimeScale;
  w.timeScale = scale;
  const ds = dt * scale;
  w.time += ds; w.zoneTime += ds;
  w.stepDamage = 0;
  if (w.savedFlash > 0) w.savedFlash -= dt;
  if (w.message && w.time > w.message.until) w.message = null;
  w.possessCd = Math.max(0, w.possessCd - dt);

  const p = w.player;
  const d = BODIES[p.body];
  // 빙의 후보·대상 계산(HUD와 마지막 기회 공용)
  w.candidates = possessCandidates(w);
  const range = w.lastChance ? RULES.lastChanceRange : RULES.possessRange;
  w.possessTarget = findPossessTarget(w, p, range);
  w.possessBlockReason = w.possessTarget && w.possessCd <= 0 ? '' : possessBlockReason(w, p, range);

  // 빙의 입력
  if (pressed.possess) {
    if (w.possessTarget && w.possessCd <= 0) possess(w, p, w.possessTarget);
    else { w.emit({ type: 'possessFail', x: p.x, y: p.y, text: w.possessBlockReason }); w.say(w.possessBlockReason, 1.8, 'warn'); }
  }
  const pl = w.player; // 빙의로 바뀌었을 수 있음
  const move = { x: input.mx, y: input.my }; const ml = Math.hypot(move.x, move.y); if (ml > 1) { move.x /= ml; move.y /= ml; }
  const moving = ml > 0.12;
  const aim = resolveAim(w, pl, moving ? move : null);
  w.aimPoint = aim.point; w.aimTargetId = aim.targetId;

  if (pl.hp > 0) {
    updatePlayer(w, pl, input, pressed, move, moving, aim.point, ds);
  } else if (w.lastChance) {
    // 마지막 기회: 느리게 기어가며 빙의만 가능
    w.lastChance.remaining -= dt;
    moveEntity(w, pl, move.x, move.y, BODIES[pl.body].speed * 0.4, ds);
    if (w.lastChance.remaining <= 0) defeat(w, '빙의할 몸을 찾지 못한 채 코어가 꺼졌다');
  }

  // 적·장치·투사체
  if (w.phase !== 'playing') return;
  updateEnemies(w, ds);
  for (const e of w.entities) {
    if (!e.alive) continue;
    updateFiring(w, e, ds);
    e.attackCd = Math.max(0, e.attackCd - ds); e.skillCd = Math.max(0, e.skillCd - ds); e.contactCd = Math.max(0, e.contactCd - ds);
    e.hitFlash = Math.max(0, e.hitFlash - ds);
    if (e.shock > 0 && e.stunUntil <= w.time) e.shock = Math.max(0, e.shock - RULES.shockDecayPerSec * ds);
    if (e.skillUntil > 0 && e.skillUntil <= w.time && e.dashDir) e.dashDir = null;
  }
  updateProjectiles(w, ds);
  updateDevices(w, ds, pressed.interact);
  separateEntities(w);
  // 플레이어 사망 판정(투사체·폭발 이후)
  const pp = w.player;
  if (pp.hp <= 0 && !w.lastChance && w.phase === 'playing') {
    const cand = findPossessTarget(w, pp, RULES.lastChanceRange);
    if (cand) { w.lastChance = { remaining: RULES.lastChanceDuration }; w.emit({ type: 'lastChance', x: pp.x, y: pp.y }); w.say('마지막 기회! 지금 빙의하라', RULES.lastChanceDuration * 3, 'warn'); }
    else defeat(w, pp.collapsing && pp.stability === 0 ? '몸이 완전히 붕괴했다' : '몸이 파괴됐고 근처에 빼앗을 몸이 없었다');
  }
  // 통계
  w.stats.timeByBody[pp.body] = (w.stats.timeByBody[pp.body] ?? 0) + ds;
  // 사망 개체 정리(연출은 이벤트로 이미 발행됨)
  w.entities = w.entities.filter((e) => e.alive || e.controlled);
  // 보스 사망 → 승리
  if (w.zone.boss && !w.entities.some((e) => e.body === 'boss' && e.alive) && w.phase === 'playing') {
    w.phase = 'victory'; w.stats.zoneTimes[w.zoneIndex] = w.zoneTime; w.emit({ type: 'victory' });
  }
}

function updatePlayer(w: World, p: Entity, input: Input, pressed: { skill: boolean; possess: boolean; interact: boolean }, move: { x: number; y: number }, moving: boolean, aim: { x: number; y: number }, ds: number): void {
  const d = BODIES[p.body];
  // 스킬
  if (pressed.skill) {
    const ok = useSkill(w, p, moving ? move : null, aim);
    if (!ok) { const why = d.skill ? (p.skillCd > 0 ? `${d.skill.name} 대기 ${p.skillCd.toFixed(1)}초` : '지금은 스킬을 쓸 수 없다') : '이 몸에는 스킬이 없다'; w.emit({ type: 'possessFail', text: why }); }
  }
  // 이동
  const dashing = p.dashDir && p.skillUntil > w.time;
  if (dashing) moveEntity(w, p, p.dashDir!.x, p.dashDir!.y, d.speed * 3.2, ds);
  else moveEntity(w, p, move.x, move.y, d.speed * speedMul(w, p) * (moving ? Math.min(1, Math.hypot(move.x, move.y) * 1.15) : 0), ds);
  // 방향: 공격 중이면 조준 방향, 아니면 이동 방향
  const attacking = input.attack || p.windup > 0 || p.burstLeft > 0;
  if (attacking) p.facing = Math.atan2(aim.y - p.y, aim.x - p.x);
  else if (moving) p.facing = Math.atan2(move.y, move.x);
  // 공격
  if (input.attack && p.attackCd <= 0 && p.windup <= 0 && p.burstLeft <= 0 && p.stunUntil <= w.time && !dashing) fireWeapon(w, p, aim);
  // 안정도
  if (p.stability != null && p.stabilityMax != null) {
    p.stability = Math.max(0, p.stability - d.stabilityDecay * ds);
    if (!p.stabWarned && p.stability <= p.stabilityMax * RULES.stabilityWarnRatio) { p.stabWarned = true; w.emit({ type: 'collapseWarn', x: p.x, y: p.y }); w.say('안정도 낮음 — 곧 붕괴한다. 다음 몸을 준비하라', 3, 'warn'); }
    if (p.stability > p.stabilityMax * RULES.stabilityWarnRatio) p.stabWarned = false;
    if (p.stability <= 0 && !p.collapsing) { p.collapsing = true; w.emit({ type: 'collapseStart', x: p.x, y: p.y }); w.say('붕괴 시작! 체력이 빠르게 줄어든다', 3, 'warn'); }
    if (p.collapsing) { p.hp = Math.max(0, p.hp - p.hpMax * RULES.collapseHpLossPerSec * ds); if (p.hp <= 0) w.stats.damageTaken += 0; }
  }
}

function defeat(w: World, reason: string): void {
  w.phase = 'defeat'; w.defeatReason = reason; w.lastChance = null; w.stats.zoneTimes[w.zoneIndex] = w.zoneTime;
  w.emit({ type: 'defeat', text: reason });
}
