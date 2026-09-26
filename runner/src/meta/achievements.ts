// Achievements (업적): 30 in 5 groups, each unlocks exactly one cosmetic (or a title). Judged only when a run ends,
// from the RunState + the save's totals/bests (GDD §9.5). Cosmetics are looks only — never stats.
import type { RunState } from '../sim/types';
import { STAGES } from '../data/stages';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { COMPANIONS, COMPANION_BY_ID } from '../data/companions';
// NOTE: circular import (progress.ts imports this module). Only used inside functions, never at module init.
import { stageCleared, totalStars, type Progress } from './progress';
import { runTrace } from './missions';

export type CosmeticKind = 'hat' | 'trail' | 'jumpSound' | 'palette';
export interface PaletteColors { body: string; shade: string; accent: string; cheek: string }
export interface CosmeticDef {
  id: string; kind: CosmeticKind; name: string;
  charId?: string;               // palettes belong to one character
  price?: number;                // 엽전 (shop items only); otherwise unlocked by an achievement
  colors?: PaletteColors;        // palettes: drop-in replacement for CharacterDef.palette
  color?: string;                // hats / trails: main tint hint for the renderer
}
export interface AchievementDef {
  id: string; group: 'dist' | 'collect' | 'skill' | 'mastery' | 'curious';
  name: string; desc: string; hidden?: boolean; hint?: string;
  reward: string;                          // cosmetic id or 'title:<text>'
  check: (p: Progress, s: RunState) => boolean;
  /** [current, target] for progress bars (current may exceed target) */
  progress?: (p: Progress) => [number, number];
}
export interface AchievementUnlock { id: string; name: string; reward: string }

export const PALETTE_PRICE = 800;
export const GROUP_NAMES: Record<AchievementDef['group'], string> = { dist: '거리', collect: '수집', skill: '기술', mastery: '숙련', curious: '호기심' };
export const COSMETIC_KIND_NAMES: Record<CosmeticKind, string> = { hat: '모자', trail: '발자취', jumpSound: '점프 소리', palette: '색' };

