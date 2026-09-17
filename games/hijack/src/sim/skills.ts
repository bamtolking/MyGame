// 몸 고유 스킬 실행. 순수 로직.
import { BODIES } from '../data/bodies';
import { applyShock } from './combat';
import type { Entity, Vec } from './types';
import { World } from './world';

export function skillReady(w: World, e: Entity): boolean {
  const d = BODIES[e.body]; if (!d.skill) return false;
  return e.skillCd <= 0 && e.windup <= 0 && e.stunUntil <= w.time;
}

/** 스킬 사용. 성공 시 true */
export function useSkill(w: World, e: Entity, moveDir: Vec | null, aim: Vec): boolean {
  const d = BODIES[e.body]; const s = d.skill;
  if (!s || !skillReady(w, e)) return false;
  switch (s.id) {
    case 'dash': {
      const moving = moveDir && Math.hypot(moveDir.x, moveDir.y) > 0.15;
      const a = moving ? Math.atan2(moveDir!.y, moveDir!.x) : e.facing;
      e.dashDir = { x: Math.cos(a), y: Math.sin(a) };
      e.skillUntil = w.time + (s.duration ?? 0.2);
      e.invulnUntil = Math.max(e.invulnUntil, e.skillUntil + 0.03);
      break;
    }
    case 'sprint': e.skillUntil = w.time + (s.duration ?? 1.4); break;
    case 'guard': e.skillUntil = w.time + (s.duration ?? 2.5); break;
    case 'bigbomb': {
      w.projectiles.push({
        id: w.nextId++, kind: 'bomb', team: e.team, ownerId: e.id, ownerBody: e.body, x: e.x, y: e.y, vx: 0, vy: 0,
        damage: 70, ttl: 99, radius: 10, pierce: false, hitIds: [], splash: 95, overWalls: true, knockback: 0, shock: 0, volley: w.volleyCounter++,
        sx: e.x, sy: e.y, tx: e.x, ty: e.y, flight: 0, t: 0, fuse: 1.6, selfDamage: true, breaksWalls: true, color: '#ffd23c',
      });
      break;
    }
    case 'aimshot': {
      e.windup = s.duration ?? 0.7; e.windupTarget = { ...aim }; e.aimshotPending = true;
      e.skillUntil = w.time + e.windup; e.attackCd = e.windup + 0.35;
      break;
    }
    case 'repairpulse': {
      e.hp = Math.min(e.hpMax, e.hp + 22);
      if (e.stability != null && e.stabilityMax != null) { e.stability = Math.min(e.stabilityMax, e.stability + 12); if (e.stability > 0) e.collapsing = false; }
      for (const t of w.entities) if (t.alive && t.team !== e.team && Math.hypot(t.x - e.x, t.y - e.y) <= 100 + t.radius) { applyShock(w, t, 45); w.emit({ type: 'shock', fromX: e.x, fromY: e.y, x: t.x, y: t.y, body: e.body }); }
      w.emit({ type: 'repair', x: e.x, y: e.y, amount: 22 });
      break;
    }
  }
  e.skillCd = s.cooldown;
  w.emit({ type: 'skill', body: e.body, x: e.x, y: e.y, text: s.id });
  return true;
}

/** 이동 속도 배율(상태이상·스킬) */
export function speedMul(w: World, e: Entity): number {
  const d = BODIES[e.body]; let m = 1;
  if (e.stunUntil > w.time) return 0;
  if (e.aimshotPending && e.windup > 0) return 0;
  if (e.windup > 0) m *= 0.5;
  if (e.slowUntil > w.time) m *= 0.7;
  if (e.skillUntil > w.time && d.skill) {
    if (d.skill.id === 'sprint') m *= 1.9;
    if (d.skill.id === 'guard') m *= 0.6;
  }
  if (w.channel && e.controlled) m *= 0.35;
  return m;
}
