// 라우터와 이벤트. 주소의 #뒤 토큰으로 화면을 고른다: f.<식품> c.<성분> t.<작용> k.<분류> a.<AI 분석> s(검색) about index
import { TAG_IDS, type CompoundId } from '../data/catalog';
import { COMPOUNDS, COMPOUND_BY_ID } from '../data/compounds';
import { FOODS, FOOD_BY_ID } from '../data/foods';
import type { TagId } from '../data/types';
import { analyzeFood, buildQuestionPrompt, errorInfo, foodKey, getSample, loadAiFoods, removeAiFood, saveAiFood, type AiFood, type SampleFn } from '../lib/ai';
import { esc } from '../lib/format';
import { SearchIndex } from '../lib/search';
import {
  CATEGORY_ORDER, aboutView, aiFoodView, answerHtml, categoryView, compoundContext, compoundView, foodContext, foodView,
  homeView, indexView, notFoundView, nutritionHtml, searchView, tagView,
} from './views';

const $view = document.getElementById('view')!;
const $q = document.getElementById('q') as HTMLInputElement;
const $form = document.getElementById('search') as HTMLFormElement;
const index = new SearchIndex(FOODS, COMPOUNDS);
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let query = '';
let grams = 100;
let sample: SampleFn | null = null;
let askCtl: AbortController | null = null;
let analyzing: { query: string; ctl: AbortController } | null = null;
let current: { kind: 'food'; food: (typeof FOODS)[number] } | { kind: 'ai'; food: AiFood } | { kind: 'compound'; id: CompoundId } | { kind: 'other' } = { kind: 'other' };

// ---------- 저장 ----------
const store = {
  get<T>(k: string, fallback: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* 저장 불가 환경 */
    }
  },
};

function pushRecent(id: string) {
  const list = store.get<string[]>('mw.recent', []).filter((x) => x !== id);
  list.unshift(id);
  store.set('mw.recent', list.slice(0, 8));
}

