// 작은 DOM 헬퍼 + 게임 내 확인창/토스트 (window.confirm 대신 — 임베드 환경에서도 동작)
import { BODY_FAMILY, DISPLAY_FAMILY } from './fonts';
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string; onclick?: (e: MouseEvent) => void };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: HTMLElement) { while (el.firstChild) el.removeChild(el.firstChild); }

export function $(sel: string, root: ParentNode = document): HTMLElement | null { return root.querySelector(sel) as HTMLElement | null; }

let clickSound: (() => void) | null = null;
export function setClickSound(fn: () => void) { clickSound = fn; }

/** 누르면 소리 나는 버튼 */
export function btn(label: Child, onClick: () => void, cls = 'btn', extra: Attrs = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...extra }, label);
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (b.disabled) return;
    clickSound?.();
    onClick();
  });
  return b;
}

/** 게임 내 확인창. 결과를 Promise로 */
export function confirmBox(root: HTMLElement, title: string, body: string, ok = '확인', cancel = '취소', danger = false): Promise<boolean> {
  return new Promise(resolve => {
    const wrap = h('div', { class: 'modal-wrap confirm-wrap' });
    const close = (v: boolean) => { wrap.remove(); resolve(v); };
    wrap.appendChild(h('div', { class: 'modal confirm' },
      h('div', { class: 'modal-title' }, title),
      h('p', { class: 'confirm-body' }, body),
      h('div', { class: 'row gap' },
        btn(cancel, () => close(false), 'btn ghost'),
        btn(ok, () => close(true), danger ? 'btn danger' : 'btn primary'),
      ),
    ));
    root.appendChild(wrap);
  });
}

/** 텍스트 입력창(내보내기/불러오기용) */
export function promptBox(root: HTMLElement, title: string, value: string, readOnly: boolean, okLabel = '확인'): Promise<string | null> {
  return new Promise(resolve => {
    const ta = h('textarea', { class: 'prompt-text', spellcheck: 'false' }) as HTMLTextAreaElement;
    ta.value = value;
    ta.readOnly = readOnly;
    const wrap = h('div', { class: 'modal-wrap confirm-wrap' });
    const close = (v: string | null) => { wrap.remove(); resolve(v); };
    let copyBtn: HTMLButtonElement | null = null;
    if (readOnly) copyBtn = btn('복사', () => {
      ta.select();
      try { navigator.clipboard?.writeText(ta.value); } catch { /* 무시 */ }
      try { document.execCommand('copy'); } catch { /* 무시 */ }
      if (copyBtn) copyBtn.textContent = '복사됨!';
    }, 'btn');
    wrap.appendChild(h('div', { class: 'modal confirm' },
      h('div', { class: 'modal-title' }, title),
      ta,
      h('div', { class: 'row gap' },
        btn('닫기', () => close(null), 'btn ghost'),
        copyBtn,
        readOnly ? null : btn(okLabel, () => close(ta.value), 'btn primary'),
      ),
    ));
    root.appendChild(wrap);
    setTimeout(() => { ta.focus(); if (readOnly) ta.select(); }, 50);
  });
}

export class Toasts {
  el: HTMLElement;
  constructor(parent: HTMLElement) {
    this.el = h('div', { class: 'toasts' });
    parent.appendChild(this.el);
  }
  show(text: string, kind: 'info' | 'warn' | 'boss' | 'good' | 'ach' = 'info', ms = 2600) {
    while (this.el.children.length >= 4) this.el.firstChild?.remove();
    const t = h('div', { class: `toast ${kind}` }, text);
    this.el.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }
}

/** 화면 가운데 큰 배너(보스 등장·궁극기·진화·콤보·야근…). 한 번에 하나만 띄운다 — 둘이 겹치면 글자 위에 글자가 찍혀 깨져 보인다.
 *  우선순위가 더 높은 배너가 뜬 지 얼마 안 됐으면(글자를 읽을 시간) 낮은 배너는 버리고, 그 밖에는 새 배너가 지금 것을 바로 갈아치운다.
 *  우선순위는 클래스 이름으로 정한다(여러 개면 가장 높은 것). */
const BANNER_PRIO: Record<string, number> = { death: 9, boss: 4, yageun: 3, ult: 3, lv: 1 };
const BANNER_MS = 1900, BANNER_GUARD_MS = 1000;

export class Banners {
  private cur: { el: HTMLElement; prio: number; t0: number; timer: number } | null = null;
  constructor(private parent: HTMLElement) {}
  /** 띄웠으면 true, 더 중요한 배너에 밀려 버렸으면 false */
  show(text: string, cls: string, sub = ''): boolean {
    const prio = Math.max(0, ...cls.split(/\s+/).map(c => BANNER_PRIO[c] ?? 0));
    const now = performance.now();
    if (this.cur && this.cur.prio > prio && now - this.cur.t0 < BANNER_GUARD_MS) return false;
    this.clear();
    const el = h('div', { class: `banner ${cls}` }, text, sub ? h('small', null, sub) : null);
    this.parent.appendChild(el);
    const cur = { el, prio, t0: now, timer: 0 };
    cur.timer = window.setTimeout(() => { el.remove(); if (this.cur === cur) this.cur = null; }, BANNER_MS);
    this.cur = cur;
    return true;
  }
  /** 판이 끝나거나 새로 시작할 때: 남은 배너('퇴사 위기…' 등)가 다음 화면까지 따라오지 않게 */
  clear() {
    if (!this.cur) return;
    window.clearTimeout(this.cur.timer);
    this.cur.el.remove();
    this.cur = null;
  }
}

