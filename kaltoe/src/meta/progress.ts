// 메타 진행: 해금 판정, 복지(영구 강화) 스탯, 업적 평가·보상, 판 정산, 일일 도전·출석
import {
  ACHIEVEMENTS, BALANCE, CHARACTER, CHARACTERS, DAILY_MODIFIERS, LUNCHES, META, META_UPGRADES, PASSIVES, STAGE, STAGES, WEAPON, WEAPONS,
} from '../content';
import type { AchievementDef, ModifierDef, StatBlock, StatKey } from '../content/types';
import { ATTENDANCE_REWARDS, DAILY_CLEAR_REWARD, DAILY_PLAY_REWARD } from '../content/meta';
import { hashStr, makeRng, pick, shuffle } from '../core/rng';
import type { RunConfig, World } from '../sim/types';
import { todayKey, yesterdayKey, type Profile } from '../platform/save';

// ───────────── 해금 ─────────────

export function has(p: Profile, key: string) { return p.unlocked.includes(key); }

export const weaponUnlocked = (p: Profile, id: string) => { const d = WEAPON.get(id); return !!d && (!d.unlockedBy || has(p, `weapon:${id}`)); };
export const passiveUnlocked = (p: Profile, id: string) => { const d = PASSIVES.find(x => x.id === id); return !!d && (!d.unlockedBy || has(p, `passive:${id}`)); };
export const characterUnlocked = (p: Profile, id: string) => { const d = CHARACTER.get(id); return !!d && (!d.unlockedBy || has(p, `character:${id}`)); };
export const characterOwned = (p: Profile, id: string) => { const d = CHARACTER.get(id); return !!d && characterUnlocked(p, id) && (!d.price || p.hired.includes(id)); };
export const stageUnlocked = (p: Profile, id: string) => { const d = STAGE.get(id); return !!d && (!d.unlockedBy || has(p, `stage:${id}`)); };
export const lunchUnlocked = (p: Profile, id: string) => { const d = LUNCHES.find(x => x.id === id); return !!d && (!d.unlockedBy || has(p, `lunch:${id}`)); };
export const metaUnlocked = (p: Profile, id: string) => { const d = META.get(id); return !!d && (!d.unlockedBy || has(p, `meta:${id}`)); };
export const featureUnlocked = (p: Profile, id: string) => has(p, `feature:${id}`);

export function maxHeatFor(p: Profile, stage: string): number {
  if (!featureUnlocked(p, 'heat')) return 0;
  const c = p.heatCleared[stage] ?? -1;
  return Math.min(BALANCE.heatLevels.length, Math.max(1, c + 1));
}

// ───────────── 복지(메타 강화) ─────────────

export function metaCost(id: string, rank: number): number {
  const d = META.get(id);
  if (!d) return Infinity;
  return Math.round(d.baseCost + d.costStep * rank);
}

export function metaStats(p: Profile): StatBlock {
  const s: Partial<Record<StatKey, number>> = {};
  for (const m of META_UPGRADES) {
    const r = Math.min(m.maxRank, p.metaRanks[m.id] ?? 0);
    if (r > 0) s[m.stat] = (s[m.stat] ?? 0) + m.perRank * r;
  }
  return s;
}

export function buyMeta(p: Profile, id: string): boolean {
  const d = META.get(id);
  if (!d || !metaUnlocked(p, id)) return false;
  const r = p.metaRanks[id] ?? 0;
  if (r >= d.maxRank) return false;
  const c = metaCost(id, r);
  if (p.coins < c) return false;
  p.coins -= c;
  p.metaRanks[id] = r + 1;
  p.lifetime.metaRanks++;
  return true;
}

/** 복지 전체 환불(메뉴 제공) */
export function refundMeta(p: Profile): number {
  let back = 0;
  for (const m of META_UPGRADES) {
    const r = p.metaRanks[m.id] ?? 0;
    for (let i = 0; i < r; i++) back += metaCost(m.id, i);
  }
  p.metaRanks = {};
  p.coins += back;
  return back;
}

