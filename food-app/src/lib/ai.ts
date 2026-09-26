// Claude(sample 기능) 연동: DB에 없는 식품을 같은 형식으로 분석하고, 식품·성분에 대해 질문에 답한다.
// claude.ai에서 열었을 때만 동작하고, 그 밖(파일로 연 경우 등)에서는 기능을 숨긴다.
import { COMPOUND_CATALOG, COMPOUND_IDS, type CompoundId } from '../data/catalog';
import { NUTRIENTS, NUTRIENT_IDS } from '../data/nutrients';
import type { Effect, Evidence, FoodCategory, Nutrients, Pathway, Step, Verdict } from '../data/types';
import { normalize } from './search';

export interface AiCompoundRef {
  id?: CompoundId;
  name: string;
  amount?: string;
  role: string;
  effect?: Effect;
  pathway?: Pathway;
}

export interface AiFood {
  key: string;
  query: string;
  createdAt: number;
  name: string;
  en: string;
  emoji: string;
  category: FoodCategory;
  summary: string;
  verdict: { tone: Verdict; text: string };
  basis: string;
  serving: { label: string; grams: number };
  nutrients: Nutrients;
  compounds: AiCompoundRef[];
  howToEat: Step[];
  pairings: { good: string[]; avoid: string[] };
  cautions: string[];
  myths: { claim: string; truth: string }[];
}

export type AiResult = { ok: true; food: AiFood } | { ok: false; notFood: true; message: string };

interface SampleOptions {
  onText?: (u: { text: string; delta: string }) => void;
  signal?: AbortSignal;
  modelTier?: 'default' | 'complex' | 'quick';
  cache?: boolean | { gcTime?: number; refresh?: boolean };
}
export interface SampleFn {
  (input: string, options?: SampleOptions): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string, options?: SampleOptions): Promise<T>;
}

let samplePromise: Promise<SampleFn | null> | null = null;