/** 디스플레이 서체(Black Han Sans, 한 굵기뿐)가 실제로 받아졌는지 */
export function displayFontLoaded(): boolean {
  let ok = false;
  try { document.fonts.forEach(f => { if (f.status === 'loaded' && f.family.replace(/["']/g, '') === DISPLAY_FAMILY) ok = true; }); } catch { /* 무시 */ }
  return ok;
}

/** 디스플레이 서체가 도착하면 <html>에 .dfont를 붙여 가짜 굵게를 끈다(style.css --dsyn).
 *  못 받으면(오프라인) 대체 글꼴이 굵게 보이도록 합성을 그대로 둔다.
 *  canvas: 캔버스에 구워 두는 글자 — display(보스 명판·격파/아이템 글자·간판) / body(말풍선, 본문 900). 미리 받아 둔다(preloadCanvasGlyphs). */
export function watchDisplayFont(canvas?: { display: string; body: string }) {
  const mark = () => { if (displayFontLoaded()) document.documentElement.classList.add('dfont'); };
  mark();
  try {
    document.fonts.forEach(f => { if (f.family.replace(/["']/g, '') === DISPLAY_FAMILY) f.loaded.then(mark, () => { /* 무시 */ }); });
    document.fonts.addEventListener('loadingdone', mark);
  } catch { /* 무시 */ }
  if (canvas) preloadCanvasGlyphs(canvas.display, canvas.body);
}

// 캔버스 글자 캐시와 글꼴 조각: Google Fonts는 한글 서체를 수십~백여 개 unicode-range 조각으로 나눠, 그 글자가 처음 쓰일 때 받는다.
// 캔버스는 조각이 오기 전이면 대체 글꼴로 그려 버리고 그 결과가 스프라이트 캐시에 굳는다('폭탄주 부장님'의 '님'만 얇게 등).
// 그래서 캔버스에 쓸 글자를 시작하자마자 그 서체로 미리 받고, 다 받으면 onCanvasGlyphs 콜백으로 캐시를 다시 굽게 한다.
let glyphsSettled = false;
let glyphsStarted = false;
const glyphCbs: (() => void)[] = [];

/** 캔버스용 글자 조각을 다 받았을 때 한 번 부른다(앱이 스프라이트·글자 캐시를 비우는 데 쓴다). 이미 끝났으면 부르지 않는다 — 그 전에 구운 것은 onFontsReady가 처리했다. */
export function onCanvasGlyphs(fn: () => void) { if (!glyphsSettled) glyphCbs.push(fn); }

const uniqChars = (s: string) => [...new Set(s.replace(/\s+/g, ''))].join('');

export function preloadCanvasGlyphs(display: string, body: string) {
  const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
  const d = uniqChars(display), b = uniqChars(body);
  if (glyphsStarted || !fs || (!d && !b)) return;
  glyphsStarted = true;
  let fired = false;
  const settle = () => {
    if (fired) return;
    fired = true; glyphsSettled = true;
    for (const f of glyphCbs.splice(0)) { try { f(); } catch { /* 무시 */ } }
  };
  try {
    Promise.all([
      d ? fs.load(`32px "${DISPLAY_FAMILY}"`, d) : null,
      b ? fs.load(`900 16px "${BODY_FAMILY}"`, b) : null,
    ]).then(settle, settle);
    // 아주 느린 망: 판 도중 한꺼번에 다시 굽는 일이 없도록 30초가 지나면 포기(그 뒤 글자는 대체 글꼴 그대로)
    window.setTimeout(() => { if (!fired) { fired = true; glyphsSettled = true; glyphCbs.length = 0; } }, 30000);
  } catch { settle(); }
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function statLabel(k: string, v: number): string {
  const pct = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
  const flat = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 10) / 10}`;
  switch (k) {
    case 'might': return `피해 ${pct(v)}`;
    case 'area': return `범위 ${pct(v)}`;
    case 'cooldown': return `쿨타임 ${v >= 0 ? '-' : '+'}${Math.round(Math.abs(v) * 100)}%`;
    case 'amount': return `투사체 ${flat(v)}`;
    case 'duration': return `지속시간 ${pct(v)}`;
    case 'projSpeed': return `투사체 속도 ${pct(v)}`;
    case 'moveSpeed': return `이동속도 ${pct(v)}`;
    case 'maxHp': return `최대 체력 ${flat(v)}`;
    case 'armor': return `방어 ${flat(v)}`;
    case 'recovery': return `초당 회복 ${flat(v)}`;
    case 'magnet': return `획득 범위 ${pct(v)}`;
    case 'luck': return `행운 ${pct(v)}`;
    case 'growth': return `경험치 ${pct(v)}`;
    case 'greed': return `월급 ${pct(v)}`;
    case 'curse': return `저주(적↑보상↑) ${pct(v)}`;
    case 'revival': return `부활 ${flat(v)}`;
    case 'reroll': return `새로고침 ${flat(v)}`;
    case 'skip': return `건너뛰기 ${flat(v)}`;
    case 'banish': return `제외 ${flat(v)}`;
    case 'crit': return `치명타 ${pct(v)}`;
    case 'ultCharge': return `궁극기 충전 ${pct(v)}`;
  }
  return `${k} ${v}`;
}
