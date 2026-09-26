// Rewards, levelling, loot and quest progression.
import { SHARE_R, MAX_LEVEL, INV_MAX } from '../shared/constants.ts';
import { xpNeed } from '../shared/data/xp.ts';
import { xpMul, GOLD_GOBLIN, WORLD_BOSS } from '../shared/data/monsters.ts';
import { makeItem, rollRarity, sellValue, GEAR_SLOTS, slotsUnlocked, RARITY_NAMES, itemName } from '../shared/data/items.ts';
import { TAL_KINDS, TALS } from '../shared/data/talismans.ts';
import { MAIN_QUESTS, BOUNTY_N, bountyReward, type QuestDef } from '../shared/data/quests.ts';
import { CLASSES, unlockedClasses, type UnlockProgress } from '../shared/data/classes.ts';
import { ZONES } from '../shared/data/zones.ts';
import type { GearSlot, Profile, Rarity, TalKind } from '../shared/types.ts';
import type { World } from './world.ts';
import type { Player, Monster } from './entities.ts';
import { ULT_PER_KILL } from './combat.ts';

export function onMonsterKilled(w: World, m: Monster, killer: Player | null): void {
  w.emit({ k: 'die', id: m.id, t: m.t, x: Math.round(m.x), y: Math.round(m.y), el: m.elite ? 1 : undefined }, m.x, m.y);
  if (m.lairIdx >= 0) { w.lairs[m.lairIdx].mon = 0; w.lairs[m.lairIdx].respawnT = 150; }
  if (m.t === WORLD_BOSS) return; // world boss rewards are handled by the event
  // credit: everyone alive nearby + every contributor who is still in the area
  const got = new Set<Player>();
  for (const p of w.players.values()) if (!p.down && p.zone !== 0 && (p.x - m.x) ** 2 + (p.y - m.y) ** 2 < SHARE_R * SHARE_R) got.add(p);
  for (const pid of m.contrib.keys()) { const p = w.players.get(pid); if (p && !p.down && (p.x - m.x) ** 2 + (p.y - m.y) ** 2 < 1600 * 1600) got.add(p); }
  if (killer && !killer.down) got.add(killer);
  const coop = Math.min(4, got.size - 1);
  for (const p of got) reward(w, p, m, coop);
  if (m.boss) {
    const names = [...got].filter(p => (m.contrib.get(p.id) ?? 0) > 0).map(p => p.prof.name);
    w.announce(`${m.def.name} 토벌! ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` 외 ${names.length - 4}명` : ''}`, 'boss');
  }
  if (m.t === GOLD_GOBLIN) w.announce(`황금 도깨비 처치! 금화가 쏟아집니다! (${[...got].map(p => p.prof.name).slice(0, 3).join(', ')})`, 'event');
}

function reward(w: World, p: Player, m: Monster, coop: number): void {
  const d = m.def; const S = p.stats; const pr = p.prof;
  // shared kills: everyone gets credit; per-kill value shrinks with group size but the group bonus caps at +80%
  const share = m.boss || m.t === GOLD_GOBLIN ? 1 : (1 + 0.2 * Math.min(4, coop)) / (1 + coop);
  const mult = (m.summon ? 0.3 : 1) * share; const eliteM = m.elite ? 4 : 1;
  const diff = pr.level - m.lv; const lvPen = diff > 5 ? Math.max(0.15, 1 - 0.15 * (diff - 5)) : 1;
  let xp = Math.round(d.xp * xpMul(m.lv) * eliteM * mult * lvPen * (1 + S.xpPct));
  let gold = Math.round(d.gold * 0.13 * xpMul(m.lv) * (m.elite ? 3 : 1) * mult * (0.8 + w.rng.next() * 0.4) * (1 + S.goldPct));
  if (m.t === GOLD_GOBLIN) gold = Math.round((400 + 90 * m.lv) * (1 + S.goldPct));
  if (m.boss) gold = Math.round(d.gold * (1 + S.goldPct));
  p.ult = Math.min(100, p.ult + ULT_PER_KILL * (m.boss ? 10 : 1));
  pr.stats.kills++;
  const loot: { k: 'loot'; x: number; y: number; g: number; xp: number; it?: number; tl?: number; sh?: number } = { k: 'loot', x: Math.round(m.x), y: Math.round(m.y), g: gold, xp };
  // items
  let items = 0, bonus = 0;
  if (m.boss) { items = 2; bonus = 2; }
  else if (m.t === GOLD_GOBLIN) { items = 1; bonus = 1; }
  else if (m.elite) { items = w.rng.chance(0.35 * share) ? 1 : 0; bonus = 1; }
  else if (!m.summon && w.rng.chance(0.012 * share)) items = 1;
  for (let i = 0; i < items; i++) { const r = giveItem(w, p, Math.max(1, m.lv + w.rng.int(-1, 1)), bonus); loot.it = Math.max(loot.it ?? 0, r); }
  // talismans & shards
  const talChance = m.boss ? 1 : m.elite ? 0.1 * share : m.summon ? 0 : 0.0055 * share;
  if (w.rng.chance(talChance)) { giveTal(w, p, w.rng.pick(TAL_KINDS)); loot.tl = 1; }
  let shards = m.boss ? w.rng.int(3, 6) : m.elite && w.rng.chance(0.2) ? 1 : 0;
  if (shards) { pr.shards += shards; loot.sh = shards; }
  giveGold(p, gold); grantXp(w, p, xp);
  if (!m.summon || m.boss) w.emitTo(p, loot);
  // quests
  questEvent(w, p, 'kill', m.t); questEvent(w, p, 'killZone', d.zone);
  if (m.boss) { questEvent(w, p, 'boss', m.t); withUnlocks(w, p, () => { pr.stats.bosses++; }); }
  if (!m.summon && d.zone >= 1 && d.zone <= 4) {
    const q = pr.quest; if (q.bountyZone !== d.zone) { q.bountyZone = d.zone; q.bountyProg = 0; }
    q.bountyProg++;
    if (q.bountyProg >= BOUNTY_N) {
      q.bountyProg = 0; q.bountyDone++; const r = bountyReward(d.zone, pr.level);
      giveGold(p, r.gold); grantXp(w, p, r.xp); w.toast(p, `현상금 완료! ${ZONES[d.zone].name} · 금화 +${r.gold} · 경험치 +${r.xp}`, '#ffd54a');
    }
    p.questVer++;
  }
}

