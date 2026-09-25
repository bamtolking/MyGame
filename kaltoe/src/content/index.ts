// 콘텐츠 레지스트리: 모든 데이터 배열을 모아 id → 정의 맵을 만들고, 상호 참조를 검증한다.
import type {
  WeaponDef, PassiveDef, EnemyDef, StageDef, CharacterDef, UltimateDef, LunchDef,
  MetaUpgradeDef, AchievementDef, ModifierDef, StatKey, FeatureId,
} from './types';
import { WEAPONS } from './weapons';
import { PASSIVES } from './passives';
import { ENEMIES } from './enemies';
import { STAGES } from './stages';
import { CHARACTERS, ULTIMATES } from './characters';
import { LUNCHES } from './lunch';
import { META_UPGRADES } from './meta';
import { ACHIEVEMENTS } from './achievements';
import { DAILY_MODIFIERS } from './modifiers';
import { BALANCE } from './balance';

export { WEAPONS, PASSIVES, ENEMIES, STAGES, CHARACTERS, ULTIMATES, LUNCHES, META_UPGRADES, ACHIEVEMENTS, DAILY_MODIFIERS, BALANCE };

function toMap<T extends { id: string }>(arr: readonly T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.id, x);
  return m;
}

export const WEAPON = toMap<WeaponDef>(WEAPONS);
export const PASSIVE = toMap<PassiveDef>(PASSIVES);
export const ENEMY = toMap<EnemyDef>(ENEMIES);
export const STAGE = toMap<StageDef>(STAGES);
export const CHARACTER = toMap<CharacterDef>(CHARACTERS);
export const ULTIMATE = toMap<UltimateDef>(ULTIMATES);
export const LUNCH = toMap<LunchDef>(LUNCHES);
export const META = toMap<MetaUpgradeDef>(META_UPGRADES);
export const ACHIEVEMENT = toMap<AchievementDef>(ACHIEVEMENTS);
export const MODIFIER = toMap<ModifierDef>([...DAILY_MODIFIERS, ...BALANCE.heatLevels]);

export const STAT_KEYS: readonly StatKey[] = [
  'might', 'area', 'cooldown', 'amount', 'duration', 'projSpeed', 'moveSpeed', 'maxHp', 'armor', 'recovery',
  'magnet', 'luck', 'growth', 'greed', 'curse', 'revival', 'reroll', 'skip', 'banish', 'crit', 'ultCharge',
];
export const FEATURE_IDS: readonly FeatureId[] = ['daily', 'heat', 'overtime'];
export const MODIFIER_FLAGS = ['noHeal', 'bigHead', 'oneHp', 'glassCannon', 'fastClock', 'eliteRush'] as const;

const ZWJ = /‍/;

