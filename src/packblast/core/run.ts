// 한 판(run)의 상태와 확정 행동. 렌더링·DOM 없음. 모든 행동은 상태를 직접 바꾸고 결과를 돌려준다.
import { EQUIPMENT, type EquipId, type Grade } from '../data/equipment';
import { BALANCE, type Difficulty } from '../data/balance';
import { getStages } from '../data/waves';
import { seedRng, rngInt, type RngState } from '../../sim/rng';
import { initialBag, checkPlacement, validateAll, itemCells, cellIndex, type BagGrid, type Item } from './bag';
import { computeLoadout, type Loadout } from './loadout';
import { generateCandidates, type RewardCandidate } from './rewards';
import type { Rot } from './shapes';
import type { BattleResult, BattleStats } from '../combat/types';

export type Phase = 'prep' | 'reward' | 'unlock' | 'battle' | 'result';

export interface BattleSummary {
  stage: number; won: boolean; stats: BattleStats;
  partsGained: number; healed: number; hpBefore: number; hpAfter: number;
}

export interface RunState {
  runId: string;
  seed: number;
  rng: RngState;
  difficulty: Difficulty;
  phase: Phase;
  stage: number;              // 다음(또는 진행 중인) 전투 구간 1..12
  hp: number; maxHp: number; parts: number;
  grid: BagGrid;
  items: Item[];
  nextUid: number;
  reward: { candidates: RewardCandidate[]; refreshUsed: boolean } | null;
  healUsed: boolean;
  pendingUnlock: number;
  lastSummary: BattleSummary | null;
  summarySeen: boolean;
  battle: { seed: number; heal: number; shield: number; stage: number } | null;
  checkpoint: string | null;  // 전투 시작 직전 상태(JSON). 전투 중 이탈 시 여기서 재도전.
  result: { won: boolean; stage: number } | null;
  tutorial: boolean;
  createdAt: number;
  totalDamageTaken: number;
  resultRecorded?: boolean;   // 결과 화면의 기록(도감·최고 구간) 반영 여부
}

export type ActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });
const OK: ActionResult = { ok: true };

export function newSeed(): number { return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0; }

export function createRun(seed: number, difficulty: Difficulty, tutorial: boolean): RunState {
  const s: RunState = {
    runId: `r${seed.toString(36)}${Date.now().toString(36)}`, seed, rng: seedRng(seed), difficulty,
    phase: 'prep', stage: 1, hp: BALANCE.maxHp, maxHp: BALANCE.maxHp, parts: BALANCE.startParts,
    grid: initialBag(), items: [], nextUid: 1, reward: null, healUsed: false, pendingUnlock: 0,
    lastSummary: null, summarySeen: true, battle: null, checkpoint: null, result: null, tutorial, createdAt: Date.now(), totalDamageTaken: 0,
  };
  addItem(s, 'dagger', 1); addItem(s, 'mg', 1); addItem(s, 'medkit', 1);
  if (tutorial) addItem(s, 'battery', 1);
  return s;
}

export function addItem(s: RunState, id: EquipId, grade: Grade, loc: 'bag' | 'bench' = 'bench', x = 0, y = 0, rot: Rot = 0): Item {
  const it: Item = { uid: `i${s.nextUid++}`, id, grade, rot, x, y, loc };
  s.items.push(it);
  return it;
}

export function getItem(s: RunState, uid: string): Item | undefined { return s.items.find(i => i.uid === uid); }
export function bagItems(s: RunState): Item[] { return s.items.filter(i => i.loc === 'bag'); }
export function benchItems(s: RunState): Item[] { return s.items.filter(i => i.loc === 'bench'); }
export function loadoutOf(s: RunState): Loadout { return computeLoadout(s.items, s.grid); }
export function stageDef(s: RunState) { return getStages(s.difficulty)[s.stage - 1]; }

function editable(s: RunState): ActionResult { return s.phase === 'prep' ? OK : fail('정리 단계에서만 가능합니다'); }

/** 장비를 가방의 (x,y)에 rot 회전으로 놓는다(작업대→가방, 가방 내 이동 모두). 실패해도 장비는 사라지지 않는다. */
export function placeItem(s: RunState, uid: string, x: number, y: number, rot: Rot): ActionResult {
  const e = editable(s); if (!e.ok) return e;
  const it = getItem(s, uid); if (!it) return fail('장비를 찾을 수 없습니다');
  const chk = checkPlacement(s.grid, s.items, it.id, rot, x, y, uid);
  if (!chk.ok) return fail('놓을 수 없음: ' + chk.reasons.join(', '));
  it.x = x; it.y = y; it.rot = rot; it.loc = 'bag';
  return OK;
}

export function toBench(s: RunState, uid: string): ActionResult {
  const e = editable(s); if (!e.ok) return e;
  const it = getItem(s, uid); if (!it) return fail('장비를 찾을 수 없습니다');
  it.loc = 'bench'; it.x = 0; it.y = 0;
  return OK;
}

