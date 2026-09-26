// 라우터와 이벤트.
// 화면은 토큰으로 고른다: f.<식품>[.<탭>[.<질문 번호>]] c.<성분>[.<탭>[.<질문 번호>]] t.<작용> k.<분류> a.<AI 분석> s(검색) about index
// claude.ai 뷰어처럼 액자(iframe) 안에서 돌 때도 이동이 되도록, 링크 대신 data-go를 직접 처리하고
// 스크롤도 문서가 아니라 앱 안의 스크롤 영역(#scroller)에서 한다.
import { TAG_IDS, type CompoundId } from '../data/catalog';
import { COMPOUNDS, COMPOUND_BY_ID } from '../data/compounds';
import { COMPOUND_FAQ, FOOD_FAQ } from '../data/faq';
import { FOODS, FOOD_BY_ID } from '../data/foods';
import type { TagId } from '../data/types';
import { analyzeFood, errorInfo, foodKey, getSample, loadAiFoods, removeAiFood, saveAiFood, type AiFood, type SampleFn } from '../lib/ai';
import { esc } from '../lib/format';
import { FaqIndex, SearchIndex } from '../lib/search';
import {
  CATEGORY_ORDER, aboutView, aiFoodView, categoryView, compoundView, foodView, homeView, indexView, notFoundView, nutritionHtml, searchView, tagView,
} from './views';

const $scroller = document.getElementById('scroller')!;
const $view = document.getElementById('view')!;
const $q = document.getElementById('q') as HTMLInputElement;
const $form = document.getElementById('search') as HTMLFormElement;
const $back = document.getElementById('back') as HTMLButtonElement;
const index = new SearchIndex(FOODS, COMPOUNDS);
const faqIndex = new FaqIndex([
  { kind: 'food', map: FOOD_FAQ, names: (id) => { const f = FOOD_BY_ID.get(id); return f ? [f.name, ...(f.aliases ?? []).slice(0, 3)] : [id]; } },
  { kind: 'compound', map: COMPOUND_FAQ, names: (id) => { const c = COMPOUND_BY_ID.get(id as CompoundId); return c ? [c.name, ...(c.aliases ?? []).slice(0, 3)] : [id]; } },
]);

let query = '';
let grams = 100;
let sample: SampleFn | null = null;
let analyzing: { query: string; ctl: AbortController } | null = null;
let current: { kind: 'food'; food: (typeof FOODS)[number] } | { kind: 'ai'; food: AiFood } | { kind: 'other' } = { kind: 'other' };

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