const pal = (body: string, shade: string, accent: string, cheek: string): PaletteColors => ({ body, shade, accent, cheek });
export const COSMETICS: CosmeticDef[] = [
  // hats (12) — all from achievements
  { id: 'hat_gat', kind: 'hat', name: '갓', color: '#2b2b33' },
  { id: 'hat_bokgeon', kind: 'hat', name: '복건', color: '#3a3f6b' },
  { id: 'hat_band', kind: 'hat', name: '머리띠', color: '#e2543f' },
  { id: 'hat_jokduri', kind: 'hat', name: '족두리', color: '#7a3fa0' },
  { id: 'hat_jobawi', kind: 'hat', name: '조바위', color: '#8a2f4a' },
  { id: 'hat_flowerpin', kind: 'hat', name: '꽃핀', color: '#ff8fb1' },
  { id: 'hat_beanie', kind: 'hat', name: '털모자', color: '#e9e2d0' },
  { id: 'hat_pouch', kind: 'hat', name: '복주머니 모자', color: '#e0b43a' },
  { id: 'hat_horns', kind: 'hat', name: '도깨비 뿔', color: '#f2c14e' },
  { id: 'hat_satgat', kind: 'hat', name: '삿갓', color: '#c9a15a' },
  { id: 'hat_crown', kind: 'hat', name: '왕관', color: '#ffd24a' },
  { id: 'hat_laurel', kind: 'hat', name: '월계관', color: '#6fae4f' },
  // trails (8)
  { id: 'trail_star', kind: 'trail', name: '별가루', color: '#fff3a0' },
  { id: 'trail_fire', kind: 'trail', name: '불꽃', color: '#ff7a3a' },
  { id: 'trail_steam', kind: 'trail', name: '김', color: '#f4f4f4' },
  { id: 'trail_lantern', kind: 'trail', name: '등불', color: '#ffb347' },
  { id: 'trail_petal', kind: 'trail', name: '꽃잎', color: '#ffb7c9' },
  { id: 'trail_snow', kind: 'trail', name: '눈송이', color: '#dff3ff' },
  { id: 'trail_rainbow', kind: 'trail', name: '무지개', color: '#8ad0ff' },
  { id: 'trail_coin', kind: 'trail', name: '엽전', color: '#e8b64a' },
  // jump sounds (4)
  { id: 'jump_bell', kind: 'jumpSound', name: '방울' },
  { id: 'jump_drum', kind: 'jumpSound', name: '장구' },
  { id: 'jump_gayageum', kind: 'jumpSound', name: '가야금' },
  { id: 'jump_pop', kind: 'jumpSound', name: '뻥튀기' },
  // palettes (12): «a» from the 「○○로 2,000 m」 achievements, «b» in the 엽전 shop
  { id: 'pal_hotteok_a', kind: 'palette', charId: 'hotteok', name: '흑당 호떡', colors: pal('#8a5a2e', '#5e3b1c', '#2e1a0c', '#ff9a8a') },
  { id: 'pal_bungeo_a', kind: 'palette', charId: 'bungeo', name: '슈크림 붕어빵', colors: pal('#f2d18a', '#c9a45c', '#7a5a2a', '#ffb0a0') },
  { id: 'pal_kkochi_a', kind: 'palette', charId: 'kkochi', name: '간장 떡꼬치', colors: pal('#a8612e', '#7a4118', '#3e200c', '#ffc0a0') },
  { id: 'pal_eomuk_a', kind: 'palette', charId: 'eomuk', name: '매운 어묵', colors: pal('#e0784a', '#b4532e', '#6a2a14', '#ffab9a') },
  { id: 'pal_dalgona_a', kind: 'palette', charId: 'dalgona', name: '초코 달고나', colors: pal('#7a4a2a', '#56321a', '#2a160a', '#ffb08a') },
  { id: 'pal_goguma_a', kind: 'palette', charId: 'goguma', name: '자색 고구마', colors: pal('#9a5fb8', '#6e3e8a', '#3e1f52', '#ffb0c8') },
  { id: 'pal_hotteok_b', kind: 'palette', charId: 'hotteok', name: '씨앗 호떡', price: PALETTE_PRICE, colors: pal('#e0a85a', '#b07a36', '#5a3a14', '#ff9a8a') },
  { id: 'pal_bungeo_b', kind: 'palette', charId: 'bungeo', name: '녹차 붕어빵', price: PALETTE_PRICE, colors: pal('#9cc46a', '#6f9444', '#3a5220', '#ffb0a0') },
  { id: 'pal_kkochi_b', kind: 'palette', charId: 'kkochi', name: '치즈 떡꼬치', price: PALETTE_PRICE, colors: pal('#f2c94a', '#c99a24', '#6e4a10', '#ffc0a0') },
  { id: 'pal_eomuk_b', kind: 'palette', charId: 'eomuk', name: '해물 어묵', price: PALETTE_PRICE, colors: pal('#d9d2c0', '#aaa290', '#5a5448', '#ffab9a') },
  { id: 'pal_dalgona_b', kind: 'palette', charId: 'dalgona', name: '딸기 달고나', price: PALETTE_PRICE, colors: pal('#f28aa0', '#c45a74', '#6a2a3a', '#ffd0d8') },
  { id: 'pal_goguma_b', kind: 'palette', charId: 'goguma', name: '호박 고구마', price: PALETTE_PRICE, colors: pal('#f0a040', '#c47420', '#6a3a0c', '#ffb08a') },
];
export const COSMETIC_BY_ID: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map(c => [c.id, c]));