/** sample 기능. claude.ai 뷰어 밖이거나 쓸 수 없으면 null. */
export function getSample(): Promise<SampleFn | null> {
  if (!samplePromise) {
    const c = (globalThis as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
    samplePromise =
      c && typeof c.use === 'function'
        ? c.use('sample').then((s) => (typeof s === 'function' ? (s as SampleFn) : null)).catch(() => null)
        : Promise.resolve(null);
  }
  return samplePromise;
}

const HIDE_CODES = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

export function errorInfo(e: unknown): { code: string; message: string; hide: boolean; silent: boolean } {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : 'upstream_error';
  const copy: Record<string, string> = {
    not_granted: 'AI 사용이 허용되지 않아 이 화면에서는 분석할 수 없어요.',
    sampling_disabled: '이 계정에서는 AI 분석을 쓸 수 없어요.',
    not_declared: '이 화면에서는 AI 분석을 쓸 수 없어요.',
    capability_disabled: '이 화면에서는 AI 분석을 쓸 수 없어요.',
    capability_removed: '앱을 업데이트해야 AI 분석을 쓸 수 있어요.',
    rate_limited: '요청이 많아 잠시 막혔어요. 조금 뒤에 다시 눌러 주세요.',
    session_expired: 'Claude 로그인이 만료됐어요. 다시 로그인한 뒤 눌러 주세요.',
    refused: '이 요청에는 답할 수 없어요. 식품 이름을 바꿔서 검색해 보세요.',
    invalid_json: '응답 형식이 맞지 않았어요. 다시 눌러 주세요.',
    empty_completion: '응답이 비어 있었어요. 다시 눌러 주세요.',
    prompt_too_large: '질문이 너무 길어요. 짧게 줄여서 물어봐 주세요.',
    cancelled: '',
  };
  return {
    code,
    message: copy[code] ?? '연결이 끊겼어요. 다시 눌러 주세요.',
    hide: HIDE_CODES.has(code),
    silent: code === 'cancelled',
  };
}

// ---------- 식품 분석 ----------

const CATEGORIES: FoodCategory[] = ['채소', '과일', '곡물', '콩·견과·씨앗', '기름·지방', '육류·달걀', '해산물·해조류', '유제품', '발효식품', '향신료·차·음료', '가공식품·기호식품'];
const EFFECTS: Effect[] = ['benefit', 'mixed', 'caution', 'harm'];
const EVIDENCES: Evidence[] = ['strong', 'moderate', 'limited', 'contested'];
const VERDICTS: Verdict[] = ['good', 'balanced', 'caution', 'limit'];

export function buildFoodPrompt(query: string): string {
  const nutrientList = NUTRIENTS.map((n) => `${n.id}(${n.name}, ${n.unit}${n.hint ? ' ' + n.hint : ''})`).join(', ');
  const catalog = COMPOUND_IDS.map((id) => `${id}=${COMPOUND_CATALOG[id]}`).join(', ');
  return `당신은 영양생화학과 기능의학을 잘 아는 전문가입니다. 한국어 식품 사전 앱에 들어갈 "${query}" 항목을 JSON으로 작성하세요.

규칙
- 한국어 "~합니다" 체. 일반인이 이해할 수 있게 쓰되, 몸속 기전은 효소·수용체·신호 경로 이름을 넣어 구체적으로.
- 정확성이 최우선입니다. 과장·공포 조장 금지. 사람 연구로 확인된 것과 시험관·동물 연구 수준의 가설을 구분하세요.
- 영양성분은 100g당 값이며 USDA FoodData Central·식약처 식품영양성분 DB 수준의 대략값만 넣고, 확신 없는 항목은 빼세요. 요리라면 흔한 조리법 기준으로 basis에 명시하세요.
- 사용 가능한 영양소 키(단위): ${nutrientList}
- 성분(compounds) 3~6개, 중요도순. 아래 목록에 있는 성분이면 {"id","amount","role"}만 쓰세요(앱이 기전 설명을 이미 갖고 있음). 목록에 없는 성분만 {"name","effect","amount","role","pathway"}로 쓰고, pathway는 3~4단계(섭취·흡수 → 대사 → 표적 → 결과)로 쓰세요.
- 성분 목록: ${catalog}
- effect: benefit|mixed|caution|harm. evidence: strong(사람 RCT·메타분석) | moderate(관찰연구 일관+일부 RCT) | limited(주로 시험관·동물) | contested(결과가 엇갈림).
- verdict.tone: good(자주 먹기 좋음) | balanced(균형 있게) | caution(조건부·주의) | limit(줄이기).
- category는 다음 중 하나: ${CATEGORIES.join(', ')}
- "${query}"가 먹는 것이 아니면 {"notFood": true, "message": "먹는 것이 아니라는 짧은 안내"}만 답하세요.

JSON 형식 (이 키만 사용, 다른 텍스트 없이 JSON 하나만):
{"name":"표준 한국어 이름","en":"English name","emoji":"이모지 1개","category":"채소","summary":"2~3문장 요약","verdict":{"tone":"good","text":"한 줄 평가"},"basis":"생 ○○ 100g","serving":{"label":"1회 분량 설명","grams":80},"nutrients":{"kcal":0,"carb":0,"protein":0,"fat":0},"compounds":[{"id":"lutein","amount":"약 ○mg/100g","role":"이 식품에서 하는 일"},{"name":"목록에 없는 성분","effect":"benefit","amount":"","role":"","pathway":{"title":"","evidence":"limited","steps":[{"title":"흡수","body":""}]}}],"howToEat":[{"title":"","body":"조리법이 성분에 주는 영향을 기전과 연결"}],"pairings":{"good":[""],"avoid":[""]},"cautions":[""],"myths":[{"claim":"흔한 주장","truth":"실제 근거"}]}
howToEat 3~4개, cautions 1~3개, myths 0~2개.`;
}

const str = (v: unknown, max = 900): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

function steps(v: unknown, max: number): Step[] {
  return arr(v)
    .map((s) => ({ title: str((s as Step)?.title, 60), body: str((s as Step)?.body) }))
    .filter((s) => s.title && s.body)
    .slice(0, max);
}

function strings(v: unknown, max: number, len = 400): string[] {
  return arr(v).map((s) => str(s, len)).filter(Boolean).slice(0, max);
}

export function foodKey(query: string): string {
  return normalize(query).slice(0, 40);
}

/** 모델 응답을 앱 형식으로 정리. 잘못된 값은 버리고, 쓸 만한 내용이 없으면 null. */
export function sanitizeAiFood(raw: unknown, query: string, now = Date.now()): AiResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.notFood === true) return { ok: false, notFood: true, message: str(r.message, 200) || `"${query}"은(는) 먹는 것이 아닌 것 같아요.` };

  const nutrients: Nutrients = {};
  if (r.nutrients && typeof r.nutrients === 'object') {
    for (const [k, v] of Object.entries(r.nutrients as Record<string, unknown>)) {
      const n = typeof v === 'string' ? Number(v) : v;
      if (NUTRIENT_IDS.includes(k as never) && typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 100000) {
        nutrients[k as keyof Nutrients] = n;
      }
    }
  }

  const compounds: AiCompoundRef[] = [];
  const seen = new Set<string>();
  for (const c of arr(r.compounds)) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const id = typeof o.id === 'string' && (COMPOUND_IDS as string[]).includes(o.id) ? (o.id as CompoundId) : undefined;
    const name = id ? COMPOUND_CATALOG[id] : str(o.name, 60);
    const role = str(o.role, 500);
    if (!name || !role || seen.has(id ?? name)) continue;
    seen.add(id ?? name);
    const ref: AiCompoundRef = { name, role };
    if (id) ref.id = id;
    const amount = str(o.amount, 120);
    if (amount) ref.amount = amount;
    if (!id) {
      ref.effect = pick(o.effect, EFFECTS, 'mixed');
      const p = o.pathway as Record<string, unknown> | undefined;
      const ps = p ? steps(p.steps, 5) : [];
      if (p && ps.length >= 2) ref.pathway = { title: str(p.title, 80) || name, evidence: pick(p.evidence, EVIDENCES, 'limited'), steps: ps };
    }
    compounds.push(ref);
    if (compounds.length >= 8) break;
  }

  const name = str(r.name, 40) || query.trim().slice(0, 40);
  const summary = str(r.summary, 700);
  if (!summary || compounds.length === 0) return null;

  const verdict = (r.verdict ?? {}) as Record<string, unknown>;
  const serving = (r.serving ?? {}) as Record<string, unknown>;
  const grams = Number(serving.grams);
  const pairings = (r.pairings ?? {}) as Record<string, unknown>;
  const emoji = str(r.emoji, 8);

  return {
    ok: true,
    food: {
      key: foodKey(query),
      query: query.trim().slice(0, 40),
      createdAt: now,
      name,
      en: str(r.en, 60),
      emoji: emoji && !/[<>&]/.test(emoji) ? emoji : '🍽️',
      category: pick(r.category, CATEGORIES, '가공식품·기호식품'),
      summary,
      verdict: { tone: pick(verdict.tone, VERDICTS, 'balanced'), text: str(verdict.text, 200) },
      basis: str(r.basis, 80) || `${name} 100g`,
      serving: { label: str(serving.label, 80) || '100g', grams: Number.isFinite(grams) && grams > 0 && grams <= 2000 ? grams : 100 },
      nutrients,
      compounds,
      howToEat: steps(r.howToEat, 5),
      pairings: { good: strings(pairings.good, 4, 120), avoid: strings(pairings.avoid, 4, 120) },
      cautions: strings(r.cautions, 4),
      myths: arr(r.myths)
        .map((m) => ({ claim: str((m as Record<string, unknown>)?.claim, 200), truth: str((m as Record<string, unknown>)?.truth, 700) }))
        .filter((m) => m.claim && m.truth)
        .slice(0, 3),
    },
  };
}