export function mergePartners(s: RunState, uid: string): Item[] {
  const it = getItem(s, uid); if (!it || it.grade >= 3) return [];
  return s.items.filter(o => o.uid !== uid && o.id === it.id && o.grade === it.grade);
}

/** 같은 종류·같은 등급 2개 → keep의 등급 +1, consume 삭제. keep의 위치가 유효한지 확인하고 실패 시 되돌린다. */
export function mergeItems(s: RunState, keepUid: string, consumeUid: string): ActionResult {
  const e = editable(s); if (!e.ok) return e;
  const a = getItem(s, keepUid), b = getItem(s, consumeUid);
  if (!a || !b || a === b) return fail('합성할 장비를 찾을 수 없습니다');
  if (a.id !== b.id) return fail('같은 종류만 합성할 수 있습니다');
  if (a.grade !== b.grade) return fail('같은 등급만 합성할 수 있습니다');
  if (a.grade >= 3) return fail('3등급은 최고 등급입니다');
  // 가방 장비를 우선 유지 (결과 위치 유효성 보장)
  const keep = a.loc === 'bag' || b.loc !== 'bag' ? a : b;
  const consume = keep === a ? b : a;
  const idx = s.items.indexOf(consume);
  s.items.splice(idx, 1);
  const prevGrade = keep.grade;
  keep.grade = (keep.grade + 1) as Grade;
  if (keep.loc === 'bag') {
    const chk = checkPlacement(s.grid, s.items, keep.id, keep.rot, keep.x, keep.y, keep.uid);
    if (!chk.ok) { keep.grade = prevGrade; s.items.splice(idx, 0, consume); return fail('합성 결과를 놓을 수 없습니다'); }
  }
  return OK;
}

export function dismantleRefund(grade: Grade): number { return BALANCE.dismantleRefund[grade - 1]; }

export function dismantleItem(s: RunState, uid: string): ActionResult & { refund?: number } {
  const e = editable(s); if (!e.ok) return e;
  const it = getItem(s, uid); if (!it) return fail('장비를 찾을 수 없습니다');
  const refund = dismantleRefund(it.grade);
  s.items.splice(s.items.indexOf(it), 1);
  s.parts += refund;
  return { ok: true, refund };
}

export function canHeal(s: RunState): { ok: boolean; reason?: string } {
  if (s.phase !== 'prep') return { ok: false, reason: '정리 단계에서만' };
  if (s.healUsed) return { ok: false, reason: '이번 정비에서 이미 회복함' };
  if (s.parts < BALANCE.healCost) return { ok: false, reason: `부품 부족 (${BALANCE.healCost} 필요)` };
  if (s.hp >= s.maxHp) return { ok: false, reason: '체력이 가득 참' };
  return { ok: true };
}
export function heal(s: RunState): ActionResult & { healed?: number } {
  const c = canHeal(s); if (!c.ok) return fail(c.reason!);
  const amt = Math.min(s.maxHp - s.hp, Math.round(s.maxHp * BALANCE.healRatio));
  s.hp += amt; s.parts -= BALANCE.healCost; s.healUsed = true;
  return { ok: true, healed: amt };
}

export function pickReward(s: RunState, index: number): ActionResult & { item?: Item } {
  if (s.phase !== 'reward' || !s.reward) return fail('보상 단계가 아닙니다');
  const c = s.reward.candidates[index]; if (!c) return fail('후보가 없습니다');
  const it = addItem(s, c.id, c.grade, 'bench');
  s.reward = null; s.phase = 'prep'; s.healUsed = false;
  return { ok: true, item: it };
}

export function refreshReward(s: RunState): ActionResult {
  if (s.phase !== 'reward' || !s.reward) return fail('보상 단계가 아닙니다');
  if (s.reward.refreshUsed) return fail('새로고침은 보상마다 1회');
  if (s.parts < BALANCE.refreshCost) return fail(`부품 부족 (${BALANCE.refreshCost} 필요)`);
  s.parts -= BALANCE.refreshCost;
  s.reward = { candidates: generateCandidates(s.rng, s.stage, s.items), refreshUsed: true };
  return OK;
}

export function lockedCells(s: RunState): number[] { return s.grid.locked.map((l, i) => (l ? i : -1)).filter(i => i >= 0); }

/** 4구간 정예 후: 잠긴 칸 중 n칸 선택 해금. */
export function chooseUnlock(s: RunState, indices: number[]): ActionResult {
  if (s.phase !== 'unlock') return fail('해금 단계가 아닙니다');
  if (indices.length !== s.pendingUnlock) return fail(`${s.pendingUnlock}칸을 선택하세요`);
  if (new Set(indices).size !== indices.length) return fail('같은 칸을 두 번 선택했습니다');
  for (const i of indices) if (!s.grid.locked[i]) return fail('잠긴 칸이 아닙니다');
  for (const i of indices) s.grid.locked[i] = false;
  s.pendingUnlock = 0;
  enterReward(s);
  return OK;
}

