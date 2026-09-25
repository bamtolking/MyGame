// 레벨업 선택지·상자·진화·점심 메뉴
import { BALANCE, LUNCHES, PASSIVE, PASSIVES, WEAPON, WEAPONS } from '../content';
import type { LunchDef, PassiveDef, WeaponDef } from '../content/types';
import { chance, rand, shuffle } from '../core/rng';
import type { ChestResult, LevelChoice, WeaponInst, World } from './types';
import { maxLevelOf, recalcBase, recalcStats, weaponStatsAt } from './stats';
import { healPlayer } from './player';

export function addWeapon(w: World, def: WeaponDef): WeaponInst | null {
  if (w.weapons.length >= BALANCE.maxWeapons) return null;
  const used = new Set(w.weapons.map(x => x.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  const wi: WeaponInst = {
    def, slot, level: 1, st: weaponStatsAt(def, 1), cd: 0.3, burst: 0, burstT: 0, on: 0,
    angle: rand(w.fxRng) * Math.PI * 2, drones: [], dmg: 0, kills: 0,
  };
  w.weapons.push(wi);
  return wi;
}

export function addPassive(w: World, def: PassiveDef) {
  if (w.passives.length >= BALANCE.maxPassives) return;
  w.passives.push({ def, level: 1 });
  recalcStats(w);
}

function levelUpWeapon(w: World, wi: WeaponInst) {
  const max = maxLevelOf(wi.def);
  if (wi.level >= max) return;
  wi.level++;
  wi.st = weaponStatsAt(wi.def, wi.level);
  if (wi.level >= max) {
    wi.maxedAt = w.t;
    if (!w.stats_.maxed.includes(wi.def.id)) w.stats_.maxed.push(wi.def.id);
    if (wi.def.evolvesTo && wi.def.evolveWith) {
      const has = w.passives.some(p => p.def.id === wi.def.evolveWith);
      const pair = PASSIVE.get(wi.def.evolveWith);
      const pn = pair ? `${pair.icon} ${pair.name}` : '짝 패시브';
      w.events.push({ t: 'toast', text: has ? `${wi.def.name} 최대 레벨! ${pn} 보유 — 엘리트 상자를 열면 진화` : `${wi.def.name} 최대 레벨! ${pn}을(를) 얻고 상자를 열면 진화`, kind: 'good' });
      w.events.push({ t: 'maxed', id: wi.def.id });
    }
  }
}

function weaponUnlocked(w: World, def: WeaponDef) {
  return w.cfg.unlockedWeapons.has(def.id) || def.id === w.cfg.character.startWeapon;
}

function ownsWeaponLine(w: World, def: WeaponDef) {
  return w.weapons.some(x => x.def.id === def.id || x.def.id === def.evolvesTo);
}

export function buildChoices(w: World): LevelChoice[] {
  const opts: { c: LevelChoice; wt: number }[] = [];
  for (const wi of w.weapons) {
    if (wi.level < maxLevelOf(wi.def)) {
      opts.push({ c: { kind: 'weapon', id: wi.def.id, level: wi.level + 1, desc: wi.def.levels[wi.level - 1]?.desc ?? '강화' }, wt: 2.2 });
    }
  }
  if (w.weapons.length < BALANCE.maxWeapons) {
    for (const def of WEAPONS) {
      if (def.evolved || !weaponUnlocked(w, def) || ownsWeaponLine(w, def) || w.banished.has(def.id)) continue;
      opts.push({ c: { kind: 'newWeapon', id: def.id, level: 1, desc: def.desc }, wt: w.weapons.length < 3 ? 1.5 : 1.0 });
    }
  }
  for (const pi of w.passives) {
    if (pi.level < pi.def.maxLevel) {
      opts.push({ c: { kind: 'passive', id: pi.def.id, level: pi.level + 1, desc: pi.def.desc }, wt: 1.0 });
    }
  }
  if (w.passives.length < BALANCE.maxPassives) {
    for (const def of PASSIVES) {
      if (def.unlockedBy && !w.cfg.unlockedPassives.has(def.id)) continue;
      if (w.passives.some(p => p.def.id === def.id) || w.banished.has(def.id)) continue;
      opts.push({ c: { kind: 'newPassive', id: def.id, level: 1, desc: def.desc }, wt: w.passives.length >= 3 ? 0.6 : 0.85 });
    }
  }
  let n = BALANCE.choices;
  if (chance(w.rng, BALANCE.fourthChoiceLuck * Math.max(0, w.stats.luck))) n++;
  const out: LevelChoice[] = [];
  const pool = opts.slice();
  while (out.length < n && pool.length) {
    let total = 0;
    for (const o of pool) total += o.wt;
    let r = rand(w.rng) * total;
    let idx = 0;
    for (; idx < pool.length; idx++) { r -= pool[idx].wt; if (r < 0) break; }
    idx = Math.min(idx, pool.length - 1);
    out.push(pool[idx].c);
    pool.splice(idx, 1);
  }
  if (!out.length) {
    out.push({ kind: 'heal', id: '', level: 0, desc: '체력 30% 회복' });
    out.push({ kind: 'coins', id: '', level: 0, desc: '월급 +25' });
  }
  return out;
}

export function openLevelUp(w: World) {
  w.choices = buildChoices(w);
  // 더 고를 게 없으면(전부 최대) 창을 띄우지 않고 자동으로 회복+월급
  if (w.choices.every(c => c.kind === 'heal' || c.kind === 'coins')) {
    const n = w.levelQueue;
    healPlayer(w, w.d.maxHp * 0.1 * n);
    w.stats_.coins += 5 * n * w.coinMul;
    w.levelQueue = 0;
    w.choices = [];
    return;
  }
  w.phase = 'levelup';
}

export function applyChoice(w: World, idx: number) {
  const c = w.choices[idx];
  if (!c || w.phase !== 'levelup') return;
  switch (c.kind) {
    case 'newWeapon': { const d = WEAPON.get(c.id); if (d) addWeapon(w, d); break; }
    case 'weapon': { const wi = w.weapons.find(x => x.def.id === c.id); if (wi) levelUpWeapon(w, wi); break; }
    case 'newPassive': { const d = PASSIVES.find(p => p.id === c.id); if (d) addPassive(w, d); break; }
    case 'passive': {
      const pi = w.passives.find(p => p.def.id === c.id);
      if (pi && pi.level < pi.def.maxLevel) { pi.level++; recalcStats(w); }
      break;
    }
    case 'heal': healPlayer(w, w.d.maxHp * 0.3); break;
    case 'coins': w.stats_.coins += 25 * w.coinMul; break;
  }
  finishLevel(w);
}

function finishLevel(w: World) {
  w.levelQueue = Math.max(0, w.levelQueue - 1);
  if (w.levelQueue > 0) w.choices = buildChoices(w);
  else { w.choices = []; w.phase = 'play'; }
}

export function reroll(w: World): boolean {
  if (w.phase !== 'levelup' || w.player.rerolls <= 0) return false;
  w.player.rerolls--;
  w.choices = buildChoices(w);
  return true;
}

export function skipLevel(w: World): boolean {
  if (w.phase !== 'levelup' || w.player.skips <= 0) return false;
  w.player.skips--;
  w.player.xp += w.player.xpNext * 0.1;
  finishLevel(w);
  return true;
}

export function banish(w: World, idx: number): boolean {
  const c = w.choices[idx];
  if (w.phase !== 'levelup' || w.player.banishes <= 0 || !c || !c.id) return false;
  if (c.kind !== 'newWeapon' && c.kind !== 'newPassive') return false;
  w.player.banishes--;
  w.banished.add(c.id);
  w.choices = buildChoices(w);
  return true;
}

// ───────────── 상자 ─────────────

export function evolvable(w: World): WeaponInst[] {
  return w.weapons.filter(wi => {
    const d = wi.def;
    if (!d.evolvesTo || !d.evolveWith || wi.level < maxLevelOf(d)) return false;
    if (!w.passives.some(p => p.def.id === d.evolveWith)) return false;
    return !w.weapons.some(x => x.def.id === d.evolvesTo);
  });
}

export function evolve(w: World, wi: WeaponInst) {
  const to = WEAPON.get(wi.def.evolvesTo ?? '');
  if (!to) return;
  const from = wi.def.id;
  wi.def = to;
  wi.level = 1;
  wi.st = weaponStatsAt(to, 1);
  wi.cd = 0.2; wi.burst = 0; wi.on = 0;
  w.stats_.evolves.push(to.id);
  w.events.push({ t: 'evolve', from, to: to.id });
}

export function openChest(w: World, boss: boolean) {
  const rs = w.stats_;
  rs.chests++;
  const L = w.d.luck;
  let count = 1;
  const r = rand(w.rng);
  if (r < BALANCE.chestMulti.five * L * (boss ? 2 : 1)) count = 5;
  else if (r < (BALANCE.chestMulti.five + BALANCE.chestMulti.three) * L * (boss ? 2 : 1)) count = 3;
  if (boss) count = Math.max(3, count);

  const res: ChestResult = { items: [], coins: 0, boss };
  for (let i = 0; i < count; i++) {
    const evo = evolvable(w);
    if (evo.length) {
      const wi = evo[0];
      const from = wi.def.id;
      evolve(w, wi);
      res.items.push({ kind: 'evolve', id: wi.def.id, from, level: 1 });
      continue;
    }
    const ups: ({ k: 'weapon'; wi: WeaponInst } | { k: 'passive'; i: number })[] = [];
    for (const wi of w.weapons) if (wi.level < maxLevelOf(wi.def)) ups.push({ k: 'weapon', wi });
    w.passives.forEach((p, i) => { if (p.level < p.def.maxLevel) ups.push({ k: 'passive', i }); });
    if (!ups.length) {
      const c = Math.round(20 * w.coinMul);
      res.coins += c;
      res.items.push({ kind: 'coins', id: '', level: c });
      continue;
    }
    shuffle(w.rng, ups);
    const u = ups[0];
    if (u.k === 'weapon') {
      levelUpWeapon(w, u.wi);
      res.items.push({ kind: 'weapon', id: u.wi.def.id, level: u.wi.level });
    } else {
      const p = w.passives[u.i];
      p.level++;
      recalcStats(w);
      res.items.push({ kind: 'passive', id: p.def.id, level: p.level });
    }
  }
  const bonus = Math.round((boss ? 60 : 15) * w.coinMul);
  res.coins += bonus;
  rs.coins += res.coins;
  w.chest = res;
  w.phase = 'chest';
}

export function closeChest(w: World) {
  if (w.phase !== 'chest') return;
  w.chest = null;
  w.phase = 'play';
}

// ───────────── 점심 ─────────────

export function openLunch(w: World) {
  const pool = LUNCHES.filter(l => !l.unlockedBy || w.cfg.unlockedLunches.has(l.id));
  shuffle(w.rng, pool);
  w.lunchChoices = pool.slice(0, 3);
  w.phase = 'lunch';
}

export function applyLunch(w: World, id: string) {
  if (w.phase !== 'lunch') return;
  const l: LunchDef | undefined = w.lunchChoices.find(x => x.id === id);
  if (!l) return;
  w.lunch = l;
  w.stats_.lunch = l.id;
  const p = w.player;
  p.rerolls += Math.floor(l.stats.reroll ?? 0);
  p.skips += Math.floor(l.stats.skip ?? 0);
  p.banishes += Math.floor(l.stats.banish ?? 0);
  p.revivals += Math.floor(l.stats.revival ?? 0);
  recalcBase(w);
  if (l.heal) healPlayer(w, w.d.maxHp * l.heal);
  w.lunchChoices = [];
  w.phase = 'play';
  w.events.push({ t: 'toast', text: `${l.icon} ${l.name} 든든! 오후도 달려봅시다`, kind: 'good' });
}
