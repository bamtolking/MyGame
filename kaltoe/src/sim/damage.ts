// 피해 적용·처치·드롭 — 모든 무기/궁극기/장판이 이 함수를 거친다.
import { BALANCE, ENEMY } from '../content';
import type { WeaponStats } from '../content/types';
import { chance, rand, randRange } from '../core/rng';
import type { Enemy, Pickup, PickupKind, World } from './types';
import { spawnEnemy } from './enemies';

export const SLOT_ULT = 6;
export const SLOT_MISC = 7;

export interface HitOpts {
  fx?: WeaponStats | null;
  knock?: number;
  kx?: number; ky?: number;     // 넉백 방향(정규화 안 해도 됨)
  noCrit?: boolean;
  flat?: boolean;                // might 미적용(화상 등)
  quiet?: boolean;               // 피해 숫자 표시 안 함
}

export function damageEnemy(w: World, e: Enemy, raw: number, slot: number, o: HitOpts = {}): number {
  if (e.dead || raw <= 0) return 0;
  let dmg = raw;
  let crit = false;
  if (!o.flat) {
    dmg *= w.d.mightMul;
    if (w.damageMulT > 0) dmg *= 1 + w.damageMulAmt;
    if (!o.noCrit && rand(w.rng) < w.d.crit + (o.fx?.critBonus ?? 0)) { crit = true; dmg *= BALANCE.critMul; }
  }
  const armor = e.def.armor ?? 0;
  if (armor > 0) dmg = Math.max(dmg * 0.25, dmg - armor);
  let dealt = dmg;
  if (e.shield > 0) {
    const a = Math.min(e.shield, dmg);
    e.shield -= a; dmg -= a;
  }
  e.hp -= dmg;
  e.flash = 0.12;
  e.lastHitSlot = slot;
  if (!o.quiet) w.events.push({ t: 'hit', x: e.x, y: e.y - e.r, dmg: dealt, crit, uid: e.uid });
  const wi = slot < 6 ? w.weapons.find(x => x.slot === slot) : undefined;
  if (wi) wi.dmg += dealt;

  const fx = o.fx;
  if (fx) {
    if (fx.slow && fx.slow > 0) {
      const amt = e.boss ? fx.slow * 0.5 : fx.slow;
      if (amt >= e.slowAmt || e.slowT <= 0) e.slowAmt = amt;
      e.slowT = Math.max(e.slowT, fx.slowDur ?? 1);
    }
    if (fx.burnDps && fx.burnDps > 0) {
      e.burnDps = Math.max(e.burnDps, fx.burnDps * w.d.mightMul);
      e.burnT = Math.max(e.burnT, fx.burnDur ?? 2);
    }
    if (fx.freezeChance && !e.boss && rand(w.rng) < fx.freezeChance) e.freezeT = Math.max(e.freezeT, e.elite ? 0.5 : 1.2);
    if (fx.lifesteal && fx.lifesteal > 0 && !w.flags.has('noHeal')) {
      // 다단히트 무기의 흡혈 폭주 방지: 초당 최대 체력의 4%까지
      const heal = Math.min(dealt * fx.lifesteal, w.lsBudget);
      if (heal > 0) { w.lsBudget -= heal; w.player.hp = Math.min(w.d.maxHp, w.player.hp + heal); }
    }
    if (fx.execute && !e.boss && !e.elite && e.hp > 0 && e.hp / e.maxHp <= fx.execute) e.hp = 0;
  }
  const knock = o.knock ?? 0;
  if (knock > 0 && !e.boss) {
    const res = e.def.knockbackResist ?? 0;
    let kx = o.kx ?? (e.x - w.player.x), ky = o.ky ?? (e.y - w.player.y);
    const L = Math.hypot(kx, ky) || 1;
    kx /= L; ky /= L;
    const f = knock * 11 * (1 - res) * (e.elite ? 0.3 : 1);
    e.vx += kx * f; e.vy += ky * f;
  }
  if (e.hp <= 0) killEnemy(w, e, slot);
  return dealt;
}