function sessionGet(k: string): string {
  try {
    return sessionStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
}

// ---------- 이동 ----------
// 현재 화면 토큰과, 뒤로 가기용 자체 기록. 브라우저 기록(pushState)은 되면 쓰고, 막혀 있어도 앱은 동작한다.
let currentToken = tokenFromHash();
const backStack: string[] = [];

function tokenFromHash(): string {
  try {
    return decodeURIComponent(location.hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}

function writeHistory(t: string, replace: boolean) {
  try {
    const url = t ? `#${t}` : location.pathname + location.search;
    if (replace) history.replaceState({ t }, '', url);
    else history.pushState({ t }, '', url);
  } catch {
    /* 샌드박스 등에서 막혀도 화면 이동은 계속 */
  }
}

/** 다른 화면으로 이동 */
export function navigate(t: string, opts: { replace?: boolean } = {}) {
  if (t === currentToken) {
    render(t);
    return;
  }
  if (!opts.replace) backStack.push(currentToken);
  currentToken = t;
  writeHistory(t, !!opts.replace);
  render(t);
}

function goBack() {
  if (!backStack.length) {
    navigate('', { replace: true });
    return;
  }
  const before = currentToken;
  try {
    history.back();
  } catch {
    /* ignore */
  }
  // 브라우저 기록이 동작하지 않는 환경이면 자체 기록으로 되돌린다.
  window.setTimeout(() => {
    if (currentToken === before && backStack.length) {
      currentToken = backStack.pop()!;
      writeHistory(currentToken, true);
      render(currentToken);
    }
  }, 250);
}

function onHistoryMove(t: string) {
  if (t === currentToken) return;
  // 브라우저 뒤로/앞으로: 자체 기록도 맞춰 준다.
  if (backStack[backStack.length - 1] === t) backStack.pop();
  else backStack.push(currentToken);
  currentToken = t;
  render(t);
}
window.addEventListener('popstate', (e) => onHistoryMove(typeof e.state?.t === 'string' ? e.state.t : tokenFromHash()));
window.addEventListener('hashchange', () => onHistoryMove(tokenFromHash()));

function scrollToTop() {
  $scroller.scrollTop = 0;
  // 문서 전체가 스크롤되는 환경(앱 스크롤 영역이 없을 때) 대비
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
}

/** 스크롤 영역 안에서 요소가 탭 막대 바로 아래에 오도록 */
function scrollToEl(el: Element, extra = 8) {
  const tabs = $view.querySelector<HTMLElement>('.tabs');
  const offset = (tabs ? tabs.offsetHeight : 0) + extra;
  const top = el.getBoundingClientRect().top - $scroller.getBoundingClientRect().top + $scroller.scrollTop - offset;
  $scroller.scrollTop = Math.max(0, top);
}

function setTitle(name?: string) {
  document.title = name ? `${name} · 먹는 원리` : '먹는 원리';
}

// ---------- 화면 그리기 ----------
function render(t: string) {
  const parts = t.split('.');
  const [kind, arg = '', tab = '', qa = ''] = parts;
  const openQa = qa !== '' && /^\d+$/.test(qa) ? Number(qa) : -1;
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
    html = foodView(food, grams, tab, openQa);
    title = food.name;
  } else if (kind === 'c' && COMPOUND_BY_ID.has(arg as CompoundId)) {
    const c = COMPOUND_BY_ID.get(arg as CompoundId)!;
    html = compoundView(c, tab, openQa);
    title = c.name;
  } else if (kind === 't' && (TAG_IDS as string[]).includes(arg)) {
    html = tagView(arg as TagId);
  } else if (kind === 'k' && CATEGORY_ORDER[Number(arg)]) {
    html = categoryView(CATEGORY_ORDER[Number(arg)]);
    title = CATEGORY_ORDER[Number(arg)];
  } else if (kind === 'a' && loadAiFoods()[safeDecode(arg)]) {
    const food = loadAiFoods()[safeDecode(arg)];
    grams = 100;
    current = { kind: 'ai', food };
    html = aiFoodView(food, grams, tab, openQa);
    title = food.name;
  } else if (t === 's') {
    if (!query) query = sessionGet('mw.q');
    $q.value = query;
    renderSearch();
    $back.hidden = false;
    scrollToTop();
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
  if (document.activeElement !== $q) $q.value = '';
  $back.hidden = !t;
  scrollToTop();
  revealActiveTab();
  if (openQa >= 0) {
    const el = document.getElementById(`qa-${openQa}`);
    if (el) scrollToEl(el);
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function renderSearch() {
  const q = query.trim();
  if (!q) {
    navigate('', { replace: true });
    return;
  }
  const hits = index.search(q);
  const faqHits = faqIndex.search(q);
  const saved = loadAiFoods()[foodKey(q)];
  $view.innerHTML = searchView(q, hits, faqHits, !!sample, saved);
  setTitle(`“${q}” 검색`);
  if (analyzing && analyzing.query === q) showAnalyzing(analyzing.query, 0);
}

// ---------- 탭 ----------
function selectTab(id: string) {
  const tabs = $view.querySelector<HTMLElement>('.tabs');
  if (!tabs) return;
  for (const b of tabs.querySelectorAll<HTMLButtonElement>('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === id));
  for (const p of $view.querySelectorAll<HTMLElement>('.panel')) p.hidden = p.id !== `panel-${id}`;
  // 주소에 탭을 남겨 두면 뒤로 가기·새로고침 때 같은 탭이 열린다 (기록은 쌓지 않음).
  const base = currentToken.split('.').slice(0, 2).join('.');
  currentToken = `${base}.${id}`;
  writeHistory(currentToken, true);
  // 탭 막대가 화면 위에 붙어 있을 만큼 내려와 있었다면, 새 패널의 처음이 보이게 올린다.
  const tabsTop = tabs.getBoundingClientRect().top - $scroller.getBoundingClientRect().top + $scroller.scrollTop;
  if ($scroller.scrollTop > tabsTop) $scroller.scrollTop = tabsTop;
  revealActiveTab();
}

/** 탭 막대가 가로로 넘칠 때 선택된 탭이 보이게 (scrollIntoView는 액자 밖까지 움직일 수 있어 쓰지 않음) */
function revealActiveTab() {
  const tabs = $view.querySelector<HTMLElement>('.tabs');
  const btn = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
  if (!tabs || !btn) return;
  const left = btn.offsetLeft - tabs.offsetLeft;
  if (left < tabs.scrollLeft || left + btn.offsetWidth > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = Math.max(0, left - 16);
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
    if (currentToken === 's') navigate('', { replace: true });
    return;
  }
  if (currentToken !== 's') navigate('s');
  else renderSearch();
});

$form.addEventListener('submit', (e) => {
  e.preventDefault();
  query = $q.value;
  const hits = index.search(query);
  const [a, b] = hits;
  $q.blur();
  if (a && a.score >= 80 && (!b || a.score - b.score >= 10)) {
    navigate(a.type === 'food' ? `f.${a.id}` : a.type === 'compound' ? `c.${a.id}` : `t.${a.id}`);
    return;
  }
  if (currentToken === 's') renderSearch();
  else navigate('s');
});

$back.addEventListener('click', goBack);

// ---------- 화면 안 클릭 ----------
// 캡처 단계에서 받아, 페이지 안의 다른 처리보다 먼저 이동을 처리한다.
document.addEventListener(
  'click',
  (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-go],[data-tab],[data-grams],[data-faq-toggle],[data-ai-analyze],[data-ai-refresh],[data-ai-delete],[data-ai-stop]');
    if (!el) return;
    if (el.dataset.go != null) {
      e.preventDefault();
      e.stopPropagation();
      navigate(el.dataset.go);
    } else if (el.dataset.tab) {
      selectTab(el.dataset.tab);
    } else if (el.dataset.grams) {
      grams = Number(el.dataset.grams);
      const box = $view.querySelector<HTMLElement>('[data-nut]');
      if (box && (current.kind === 'food' || current.kind === 'ai')) box.innerHTML = nutritionHtml(current.food, grams);
    } else if (el.dataset.faqToggle != null) {
      const items = [...$view.querySelectorAll<HTMLDetailsElement>('.qa:not([hidden])')];
      const open = items.some((d) => !d.open);
      for (const d of items) d.open = open;
      el.textContent = open ? '모두 접기' : '모두 펼치기';
    } else if (el.dataset.aiAnalyze) {
      void runAnalysis(el.dataset.aiAnalyze, false);
    } else if (el.dataset.aiRefresh) {
      void runAnalysis(el.dataset.aiRefresh, true);
    } else if (el.dataset.aiDelete) {
      removeAiFood(el.dataset.aiDelete);
      navigate('', { replace: true });
    } else if (el.dataset.aiStop != null) {
      analyzing?.ctl.abort();
    }
  },
  true,
);

// 키보드: 링크 역할 요소는 Enter로 이동
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = (e.target as HTMLElement).closest?.<HTMLElement>('[data-go]');
  if (el) {
    e.preventDefault();
    navigate(el.dataset.go!);
  }
});

// 질문 목록 안에서 찾기
document.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.id !== 'faq-filter') return;
  const terms = input.value.toLowerCase().split(/\s+/).map((t) => t.replace(/[\s·・()\[\]{}\-_,./'"!?~]+/g, '')).filter(Boolean);
  let shown = 0;
  for (const d of $view.querySelectorAll<HTMLDetailsElement>('.qa')) {
    const text = d.dataset.text ?? '';
    const ok = terms.every((t) => text.includes(t));
    d.hidden = !ok;
    if (ok) shown++;
  }
  const empty = $view.querySelector<HTMLElement>('.faq-empty');
  if (empty) empty.hidden = shown > 0;
});

// ---------- AI (DB에 없는 식품 분석) ----------
function disableAi(message: string) {
  sample = null;
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
      navigate(`a.${encodeURIComponent(res.food.key)}`);
    } else {
      const slot = $view.querySelector<HTMLElement>('[data-ai-slot]');
      if (slot) slot.innerHTML = `<div class="empty"><p>${esc(res.message)}</p></div>`;
    }
  } catch (err) {
    analyzing = null;
    const info = errorInfo(err);
    if (info.hide) return disableAi(info.message);
    render(currentToken);
    if (!info.silent) {
      const slot = $view.querySelector<HTMLElement>('[data-ai-slot]') ?? $view.querySelector<HTMLElement>('.ai-banner');
      slot?.insertAdjacentHTML('beforeend', `<p class="err">${esc(info.message)}</p>`);
    }
  }
}

// ---------- 시작 ----------
render(currentToken);
void getSample().then((s) => {
  sample = s;
  if (s && currentToken === 's') renderSearch();
});