export function hireCharacter(p: Profile, id: string): boolean {
  const d = CHARACTER.get(id);
  if (!d || !d.price || !characterUnlocked(p, id) || p.hired.includes(id) || p.coins < d.price) return false;
  p.coins -= d.price;
  p.hired.push(id);
  return true;
}

// ───────────── 판 설정 ─────────────

export function buildRunConfig(p: Profile, opts: { char: string; stage: string; heat: number; seed: number; modifiers?: ModifierDef[]; daily?: boolean }): RunConfig {
  return {
    stage: STAGE.get(opts.stage) ?? STAGES[0],
    character: CHARACTER.get(opts.char) ?? CHARACTERS[0],
    seed: opts.seed >>> 0,
    heat: opts.heat,
    modifiers: opts.modifiers ?? [],
    meta: metaStats(p),
    unlockedWeapons: new Set(WEAPONS.filter(w => weaponUnlocked(p, w.id)).map(w => w.id)),
    unlockedPassives: new Set(PASSIVES.filter(x => passiveUnlocked(p, x.id)).map(x => x.id)),
    unlockedLunches: new Set(LUNCHES.filter(x => lunchUnlocked(p, x.id)).map(x => x.id)),
    daily: !!opts.daily,
    overtimeAllowed: featureUnlocked(p, 'overtime'),
  };
}

export interface DailyInfo { date: string; seed: number; char: string; stage: string; heat: number; modifiers: ModifierDef[] }

const RISKY_FLAGS = ['noHeal', 'oneHp', 'glassCannon'];

export function dailyInfo(p: Profile, date = todayKey()): DailyInfo {
  const seed = hashStr('kaltoe-daily-' + date);
  const r = makeRng(seed);
  const stages = STAGES.filter(s => stageUnlocked(p, s.id));
  const officeCleared = (p.bests.office?.clears ?? 0) > 0;
  // 첫 칼퇴 전에는 극단적 규칙(체력 1·유리 대포)을 빼고, 체력 위험 규칙은 하루에 하나만
  const pool = shuffle(r, DAILY_MODIFIERS.filter(m => officeCleared || (m.id !== 'd_audit' && m.id !== 'd_resign')));
  const risky = (m: ModifierDef) => (m.flags ?? []).some(f => RISKY_FLAGS.includes(f));
  const mods: ModifierDef[] = [];
  for (const m of pool) {
    if (mods.length >= 2) break;
    if (risky(m) && mods.some(risky)) continue;
    mods.push(m);
  }
  // 숨겨진 캐릭터는 해금 전까지 오늘의 업무에 나오지 않는다(잠긴 캐릭터는 '체험 근무')
  const chars = CHARACTERS.filter(c => characterUnlocked(p, c.id) || !(c.unlockedBy && ACHIEVEMENT_HIDDEN(c.unlockedBy)));
  return { date, seed, char: pick(r, chars).id, stage: pick(r, stages.length ? stages : STAGES).id, heat: featureUnlocked(p, 'heat') ? 1 : 0, modifiers: mods };
}

function ACHIEVEMENT_HIDDEN(id: string) { return !!ACHIEVEMENTS.find(a => a.id === id)?.hidden; }

/** 오늘의 업무 재도전은 규칙은 같지만 월급 배율(coinMul)을 빼고 진행 */
export function dailyModifiersFor(p: Profile, info: DailyInfo): ModifierDef[] {
  const rerun = p.daily.date === info.date && p.daily.played;
  return rerun ? info.modifiers.map(m => ({ ...m, coinMul: undefined })) : info.modifiers;
}

// ───────────── 출석 ─────────────

export function checkAttendance(p: Profile): { day: number; coins: number } | null {
  const today = todayKey();
  if (p.attendance.last === today) return null;
  const day = (p.attendance.day % ATTENDANCE_REWARDS.length) + 1;
  const coins = ATTENDANCE_REWARDS[day - 1] ?? 0;
  p.attendance = { last: today, day, total: p.attendance.total + 1 };
  p.coins += coins;
  return { day, coins };
}