// ---------------------------------------------------------------- per-run bests (stored in p.bests)
function bests(p: Progress): Record<string, number> {
  if (!p.bests || typeof p.bests !== 'object') p.bests = {};
  return p.bests;
}
function best(p: Progress, k: string): number { return p.bests?.[k] ?? 0; }
function up(b: Record<string, number>, k: string, v: number): void { if (v > (b[k] ?? 0)) b[k] = Math.floor(v); }
/** Distance each character ran in this run (the main until the hand-over, the partner after it). */
export function distByChar(s: RunState): Record<string, number> {
  const out: Record<string, number> = {};
  out[s.mainId] = s.relayUsed ? s.relayStartDist : s.dist;
  if (s.relayUsed && s.partnerId) out[s.partnerId] = Math.max(out[s.partnerId] ?? 0, s.stats.relayDist);
  return out;
}
/** Update the single-run records achievements read (idempotent: max()). Tutorial / trial runs never count. */
export function recordBests(p: Progress, s: RunState): void {
  if (s.trial || s.mode === 'tutorial') return;
  const b = bests(p); const st = s.stats;
  for (const [c, d] of Object.entries(distByChar(s))) up(b, 'dist:' + c, d);
  up(b, 'near', st.nearMisses); up(b, 'lines', st.lines); up(b, 'smash', st.smashed); up(b, 'flow', st.maxFlow);
  up(b, 'relay', st.relayDist); up(b, 'sky', st.bonusJellies);
  if (st.potions + st.miniPotions === 0) up(b, 'noPotionRun', s.dist);
  if (s.mode === 'stage' && s.phase === 'clear' && st.hits + st.shieldsUsed + st.falls === 0) b.cleanStage = 1;
  // hit-free stretch needs a replay unless the run was entirely hit-free; only worth it while it could set a record
  const whole = Math.floor(s.dist);
  if (st.hits + st.shieldsUsed === 0) up(b, 'nohit', whole);
  else if (whole > (b.nohit ?? 0) && !p.achievements?.sk_nohit) up(b, 'nohit', runTrace(s).noHit);
}

// ---------------------------------------------------------------- the 30 achievements
const regularOf = (w: number) => STAGES.filter(s => s.world === w && !s.remix);
const worldDone = (p: Progress, w: number): [number, number] => { const r = regularOf(w); return [r.filter(s => stageCleared(p, s.id)).length, Math.max(1, r.length)]; };
const medalBest = (p: Progress) => Object.values(p.daily ?? {}).reduce((a, d) => Math.max(a, d?.medal ?? 0), 0);
const T = (p: Progress, k: keyof Progress['totals']) => (p.totals?.[k] as number) ?? 0;