export function addPickup(w: World, kind: PickupKind, x: number, y: number, value: number, bossChest = false): Pickup {
  // 보석이 너무 많으면 기존 보석에 합친다(성능)
  if (kind === 'xp') {
    if (w.gemCount > 380) {
      for (let tries = 0; tries < 6; tries++) {
        const p = w.pickups[Math.floor(rand(w.fxRng) * w.pickups.length)];
        if (p && p.kind === 'xp' && !p.dead) { p.value += value; return p; }
      }
    }
  }
  const p: Pickup = { kind, x, y, value, vx: 0, vy: 0, pull: false, t: 0, dead: false, bossChest, pt: 0 };
  if (kind === 'xp') w.gemCount++;
  if (kind !== 'xp') { const a = rand(w.fxRng) * Math.PI * 2; p.vx = Math.cos(a) * 60; p.vy = Math.sin(a) * 60; }
  w.pickups.push(p);
  return p;
}

export function killEnemy(w: World, e: Enemy, slot: number) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  const rs = w.stats_;
  rs.kills++;
  const wi = slot < 6 ? w.weapons.find(x => x.slot === slot) : undefined;
  if (wi) { wi.kills++; rs.weaponKills[wi.def.id] = (rs.weaponKills[wi.def.id] ?? 0) + 1; }
  if (w.player.ultActiveT <= 0) {
    // 사용할수록 충전이 조금씩 느려짐(후반 무한 궁극기 방지)
    const dim = 1 / (1 + rs.ultUses * 0.12);
    w.player.ult = Math.min(w.player.ultMax, w.player.ult + (e.boss ? 50 : e.elite ? 20 : 1) * w.d.ultMul * dim);
  }
  w.events.push({ t: 'kill', x: e.x, y: e.y, elite: e.elite, boss: e.boss, id: e.def.id });

  // 경험치
  if (e.xp > 0) addPickup(w, 'xp', e.x, e.y, e.xp * w.xpMul);
  // 코인
  const cc = e.def.coinChance ?? BALANCE.coinChance;
  if (!e.elite && !e.boss && chance(w.rng, cc)) addPickup(w, 'coin', e.x + 6, e.y, BALANCE.coinValue);
  // 엘리트/보스
  if (e.elite) {
    rs.eliteKills++;
    addPickup(w, 'chest', e.x, e.y, 0);
    for (let i = 0; i < 4; i++) addPickup(w, 'coin', e.x + randRange(w.fxRng, -20, 20), e.y + randRange(w.fxRng, -20, 20), BALANCE.eliteCoins / 4);
    w.hitStop = Math.max(w.hitStop, 0.06);
  }
  if (e.boss) {
    rs.bossKills.push(e.def.id);
    addPickup(w, 'chest', e.x, e.y, 0, true);
    for (let i = 0; i < 8; i++) addPickup(w, 'coin', e.x + randRange(w.fxRng, -40, 40), e.y + randRange(w.fxRng, -40, 40), BALANCE.bossCoins / 8);
    w.hitStop = Math.max(w.hitStop, 0.35);
    if (w.bossAlive === e) w.bossAlive = null;
    w.events.push({ t: 'bossDead', name: e.def.name });
    if (e.def.id === w.cfg.stage.finalBoss) w.finalBossDead = true;
    // 다른 살아있는 보스가 있으면 체력바를 넘긴다
    for (const o of w.enemies) if (!o.dead && o.boss) { w.bossAlive = o; break; }
  }
  // 아이템
  if (!e.boss) {
    const pc = BALANCE.pickups;
    const L = w.d.luck;
    const r = rand(w.rng);
    let acc = 0;
    const table: [PickupKind, number][] = [
      ['coffee', pc.coffee], ['chicken', pc.chicken], ['magnet', pc.magnet], ['bomb', pc.bomb], ['clock', pc.clock],
    ];
    for (const [k, p] of table) {
      acc += p * L * (e.elite ? 8 : 1);
      if (r < acc) {
        const kind: PickupKind = w.flags.has('noHeal') && (k === 'coffee' || k === 'chicken') ? 'coin' : k;
        addPickup(w, kind, e.x, e.y, kind === 'coin' ? BALANCE.coinValue * 3 : 0);
        break;
      }
    }
  }
  // 분열
  if (e.def.split) {
    const child = ENEMY.get(e.def.split.into);
    if (child) {
      const n = e.def.split.count;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(w.fxRng);
        const c = spawnEnemy(w, child, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, e.maxHp / Math.max(1, e.def.hp));
        c.vx = Math.cos(a) * 120; c.vy = Math.sin(a) * 120;
        c.spawnT = 0;
      }
    }
  }
}