function enterReward(s: RunState): void {
  s.reward = { candidates: generateCandidates(s.rng, s.stage, s.items), refreshUsed: false };
  s.phase = 'reward';
}

export interface StartCheck { ok: boolean; reasons: string[]; bench: Item[]; benchRefund: number }
export function checkStart(s: RunState): StartCheck {
  const reasons: string[] = [];
  if (s.phase !== 'prep') reasons.push('정리 단계가 아닙니다');
  const bag = bagItems(s);
  if (!bag.some(i => EQUIPMENT[i.id].weapon)) reasons.push('공격 가능한 무기를 가방에 최소 1개 넣어야 합니다');
  const v = validateAll(s.grid, s.items);
  if (!v.ok) reasons.push('배치가 유효하지 않은 장비가 있습니다');
  const bench = benchItems(s);
  return { ok: reasons.length === 0, reasons, bench, benchRefund: bench.reduce((a, i) => a + dismantleRefund(i.grade), 0) };
}

/**
 * 가방을 닫고 출발. 작업대에 장비가 남아 있으면 dismantleBench=true일 때만 분해하고 진행한다.
 * 전투 시작 체크포인트(정리 상태)를 저장하고 전투에서 쓸 값(보호막·회복량·시드)을 확정한다.
 */
export function startBattle(s: RunState, dismantleBench: boolean): ActionResult & { loadout?: Loadout } {
  const chk = checkStart(s);
  if (!chk.ok) return fail(chk.reasons.join(' / '));
  if (chk.bench.length > 0) {
    if (!dismantleBench) return fail('작업대에 장비가 남아 있습니다');
    for (const it of chk.bench) dismantleItem(s, it.uid);
  }
  const lo = computeLoadout(s.items, s.grid);
  const seed = rngInt(s.rng, 0x7fffffff);
  s.battle = { seed, heal: lo.heal, shield: lo.shield, stage: s.stage };
  s.lastSummary = null; s.summarySeen = true;
  const snap: RunState = { ...s, phase: 'prep', checkpoint: null, battle: null, grid: { ...s.grid, locked: [...s.grid.locked] }, items: s.items.map(i => ({ ...i })), rng: { ...s.rng } };
  s.checkpoint = JSON.stringify(snap);
  s.phase = 'battle';
  return { ok: true, loadout: lo };
}

/** 전투 결과 확정. phase가 battle일 때 한 번만 적용된다(새로고침·중복 호출 안전). */
export function applyBattleResult(s: RunState, r: BattleResult): ActionResult {
  if (s.phase !== 'battle' || !s.battle) return fail('전투 중이 아닙니다');
  const hpBefore = s.hp;
  s.hp = Math.max(0, Math.min(s.maxHp, Math.round(r.hpAfter)));
  s.totalDamageTaken += r.stats.damageTaken;
  const def = stageDef(s);
  let partsGained = 0, healed = 0;
  if (r.won) {
    partsGained = def.kind === 'elite' ? BALANCE.rewardParts.elite : def.kind === 'boss' ? 0 : BALANCE.rewardParts.normal;
    s.parts += partsGained;
    healed = Math.min(s.maxHp - s.hp, s.battle.heal);
    s.hp += healed;
  }
  s.lastSummary = { stage: s.stage, won: r.won, stats: r.stats, partsGained, healed, hpBefore, hpAfter: s.hp };
  s.summarySeen = false;
  s.checkpoint = null;
  const stage = s.battle.stage;
  s.battle = null;
  if (!r.won || s.hp <= 0) { s.phase = 'result'; s.result = { won: false, stage }; return OK; }
  if (stage >= BALANCE.stages) { s.phase = 'result'; s.result = { won: true, stage }; return OK; }
  s.stage = stage + 1;
  const unlockN = BALANCE.unlockAfterStage[stage];
  const locked = lockedCells(s);
  if (unlockN && locked.length > 0) {
    if (locked.length <= unlockN) { for (const i of locked) s.grid.locked[i] = false; enterReward(s); }
    else { s.pendingUnlock = Math.min(unlockN, locked.length); s.phase = 'unlock'; }
  } else enterReward(s);
  return OK;
}

/** 전투 중 이탈 후 복귀: 체크포인트(전투 시작 직전)로 되돌린다. */
export function restoreCheckpoint(s: RunState): RunState | null {
  if (!s.checkpoint) return null;
  try { const c = JSON.parse(s.checkpoint) as RunState; c.phase = 'prep'; c.checkpoint = null; c.battle = null; return c; } catch { return null; }
}

export function cellIsLocked(s: RunState, x: number, y: number): boolean { return !!s.grid.locked[cellIndex(x, y, s.grid.size)]; }
export { itemCells };