type Def = Omit<AchievementDef, 'check' | 'progress'> & { value: (p: Progress) => number; target: number | ((p: Progress) => number) };
const DEFS: Def[] = [
  // 거리 6 — 「○○로 2,000 m」 → that character's alternate palette
  ...CHARACTERS.slice(0, 6).map((c): Def => ({
    id: 'dist_' + c.id, group: 'dist', name: `${c.name} 장거리`, desc: `${c.name}${josaRo(c.name)} 한 판에 2,000 m 달리기`,
    reward: `pal_${c.id}_a`, value: p => best(p, 'dist:' + c.id), target: 2000,
  })),
  // 수집 6
  { id: 'col_jelly', group: 'collect', name: '별사탕 부자', desc: '별사탕 모두 합쳐 10,000개', reward: 'trail_star', value: p => T(p, 'jellies'), target: 10000 },
  { id: 'col_coin', group: 'collect', name: '엽전 꾸러미', desc: '엽전 모두 합쳐 2,000개 줍기', reward: 'trail_coin', value: p => T(p, 'coins'), target: 2000 },
  { id: 'col_line', group: 'collect', name: '한 줄 장인', desc: '한 판에 한 줄 완성 30번', reward: 'hat_flowerpin', value: p => best(p, 'lines'), target: 30 },
  { id: 'col_moon', group: 'collect', name: '떡 부자', desc: '보름달 떡 모두 합쳐 10개', reward: 'trail_lantern', value: p => T(p, 'moonCakes'), target: 10 },
  { id: 'col_honey', group: 'collect', name: '꿀단지 비우기', desc: '꿀물 모두 합쳐 100개 마시기', reward: 'trail_steam', value: p => T(p, 'potions'), target: 100 },
  { id: 'col_pouch', group: 'collect', name: '복주머니 수집가', desc: '황금 복주머니 모두 합쳐 15개', reward: 'hat_pouch', value: p => T(p, 'pouches'), target: 15 },
  // 기술 6 — 아슬아슬, 흐름, 무피격
  { id: 'near_20', group: 'skill', name: '아슬아슬 달인', desc: '아슬아슬 모두 합쳐 20번', reward: 'hat_gat', value: p => T(p, 'nearMisses'), target: 20 },
  { id: 'sk_near_run', group: 'skill', name: '종이 한 장 차이', desc: '한 판에 아슬아슬 15번', reward: 'hat_bokgeon', value: p => best(p, 'near'), target: 15 },
  { id: 'sk_flow', group: 'skill', name: '활활 흐름', desc: '흐름 불꽃 5단계 만들기', reward: 'trail_fire', value: p => best(p, 'flow'), target: 5 },
  { id: 'sk_streak', group: 'skill', name: '끊기지 않는 흐름', desc: '위험물을 100번 연달아 피하기', reward: 'hat_jobawi', value: p => T(p, 'bestStreak'), target: 100 },
  { id: 'sk_nohit', group: 'skill', name: '털끝 하나 안 다치고', desc: '한 번도 안 부딪히고 1,000 m 달리기', reward: 'trail_snow', value: p => best(p, 'nohit'), target: 1000 },
  { id: 'sk_clean', group: 'skill', name: '깔끔한 완주', desc: '골목 지도 스테이지를 한 번도 안 부딪히고 완주', reward: 'hat_beanie', value: p => best(p, 'cleanStage'), target: 1 },
  // 숙련 6 — ★3, 메달, 월드 클리어
  { id: 'ma_star3', group: 'mastery', name: '복주머니 셋', desc: '스테이지 하나에서 ★3 받기', reward: 'hat_jokduri', value: p => (Object.values(p.starMask ?? {}).some(m => (m & 4) === 4) ? 1 : 0), target: 1 },
  { id: 'ma_world1', group: 'mastery', name: '야시장 골목 정복', desc: '월드 1 스테이지 모두 완주', reward: 'hat_band', value: p => worldDone(p, 1)[0], target: p => worldDone(p, 1)[1] },
  { id: 'ma_world3', group: 'mastery', name: '보름달 언덕 너머', desc: '월드 3 스테이지 모두 완주', reward: 'hat_laurel', value: p => worldDone(p, 3)[0], target: p => worldDone(p, 3)[1] },
  { id: 'ma_medal_silver', group: 'mastery', name: '은빛 골목', desc: '오늘의 골목 은메달', reward: 'trail_petal', value: p => Math.min(2, medalBest(p)), target: 2 },
  { id: 'ma_medal_gold', group: 'mastery', name: '금빛 골목', desc: '오늘의 골목 금메달', reward: 'trail_rainbow', value: p => medalBest(p), target: 3 },
  { id: 'ma_all_stars', group: 'mastery', name: '별을 다 모은 밤', desc: '골목 지도의 별 모두 모으기', reward: 'hat_crown', value: p => totalStars(p), target: () => Math.max(1, STAGES.length * 3) },
  // 호기심 6 — 5 hidden, each with a one-line hint
  { id: 'cu_bonus', group: 'curious', name: '보름달이 떴어요', desc: '보름달 잔치 처음 열기', reward: 'jump_bell', value: p => T(p, 'bonusTimes'), target: 1 },
  { id: 'cu_super', group: 'curious', name: '왕보름달', desc: '왕보름달 잔치 열기', hidden: true, hint: '따끈함이 바닥일 때 마지막 글자를 먹으면…', reward: 'jump_gayageum', value: p => T(p, 'superBonus'), target: 1 },
  { id: 'cu_relay', group: 'curious', name: '바통 터치', desc: '이어달리기 주자로 한 판에 1,000 m', hidden: true, hint: '쓰러져도 뒤를 맡아 줄 친구가 있다면…', reward: 'jump_drum', value: p => best(p, 'relay'), target: 1000 },
  { id: 'cu_smash', group: 'curious', name: '와장창', desc: '한 판에 장애물 40개 부수기', hidden: true, hint: '커지거나 빨라지면 무서울 게 없어요', reward: 'hat_satgat', value: p => best(p, 'smash'), target: 40 },
  { id: 'cu_fastfall', group: 'curious', name: '쏙쏙', desc: '빠른 낙하 모두 합쳐 50번', hidden: true, hint: '공중에서 슬라이드를 눌러 보세요', reward: 'jump_pop', value: p => T(p, 'fastFalls'), target: 50 },
  { id: 'cu_nopotion', group: 'curious', name: '달콤함을 참는 법', desc: '꿀물을 한 번도 안 마시고 한 판에 500 m', hidden: true, hint: '가끔은 꿀물을 그냥 지나쳐 보세요', reward: 'hat_horns', value: p => best(p, 'noPotionRun'), target: 500 },
];
function josaRo(word: string): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return '로';
  const jong = c % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';   // no final consonant or ㄹ → 로
}
const targetOf = (d: Def, p: Progress) => (typeof d.target === 'function' ? d.target(p) : d.target);