/** 모든 상호 참조·범위를 검사해 오류 문자열 목록을 돌려준다(비어 있으면 정상). */
export function validateContent(): string[] {
  const errs: string[] = [];
  const dup = (name: string, arr: readonly { id: string }[]) => {
    const seen = new Set<string>();
    for (const x of arr) { if (seen.has(x.id)) errs.push(`${name}: 중복 id ${x.id}`); seen.add(x.id); }
  };
  dup('weapon', WEAPONS); dup('passive', PASSIVES); dup('enemy', ENEMIES); dup('stage', STAGES);
  dup('character', CHARACTERS); dup('ultimate', ULTIMATES); dup('lunch', LUNCHES); dup('meta', META_UPGRADES);
  dup('achievement', ACHIEVEMENTS); dup('modifier', [...DAILY_MODIFIERS, ...BALANCE.heatLevels]);

  const emoji = (where: string, s: string | undefined) => {
    if (s && ZWJ.test(s)) errs.push(`${where}: ZWJ 결합 이모지 금지 (${s})`);
  };
  const stats = (where: string, b: object | undefined) => {
    if (!b) return;
    for (const k of Object.keys(b)) if (!STAT_KEYS.includes(k as StatKey)) errs.push(`${where}: 알 수 없는 스탯 ${k}`);
  };
  const ach = (where: string, id: string | undefined) => {
    if (id && !ACHIEVEMENT.has(id)) errs.push(`${where}: unlockedBy 업적 없음 ${id}`);
  };

  for (const w of WEAPONS) {
    emoji(`weapon ${w.id}`, w.icon); emoji(`weapon ${w.id}`, w.projectile); ach(`weapon ${w.id}`, w.unlockedBy);
    if (!w.evolved && w.levels.length < 1) errs.push(`weapon ${w.id}: levels 비어 있음`);
    if (w.evolveWith && !PASSIVE.has(w.evolveWith)) errs.push(`weapon ${w.id}: evolveWith 패시브 없음 ${w.evolveWith}`);
    if (w.evolvesTo) {
      const e = WEAPON.get(w.evolvesTo);
      if (!e) errs.push(`weapon ${w.id}: evolvesTo 무기 없음 ${w.evolvesTo}`);
      else if (!e.evolved) errs.push(`weapon ${w.id}: evolvesTo ${e.id}가 evolved 아님`);
      if (!w.evolveWith) errs.push(`weapon ${w.id}: evolvesTo 있으나 evolveWith 없음`);
    }
    if (w.base.cooldown <= 0 && w.archetype !== 'aura' && w.archetype !== 'orbit') errs.push(`weapon ${w.id}: cooldown <= 0`);
    if (w.base.hitCooldown <= 0 && ['aura', 'orbit', 'beam', 'boomerang', 'lob'].includes(w.archetype)) errs.push(`weapon ${w.id}: hitCooldown <= 0`);
  }
  for (const w of WEAPONS.filter(w => w.evolved)) {
    if (!WEAPONS.some(b => b.evolvesTo === w.id)) errs.push(`weapon ${w.id}: 진화 무기인데 진화 원본이 없음`);
  }
  for (const p of PASSIVES) { emoji(`passive ${p.id}`, p.icon); stats(`passive ${p.id}`, p.perLevel); ach(`passive ${p.id}`, p.unlockedBy); }

  for (const e of ENEMIES) {
    emoji(`enemy ${e.id}`, e.sprite);
    if (e.split && !ENEMY.has(e.split.into)) errs.push(`enemy ${e.id}: split 대상 없음 ${e.split.into}`);
    if (e.behavior === 'spawner' && !ENEMY.has(String(e.params?.spawnId))) errs.push(`enemy ${e.id}: spawnId 없음 ${e.params?.spawnId}`);
    for (const a of e.abilities ?? []) {
      if ((a.kind === 'summon' || a.kind === 'wall') && !ENEMY.has(String(a.params.enemy))) errs.push(`enemy ${e.id}: ${a.kind} 대상 없음 ${a.params.enemy}`);
    }
    if (e.hp <= 0 || e.radius <= 0) errs.push(`enemy ${e.id}: hp/radius <= 0`);
  }

  for (const s of STAGES) {
    emoji(`stage ${s.id}`, s.icon); ach(`stage ${s.id}`, s.unlockedBy);
    for (const d of s.decor) emoji(`stage ${s.id} decor`, d);
    const segs = [...s.timeline].sort((a, b) => a.from - b.from);
    if (segs.length === 0 || segs[0].from !== 0) errs.push(`stage ${s.id}: 타임라인이 0초에서 시작하지 않음`);
    for (let i = 1; i < segs.length; i++) if (segs[i].from !== segs[i - 1].to) errs.push(`stage ${s.id}: 타임라인 틈/겹침 ${segs[i - 1].to}→${segs[i].from}`);
    if (segs.length && segs[segs.length - 1].to < BALANCE.runSeconds) errs.push(`stage ${s.id}: 타임라인이 ${BALANCE.runSeconds}초까지 덮지 않음`);
    for (const g of segs) for (const p of g.pool) if (!ENEMY.has(p.enemy)) errs.push(`stage ${s.id}: 풀에 없는 적 ${p.enemy}`);
    for (const ev of s.events) {
      if (ev.enemy && !ENEMY.has(ev.enemy)) errs.push(`stage ${s.id}: 이벤트 적 없음 ${ev.enemy} @${ev.at}`);
      if (['swarm', 'ring', 'elite', 'boss', 'burst'].includes(ev.kind) && !ev.enemy) errs.push(`stage ${s.id}: ${ev.kind} 이벤트에 enemy 없음 @${ev.at}`);
    }
    const fb = ENEMY.get(s.finalBoss);
    if (!fb) errs.push(`stage ${s.id}: finalBoss 없음 ${s.finalBoss}`); else if (!fb.boss) errs.push(`stage ${s.id}: finalBoss ${fb.id}가 boss 아님`);
    for (const p of s.overtimePool) if (!ENEMY.has(p.enemy)) errs.push(`stage ${s.id}: 야근 풀에 없는 적 ${p.enemy}`);
  }

  for (const u of ULTIMATES) emoji(`ultimate ${u.id}`, u.icon);
  for (const c of CHARACTERS) {
    ach(`character ${c.id}`, c.unlockedBy); stats(`character ${c.id}`, c.stats); stats(`character ${c.id} growth`, c.growth?.stats);
    if (!WEAPON.has(c.startWeapon)) errs.push(`character ${c.id}: startWeapon 없음 ${c.startWeapon}`);
    else if (WEAPON.get(c.startWeapon)!.evolved) errs.push(`character ${c.id}: startWeapon이 진화 무기`);
    if (!ULTIMATE.has(c.ultimate)) errs.push(`character ${c.id}: ultimate 없음 ${c.ultimate}`);
    emoji(`character ${c.id}`, c.look.accessory);
  }
  for (const l of LUNCHES) { emoji(`lunch ${l.id}`, l.icon); stats(`lunch ${l.id}`, l.stats); ach(`lunch ${l.id}`, l.unlockedBy); }
  for (const m of META_UPGRADES) {
    emoji(`meta ${m.id}`, m.icon); ach(`meta ${m.id}`, m.unlockedBy);
    if (!STAT_KEYS.includes(m.stat)) errs.push(`meta ${m.id}: 알 수 없는 스탯 ${m.stat}`);
  }
  for (const m of [...DAILY_MODIFIERS, ...BALANCE.heatLevels]) {
    emoji(`modifier ${m.id}`, m.icon); stats(`modifier ${m.id}`, m.stats);
    for (const f of m.flags ?? []) if (!(MODIFIER_FLAGS as readonly string[]).includes(f)) errs.push(`modifier ${m.id}: 알 수 없는 flag ${f}`);
  }

  const refOk: Record<string, (id: string) => boolean> = {
    weapon: id => WEAPON.has(id), passive: id => PASSIVE.has(id), character: id => CHARACTER.has(id),
    stage: id => STAGE.has(id), lunch: id => LUNCH.has(id), meta: id => META.has(id),
    feature: id => (FEATURE_IDS as readonly string[]).includes(id),
  };
  const paramRef: Partial<Record<string, (id: string) => boolean>> = {
    clearStage: id => STAGE.has(id), clearWithChar: id => CHARACTER.has(id), evolveWeapon: id => WEAPON.has(id),
    weaponMax: id => WEAPON.has(id), bossKill: id => ENEMY.get(id)?.boss === true, lunchPick: id => LUNCH.has(id),
    weaponKills: id => WEAPON.has(id), charLevel: id => CHARACTER.has(id),
    pickupItem: id => ['coffee', 'chicken', 'magnet', 'bomb', 'clock', 'chest'].includes(id),
  };
  for (const a of ACHIEVEMENTS) {
    emoji(`achievement ${a.id}`, a.icon);
    const r = a.reward;
    if (r.kind === 'coins') { if (!r.amount) errs.push(`achievement ${a.id}: coins 보상에 amount 없음`); }
    else if (!r.id || !refOk[r.kind]?.(r.id)) errs.push(`achievement ${a.id}: 보상 대상 없음 ${r.kind}:${r.id}`);
    const pr = paramRef[a.metric];
    if (pr && (!a.param || !pr(a.param))) errs.push(`achievement ${a.id}: ${a.metric} param 잘못됨 ${a.param}`);
  }
  // 해금 참조 대상이 되는 업적이 실제로 그 대상을 보상으로 주는지(선택적 일관성)
  const rewardOf = new Map<string, string>();
  for (const a of ACHIEVEMENTS) rewardOf.set(a.id, `${a.reward.kind}:${a.reward.id ?? ''}`);
  const checkUnlock = (kind: string, id: string, by?: string) => {
    if (by && rewardOf.get(by) !== `${kind}:${id}`) errs.push(`${kind} ${id}: unlockedBy ${by}의 보상이 ${rewardOf.get(by)} (불일치)`);
  };
  for (const w of WEAPONS) checkUnlock('weapon', w.id, w.unlockedBy);
  for (const p of PASSIVES) checkUnlock('passive', p.id, p.unlockedBy);
  for (const c of CHARACTERS) checkUnlock('character', c.id, c.unlockedBy);
  for (const s of STAGES) checkUnlock('stage', s.id, s.unlockedBy);
  for (const l of LUNCHES) checkUnlock('lunch', l.id, l.unlockedBy);
  for (const m of META_UPGRADES) checkUnlock('meta', m.id, m.unlockedBy);
  return errs;
}
