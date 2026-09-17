// 저장 데이터 직렬화·검증. 렌더링 객체 없이 순수 데이터만 다룬다.
import { SAVE } from '../data/balance';
import { BOARD_SIZE } from './board';
import { newMeta } from './meta';
import type { GameState, MetaState, RunState, Screen } from './types';

export interface SaveBlob {
  v: number;
  savedAt: number;
  screen: Screen;
  meta: MetaState;
  run: RunState | null;
}

export function serializeState(state: GameState, savedAt = Date.now()): string {
  const run = state.run ? { ...state.run, events: [] } : null;
  const blob: SaveBlob = { v: SAVE.version, savedAt, screen: state.screen, meta: state.meta, run };
  return JSON.stringify(blob);
}

export type ParseResult = { ok: true; blob: SaveBlob } | { ok: false; error: string };

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isBool = (x: unknown): x is boolean => typeof x === 'boolean';
const isStr = (x: unknown): x is string => typeof x === 'string';
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function validateMeta(m: unknown): string | null {
  if (!isObj(m)) return 'meta 없음';
  if (!isNum(m.coins) || m.coins < 0) return 'coins';
  if (!isNum(m.seatsBought) || !isNum(m.decorBought) || !isNum(m.staffSpeedLevel)) return '구매 정보';
  if (!Array.isArray(m.layout)) return 'layout';
  for (const f of m.layout) {
    if (!isObj(f) || !isNum(f.id) || !isNum(f.x) || !isNum(f.y) || (f.kind !== 'seat' && f.kind !== 'decor')) return 'layout 항목';
  }
  if (!isNum(m.unlockedDay) || m.unlockedDay < 1 || m.unlockedDay > 5) return 'unlockedDay';
  if (!isObj(m.best)) return 'best';
  if (!isObj(m.settings) || !isNum(m.settings.volume) || !isBool(m.settings.muted)) return 'settings';
  if (!Array.isArray(m.settledRunIds)) return 'settledRunIds';
  return null;
}

function validateRun(r: unknown): string | null {
  if (r === null) return null;
  if (!isObj(r)) return 'run';
  if (!isStr(r.runId) || !isNum(r.dayId) || !isNum(r.seed) || !isNum(r.t)) return 'run 기본값';
  if (r.phase !== 'open' && r.phase !== 'closing' && r.phase !== 'ended') return 'run.phase';
  if (!Array.isArray(r.board) || r.board.length !== BOARD_SIZE) return 'board';
  const ids = new Set<number>();
  for (const c of r.board) {
    if (c === null) continue;
    if (!isObj(c) || !isNum(c.id) || !isNum(c.tier) || !isStr(c.family)) return 'board 항목';
    if (ids.has(c.id)) return 'board 중복 ID';
    ids.add(c.id);
  }
  if (!Array.isArray(r.customers) || !Array.isArray(r.queue) || !Array.isArray(r.seats) || !Array.isArray(r.servingQueue) || !Array.isArray(r.schedule)) return 'run 목록';
  if (!isObj(r.staff) || !isObj(r.staff.pos) || !Array.isArray(r.staff.path)) return 'staff';
  if (!isObj(r.ledger) || !isNum(r.ledger.sales) || !isNum(r.ledger.tips) || !Array.isArray(r.ledger.deliveries)) return 'ledger';
  if (!isObj(r.stats) || !isNum(r.stats.served)) return 'stats';
  if (!isObj(r.rng) || !isNum(r.rng.a)) return 'rng';
  if (!isBool(r.settled) || !isBool(r.startFoodsGiven)) return 'run 플래그';
  // 장부 일관성: 전달 목록 합계 = 판매액/팁
  const sales = (r.ledger.deliveries as Array<{ price?: unknown; tip?: unknown }>).reduce((a, d) => a + (isNum(d.price) ? d.price : NaN), 0);
  const tips = (r.ledger.deliveries as Array<{ price?: unknown; tip?: unknown }>).reduce((a, d) => a + (isNum(d.tip) ? d.tip : NaN), 0);
  if (sales !== r.ledger.sales || tips !== r.ledger.tips) return '장부 불일치';
  return null;
}

export function parseSave(text: string | null): ParseResult {
  if (!text) return { ok: false, error: '저장 데이터가 없어요.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: '저장 데이터를 읽을 수 없어요 (형식 오류).' }; }
  if (!isObj(raw)) return { ok: false, error: '저장 데이터 형식이 잘못됐어요.' };
  if (raw.v !== SAVE.version) return { ok: false, error: `지원하지 않는 저장 버전(${String(raw.v)})이에요.` };
  const em = validateMeta(raw.meta);
  if (em) return { ok: false, error: `저장 데이터 손상: ${em}` };
  const er = validateRun(raw.run ?? null);
  if (er) return { ok: false, error: `영업 데이터 손상: ${er}` };
  const screen = raw.screen;
  if (screen !== 'title' && screen !== 'days' && screen !== 'prep' && screen !== 'run' && screen !== 'result') return { ok: false, error: '화면 정보 손상' };
  const meta = { ...newMeta(), ...(raw.meta as MetaState) };
  const run = (raw.run as RunState | null);
  if (run) run.events = [];
  return { ok: true, blob: { v: raw.v, savedAt: isNum(raw.savedAt) ? raw.savedAt : 0, screen, meta, run } };
}