// ───────────── 업적 ─────────────

function prog(p: Profile, k: string) { return p.progress[k] ?? 0; }
function bump(p: Profile, k: string, v = 1) { p.progress[k] = prog(p, k) + v; }
function maxp(p: Profile, k: string, v: number) { if (v > prog(p, k)) p.progress[k] = v; }

/** 지표 현재값. live가 있으면 진행 중인 판의 값을 더해 본다(표시·실시간 달성용). */
export function metricValue(p: Profile, a: AchievementDef, live?: World): number {
  const rs = live?.stats_;
  const par = a.param ?? '';
  switch (a.metric) {
    case 'totalKills': return p.lifetime.kills + (rs?.kills ?? 0);
    case 'runKills': return Math.max(prog(p, 'runKills'), rs?.kills ?? 0);
    case 'surviveSec': return Math.max(prog(p, 'surviveSec'), live ? Math.min(live.t, BALANCE.runSeconds) : 0);
    case 'clearStage': return p.bests[par]?.clears ?? 0;
    case 'clearWithChar': return prog(p, `clearWithChar:${par}`);
    case 'reachLevel': return Math.max(prog(p, 'reachLevel'), live?.player.level ?? 0);
    case 'totalEvolves': return p.lifetime.evolves + (rs?.evolves.length ?? 0);
    case 'evolveWeapon': return prog(p, `evolveWeapon:${par}`) + (rs ? evolveHits(rs.evolves, par) : 0);
    case 'weaponMax': return prog(p, `weaponMax:${par}`) + (rs?.maxed.includes(par) ? 1 : 0);
    case 'totalBossKills': return p.lifetime.bossKills + (rs?.bossKills.length ?? 0);
    case 'bossKill': return prog(p, `bossKill:${par}`) + (rs?.bossKills.filter(b => b === par).length ?? 0);
    case 'totalCoins': return p.lifetime.coins + (rs?.coins ?? 0);
    case 'ultUses': return p.lifetime.ultUses + (rs?.ultUses ?? 0);
    case 'runsPlayed': return p.lifetime.runs;
    case 'heatClear': return prog(p, 'heatClear');
    case 'dailyClears': return p.lifetime.dailyClears;
    case 'attendanceDays': return p.attendance.total;
    case 'lunchPick': return prog(p, `lunchPick:${par}`) + (rs?.lunch === par ? 1 : 0);
    case 'overtimeSec': return Math.max(prog(p, 'overtimeSec'), rs?.overtimeSec ?? 0);
    case 'noHitSec': return Math.max(prog(p, 'noHitSec'), rs?.maxNoHit ?? 0, live ? live.player.noHitT : 0);
    case 'chestsOpened': return p.lifetime.chests + (rs?.chests ?? 0);
    case 'weaponKills': return prog(p, `weaponKills:${par}`) + (rs ? weaponKillsOf(rs.weaponKills, par) : 0);
    case 'metaRanks': return p.lifetime.metaRanks;
    case 'lowHpClear': return prog(p, 'lowHpClear');
    case 'runCoins': return Math.max(prog(p, 'runCoins'), rs?.coins ?? 0);
    case 'charLevel': return Math.max(prog(p, `charLevel:${par}`), live && live.cfg.character.id === par ? live.player.level : 0);
    case 'pickupItem': return prog(p, `pickup:${par}`) + (rs?.pickups[par] ?? 0);
  }
  return 0;
}

function evolveHits(list: string[], id: string): number {
  let n = 0;
  for (const e of list) { if (e === id) n++; else { const base = WEAPONS.find(w => w.evolvesTo === e); if (base?.id === id) n++; } }
  return n;
}
function weaponKillsOf(map: Record<string, number>, id: string): number {
  let n = map[id] ?? 0;
  const d = WEAPON.get(id);
  if (d?.evolvesTo) n += map[d.evolvesTo] ?? 0;
  return n;
}

