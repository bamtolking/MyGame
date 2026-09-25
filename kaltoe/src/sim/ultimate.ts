// 궁극기(사직서 등) — 게이지가 차면 발동
import { rand, randRange } from '../core/rng';
import type { World } from './types';
import { damageEnemy, SLOT_ULT } from './damage';
import { segmentHpMul } from './enemies';

const DT = 1 / 60;

export function ultReady(w: World) {
  return w.phase === 'play' && w.player.ult >= w.player.ultMax && w.player.ultActiveT <= 0;
}

/** 시간이 지날수록 적 체력과 함께 강해지는 궁극기 피해 */
function ultDamage(w: World, base: number) {
  return base * Math.max(1, segmentHpMul(w)) * (w.cfg.stage.hpMul ?? 1);
}

export function activateUlt(w: World): boolean {
  if (!ultReady(w)) return false;
  const u = w.ultimate;
  const P = u.params;
  const p = w.player;
  p.ult = 0;
  w.stats_.ultUses++;
  w.events.push({ t: 'ult', id: u.id, shout: u.shout });
  const inView = (x: number, y: number, pad = 40) => Math.abs(x - p.x) < w.viewW / 2 + pad && Math.abs(y - p.y) < w.viewH / 2 + pad;
  switch (u.kind) {
    case 'blast': {
      const r = (P.radius ?? 300) * w.d.areaMul;
      const dmg = ultDamage(w, P.damage ?? 200);
      for (const e of w.enemies) {
        if (e.dead) continue;
        const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d2 < (r + e.r) ** 2) damageEnemy(w, e, dmg, SLOT_ULT, { knock: P.knockback ?? 80, kx: e.x - p.x, ky: e.y - p.y, noCrit: true });
      }
      w.events.push({ t: 'explode', x: p.x, y: p.y, r, color: '#ffffff', big: true });
      w.hitStop = Math.max(w.hitStop, 0.12);
      break;
    }
    case 'freeze': {
      const dur = (P.dur ?? 5) * w.d.durMul;
      for (const e of w.enemies) {
        if (e.dead || !inView(e.x, e.y, 120)) continue;
        if (e.boss) { e.slowAmt = Math.max(e.slowAmt, 0.5); e.slowT = Math.max(e.slowT, dur); }
        else e.freezeT = Math.max(e.freezeT, dur);
        if (P.damage) damageEnemy(w, e, ultDamage(w, P.damage), SLOT_ULT, { noCrit: true, quiet: true });
      }
      w.events.push({ t: 'explode', x: p.x, y: p.y, r: Math.max(w.viewW, w.viewH) * 0.7, color: '#8fe3ff', big: true });
      break;
    }
    case 'rain': case 'shield': {
      p.ultActiveT = (P.dur ?? 5) * w.d.durMul;
      if (u.kind === 'shield') p.invulnT = Math.max(p.invulnT, p.ultActiveT);
      break;
    }
    case 'vacuum': {
      for (const k of w.pickups) if (!k.dead && (k.kind === 'xp' || k.kind === 'coin')) k.pull = true;
      w.damageMulT = (P.dur ?? 8) * w.d.durMul;
      w.damageMulAmt = P.buff ?? 0.5;
      p.ultActiveT = w.damageMulT;
      break;
    }
    case 'clone': {
      w.fireMulT = (P.dur ?? 6) * w.d.durMul;
      w.fireMul = P.mul ?? 2;
      p.ultActiveT = w.fireMulT;
      break;
    }
  }
  return true;
}

export function updateUlt(w: World) {
  const p = w.player;
  const u = w.ultimate;
  if (w.damageMulT > 0) w.damageMulT -= DT;
  if (w.fireMulT > 0) w.fireMulT -= DT;
  if (p.ultActiveT <= 0) return;
  p.ultActiveT -= DT;
  const P = u.params;
  if (u.kind === 'rain') {
    const rate = P.rate ?? 8;
    if (rand(w.rng) < rate * DT) {
      const x = p.x + randRange(w.rng, -w.viewW / 2, w.viewW / 2);
      const y = p.y + randRange(w.rng, -w.viewH / 2, w.viewH / 2);
      w.blasts.push({
        kind: 'ult', slot: SLOT_ULT, x, y, sx: x, sy: y, t: 0, delay: 0.35, r: (P.radius ?? 70) * w.d.areaMul,
        dmg: ultDamage(w, P.damage ?? 60), knock: 20, puddle: 0, puddleDur: 0, hitCd: 0.5, trigger: 0, life: 0,
        armed: true, sprite: u.icon, color: '#ff5cf0', hostile: false, dead: false, fx: null,
      });
    }
  } else if (u.kind === 'shield') {
    const dmg = ultDamage(w, P.damage ?? 30);
    w.grid.query(p.x, p.y, p.r + 18, e => {
      if (e.dead || e.hitCd[SLOT_ULT] > 0) return;
      e.hitCd[SLOT_ULT] = 0.3;
      damageEnemy(w, e, dmg, SLOT_ULT, { knock: 30, noCrit: true });
    });
  }
}