export const unlockProgress = (pr: Profile): UnlockProgress => ({ level: pr.level, bosses: pr.stats.bosses, worldBoss: pr.stats.worldBoss });
/** Runs `change` (a level up, boss kill...) and announces any class it unlocked. */
let unlockDepth = 0;
export function withUnlocks(w: World, p: Player, change: () => void): void {
  if (unlockDepth > 0 || p.bot) { change(); return; } // nested (quest reward → more xp): the outermost call announces
  const before = unlockedClasses(unlockProgress(p.prof));
  unlockDepth++; try { change(); } finally { unlockDepth--; }
  for (const c of unlockedClasses(unlockProgress(p.prof))) if (!before.includes(c)) {
    w.emitTo(p, { k: 'unlock', c }); w.toast(p, `새 직업 해금: ${CLASSES[c].name}! 마을에서 전직할 수 있습니다`, CLASSES[c].color);
  }
}

export function giveGold(p: Player, g: number): void { p.prof.gold += g; p.prof.stats.goldEarned += g; }

export function grantXp(w: World, p: Player, xp: number): void {
  const pr = p.prof; if (pr.level >= MAX_LEVEL) return;
  withUnlocks(w, p, () => levelUp(w, p, xp));
}
function levelUp(w: World, p: Player, xp: number): void {
  const pr = p.prof;
  pr.xp += xp; let leveled = false;
  while (pr.level < MAX_LEVEL && pr.xp >= xpNeed(pr.level)) {
    pr.xp -= xpNeed(pr.level); pr.level++; leveled = true;
    const before = slotsUnlocked(pr.level - 1), after = slotsUnlocked(pr.level);
    if (after > before) w.toast(p, `부적 칸 ${after}개 해금! 부적 메뉴에서 장착하세요`, '#ffe066');
  }
  if (pr.level >= MAX_LEVEL) pr.xp = 0;
  if (leveled) {
    w.recompute(p); p.hp = p.stats.maxHp;
    w.emit({ k: 'lvl', p: p.id, l: pr.level }, p.x, p.y);
    if (pr.level % 10 === 0) w.announce(`${pr.name}님이 레벨 ${pr.level}을 달성했습니다!`, 'info');
    questEvent(w, p, 'level', pr.level);
  }
}