export interface Grant { a: AchievementDef; text: string }

function rewardText(a: AchievementDef): string {
  const r = a.reward;
  switch (r.kind) {
    case 'coins': return `월급 +${r.amount}`;
    case 'weapon': return `무기 해금: ${WEAPON.get(r.id!)?.name ?? r.id}`;
    case 'passive': return `패시브 해금: ${PASSIVES.find(x => x.id === r.id)?.name ?? r.id}`;
    case 'character': return `캐릭터 해금: ${CHARACTER.get(r.id!)?.name ?? r.id}`;
    case 'stage': return `스테이지 해금: ${STAGE.get(r.id!)?.name ?? r.id}`;
    case 'lunch': return `점심 메뉴 해금: ${LUNCHES.find(x => x.id === r.id)?.name ?? r.id}`;
    case 'meta': return `복지 해금: ${META.get(r.id!)?.name ?? r.id}`;
    case 'feature': return r.id === 'daily' ? '기능 해금: 오늘의 업무' : r.id === 'heat' ? '기능 해금: 야근 강도' : r.id === 'overtime' ? '기능 해금: 야근 모드' : `기능 해금: ${r.id}`;
  }
  return '';
}

function grant(p: Profile, a: AchievementDef): Grant {
  p.achievements[a.id] = Date.now();
  const r = a.reward;
  if (r.kind === 'coins') p.coins += r.amount ?? 0;
  else if (r.id) { const key = `${r.kind}:${r.id}`; if (!p.unlocked.includes(key)) p.unlocked.push(key); }
  return { a, text: rewardText(a) };
}

/** 달성한(아직 기록 안 된) 업적을 모두 지급 */
export function evaluateAchievements(p: Profile, live?: World): Grant[] {
  const out: Grant[] = [];
  // 해금이 해금을 부를 수 있어 두 번 돈다
  for (let pass = 0; pass < 2; pass++) {
    for (const a of ACHIEVEMENTS) {
      if (p.achievements[a.id]) continue;
      if (metricValue(p, a, live) >= a.target) out.push(grant(p, a));
    }
  }
  return out;
}

// ───────────── 판 정산 ─────────────

export interface Settlement {
  runCoins: number; clearBonus: number; overtimeBonus: number; dailyBonus: number; total: number;
  grants: Grant[]; newBest: boolean; heatUnlocked: number | null;
}