export const ACHIEVEMENTS: AchievementDef[] = DEFS.map(d => ({
  id: d.id, group: d.group, name: d.name, desc: d.desc, hidden: d.hidden, hint: d.hint, reward: d.reward,
  check: (p: Progress) => d.value(p) >= targetOf(d, p),
  progress: (p: Progress) => [d.value(p), targetOf(d, p)] as [number, number],
}));
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/** Judge achievements after a run was booked (applyRun calls this last). Each unlocks once and grants its cosmetic. */
export function evaluateAchievements(p: Progress, s: RunState): AchievementUnlock[] {
  const got: AchievementUnlock[] = [];
  if (!p.achievements || typeof p.achievements !== 'object') p.achievements = {};
  try { recordBests(p, s); } catch { /* a broken run record must never block booking */ }
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    let ok = false; try { ok = a.check(p, s); } catch { ok = false; }
    if (!ok) continue;
    p.achievements[a.id] = Date.now();
    grantReward(p, a.reward);
    got.push({ id: a.id, name: a.name, reward: a.reward });
  }
  return got;
}
function grantReward(p: Progress, reward: string): void {
  if (reward.startsWith('title:')) { const t = reward.slice(6); if (!p.titles) p.titles = []; if (!p.titles.includes(t)) p.titles.push(t); return; }
  if (!p.cosmetics.owned.includes(reward)) p.cosmetics.owned.push(reward);
}

/** [current, target] for an achievement's progress bar (current is capped at target). Unknown id → [0, 1]. */
export function achievementProgress(p: Progress, id: string): [number, number] {
  const a = ACHIEVEMENT_BY_ID[id]; if (!a || !a.progress) return [0, 1];
  const [c, t] = a.progress(p);
  return [Math.max(0, Math.min(Math.floor(c), t)), t];
}
/** UI card: hidden achievements show only their hint until unlocked. */
export function achievementView(p: Progress, id: string): { id: string; group: string; name: string; desc: string; unlocked: boolean; at: number; progress: [number, number]; reward: CosmeticDef | { id: string; kind: 'title'; name: string } } | null {
  const a = ACHIEVEMENT_BY_ID[id]; if (!a) return null;
  const at = p.achievements?.[id] ?? 0; const unlocked = !!at;
  const secret = a.hidden && !unlocked;
  const reward = a.reward.startsWith('title:') ? { id: a.reward, kind: 'title' as const, name: a.reward.slice(6) } : COSMETIC_BY_ID[a.reward];
  return { id, group: GROUP_NAMES[a.group], name: secret ? '???' : a.name, desc: secret ? (a.hint ?? '???') : a.desc, unlocked, at, progress: achievementProgress(p, id), reward };
}
/** Which achievement unlocks this cosmetic (undefined for shop items). */
export function achievementFor(cosmeticId: string): AchievementDef | undefined { return ACHIEVEMENTS.find(a => a.reward === cosmeticId); }