export async function analyzeFood(
  sample: SampleFn,
  query: string,
  opts: { onProgress?: (chars: number) => void; signal?: AbortSignal; refresh?: boolean },
): Promise<AiResult> {
  const raw = await sample.json(buildFoodPrompt(query), {
    modelTier: 'default',
    signal: opts.signal,
    cache: { gcTime: 24 * 60 * 60 * 1000, refresh: opts.refresh },
    onText: ({ text }) => opts.onProgress?.(text.length),
  });
  const res = sanitizeAiFood(raw, query);
  if (!res) throw { code: 'invalid_json', message: 'unusable response' };
  return res;
}

// ---------- 질문 ----------

export function buildQuestionPrompt(context: string, question: string): string {
  return `당신은 영양생화학과 기능의학을 잘 아는 설명가입니다. 아래 [앱 데이터]를 참고해 [질문]에 한국어("~합니다" 체)로 답하세요.

규칙
- 몸속에서 일어나는 일을 순서대로(흡수 → 대사 → 표적 → 결과) 구체적으로 설명하세요.
- 주장마다 문장 끝에 근거 수준을 [근거 강함], [근거 중간], [근거 제한적], [논쟁 중] 중 하나로 붙이세요.
- 사람 연구에서 확인된 것과 시험관·동물 연구 수준의 가설을 구분하고, 과장하지 마세요.
- 질병 치료나 약 복용과 관련된 질문이면 마지막에 의료진과 상의하라는 문장을 한 번만 넣으세요.
- 제목·표·굵은 글씨 없이 짧은 문단 3~6개, 전체 800자 안팎. 목록이 필요하면 줄 앞에 "• "를 쓰세요.

[앱 데이터]
${context.slice(0, 6000)}

[질문]
${question.slice(0, 500)}`;
}

// ---------- 저장 (이 브라우저에만) ----------

const STORE_KEY = 'mw.ai.v1';

export function loadAiFoods(): Record<string, AiFood> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveAiFood(food: AiFood): void {
  try {
    const all = loadAiFoods();
    all[food.key] = food;
    const keys = Object.keys(all).sort((a, b) => all[b].createdAt - all[a].createdAt);
    for (const k of keys.slice(40)) delete all[k];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    /* 저장 실패는 무시: 화면에는 이미 표시됨 */
  }
}

export function removeAiFood(key: string): void {
  try {
    const all = loadAiFoods();
    delete all[key];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