export function settleRun(p: Profile, w: World): Settlement {
  const rs = w.stats_;
  const stage = w.cfg.stage.id;
  const ch = w.cfg.character.id;
  const cleared = rs.cleared;
  const surv = Math.min(w.t, BALANCE.runSeconds);

  const runCoins = Math.floor(rs.coins);
  const clearBonus = cleared ? Math.round(BALANCE.clearBonus * w.coinMul) : 0;
  const overtimeBonus = Math.round(BALANCE.overtimeCoinPerMin * (rs.overtimeSec / 60) * w.coinMul);
  let dailyBonus = 0;
  const today = todayKey();
  if (w.cfg.daily) {
    if (p.daily.date !== today) p.daily = { ...p.daily, date: today, played: false, cleared: false };
    if (!p.daily.played) { p.daily.played = true; dailyBonus += DAILY_PLAY_REWARD; }
    if (cleared && !p.daily.cleared) {
      p.daily.cleared = true;
      dailyBonus += DAILY_CLEAR_REWARD;
      p.daily.streak = p.daily.lastClear === yesterdayKey() ? p.daily.streak + 1 : 1;
      p.daily.lastClear = today;
      p.lifetime.dailyClears++;
    }
  }
  const total = runCoins + clearBonus + overtimeBonus + dailyBonus;
  p.coins += total;

  // 누적
  const L = p.lifetime;
  L.kills += rs.kills;
  L.bossKills += rs.bossKills.length;
  L.evolves += rs.evolves.length;
  L.coins += total;
  L.ultUses += rs.ultUses;
  L.runs++;
  L.chests += rs.chests;
  L.playSec += w.t;
  if (cleared) L.clears++;

  maxp(p, 'runKills', rs.kills);
  maxp(p, 'surviveSec', surv);
  maxp(p, 'reachLevel', w.player.level);
  maxp(p, 'overtimeSec', rs.overtimeSec);
  maxp(p, 'noHitSec', Math.max(rs.maxNoHit, w.player.noHitT));
  maxp(p, 'runCoins', runCoins);
  maxp(p, `charLevel:${ch}`, w.player.level);
  for (const e of rs.evolves) {
    bump(p, `evolveWeapon:${e}`);
    const base = WEAPONS.find(x => x.evolvesTo === e);
    if (base) bump(p, `evolveWeapon:${base.id}`);
  }
  for (const m of rs.maxed) bump(p, `weaponMax:${m}`);
  for (const b of rs.bossKills) bump(p, `bossKill:${b}`);
  for (const [id, n] of Object.entries(rs.weaponKills)) {
    bump(p, `weaponKills:${id}`, n);
    const base = WEAPONS.find(x => x.evolvesTo === id);
    if (base) bump(p, `weaponKills:${base.id}`, n);
  }
  for (const [k, n] of Object.entries(rs.pickups)) bump(p, `pickup:${k}`, n);
  if (rs.lunch) bump(p, `lunchPick:${rs.lunch}`);

  // 최고 기록
  const b = p.bests[stage] ?? { bestTime: 0, clears: 0, bestHeat: -1, bestKills: 0, bestLevel: 0, bestOvertime: 0 };
  const newBest = surv > b.bestTime || rs.kills > b.bestKills || rs.overtimeSec > b.bestOvertime;
  b.bestTime = Math.max(b.bestTime, surv);
  b.bestKills = Math.max(b.bestKills, rs.kills);
  b.bestLevel = Math.max(b.bestLevel, w.player.level);
  b.bestOvertime = Math.max(b.bestOvertime, rs.overtimeSec);
  let heatUnlocked: number | null = null;
  if (cleared) {
    b.clears++;
    bump(p, `clearWithChar:${ch}`);
    if (w.player.hp / w.d.maxHp < 0.1) bump(p, 'lowHpClear');
    if (!w.cfg.daily) {
      b.bestHeat = Math.max(b.bestHeat, w.cfg.heat);
      const prev = p.heatCleared[stage] ?? -1;
      if (w.cfg.heat > prev) {
        p.heatCleared[stage] = w.cfg.heat;
        if (featureUnlocked(p, 'heat') && w.cfg.heat + 1 <= BALANCE.heatLevels.length) heatUnlocked = w.cfg.heat + 1;
      }
      maxp(p, 'heatClear', w.cfg.heat);
    }
  }
  p.bests[stage] = b;

  // 도감
  for (const wi of w.weapons) {
    if (!p.discovered.weapons.includes(wi.def.id)) p.discovered.weapons.push(wi.def.id);
    const base = WEAPONS.find(x => x.evolvesTo === wi.def.id);
    if (base && !p.discovered.weapons.includes(base.id)) p.discovered.weapons.push(base.id);
  }
  for (const id of w.seenEnemies) if (!p.discovered.enemies.includes(id)) p.discovered.enemies.push(id);
  if (rs.lunch && !p.discovered.lunches.includes(rs.lunch)) p.discovered.lunches.push(rs.lunch);

  p.last = { stage, char: ch, cleared, time: w.t, level: w.player.level, kills: rs.kills, coins: total, date: today };

  const grants = evaluateAchievements(p);
  return { runCoins, clearBonus, overtimeBonus, dailyBonus, total, grants, newBest, heatUnlocked };
}

/** 업적 목록 표시용 진행도 */
export function achievementProgress(p: Profile, a: AchievementDef): { value: number; done: boolean } {
  return { value: metricValue(p, a), done: !!p.achievements[a.id] };
}

export { CHARACTERS, STAGES, META_UPGRADES };