export function giveItem(w: World, p: Player, ilvl: number, bonus: number, forced?: Rarity): number {
  const pr = p.prof;
  let rarity = forced ?? rollRarity(w.rng, bonus);
  pr.pity++; if (forced == null && pr.pity >= 45 && rarity < 3) rarity = 3;
  if (rarity >= 3) pr.pity = 0;
  const slot: GearSlot = w.rng.weighted(GEAR_SLOTS, [40, 35, 25]);
  const it = makeItem(w.rng, pr.nextUid++, slot, Math.min(32, ilvl), rarity as Rarity);
  if (rarity === 4) { pr.stats.legendaries++; w.announce(`✨ ${pr.name}님이 전설 장비 [${itemName(it, pr.cls)}]을(를) 얻었습니다!`, 'legend'); }
  const auto = pr.opts?.autoSell ?? -1;
  if (rarity <= auto && !isUpgrade(p, it)) { giveGold(p, sellValue(it)); p.invVer++; return rarity; }
  if (pr.inv.length >= INV_MAX) {
    // bag full: sell the cheapest thing (maybe the new item)
    let worst = it, wi = -1; pr.inv.forEach((x, i) => { if (sellValue(x) < sellValue(worst)) { worst = x; wi = i; } });
    if (wi >= 0) { pr.inv.splice(wi, 1); pr.inv.push(it); }
    giveGold(p, sellValue(worst)); w.toast(p, `가방이 가득 차 ${RARITY_NAMES[worst.rarity]} ${itemName(worst, pr.cls)}을(를) 자동 판매했습니다`, '#ffb36b');
  } else pr.inv.push(it);
  p.invVer++;
  return rarity;
}
function isUpgrade(p: Player, it: { slot: GearSlot; ilvl: number; rarity: number }): boolean {
  const cur = p.prof.equip[it.slot]; return !cur || it.ilvl * (1 + it.rarity * 0.3) > cur.ilvl * (1 + cur.rarity * 0.3);
}
export function giveTal(w: World, p: Player, kind: TalKind | 'start', lv = 1): void {
  const pr = p.prof; const k: TalKind = kind === 'start' ? CLASSES[pr.cls].startTal : kind;
  if (pr.tals.length >= 40) { giveGold(p, 60 * lv); w.toast(p, '부적함이 가득 차 부적을 금화로 바꿨습니다', '#ffb36b'); return; }
  pr.tals.push({ uid: pr.nextUid++, kind: k, lv }); p.talVer++;
  w.toast(p, `부적 획득: ${TALS[k].name} Lv${lv}`, TALS[k].color);
}

// ---------- quests ----------
function curQuest(p: Player): QuestDef | null { return MAIN_QUESTS[p.prof.quest.main] ?? null; }
export function questEvent(w: World, p: Player, kind: QuestDef['kind'], value: number): void {
  const q = curQuest(p); if (!q || q.kind !== kind) return;
  const qs = p.prof.quest;
  switch (kind) {
    case 'kill': case 'killZone': case 'boss': if (value === q.target) qs.prog++; break;
    case 'merge': case 'worldboss': qs.prog++; break;
    default: questCheckState(w, p); return;
  }
  p.questVer++;
  if (qs.prog >= q.n) completeQuest(w, p);
}
/** Re-evaluates quests whose goal is a state (level, equipment, slots...) instead of a counter. */
export function questCheckState(w: World, p: Player): void {
  for (let guard = 0; guard < 5; guard++) {
    const q = curQuest(p); if (!q) return; const pr = p.prof; let ok = false;
    switch (q.kind) {
      case 'level': ok = pr.level >= q.target; break;
      case 'equipCount': ok = GEAR_SLOTS.filter(s => pr.equip[s]).length >= q.target; break;
      case 'slots': ok = pr.slots.filter(s => s != null).length >= q.target; break;
      case 'enhance': ok = GEAR_SLOTS.some(s => (pr.equip[s]?.plus ?? 0) >= q.target); break;
      case 'visit': ok = p.zone === q.target; break;
      default: return;
    }
    if (!ok) return; completeQuest(w, p);
  }
}
function completeQuest(w: World, p: Player): void {
  const q = curQuest(p)!; const pr = p.prof; const r = q.reward; const parts: string[] = [];
  if (r.gold) { giveGold(p, r.gold); parts.push(`금화 ${r.gold}`); }
  if (r.shards) { pr.shards += r.shards; parts.push(`달빛 조각 ${r.shards}`); }
  if (r.item != null) { giveItem(w, p, Math.max(pr.level, 2), 0, r.item); parts.push(`${RARITY_NAMES[r.item]} 장비`); }
  if (r.tal) { giveTal(w, p, r.tal); parts.push('부적'); }
  pr.quest.main++; pr.quest.prog = 0; p.questVer++;
  w.emitTo(p, { k: 'quest', title: `${q.title} 완료!${parts.length ? ' — ' + parts.join(' · ') : ''}`, done: 1 });
  if (r.xp) grantXp(w, p, r.xp);
  questCheckState(w, p);
}
export function onVisitZone(w: World, p: Player, z: number): void {
  if (!p.bot && z >= 1 && z <= 4) {
    const zd = ZONES[z];
    if (p.prof.level < zd.minLv - 2) w.toast(p, `⚠ 위험! ${zd.name}은(는) 권장 Lv${zd.minLv}~${zd.maxLv} 지역입니다`, '#ff7b7b');
  }
  questCheckState(w, p);
}