// ---------------------------------------------------------------- shop + wardrobe
export type ShopResult = { ok: boolean; error?: string };
export function buyCosmetic(p: Progress, id: string): ShopResult {
  const c = COSMETIC_BY_ID[id]; if (!c) return { ok: false, error: '없는 꾸미기' };
  if (p.cosmetics.owned.includes(id)) return { ok: false, error: '이미 있어요' };
  if (!c.price) return { ok: false, error: '업적으로 여는 꾸미기예요' };
  if (p.coins < c.price) return { ok: false, error: `엽전이 ${(c.price - p.coins).toLocaleString('ko-KR')}개 부족해요` };
  p.coins -= c.price; p.cosmetics.owned.push(id);
  return { ok: true };
}
type Slot = 'hat' | 'trail' | 'palette' | 'jumpSound';
/** Wear an owned cosmetic on a character (hats / trails / jump sounds fit everyone; a palette only its own character). */
export function equipCosmetic(p: Progress, charId: string, id: string): ShopResult {
  const c = COSMETIC_BY_ID[id]; if (!c) return { ok: false, error: '없는 꾸미기' };
  if (!CHAR_BY_ID[charId]) return { ok: false, error: '없는 캐릭터' };
  if (!p.cosmetics.owned.includes(id)) return { ok: false, error: '아직 없는 꾸미기예요' };
  if (c.kind === 'palette' && c.charId !== charId) return { ok: false, error: `${CHAR_BY_ID[c.charId ?? '']?.name ?? '다른 캐릭터'} 전용이에요` };
  const e = (p.cosmetics.equipped[charId] ??= {});
  e[c.kind as Slot] = id;
  return { ok: true };
}
export function unequipCosmetic(p: Progress, charId: string, kind: CosmeticKind): void {
  const e = p.cosmetics.equipped[charId]; if (e) delete e[kind as Slot];
}
/** Resolved looks for rendering a character (undefined slots = default look). */
export function equippedFor(p: Progress, charId: string): { hat?: CosmeticDef; trail?: CosmeticDef; palette?: CosmeticDef; jumpSound?: CosmeticDef } {
  const e = p.cosmetics?.equipped?.[charId] ?? {};
  const get = (id?: string) => (id && p.cosmetics.owned.includes(id) ? COSMETIC_BY_ID[id] : undefined);
  return { hat: get(e.hat), trail: get(e.trail), palette: get(e.palette), jumpSound: get(e.jumpSound) };
}

/** Average 엽전 per booked run for this save (fallback: the design target 150). */
export function coinsPerRun(p: Progress): number {
  const runs = p.totals?.runs ?? 0; const earned = p.totals?.coinsEarned ?? 0;
  return runs >= 3 && earned > 0 ? earned / runs : 150;
}
/** "약 N판" shown next to every price (GDD §9.6). 0 = affordable now. */
export function estimateRuns(p: Progress, price: number): number {
  const need = price - p.coins; if (need <= 0) return 0;
  return Math.max(1, Math.ceil(need / Math.max(1, coinsPerRun(p))));
}
export interface ShopItem { kind: 'char' | 'companion' | 'cosmetic'; id: string; name: string; price: number; owned: boolean; affordable: boolean; runs: number; charId?: string }
/** Everything 엽전 can buy (fixed prices, permanent): coin-unlock characters and companions, then the 6 shop palettes. */
export function shopList(p: Progress): ShopItem[] {
  const out: ShopItem[] = [];
  const add = (kind: ShopItem['kind'], id: string, name: string, price: number, owned: boolean, charId?: string) =>
    out.push({ kind, id, name, price, owned, affordable: !owned && p.coins >= price, runs: owned ? 0 : estimateRuns(p, price), charId });
  for (const c of CHARACTERS) if (c.unlock.kind === 'coins') add('char', c.id, c.name, c.unlock.cost, p.unlocked.includes(c.id));
  for (const c of COMPANIONS) if (c.unlock.kind === 'coins') add('companion', c.id, c.name, c.unlock.cost, p.companions.includes(c.id));
  for (const c of COSMETICS) if (c.price) add('cosmetic', c.id, c.name, c.price, p.cosmetics.owned.includes(c.id), c.charId);
  return out;
}
export { COMPANION_BY_ID };