// ---------- 라우팅 ----------
function token(): string {
  try {
    return decodeURIComponent(location.hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}

function go(t: string) {
  if (token() === t) route();
  else location.hash = t;
}

function setTitle(name?: string) {
  document.title = name ? `${name} · 먹는 원리` : '먹는 원리';
}

function route() {
  askCtl?.abort();
  askCtl = null;
  const t = token();
  const [kind, ...rest] = t.split('.');
  const arg = rest.join('.');
  current = { kind: 'other' };
  let html: string;
  let title: string | undefined;

  if (!t) {
    const recent = store.get<string[]>('mw.recent', []).map((id) => FOOD_BY_ID.get(id)).filter((f): f is NonNullable<typeof f> => !!f);
    const ai = Object.values(loadAiFoods()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
    html = homeView(recent, ai);
  } else if (kind === 'f' && FOOD_BY_ID.has(arg)) {
    const food = FOOD_BY_ID.get(arg)!;
    grams = 100;
    current = { kind: 'food', food };
    pushRecent(food.id);
    html = foodView(food, grams);
    title = food.name;
  } else if (kind === 'c' && COMPOUND_BY_ID.has(arg as CompoundId)) {
    const c = COMPOUND_BY_ID.get(arg as CompoundId)!;
    current = { kind: 'compound', id: c.id };
    html = compoundView(c);
    title = c.name;
  } else if (kind === 't' && (TAG_IDS as string[]).includes(arg)) {
    html = tagView(arg as TagId);
  } else if (kind === 'k' && CATEGORY_ORDER[Number(arg)]) {
    html = categoryView(CATEGORY_ORDER[Number(arg)]);
    title = CATEGORY_ORDER[Number(arg)];
  } else if (kind === 'a' && loadAiFoods()[arg]) {
    const food = loadAiFoods()[arg];
    grams = 100;
    current = { kind: 'ai', food };
    html = aiFoodView(food, grams);
    title = food.name;
  } else if (t === 's') {
    if (!query) query = sessionStorageGet('mw.q');
    $q.value = query;
    renderSearch();
    return;
  } else if (t === 'about') {
    html = aboutView();
  } else if (t === 'index') {
    html = indexView();
  } else {
    html = notFoundView();
  }
  $view.innerHTML = html;
  setTitle(title);
  if (t !== 's' && document.activeElement !== $q) $q.value = '';
  window.scrollTo(0, 0);
  syncAi();
}

function sessionStorageGet(k: string): string {
  try {
    return sessionStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}

function renderSearch() {
  const q = query.trim();
  if (!q) {
    location.hash = '';
    return;
  }
  const hits = index.search(q);
  const saved = loadAiFoods()[foodKey(q)];
  $view.innerHTML = searchView(q, hits, !!sample, saved);
  setTitle(`“${q}” 검색`);
  if (analyzing && analyzing.query === q) showAnalyzing(analyzing.query, 0);
}

// ---------- 검색 입력 ----------
$q.addEventListener('input', () => {
  query = $q.value;
  try {
    sessionStorage.setItem('mw.q', query);
  } catch {
    /* ignore */
  }
  if (!query.trim()) {
    if (token() === 's') location.hash = '';
    return;
  }
  if (token() !== 's') location.hash = 's';
  else renderSearch();
});

$form.addEventListener('submit', (e) => {
  e.preventDefault();
  query = $q.value;
  const hits = index.search(query);
  const [a, b] = hits;
  if (a && a.score >= 80 && (!b || a.score - b.score >= 10)) {
    $q.blur();
    go(a.type === 'food' ? `f.${a.id}` : a.type === 'compound' ? `c.${a.id}` : `t.${a.id}`);
    return;
  }
  $q.blur();
  go('s');
});

// ---------- 화면 안 클릭 ----------
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-jump],[data-grams],[data-ai-analyze],[data-ai-refresh],[data-ai-delete],[data-ai-stop],[data-ask-example]');
  if (!el) return;
  if (el.dataset.jump) {
    e.preventDefault();
    document.getElementById(el.dataset.jump)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  } else if (el.dataset.grams) {
    grams = Number(el.dataset.grams);
    const box = $view.querySelector<HTMLElement>('[data-nut]');
    if (box && (current.kind === 'food' || current.kind === 'ai')) box.innerHTML = nutritionHtml(current.food, grams);
  } else if (el.dataset.aiAnalyze) {
    void runAnalysis(el.dataset.aiAnalyze, false);
  } else if (el.dataset.aiRefresh) {
    void runAnalysis(el.dataset.aiRefresh, true);
  } else if (el.dataset.aiDelete) {
    removeAiFood(el.dataset.aiDelete);
    location.hash = '';
  } else if (el.dataset.aiStop != null) {
    analyzing?.ctl.abort();
  } else if (el.dataset.askExample) {
    const input = $view.querySelector<HTMLInputElement>('#ask-input');
    if (input) input.value = el.dataset.askExample;
    void runAsk(el.dataset.askExample);
  }
});

document.addEventListener('submit', (e) => {
  const form = (e.target as HTMLElement).closest<HTMLFormElement>('.ask-form');
  if (!form) return;
  e.preventDefault();
  const q = (form.elements.namedItem('q') as HTMLInputElement).value.trim();
  if (q) void runAsk(q);
});

// ---------- AI ----------
function syncAi() {
  for (const el of $view.querySelectorAll<HTMLElement>('.ask')) el.hidden = !sample;
}

function disableAi(message: string) {
  sample = null;
  syncAi();
  const slot = $view.querySelector<HTMLElement>('[data-ai-slot]');
  if (slot) slot.innerHTML = `<div class="empty"><p>${esc(message)}</p></div>`;
}

function showAnalyzing(q: string, chars: number) {
  const slot = $view.querySelector<HTMLElement>('[data-ai-slot]') ?? $view.querySelector<HTMLElement>('.ai-banner');
  if (!slot) return;
  const status = chars > 0 ? `작성 중… ${chars.toLocaleString('ko-KR')}자` : '생각하는 중… 보통 30초~1분 걸려요';
  slot.innerHTML = `<div class="ai-cta busy"><div><b>“${esc(q)}” 분석 중</b><span class="progress">${status}</span></div><button type="button" class="btn ghost" data-ai-stop>중지</button></div>`;
}

async function runAnalysis(q: string, refresh: boolean) {
  if (!sample || analyzing) return;
  const ctl = new AbortController();
  analyzing = { query: q, ctl };
  showAnalyzing(q, 0);
  try {
    const res = await analyzeFood(sample, q, { signal: ctl.signal, refresh, onProgress: (n) => analyzing?.query === q && showAnalyzing(q, n) });
    analyzing = null;
    if (res.ok) {
      saveAiFood(res.food);
      go(`a.${res.food.key}`);
    } else {
      const slot = $view.querySelector<HTMLElement>('[data-ai-slot]');
      if (slot) slot.innerHTML = `<div class="empty"><p>${esc(res.message)}</p></div>`;
    }
  } catch (err) {
    analyzing = null;
    const info = errorInfo(err);
    if (info.hide) return disableAi(info.message);
    if (token() === 's') renderSearch();
    else route();
    if (!info.silent) {
      const slot = $view.querySelector<HTMLElement>('[data-ai-slot]') ?? $view.querySelector<HTMLElement>('.ai-banner');
      slot?.insertAdjacentHTML('beforeend', `<p class="err">${esc(info.message)}</p>`);
    }
  }
}

async function runAsk(question: string) {
  if (!sample) return;
  const out = $view.querySelector<HTMLElement>('.ask .answer');
  const btn = $view.querySelector<HTMLButtonElement>('.ask-form button');
  if (!out) return;
  let context = '';
  if (current.kind === 'food') context = foodContext(current.food);
  else if (current.kind === 'ai') context = foodContext(current.food);
  else if (current.kind === 'compound') context = compoundContext(COMPOUND_BY_ID.get(current.id)!);
  askCtl?.abort();
  const ctl = new AbortController();
  askCtl = ctl;
  out.innerHTML = `<p class="q-echo">${esc(question)}</p><p class="progress">생각하는 중…</p>`;
  if (btn) btn.disabled = true;
  try {
    await sample(buildQuestionPrompt(context, question), {
      signal: ctl.signal,
      onText: ({ text }) => {
        out.innerHTML = `<p class="q-echo">${esc(question)}</p>${answerHtml(text)}`;
      },
    });
  } catch (err) {
    const info = errorInfo(err);
    if (info.hide) return disableAi(info.message);
    const kept = (err as { text?: string })?.text;
    if (!info.silent) out.innerHTML = `<p class="q-echo">${esc(question)}</p>${kept ? answerHtml(kept) : ''}<p class="err">${esc(info.message)}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ---------- 시작 ----------
window.addEventListener('hashchange', route);
route();
void getSample().then((s) => {
  sample = s;
  if (!s) return;
  syncAi();
  if (token() === 's') renderSearch();
});
