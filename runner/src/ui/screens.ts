// Menu screens (GDD §8–§10): 홈 · 준비 시트 · 골목 지도 + 스테이지 카드 · 도감 · 미션 · 명예의 전당 · 오늘의 골목 · 설정.
// Every screen renders into app.root; styles live in src/menus.css (scoped under .ms / .msheet).
// Copy rules: 해요체, buttons ≤ 6 chars, numbers via toLocaleString('ko-KR'), no timers / streak pressure / ads / payments.
import { CHARACTERS, CHAR_BY_ID, type CharacterDef } from '../data/characters';
import { COMPANIONS, COMPANION_BY_ID } from '../data/companions';
import { STAGES, type StageDef } from '../data/stages';
import { BIOME_BY_ID } from '../data/biomes';
import { SCORE_VERSION } from '../data/tuning';
import { CONTENT_HASH } from '../sim/content';
import * as store from '../platform/storage';
import {
  defaultProgress, featureOpen, nextStage, stageUnlocked, stageCleared, stageStarCount, totalStars, worldStars, REMIX_GATE,
  buyCharacter, buyCompanion, companionState, canReroll, reroll, todayKey, dailyChar, dailyCompanion, dailyArchive,
  DAILY_MEDALS, recordCode, type Progress, type Feature, type GhostRec, type HallRec,
} from '../meta/progress';
import { missionText, missionReward, missionTag, rankRewardPreview, RANK_TITLES, RANK_XP, RANK_MAX } from '../meta/missions';
import {
  ACHIEVEMENTS, COSMETICS, COSMETIC_BY_ID, COSMETIC_KIND_NAMES, GROUP_NAMES, achievementView, achievementFor,
  buyCosmetic, equipCosmetic, unequipCosmetic, equippedFor, type CosmeticKind,
} from '../meta/achievements';
import { h, clear } from './dom';
import {
  icon, starRow, pouchRow, medalBadge, bar, coinAmount, newDot, fmtNum, fmtDist, fmtDuration, fmtDateKey, fmtDateMs,
  charPortrait, companionPortrait, paceText, MEDAL_NAMES, cosmeticPreview, lookFor,
} from './panels';
import { josa } from './josa';
import { ghostUsable } from './ghost';
import { VERSION, type App, type Screen } from './app';

// ---------------------------------------------------------------- shared helpers
const WORLD_NAMES: Record<number, string> = { 1: '야시장 골목', 2: '포장마차 강변', 3: '불꽃놀이 다리' };
const WORLD_VERBS: Record<number, string> = { 1: '점프 · 2단 점프 · 슬라이드 · 구덩이', 2: '발판 · 빠른 낙하 · 갈림길', 3: '터널 · 빠른 전환' };

type Dot = Feature | 'hall';
function isOpen(p: Progress, f: Dot): boolean { return f === 'hall' ? p.hall.length > 0 : featureOpen(p, f); }
/** One 'new' dot per newly opened feature; it disappears on the first visit (p.seen). */
function isNew(p: Progress, f: Dot): boolean { return isOpen(p, f) && !p.seen.includes(f); }
function markSeen(app: App, f: Dot): void { if (!app.p.seen.includes(f)) { app.p.seen.push(f); app.persist(); } }

/** UI size (100/115/130 %) → a CSS variable every menu size is derived from. */
function applyUi(app: App): void {
  try { document.documentElement.style.setProperty('--ui', String(app.p.settings.uiScale || 1)); } catch { /* ignore */ }
}

function shell(app: App, name: string, title: string, back: () => void = () => app.showHome()): { root: HTMLElement; body: HTMLElement } {
  app.nav(name as Screen); applyUi(app);
  const head = h('header', { class: 'topbar ms-top' },
    h('button', { class: 'back ms-iconbtn', 'aria-label': '뒤로', onclick: app.click(back) }, icon('back')),
    h('h2', {}, title),
    coinAmount(app.p.coins, 'pill'));
  const body = h('main', { class: 'ms-body' });
  const root = h('div', { class: `screen ms ms-${name}` }, head, body);
  app.root.append(root);
  return { root, body };
}
function section(title: string, ico: string | null, ...kids: (Node | string | null | false | undefined)[]): HTMLElement {
  return h('section', { class: 'mpanel' }, h('h3', {}, ico ? icon(ico) : null, title), ...kids);
}
function sheet(app: App, cls: string, title: string, ...kids: (Node | string | null | false | undefined)[]): HTMLElement {
  return h('div', { class: `msheet ${cls}`, role: 'dialog', 'aria-label': title },
    h('div', { class: 'msheet-head' }, h('h3', {}, title), h('button', { class: 'ms-iconbtn ghost msheet-x', 'aria-label': '닫기', onclick: app.click(() => app.closeModal()) }, icon('close'))),
    ...kids);
}
/** app.modal + an optional callback for every way the sheet can be closed (×, backdrop tap). */
function openSheet(app: App, el: HTMLElement, onClose?: () => void): void {
  app.modal(el, true);
  if (!onClose) return;
  const m = document.getElementById('modal');
  m?.addEventListener('click', e => { if (e.target === m) onClose(); });
  el.querySelector('.msheet-x')?.addEventListener('click', () => onClose());
}
/** Element.append without the nulls (conditional children). */
function add(el: HTMLElement, ...kids: (Node | string | null | false | undefined)[]): HTMLElement {
  for (const k of kids) if (k != null && k !== false) el.append(k);
  return el;
}
function kv(k: string, v: string | Node): HTMLElement { return h('div', { class: 'kv' }, h('span', {}, k), typeof v === 'string' ? h('b', {}, v) : v); }
function charName(id: string | null | undefined): string { return (id && CHAR_BY_ID[id]?.name) || ''; }
function stagesOfWorld(w: number): StageDef[] { return STAGES.filter(s => s.world === w); }
function worldName(w: number): string { const st = stagesOfWorld(w)[0]; return (st && BIOME_BY_ID[st.biome]?.name) || WORLD_NAMES[w] || `${w}번째 골목`; }
function isRemix(st: StageDef): boolean { return !!st.remix || st.index === 7; }

// ---------------------------------------------------------------- run entry points (App builds the RunConfig)
function startEndless(app: App): void { markSeen(app, 'endless'); app.startEndless(); }

// ================================================================ 홈 (GDD §10.1)
type Primary = { kind: 'tutorial' } | { kind: 'stage'; st: StageDef } | { kind: 'endless' };
function primaryAction(p: Progress): Primary {
  if (!p.tutorialDone) return { kind: 'tutorial' };
  const id = nextStage(p); const st = id ? STAGES.find(s => s.id === id) : null;
  return st ? { kind: 'stage', st } : { kind: 'endless' };
}

let homeResizeHooked = false;
export function showHome(app: App): void {
  app.nav('home'); applyUi(app);
  if (!homeResizeHooked) {   // rotate / resize → re-layout the home (hero size depends on the viewport)
    homeResizeHooked = true; let t = 0;
    window.addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(() => { if (app.screen === 'home' && !document.getElementById('modal')) showHome(app); }, 250); });
  }
  const p = app.p;
  const ch = CHAR_BY_ID[p.loadout.main] ?? CHARACTERS[0];
  const comp = p.loadout.companion ? COMPANION_BY_ID[p.loadout.companion] : null;
  const relay = featureOpen(p, 'relay');
  const partner = relay && p.loadout.partner ? CHAR_BY_ID[p.loadout.partner] : null;
  const prim = primaryAction(p);
  const run = () => {
    if (prim.kind === 'tutorial') app.startTutorial();
    else if (prim.kind === 'stage') app.startStage(prim.st.id);
    else startEndless(app);
  };
  const best = p.bestEndless;
  const primSub = prim.kind === 'tutorial' ? '화면을 누르면 점프!'
    : prim.kind === 'stage' ? `${prim.st.id} ${prim.st.name}`
    : best ? `무한 달리기 · 최고 ${fmtDist(best.dist)}` : '무한 달리기';

  // top-right: 엽전 · ★ · 계급
  const maxStars = STAGES.length * 3;
  const stats = h('div', { class: 'home-stats', 'aria-label': '내 기록' },
    coinAmount(p.coins),
    h('span', { class: 'stat-star' }, icon('star'), h('b', {}, fmtNum(totalStars(p)))),
    h('span', { class: 'stat-rank' }, h('small', {}, '계급'), h('b', {}, String(p.rank)), bar(p.rank >= RANK_MAX ? 1 : p.xp / RANK_XP(p.rank), 'xp')));

  // KakaoTalk in-app browser → gentle, dismissible hint (GDD §10.5)
  let banner: HTMLElement | null = null;
  if (/KAKAOTALK/i.test(navigator.userAgent) && !p.seen.includes('kakao-banner')) {
    const web = /^https?:/.test(location.protocol);
    banner = h('div', { class: 'ms-banner', role: 'note' },
      h('span', {}, '기본 브라우저로 열면 더 잘 돼요'),
      web ? h('button', { class: 'ms-btn sm', onclick: app.click(() => { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href); }) }, '열기') : null,
      h('button', { class: 'ms-iconbtn ghost', 'aria-label': '닫기', onclick: app.click(() => { p.seen.push('kakao-banner'); app.persist(); banner?.remove(); }) }, icon('close')));
  }

  // the runner gets bigger on tall phones (fills the space instead of leaving a gap), smaller on short landscape
  const vh = window.innerHeight || 700; const landscape = (window.innerWidth || 400) > vh;
  const heroSize = landscape ? (vh < 420 ? 104 : 124) : vh >= 800 ? 156 : vh >= 700 ? 136 : 118;
  const hero = h('div', { class: 'home-hero' },
    h('div', { class: 'hero-pics' },
      h('div', { class: 'hero-main' }, charPortrait(ch, heroSize, false, p)),
      comp ? h('div', { class: 'hero-comp', title: comp.name }, companionPortrait(comp, Math.round(heroSize * 0.4))) : null,
      partner ? h('div', { class: 'hero-partner', title: `이어달리기 ${partner.name}` }, charPortrait(partner, 46, false, p)) : null),
    h('div', { class: 'hero-txt' },
      h('b', {}, ch.name), h('small', {}, ch.title),
      h('span', { class: 'hero-line' }, comp ? `짝꿍 ${comp.name}` : '짝꿍 없음'),
      partner ? h('span', { class: 'hero-line' }, icon('relay'), ` 이어달리기 ${partner.name}`) : null,
      h('button', { class: 'ms-chip', id: 'btn-ready', onclick: app.click(() => openReady(app, { context: 'home', onDone: () => showHome(app) })) },
        icon('swap'), '바꾸기', isNew(p, 'relay') ? newDot() : null)));

  const secondary: HTMLElement[] = [];
  if (featureOpen(p, 'endless') && prim.kind !== 'endless')
    secondary.push(h('button', { class: 'ms-btn sec', id: 'btn-endless', onclick: app.click(() => startEndless(app)) },
      icon('infinity'), h('span', { class: 'lbl' }, '무한 달리기', h('small', {}, best ? `최고 ${fmtDist(best.dist)}` : '끝없이 달려요')), isNew(p, 'endless') ? newDot() : null));
  if (featureOpen(p, 'daily')) {
    const d = p.daily[todayKey()];
    secondary.push(h('button', { class: 'ms-btn sec', id: 'btn-daily', onclick: app.click(() => app.showDaily()) },
      icon('calendar'), h('span', { class: 'lbl' }, '오늘의 골목', h('small', {}, d ? `오늘 ${fmtDist(d.dist)}${d.medal ? ` · ${MEDAL_NAMES[d.medal]}메달` : ''}` : '매일 새 코스')), isNew(p, 'daily') ? newDot() : null));
  }

  const mapOpen = featureOpen(p, 'map') && STAGES.length > 0;
  const actions = h('div', { class: 'home-actions' },
    mapOpen ? h('button', { class: 'ms-strip', id: 'btn-map', onclick: app.click(() => app.showAdventure()) },
      icon('map'), h('span', { class: 'lbl' }, '골목 지도'), h('span', { class: 'strip-stars' }, icon('star'), `${fmtNum(totalStars(p))}/${fmtNum(maxStars)}`),
      bar(totalStars(p) / Math.max(1, maxStars), 'thin'), isNew(p, 'map') ? newDot() : null, icon('next', 'chev')) : null,
    h('button', { class: 'ms-btn primary huge', id: 'btn-run', onclick: app.click(run) },
      icon('play'), h('span', { class: 'lbl' }, prim.kind === 'tutorial' ? '첫 달리기' : '이어서 달리기', h('small', {}, primSub))),
    secondary.length ? h('div', { class: 'home-sec' }, ...secondary) : null);

  const dockItem = (id: string, ico: string, label: string, f: Dot | null, go: () => void) =>
    h('button', { class: 'dock-btn', id, onclick: app.click(go) }, icon(ico), h('span', {}, label), f && isNew(p, f) ? newDot() : null);
  const dock = h('nav', { class: 'home-dock', 'aria-label': '메뉴' },
    featureOpen(p, 'chars') ? dockItem('nav-chars', 'book', '도감', 'chars', () => app.showChars()) : null,
    featureOpen(p, 'missions') ? dockItem('nav-missions', 'mission', '미션', 'missions', () => app.showMissions()) : null,
    isOpen(p, 'hall') ? dockItem('nav-hall', 'trophy', '명예의 전당', 'hall', () => showHall(app)) : null,
    dockItem('nav-settings', 'gear', '설정', null, () => app.showSettings()));

  // a string of paper lanterns sagging across the top (catenary-ish: y = sag·(1 − x²))
  const lanterns = h('div', { class: 'lanterns', 'aria-hidden': 'true' },
    ...Array.from({ length: 9 }, (_, i) => { const x = (i - 4) / 4.6; return h('i', { style: `left:${(6 + i * 11).toFixed(1)}%;top:${(4 + 26 * (1 - x * x)).toFixed(1)}px;--d:${(i * 0.37).toFixed(2)}s` }); }));
  const el = h('div', { class: 'screen ms ms-home home' },
    lanterns, h('div', { class: 'skyline', 'aria-hidden': 'true' }),
    h('div', { class: 'home-head' }, banner, stats),
    h('div', { class: 'home-title' }, h('div', { class: 'moon', 'aria-hidden': 'true' }), h('h1', {}, '야식 대질주'), h('p', {}, '보름달까지 달려라!')),
    hero, actions, dock,
    !store.storageInfo.available ? h('p', { class: 'home-warn' }, '이 브라우저는 기록을 저장하지 못해요 — 설정에서 백업 코드를 저장해 두세요') : null);
  app.root.append(el);
}

// ================================================================ 준비 시트 (주자 · 파트너 · 짝꿍)
export function openReady(app: App, o: { context: 'home' | 'stage' | 'endless'; onDone?: () => void }): void {
  const p = app.p;
  const relay = featureOpen(p, 'relay') && o.context !== 'stage';
  if (relay) markSeen(app, 'relay');
  const body = h('div', { class: 'ready-body' });
  const done = () => { app.closeModal(); o.onDone?.(); };
  const render = () => {
    clear(body);
    const main = CHAR_BY_ID[p.loadout.main] ?? CHARACTERS[0];
    const owned = CHARACTERS.filter(c => p.unlocked.includes(c.id));
    const lockedN = CHARACTERS.length - owned.length;
    const tile = (on: boolean, pic: Node | null, name: string, onclick: () => void, id?: string) =>
      h('button', { class: 'tile' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', 'data-id': id ?? '', onclick: app.click(onclick) },
        pic ?? h('span', { class: 'tile-none' }, icon('close')), h('span', { class: 'tile-name' }, name), on ? icon('check', 'tick') : null);
    add(body,
      h('div', { class: 'ready-sec' }, h('h4', {}, '주자'),
        h('div', { class: 'tiles' }, ...owned.map(c => tile(c.id === main.id, charPortrait(c, 58, false, p), c.name, () => {
          if (p.loadout.partner === c.id) p.loadout.partner = main.id === c.id ? null : main.id;
          p.loadout.main = c.id; if (p.loadout.partner === p.loadout.main) p.loadout.partner = null;
          app.persist(); render();
        }, c.id))),
        h('p', { class: 'ready-note' }, icon('sparkle'), h('span', {}, h('b', {}, main.skillName), ` — ${main.skillDesc}`)),
        lockedN > 0 ? h('p', { class: 'ready-more' }, `아직 못 만난 주자 ${lockedN}명은 도감에서 볼 수 있어요`) : null),
      relay ? h('div', { class: 'ready-sec' }, h('h4', {}, '이어달리기 파트너'),
        h('div', { class: 'tiles' },
          tile(!p.loadout.partner, null, '없음', () => { p.loadout.partner = null; app.persist(); render(); }, 'none'),
          ...owned.filter(c => c.id !== main.id).map(c => tile(p.loadout.partner === c.id, charPortrait(c, 58, false, p), c.name, () => { p.loadout.partner = c.id; app.persist(); render(); }, c.id))),
        h('p', { class: 'ready-note' }, icon('relay'), h('span', {}, '주자가 다 식으면 파트너가 따끈함 절반으로 한 번 이어 달려요. 무한 달리기에서만 써요.'))) : null,
      h('div', { class: 'ready-sec' }, h('h4', {}, '짝꿍'),
        h('div', { class: 'tiles' },
          ...COMPANIONS.filter(c => p.companions.includes(c.id)).map(c => tile(p.loadout.companion === c.id, companionPortrait(c, 58), c.name.split(' ').pop() ?? c.name, () => { p.loadout.companion = c.id; app.persist(); render(); }, c.id)),
          tile(!p.loadout.companion, null, '없음', () => { p.loadout.companion = null; app.persist(); render(); }, 'none')),
        p.loadout.companion && COMPANION_BY_ID[p.loadout.companion] ? h('p', { class: 'ready-note' }, icon('sparkle'), h('span', {}, h('b', {}, COMPANION_BY_ID[p.loadout.companion].name), ` — ${COMPANION_BY_ID[p.loadout.companion].desc}`)) : null),
    );
  };
  render();
  openSheet(app, sheet(app, 'ready', '준비', body,
    h('div', { class: 'msheet-foot' }, h('button', { class: 'ms-btn primary', id: 'ready-done', onclick: app.click(done) }, icon('check'), '완료'))), o.onDone);
}

// ================================================================ 골목 지도 (GDD §8.2)
export function showAdventure(app: App): void {
  const { body } = shell(app, 'adventure', '골목 지도');
  markSeen(app, 'map');
  const p = app.p;
  const worlds = Array.from(new Set(STAGES.map(s => s.world))).sort((a, b) => a - b);
  const next = nextStage(p);
  const wrap = h('div', { class: 'worlds' });
  body.append(h('p', { class: 'ms-hint' }, '골목은 매번 똑같은 길이에요. ', h('b', {}, '★1'), ' 도착 · ', h('b', {}, '★2'), ' 별사탕 모으기 · ', h('b', {}, '★3'), ' 황금 복주머니 3개. 별은 한 번 받으면 사라지지 않아요.'), wrap);
  for (const w of worlds) {
    const stages = stagesOfWorld(w);
    const bi = BIOME_BY_ID[stages[0].biome];
    const ws = worldStars(p, w);
    const sec = h('section', { class: 'world', style: `--w1:${bi?.sky[0] ?? '#2b2d6e'};--w2:${bi?.sky[1] ?? '#f28f6b'};--wl:${bi?.light ?? '#ffc86b'}` },
      h('div', { class: 'world-head' },
        h('span', { class: 'world-no' }, String(w)),
        h('div', { class: 'world-txt' }, h('h3', {}, worldName(w)), h('small', {}, WORLD_VERBS[w] ?? '')),
        h('span', { class: 'world-stars' }, icon('star'), `${ws}/${stages.length * 3}`)));
    const grid = h('div', { class: 'nodes' });
    for (const st of stages) {
      const ok = stageUnlocked(p, st.id); const stars = stageStarCount(p, st.id); const remix = isRemix(st);
      const cur = st.id === next;
      // a locked remix shows what it still waits for: the world's stars, or (stars enough) its first un-reached stage
      const blocker = remix && !ok && ws >= REMIX_GATE ? stages.find(x => !isRemix(x) && !stageCleared(p, x.id)) : null;
      const need = remix && !ok ? h('small', { class: 'node-need' }, ...(blocker ? [icon('runner'), `${blocker.id} 도착`] : [icon('star'), `${Math.min(ws, REMIX_GATE)}/${REMIX_GATE}`])) : null;
      grid.append(h('button', {
        class: 'stage node' + (ok ? '' : ' locked') + (remix ? ' remix' : '') + (cur ? ' cur' : '') + (stars === 3 ? ' full' : ''),
        'data-stage': st.id, 'aria-label': `${st.id} ${st.name}${ok ? ` 별 ${stars}개` : ' 잠김'}`,
        onclick: app.click(() => openStageCard(app, st.id)),
      },
        cur ? h('span', { class: 'node-here' }, '지금') : null,
        h('span', { class: 'node-id' }, remix ? icon('sparkle') : null, st.id),
        ok ? starRow(stars, 3, 'sm') : h('span', { class: 'node-lock' }, icon('lock')),
        ok ? pouchRow(p.pouches[st.id] ?? 0, 'sm') : need,
        h('span', { class: 'node-name' }, st.name)));
    }
    sec.append(grid); wrap.append(sec);
  }
}

/** Stage card: intro, the 3 star conditions, pouches, best, ghost toggle, 출발! (GDD §10.1) */
export function openStageCard(app: App, id: string): void {
  const st = STAGES.find(s => s.id === id); if (!st) return;
  const p = app.p; const ok = stageUnlocked(p, id);
  const mask = p.starMask[id] ?? 0; const pouches = p.pouches[id] ?? 0;
  const pn = [0, 1, 2].filter(i => (pouches >> i) & 1).length;
  const ghost = ghostUsable(store.loadGhost<GhostRec>('stage:' + id), st.seed);   // the same test startRun races it by
  const bi = BIOME_BY_ID[st.biome];
  const cond = (on: boolean, title: string, detail: Node | string | null) =>
    h('li', { class: 'cond' + (on ? ' on' : '') }, icon(on ? 'star' : 'starO'), h('div', {}, h('b', {}, title), detail ? h('small', {}, detail) : null));
  const remix = isRemix(st);
  const ws = worldStars(p, st.world);
  const ch = CHAR_BY_ID[p.loadout.main]; const comp = p.loadout.companion ? COMPANION_BY_ID[p.loadout.companion] : null;
  const ghostSw = h('input', { type: 'checkbox', class: 'switch', checked: !!p.settings.ghost, onchange: (e: Event) => { p.settings.ghost = (e.target as HTMLInputElement).checked; app.applySettings(); app.persist(); } });
  const lockMsg = !ok ? (remix
    ? `${worldName(st.world)} 별 ${REMIX_GATE}개와 모든 골목 도착이 필요해요 (지금 ★ ${ws})`
    : (() => { const reg = STAGES.filter(s => !isRemix(s)); const i = reg.findIndex(s => s.id === id); const prev = reg[i - 1]; return prev ? `${prev.id} ${prev.name}에 도착하면 열려요` : '곧 열려요'; })()) : '';
  const body = h('div', { class: 'stage-body' },
    h('div', { class: 'stage-hero', style: `--w1:${bi?.sky[0] ?? '#2b2d6e'};--w2:${bi?.sky[1] ?? '#f28f6b'}` },
      h('span', { class: 'stage-biome' }, `${worldName(st.world)} · ${fmtNum(st.length)}m`),
      h('p', { class: 'stage-intro' }, st.intro),
      starRow(stageStarCount(p, id), 3, 'lg')),
    h('ol', { class: 'conds' },
      cond((mask & 1) === 1, '결승 깃발에 도착', null),
      cond((mask & 2) === 2, `별사탕 ${st.stars.jellyPct}% 이상 먹고 도착`, '한 판에서 모아야 해요'),
      cond((mask & 4) === 4, '황금 복주머니 3개', h('span', { class: 'pouch-line' }, pouchRow(pouches), ` ${pn}/3 · 도착한 판에서 먹은 것만 세고, 여러 판을 합쳐요`))),
    h('div', { class: 'stage-meta' },
      kv('최고 기록', p.stageBest[id] ? `${fmtNum(p.stageBest[id])}점` : '아직 없어요'),
      h('label', { class: 'set ghost-row' }, h('span', { class: 'txt' }, h('b', {}, icon('ghost'), ' 유령과 달리기'), h('small', {}, ghost ? '내 최고 기록이 흐릿하게 함께 달려요' : '도착하면 최고 기록이 유령으로 남아요')), ghostSw),
      h('div', { class: 'stage-loadout' },
        ch ? charPortrait(ch, 40, false, p) : null, comp ? companionPortrait(comp, 34) : null,
        h('span', {}, `${ch?.name ?? ''}${comp ? ` · ${comp.name.split(' ').pop()}` : ''}`),
        h('button', { class: 'ms-chip', onclick: app.click(() => openReady(app, { context: 'stage', onDone: () => openStageCard(app, id) })) }, icon('swap'), '바꾸기')),
      app.assistOpts().noHitDamage || app.assistOpts().halfDrain || app.assistOpts().autoSlide ? h('p', { class: 'ms-hint small' }, icon('assist'), ' 도움이 켜져 있어요. 별은 그대로 받고 기록에 작은 표시만 붙어요.') : null),
    !ok ? h('p', { class: 'stage-lock' }, icon('lock'), ` ${lockMsg}`) : null);
  app.modal(sheet(app, 'stagecard', `${st.id} ${st.name}`, body,
    h('div', { class: 'msheet-foot' },
      h('button', { class: 'ms-btn primary', id: 'stage-go', disabled: !ok, onclick: app.click(() => { app.closeModal(); app.startStage(st.id); }) }, icon('play'), '출발!'))));
}

// ================================================================ 도감 (주자 · 짝꿍 · 꾸미기 · 업적)
let colTab: 'chars' | 'comps' | 'cosm' | 'ach' = 'chars';
let cosmTarget = '';

function unlockBox(p: Progress, c: CharacterDef): HTMLElement | null {
  const u = c.unlock;
  if (u.kind === 'start') return null;
  let label = ''; let frac = 0; let extra = '';
  if (u.kind === 'stars') { const n = totalStars(p); label = `골목 지도 ★ ${fmtNum(Math.min(n, u.n))}/${fmtNum(u.n)}`; frac = n / u.n; extra = `골목 지도에서 별 ${fmtNum(u.n)}개를 모으면 합류해요`; }
  else if (u.kind === 'rank') { label = `계급 ${Math.min(p.rank, u.n)}/${u.n}`; frac = (p.rank + (p.rank < u.n ? p.xp / RANK_XP(p.rank) : 0)) / u.n; extra = `미션을 끝내 ${josa(`계급 ${u.n}`, '이/가')} 되면 합류해요`; }
  else { label = `엽전 ${fmtNum(Math.min(p.coins, u.cost))}/${fmtNum(u.cost)}`; frac = p.coins / u.cost; extra = paceText(p, u.cost); }
  return h('div', { class: 'unlock' }, h('div', { class: 'unlock-top' }, icon(u.kind === 'coins' ? 'coin' : u.kind === 'stars' ? 'star' : 'mission'), h('b', {}, label), extra ? h('small', {}, extra) : null), bar(frac));
}
function traitsOf(c: CharacterDef): string[] {
  const t: string[] = [];
  if (c.maxHp !== 100) t.push(`따끈함 ${c.maxHp}`);
  if (c.drainMul !== 1) t.push(`식는 속도 ×${c.drainMul}`);
  if (c.maxJumps > 2) t.push(`${c.maxJumps}단 점프`);
  if (c.glide) t.push('활공');
  if (c.magnetR) t.push(`자석 ${c.magnetR}`);
  if (c.revive) t.push(`되살아남 ${Math.round(c.revive * 100)}%`);
  return t;
}

export function showChars(app: App): void {
  const { body } = shell(app, 'chars', '도감');
  markSeen(app, 'chars');
  const p = app.p;
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const pane = h('div', { class: 'tabpane' });
  const tabDefs: [typeof colTab, string][] = [['chars', '주자'], ['comps', '짝꿍'], ['cosm', '꾸미기'], ['ach', '업적']];
  const render = () => {
    clear(tabs); clear(pane);
    for (const [k, label] of tabDefs) tabs.append(h('button', { class: 'tab' + (colTab === k ? ' on' : ''), role: 'tab', 'aria-selected': colTab === k ? 'true' : 'false', 'data-tab': k, onclick: app.click(() => { colTab = k; render(); }) }, label));
    if (colTab === 'chars') renderCharsTab(app, pane, render);
    else if (colTab === 'comps') renderCompsTab(app, pane, render);
    else if (colTab === 'cosm') renderCosmTab(app, pane, render);
    else renderAchTab(app, pane);
  };
  body.append(tabs, pane);
  render();
  void p;
}

function renderCharsTab(app: App, pane: HTMLElement, rerender: () => void): void {
  const p = app.p; const relay = featureOpen(p, 'relay');
  const have = CHARACTERS.filter(c => p.unlocked.includes(c.id)).length;
  pane.append(h('p', { class: 'ms-hint' }, `주자 ${have}/${CHARACTERS.length} · 모두 강하고 약한 게 아니라 다르게 달려요. 강화도 뽑기도 없어요.`));
  const list = h('div', { class: 'cards' });
  for (const c of CHARACTERS) {
    const own = p.unlocked.includes(c.id);
    const isMain = p.loadout.main === c.id; const isPartner = relay && p.loadout.partner === c.id;
    const canBuy = !own && c.unlock.kind === 'coins';
    const best = p.bestByChar[c.id] ?? 0;
    const actions: HTMLElement[] = [];
    if (own) {
      actions.push(h('button', { class: 'ms-btn sm' + (isMain ? ' on' : ''), disabled: isMain, onclick: app.click(() => { if (p.loadout.partner === c.id) p.loadout.partner = p.loadout.main; p.loadout.main = c.id; if (p.loadout.partner === c.id) p.loadout.partner = null; app.persist(); rerender(); }) }, isMain ? '달리는 중' : '주자로'));
      if (relay && !isMain) actions.push(h('button', { class: 'ms-btn sm' + (isPartner ? ' on' : ''), onclick: app.click(() => { p.loadout.partner = isPartner ? null : c.id; app.persist(); rerender(); }) }, isPartner ? '파트너 빼기' : '파트너로'));
    } else {
      actions.push(h('button', { class: 'ms-btn sm', 'data-trial': c.id, onclick: app.click(() => app.startTrial(c.id)) }, icon('play'), '시험 달리기'));
      if (canBuy) {
        const cost = (c.unlock as { cost: number }).cost;
        actions.push(h('button', { class: 'ms-btn sm primary', disabled: p.coins < cost, onclick: app.click(() => {
          const r = buyCharacter(p, c.id);
          if (r.ok) { app.audio.play('unlock'); app.toast(`${josa(c.name, '이/가')} 합류했어요!`, 'good'); app.persist(); } else { app.audio.play('error'); app.toast(r.error ?? '', 'warn'); }
          rerender();
        }) }, icon('coin'), '데려오기'));
      }
    }
    list.append(h('article', { class: 'ccard' + (own ? '' : ' locked') + (isMain ? ' main' : '') + (isPartner ? ' partner' : ''), 'data-char': c.id },
      h('div', { class: 'pic' }, charPortrait(c, 84, false, own ? p : null), own ? null : h('span', { class: 'pic-lock' }, icon('lock'))),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, h('b', {}, c.name), h('small', {}, c.title), isMain ? h('span', { class: 'tag gold' }, '주자') : null, isPartner ? h('span', { class: 'tag jade' }, '파트너') : null),
        h('p', {}, c.desc),
        h('div', { class: 'skill' }, icon('sparkle'), h('span', {}, h('b', {}, c.skillName), ` ${c.skillDesc}`)),
        traitsOf(c).length ? h('div', { class: 'traits' }, ...traitsOf(c).map(t => h('span', { class: 'tag' }, t))) : null,
        own && best ? h('small', { class: 'best' }, `이 주자 최고 ${fmtNum(best)}점`) : null,
        own ? null : unlockBox(p, c),
        h('div', { class: 'acts' }, ...actions))));
  }
  pane.append(list);
}

function renderCompsTab(app: App, pane: HTMLElement, rerender: () => void): void {
  const p = app.p;
  pane.append(h('p', { class: 'ms-hint' }, '짝꿍은 한 번에 하나만 데려가요. 저마다 힘이 하나씩 있고, 어떤 주자와도 잘 맞아요.'));
  const list = h('div', { class: 'cards' });
  for (const c of COMPANIONS) {
    const us = companionState(p, c.id); const own = us.ok; const on = p.loadout.companion === c.id;
    let lock: HTMLElement | null = null; const acts: HTMLElement[] = [];
    if (own) acts.push(h('button', { class: 'ms-btn sm' + (on ? ' on' : ''), onclick: app.click(() => { p.loadout.companion = on ? null : c.id; app.persist(); rerender(); }) }, on ? '함께하는 중' : '함께하기'));
    else if (c.unlock.kind === 'stage') {
      const sid = c.unlock.id; const st = STAGES.find(s => s.id === sid);
      lock = h('div', { class: 'unlock' }, h('div', { class: 'unlock-top' }, icon('map'), h('b', {}, `${sid}${st ? ` ${st.name}` : ''} 도착`), h('small', {}, `골목 지도 ${sid}에 도착하면 합류해요`)), bar(stageCleared(p, sid) ? 1 : 0));
    } else if (c.unlock.kind === 'coins') {
      const cost = c.unlock.cost;
      lock = h('div', { class: 'unlock' }, h('div', { class: 'unlock-top' }, icon('coin'), h('b', {}, `엽전 ${fmtNum(Math.min(p.coins, cost))}/${fmtNum(cost)}`), h('small', {}, paceText(p, cost))), bar(p.coins / cost));
      acts.push(h('button', { class: 'ms-btn sm primary', disabled: p.coins < cost, onclick: app.click(() => {
        const r = buyCompanion(p, c.id);
        if (r.ok) { app.audio.play('unlock'); app.toast(`${josa(c.name, '이/가')} 함께해요!`, 'good'); app.persist(); } else { app.audio.play('error'); app.toast(r.error ?? '', 'warn'); }
        rerender();
      }) }, icon('coin'), '데려오기'));
    }
    list.append(h('article', { class: 'ccard comp' + (own ? '' : ' locked') + (on ? ' main' : ''), 'data-comp': c.id },
      h('div', { class: 'pic' }, companionPortrait(c, 84), own ? null : h('span', { class: 'pic-lock' }, icon('lock'))),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, h('b', {}, c.name), on ? h('span', { class: 'tag gold' }, '함께') : null),
        h('div', { class: 'skill' }, icon('sparkle'), h('span', {}, c.desc)),
        lock, acts.length ? h('div', { class: 'acts' }, ...acts) : null)));
  }
  pane.append(list);
}

function rewardLabel(reward: string): string {
  if (reward.startsWith('title:')) return `칭호 「${reward.slice(6)}」`;
  const c = COSMETIC_BY_ID[reward];
  return c ? `${COSMETIC_KIND_NAMES[c.kind] ?? '꾸미기'} 「${c.name}」` : reward;
}
const COSM_ICON: Record<CosmeticKind, string> = { hat: 'hat', trail: 'trail', jumpSound: 'note', palette: 'palette' };

function renderCosmTab(app: App, pane: HTMLElement, rerender: () => void): void {
  const p = app.p;
  if (!p.unlocked.includes(cosmTarget)) cosmTarget = p.loadout.main;
  const target = CHAR_BY_ID[cosmTarget] ?? CHARACTERS[0];
  const owned = new Set(p.cosmetics.owned);
  pane.append(h('p', { class: 'ms-hint' }, `꾸미기 ${COSMETICS.filter(c => owned.has(c.id)).length}/${COSMETICS.length} · 업적을 이루면 하나씩 열려요. 모양만 바뀌고 달리기에는 영향이 없어요.`));
  // whose look are we changing?
  pane.append(h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '누구를 꾸밀까요' },
    ...CHARACTERS.filter(c => p.unlocked.includes(c.id)).map(c => h('button', { class: 'ms-chip' + (c.id === cosmTarget ? ' on' : ''), 'aria-pressed': c.id === cosmTarget ? 'true' : 'false', onclick: app.click(() => { cosmTarget = c.id; rerender(); }) }, charPortrait(c, 26, false, p), c.name))));
  const eq = equippedFor(p, cosmTarget);
  const wearing = (['hat', 'trail', 'jumpSound', 'palette'] as CosmeticKind[]).map(k => eq[k]?.name).filter(Boolean);
  pane.append(h('p', { class: 'ms-hint small' }, `${josa(target.name, '은/는')} 지금 ${josa(wearing.length ? wearing.join(' · ') : '기본 모습', '이에요/예요')}.`));
  for (const kind of ['hat', 'trail', 'jumpSound', 'palette'] as CosmeticKind[]) {
    const items = COSMETICS.filter(c => c.kind === kind && (kind !== 'palette' || c.charId === cosmTarget));
    if (!items.length) continue;
    const grid = h('div', { class: 'cosm-grid' });
    for (const c of items) {
      const own = owned.has(c.id); const on = eq[kind]?.id === c.id;
      const src = achievementFor(c.id);
      const secret = !!src?.hidden && !p.achievements[src.id];
      const how = own ? '' : src ? (secret ? `숨은 업적${src.hint ? ` · ${src.hint}` : ''}` : `업적 「${src.name}」`) : c.price ? `엽전 ${fmtNum(c.price)}` : '';
      let act: HTMLElement | null = null;
      if (own) act = h('button', { class: 'ms-btn sm' + (on ? ' on' : ''), onclick: app.click(() => {
        if (on) unequipCosmetic(p, cosmTarget, kind);
        else { const r = equipCosmetic(p, cosmTarget, c.id); if (!r.ok) { app.toast(r.error ?? '', 'warn'); return; } }
        app.persist(); rerender();
      }) }, on ? '쓰는 중' : '쓰기');
      else if (c.price) act = h('button', { class: 'ms-btn sm primary', disabled: p.coins < c.price, onclick: app.click(() => {
        const r = buyCosmetic(p, c.id);
        if (r.ok) { equipCosmetic(p, cosmTarget, c.id); app.audio.play('unlock'); app.toast(`${josa(c.name, '을/를')} 샀어요`, 'good'); app.persist(); } else { app.audio.play('error'); app.toast(r.error ?? '', 'warn'); }
        rerender();
      }) }, icon('coin'), '사기');
      const pic = secret ? icon('lock') : cosmeticPreview(c, target, undefined, kind === 'palette' ? null : lookFor(p, cosmTarget).palette) ?? icon(own ? COSM_ICON[kind] : 'lock');
      grid.append(h('div', { class: 'cosm' + (own ? '' : c.price ? ' shop' : ' locked') + (on ? ' on' : '') + (kind === 'palette' ? ' pal' : ''), 'data-cosm': c.id },
        h('span', { class: 'cosm-ico', style: c.color && own ? `color:${c.color === '#2b2b33' ? '#c9c3e6' : c.color}` : '' }, pic),
        h('b', {}, c.name),
        how ? h('small', {}, how) : null,
        c.price && !own ? h('small', {}, paceText(p, c.price, '지금 살 수 있어요')) : null, act));
    }
    pane.append(h('h4', { class: 'sub' }, icon(COSM_ICON[kind]), COSMETIC_KIND_NAMES[kind] ?? kind), grid);
  }
}

function renderAchTab(app: App, pane: HTMLElement): void {
  const p = app.p;
  const views = ACHIEVEMENTS.map(a => ({ a, v: achievementView(p, a.id) })).filter(x => x.v);
  const done = views.filter(x => x.v!.unlocked).length;
  const titles = (p as Progress & { titles?: string[] }).titles ?? [];
  pane.append(h('div', { class: 'mpanel ach-sum' }, h('b', {}, `업적 ${done}/${views.length}`), bar(views.length ? done / views.length : 0),
    h('small', {}, '업적은 한 판이 끝날 때 확인해요. 하나마다 꾸미기나 칭호를 하나 받아요.'),
    titles.length ? h('div', { class: 'chips' }, ...titles.map(t => h('span', { class: 'tag gold' }, icon('title'), t))) : null));
  if (!views.length) { pane.append(h('p', { class: 'empty' }, '곧 업적이 들어와요.')); return; }
  for (const g of Array.from(new Set(ACHIEVEMENTS.map(a => a.group)))) {
    const list = h('div', { class: 'ach-list' });
    for (const { a, v } of views.filter(x => x.a.group === g)) {
      const got = v!.unlocked; const secret = !!a.hidden && !got;
      const [cur, max] = v!.progress;
      const prog = !got && a.progress && max > 1 ? h('div', { class: 'ach-prog' }, bar(cur / max), h('small', {}, `${fmtNum(cur)}/${fmtNum(max)}`)) : null;
      list.append(h('div', { class: 'ach' + (got ? ' on' : '') + (secret ? ' secret' : ''), 'data-ach': a.id },
        h('span', { class: 'ach-ico' }, icon(got ? 'check' : secret ? 'lock' : 'trophy')),
        h('div', { class: 'ach-txt' },
          h('b', {}, v!.name),
          h('small', {}, secret ? `힌트: ${v!.desc}` : v!.desc),
          prog,
          h('small', { class: 'ach-reward' }, got ? `${fmtDateMs(v!.at)} · ${rewardLabel(a.reward)}` : secret ? '보상: ???' : `보상: ${rewardLabel(a.reward)}`))));
    }
    pane.append(h('h4', { class: 'sub' }, GROUP_NAMES[g] ?? g), list);
  }
}

// ================================================================ 미션 · 계급 (GDD §9.3–9.4)
export function showMissions(app: App): void {
  const { body } = shell(app, 'missions', '미션');
  markSeen(app, 'missions');
  const p = app.p;
  const maxed = p.rank >= RANK_MAX;
  const next = maxed ? null : rankRewardPreview(p.rank + 1);
  const nextChar = next?.unlocks.map(id => CHAR_BY_ID[id]).find(Boolean) ?? null;
  const rankChars = CHARACTERS.filter(c => c.unlock.kind === 'rank');
  body.append(h('section', { class: 'mpanel rank' },
    h('div', { class: 'rank-head' },
      h('span', { class: 'rank-no' }, h('small', {}, '계급'), h('b', {}, String(p.rank))),
      h('div', { class: 'rank-txt' },
        RANK_TITLES[p.rank] ? h('b', {}, RANK_TITLES[p.rank]) : null,
        maxed ? h('small', {}, '가장 높은 계급이에요!') : h('small', {}, `다음 계급까지 미션 별 ${fmtNum(RANK_XP(p.rank) - p.xp)}개`),
        bar(maxed ? 1 : p.xp / RANK_XP(p.rank), 'xp'),
        maxed ? null : h('small', { class: 'muted' }, `${p.xp}/${RANK_XP(p.rank)}`))),
    next ? h('div', { class: 'rank-next' },
      h('span', {}, `${josa(`계급 ${next.rank}`, '이/가')} 되면`),
      coinAmount(next.coins),
      nextChar ? h('span', { class: 'rank-char' }, charPortrait(nextChar, 34), `${josa(nextChar.name, '이/가')} 합류해요`)
        : next.title ? h('span', {}, `칭호 「${next.title}」`) : null) : null,
    rankChars.length ? h('div', { class: 'rank-road' }, ...rankChars.map(c => {
      const n = (c.unlock as { n: number }).n; const got = p.unlocked.includes(c.id);
      return h('span', { class: 'tag' + (got ? ' jade' : '') }, got ? icon('check') : icon('lock'), `계급 ${n} ${c.name}`);
    })) : null));

  const list = h('div', { class: 'missions' });
  const render = () => {
    clear(list);
    p.missions.forEach((m, i) => {
      const rw = missionReward(m); const tag = missionTag(m);
      const cur = Math.min(m.progress, m.target);
      list.append(h('article', { class: 'mission' + (m.progress >= m.target * 0.8 ? ' close' : ''), 'data-mission': m.id },
        h('div', { class: 'mission-top' }, starRow(rw.xp, 3, 'sm'), tag ? h('span', { class: 'tag' + (tag === '별난' ? ' gold' : '') }, tag) : null),
        h('b', { class: 'mission-txt' }, missionText(m)),
        bar(cur / m.target),
        h('div', { class: 'mission-foot' },
          h('small', {}, `${fmtNum(cur)} / ${fmtNum(m.target)}`),
          h('span', { class: 'mission-rw' }, `계급 별 +${rw.xp}`, coinAmount(rw.coins, 'sm')),
          h('button', { class: 'ms-btn sm ghost', disabled: !canReroll(p, i), 'aria-label': '다른 미션으로 바꾸기', onclick: app.click(() => { if (reroll(p, i)) { app.persist(); render(); } }) }, icon('swap'), '바꾸기'))));
    });
  };
  render();
  body.append(h('h4', { class: 'sub' }, icon('mission'), '진행 중인 미션'), h('p', { class: 'ms-hint' }, '미션은 늘 3개예요. 끝내면 바로 새 미션이 와요. 마음에 안 들면 언제든 무료로 바꿔요 (바꾼 미션은 보상이 없어요).'), list);

  const T = p.totals;
  body.append(section('누적 기록', 'trophy',
    h('div', { class: 'kvgrid' },
      kv('달린 판', `${fmtNum(T.runs)}판`), kv('달린 거리', fmtDist(T.dist)), kv('달린 시간', fmtDuration(T.playTime)),
      kv('별사탕', `${fmtNum(T.jellies)}개`), kv('왕별사탕', `${fmtNum(T.bigJellies)}개`), kv('주운 엽전', `${fmtNum(T.coins)}개`),
      kv('보름달 잔치', `${fmtNum(T.bonusTimes)}번`), kv('한 줄 완성', `${fmtNum(T.lines)}번`), kv('아슬아슬', `${fmtNum(T.nearMisses)}번`),
      kv('가장 긴 흐름', `${fmtNum(T.bestStreak)}`), kv('끝낸 미션', `${fmtNum(p.missionsDone)}개`), kv('참여한 날', `${fmtNum(p.daysPlayed)}일`))));
}

// ================================================================ 명예의 전당 (GDD §10.6)
let hallTab: 'endless' | 'daily' | 'stage' = 'endless';
let hallChar = '';

function recRow(i: number | null, r: HallRec, extra?: Node | null): HTMLElement {
  const c = CHAR_BY_ID[r.charId];
  return h('div', { class: 'hrow' + (i !== null && i < 3 ? ` top${i + 1}` : '') },
    i !== null ? h('span', { class: 'hrank' }, String(i + 1)) : null,
    c ? charPortrait(c, 36) : null,
    h('div', { class: 'htxt' },
      h('b', {}, `${fmtNum(r.score)}점`),
      h('small', {}, [fmtDist(r.dist), c?.name ?? '', fmtDateMs(r.date)].filter(Boolean).join(' · '))),
    extra ?? null,
    h('span', { class: 'hicons' },
      r.assist ? h('span', { class: 'hflag assist', title: '도움을 켠 기록' }, icon('assist'), '도움') : null,
      r.relay ? h('span', { class: 'hflag relay', title: '이어달리기를 쓴 기록' }, icon('relay')) : null,
      r.scoreVersion && r.scoreVersion !== SCORE_VERSION ? h('span', { class: 'hflag', title: '예전 점수 규칙' }, `v${r.scoreVersion}`) : null));
}

export function showHall(app: App): void {
  const { body } = shell(app, 'hall', '명예의 전당');
  markSeen(app, 'hall');
  const p = app.p;
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const pane = h('div', { class: 'tabpane hall' });
  const empty = (t: string) => h('p', { class: 'empty' }, t);
  const render = () => {
    clear(tabs); clear(pane);
    for (const [k, label] of [['endless', '무한 달리기'], ['daily', '오늘의 골목'], ['stage', '골목 지도']] as [typeof hallTab, string][])
      tabs.append(h('button', { class: 'tab' + (hallTab === k ? ' on' : ''), role: 'tab', 'aria-selected': hallTab === k ? 'true' : 'false', 'data-tab': k, onclick: app.click(() => { hallTab = k; render(); }) }, label));
    if (hallTab === 'endless') {
      const recs = p.hall.filter(r => r.mode === 'endless');
      const chars = CHARACTERS.filter(c => recs.some(r => r.charId === c.id));
      if (hallChar && !chars.some(c => c.id === hallChar)) hallChar = '';
      pane.append(h('div', { class: 'chips' },
        h('button', { class: 'ms-chip' + (!hallChar ? ' on' : ''), onclick: app.click(() => { hallChar = ''; render(); }) }, '모두'),
        ...chars.map(c => h('button', { class: 'ms-chip' + (hallChar === c.id ? ' on' : ''), onclick: app.click(() => { hallChar = c.id; render(); }) }, charPortrait(c, 26), c.name))));
      const mine = recs.filter(r => !hallChar || r.charId === hallChar).sort((a, b) => b.score - a.score);
      const plain = mine.filter(r => !r.assist).slice(0, 10); const helped = mine.filter(r => r.assist).slice(0, 10);
      pane.append(h('h4', { class: 'sub' }, icon('trophy'), hallChar ? `${charName(hallChar)} 상위 10` : '상위 10'),
        plain.length ? h('div', { class: 'hlist' }, ...plain.map((r, i) => recRow(i, r))) : empty('아직 기록이 없어요. 무한 달리기를 달리면 여기에 남아요!'));
      if (helped.length) pane.append(h('h4', { class: 'sub' }, icon('assist'), '도움을 켠 기록'), h('div', { class: 'hlist' }, ...helped.map((r, i) => recRow(i, r))));
    } else if (hallTab === 'daily') {
      const days = Object.entries(p.daily).sort((a, b) => b[0].localeCompare(a[0]));
      pane.append(h('p', { class: 'ms-hint' }, `참여한 날 ${fmtNum(p.daysPlayed)}일 · 날마다 가장 좋은 기록만 남아요.`));
      if (!days.length) { pane.append(empty('아직 오늘의 골목 기록이 없어요.')); return; }
      pane.append(h('div', { class: 'hlist' }, ...days.map(([k, d]) => {
        const c = CHAR_BY_ID[d.charId]; const hr = p.hall.find(r => r.mode === 'daily' && r.key === k && r.score === d.best);
        return h('div', { class: 'hrow' },
          medalBadge(d.medal, false),
          h('div', { class: 'htxt' }, h('b', {}, fmtDateKey(k)), h('small', {}, `${fmtNum(d.best)}점 · ${fmtDist(d.bestDist ?? d.dist)} · ${c?.name ?? ''} · ${fmtNum(d.tries)}번 달림`)),
          h('span', { class: 'hicons' }, hr?.assist ? h('span', { class: 'hflag assist' }, icon('assist'), '도움') : null));
      })));
    } else {
      const rows = STAGES.filter(st => p.stageBest[st.id] || p.starMask[st.id]);
      if (!rows.length) { pane.append(empty('골목에 도착하면 기록이 여기에 남아요.')); return; }
      pane.append(h('div', { class: 'hlist' }, ...rows.map(st => {
        const recs = p.hall.filter(r => r.mode === 'stage' && r.key === st.id).sort((a, b) => b.score - a.score);
        const top = recs.find(r => !r.assist) ?? recs[0];
        return h('div', { class: 'hrow stage-row' },
          h('span', { class: 'hstage' }, st.id),
          h('div', { class: 'htxt' }, h('b', {}, st.name), h('small', {}, top ? `${fmtNum(top.score)}점 · ${charName(top.charId)} · ${fmtDateMs(top.date)}` : p.stageBest[st.id] ? `${fmtNum(p.stageBest[st.id])}점` : '')),
          starRow(stageStarCount(p, st.id), 3, 'sm'),
          h('span', { class: 'hicons' }, top?.assist ? h('span', { class: 'hflag assist' }, icon('assist'), '도움') : null));
      })));
    }
  };
  body.append(tabs, pane);
  render();
}

// ================================================================ 오늘의 골목 (GDD §8.4)
export function showDaily(app: App): void {
  const { body } = shell(app, 'daily', '오늘의 골목');
  markSeen(app, 'daily');
  const p = app.p; const dk = todayKey(); const d = p.daily[dk];
  const ch = CHAR_BY_ID[dailyChar(dk)]; const comp = COMPANION_BY_ID[dailyCompanion(dk)];
  const lentC = ch && !p.unlocked.includes(ch.id); const lentP = comp && !p.companions.includes(comp.id);
  const bestDist = d?.dist ?? 0; const medal = d?.medal ?? 0;
  const MAXD = Math.round(DAILY_MEDALS[DAILY_MEDALS.length - 1] * 1.15);
  const track = h('div', { class: 'medal-track', 'aria-label': `최고 ${fmtDist(bestDist)}` },
    h('i', { class: 'fill', style: `width:${Math.min(100, (100 * bestDist) / MAXD).toFixed(1)}%` }),
    ...DAILY_MEDALS.map((m, i) => h('span', { class: `mark ${['bronze', 'silver', 'gold'][i]}${bestDist >= m ? ' on' : ''}`, style: `left:${((100 * m) / MAXD).toFixed(1)}%` })));
  const share = () => {
    if (!d) return;
    const code = recordCode(dk, d.best, d.bestDist ?? d.dist, !!d.assist);   // score and distance of the SAME try
    const text = `야식 대질주 · 오늘의 골목 ${fmtDateKey(dk, false)}\n${fmtNum(d.best)}점 · ${fmtDist(d.bestDist ?? d.dist)}${d.medal ? ` · ${MEDAL_NAMES[d.medal]}메달` : ''}\n기록 코드 ${code}`;
    shareText(app, text);
  };
  body.append(
    h('section', { class: 'mpanel daily-today' },
      h('div', { class: 'daily-date' }, icon('calendar'), h('b', {}, fmtDateKey(dk)), h('small', {}, '누구나 같은 코스예요')),
      h('div', { class: 'daily-cast' },
        h('div', { class: 'cast' }, ch ? charPortrait(ch, 76) : null, h('div', {}, h('small', {}, '오늘의 주자'), h('b', {}, ch?.name ?? ''), lentC ? h('span', { class: 'tag gold' }, '오늘만 빌려줘요') : null)),
        comp ? h('div', { class: 'cast' }, companionPortrait(comp, 56), h('div', {}, h('small', {}, '오늘의 짝꿍'), h('b', {}, comp.name), lentP ? h('span', { class: 'tag gold' }, '오늘만 빌려줘요') : null)) : null),
      h('div', { class: 'medals' }, ...DAILY_MEDALS.map((m, i) => h('div', { class: 'medal-card' + (medal > i ? ' on' : '') }, medalBadge(i + 1, false), h('b', {}, `${MEDAL_NAMES[i + 1]}메달`), h('small', {}, fmtDist(m))))),
      track,
      h('div', { class: 'bigstat' },
        h('b', {}, d ? `${fmtNum(d.best)}점` : '아직 안 달렸어요'),
        h('small', {}, d ? `최고 ${fmtDist(d.dist)} · ${fmtNum(d.tries)}번 달렸어요 · 몇 번이든 다시 달려도 돼요` : '몇 번이든 달릴 수 있고, 가장 좋은 기록만 남아요')),
      h('button', { class: 'ms-btn primary huge', id: 'daily-go', onclick: app.click(() => app.startDaily(dk)) }, icon('play'), h('span', { class: 'lbl' }, '달리기', h('small', {}, '혼자 달려요 · 이어달리기 없음'))),
      d ? h('div', { class: 'share-row' }, h('code', {}, recordCode(dk, d.best, d.bestDist ?? d.dist, !!d.assist)), h('button', { class: 'ms-btn sm', id: 'daily-share', onclick: app.click(share) }, icon('share'), '기록 공유')) : null),
    h('p', { class: 'days-played' }, icon('calendar'), ` 참여한 날 ${fmtNum(p.daysPlayed)}일`));

  const past = dailyArchive(dk).slice(1);
  body.append(section('지난 7일', 'calendar', h('p', { class: 'ms-hint' }, '지난 골목도 계속 달릴 수 있어요. 놓친 날이 있어도 괜찮아요.'),
    h('div', { class: 'hlist' }, ...past.map(k => {
      const r = p.daily[k]; const c = CHAR_BY_ID[dailyChar(k)];
      return h('div', { class: 'hrow arch', 'data-day': k },
        c ? charPortrait(c, 36) : null,
        h('div', { class: 'htxt' }, h('b', {}, fmtDateKey(k)), h('small', {}, r ? `${fmtNum(r.best)}점 · ${fmtDist(r.dist)}` : `${c?.name ?? ''} · 아직 안 달렸어요`)),
        r ? medalBadge(r.medal, false) : null,
        h('button', { class: 'ms-btn sm', onclick: app.click(() => app.startDaily(k)) }, icon('play'), '달리기'));
    }))));
}

/** Web Share when available, else clipboard, else show the text. */
export function shareText(app: App, text: string): void {
  const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
  const copy = () => {
    try { navigator.clipboard.writeText(text).then(() => app.toast('기록을 복사했어요', 'good'), () => app.toast(text, 'info', 6)); } catch { app.toast(text, 'info', 6); }
  };
  if (nav.share) { nav.share({ text }).catch((e: { name?: string }) => { if (e?.name !== 'AbortError') copy(); }); return; }
  copy();
}
/** kept for older callers */
export function share(app: App, text: string): void { shareText(app, text); }

// ================================================================ 설정 (GDD §10.5)
export function showSettings(app: App): void {
  const { body } = shell(app, 'settings', '설정');
  const p = app.p; const st = p.settings;
  const save = () => { app.applySettings(); applyUi(app); app.persist(); };
  type BoolKey = { [K in keyof typeof st]: typeof st[K] extends boolean ? K : never }[keyof typeof st];
  const toggle = (key: BoolKey, label: string, desc: string, after?: () => void) => h('label', { class: 'set', 'data-set': key },
    h('span', { class: 'txt' }, h('b', {}, label), desc ? h('small', {}, desc) : null),
    h('input', { type: 'checkbox', class: 'switch', checked: !!st[key], onchange: (e: Event) => { (st as unknown as Record<string, boolean>)[key] = (e.target as HTMLInputElement).checked; save(); after?.(); } }));
  const range = (label: string, desc: string, get: () => number, set: (v: number) => void, fmt: (v: number) => string, key: string, done?: () => void) => {
    const out = h('output', {}, fmt(get()));
    return h('label', { class: 'set range', 'data-set': key },
      h('span', { class: 'txt' }, h('b', {}, label), desc ? h('small', {}, desc) : null),
      h('span', { class: 'range-wrap' },
        h('input', { type: 'range', min: 0, max: 10, step: 1, value: Math.round(get() * 10), 'aria-label': label,
          oninput: (e: Event) => { const v = +(e.target as HTMLInputElement).value / 10; set(v); out.textContent = fmt(v); app.audio.setVolumes(st.sfx, st.musicOff ? 0 : st.bgm); },
          onchange: () => { save(); done?.(); } }),
        out));
  };
  const seg = (label: string, desc: string, opts: [number, string][], get: () => number, set: (v: number) => void, key: string) => {
    const box = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    const draw = () => { clear(box); for (const [v, t] of opts) box.append(h('button', { class: Math.abs(get() - v) < 0.001 ? 'on' : '', role: 'radio', 'aria-checked': Math.abs(get() - v) < 0.001 ? 'true' : 'false', onclick: app.click(() => { set(v); save(); draw(); }) }, t)); };
    draw();
    return h('div', { class: 'set segrow', 'data-set': key }, h('span', { class: 'txt' }, h('b', {}, label), desc ? h('small', {}, desc) : null), box);
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  add(body,
    section('소리', 'sound',
      range('배경음', '', () => st.bgm, v => { st.bgm = v; }, pct, 'bgm'),
      range('효과음', '', () => st.sfx, v => { st.sfx = v; }, pct, 'sfx', () => { app.audio.unlock(); app.audio.play('jelly'); }),
      toggle('musicOff', '음악 끄기', '효과음만 들려요')),
    section('조작', 'hand',
      toggle('swapSides', '좌우 바꾸기', '점프를 오른쪽, 슬라이드를 왼쪽에 둬요'),
      toggle('showPads', '버튼 표시', '가로 화면에서도 엄지 자리 안내를 늘 보여 줘요'),
      toggle('slideToggle', '슬라이드 토글', '누르고 있지 않아도 한 번 누르면 잠깐 슬라이드해요'),
      h('p', { class: 'ms-hint small' }, '키보드: 점프 Space · ↑ · W · Z / 슬라이드 ↓ · S · X · Shift (누르고 있기) / 멈춤 Esc · P'),
      h('div', { class: 'set' }, h('span', { class: 'txt' }, h('b', {}, '첫 달리기'), h('small', {}, '조작을 처음부터 다시 연습해요')), h('button', { class: 'ms-btn sm', id: 'set-tutorial', onclick: app.click(() => app.startTutorial()) }, icon('play'), '첫 달리기'))),
    section('보기 · 접근성', 'eye',
      toggle('reduceMotion', '움직임 줄이기', '번쩍임, 회전, 흔들리는 연출을 줄여요'),
      range('화면 흔들림', '부딪힐 때 화면이 흔들리는 정도', () => st.shake, v => { st.shake = v; }, pct, 'shake'),
      toggle('highContrast', '위험물 강조', '위험물 테두리를 굵게, 배경은 차분하게'),
      toggle('lowFx', '효과 줄이기', '반짝이와 파티클을 줄여요'),
      seg('UI 크기', '글자와 버튼 크기', [[1, '100%'], [1.15, '115%'], [1.3, '130%']], () => st.uiScale || 1, v => { st.uiScale = v; }, 'uiScale'),
      toggle('fps30', '배터리 절약', '초당 30장으로 그려서 배터리를 아껴요'),
      'vibrate' in navigator ? toggle('vibrate', '진동', '부딪히면 짧게 떨려요') : null),
    section('도움', 'assist',
      h('p', { class: 'ms-hint' }, '도움을 켜도 별, 미션, 해금은 모두 그대로 받아요. 기록 옆에 작은 ', h('span', { class: 'hflag assist' }, icon('assist'), '도움'), ' 표시만 붙고, 명예의 전당에서 따로 모아 보여 줘요.'),
      seg('게임 속도', '느리게 하면 생각할 시간이 늘어요. 코스는 그대로예요', [[0.6, '60'], [0.7, '70'], [0.8, '80'], [0.9, '90'], [1, '100%']], () => st.gameSpeed || 1, v => { st.gameSpeed = v; }, 'gameSpeed'),
      toggle('assistNoHit', '부딪혀도 따끈함 유지', '장애물에 부딪혀도 식지 않아요'),
      toggle('assistHalfDrain', '식는 속도 절반', '시간이 지나며 식는 속도가 절반이에요'),
      toggle('assistAutoSlide', '자동 슬라이드', '매달린 장애물 앞에서 저절로 슬라이드해요')),
    dataSection(app),
    (import.meta.env?.DEV || /[?&]dev\b/.test(location.search) || st.showHitbox)
      ? section('개발', 'code', toggle('showHitbox', '판정 상자 보기', '실제 부딪힘 판정을 상자로 그려요 (H 키)')) : null,
    h('p', { class: 'ms-foot' }, `야식 대질주 v${VERSION} · 코스 ${(CONTENT_HASH >>> 0).toString(16).slice(0, 6)} · 서버, 계정, 광고 없이 이 기기에만 저장돼요`));
}

function dataSection(app: App): HTMLElement {
  const box = h('textarea', { class: 'code-box', rows: 3, spellcheck: false, placeholder: '백업 코드를 여기에 붙여 넣어요', 'aria-label': '백업 코드' }) as HTMLTextAreaElement;
  const areaBtns = h('div', { class: 'btnrow' });
  const area = h('div', { class: 'code-area hidden' }, box, areaBtns);
  const copy = (text: string) => {
    try { navigator.clipboard.writeText(text).then(() => app.toast('백업 코드를 복사했어요', 'good'), () => app.toast('코드를 길게 눌러 복사해 주세요', 'info')); } catch { app.toast('코드를 길게 눌러 복사해 주세요', 'info'); }
  };
  const doImport = (text: string) => {
    const r = store.importString(text);
    if (!r.p) { app.audio.play('error'); app.toast(r.error ?? '코드를 읽지 못했어요', 'warn', 4); return; }
    app.confirm('이 백업 코드로 지금 기록을 바꿀까요? 지금 기록은 사라져요.', () => { app.p = r.p!; app.persist(); app.applySettings(); app.toast('백업을 불러왔어요', 'good'); showSettings(app); });
  };
  const mode = (m: 'export' | 'import') => {
    area.classList.remove('hidden'); clear(areaBtns);
    if (m === 'export') {
      box.readOnly = true; box.value = store.exportString(app.p); box.select(); copy(box.value);
      areaBtns.append(h('button', { class: 'ms-btn sm', onclick: app.click(() => { box.select(); copy(box.value); }) }, icon('copy'), '복사'));
    } else {
      box.readOnly = false; box.value = ''; box.focus();
      areaBtns.append(
        h('button', { class: 'ms-btn sm primary', id: 'data-load', onclick: app.click(() => { if (box.value.trim()) doImport(box.value); else app.toast('백업 코드를 먼저 붙여 넣어 주세요', 'info'); }) }, icon('check'), '불러오기'),
        h('button', { class: 'ms-btn sm ghost', onclick: app.click(() => file.click()) }, '파일 열기'));
    }
  };
  const file = h('input', { type: 'file', accept: '.txt,text/plain', class: 'hidden', onchange: (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    f.text().then(t => { box.value = t.trim(); doImport(t); }, () => app.toast('파일을 읽지 못했어요', 'warn'));
  } }) as HTMLInputElement;
  const ok = store.storageInfo.available;
  return section('데이터', 'data',
    h('p', { class: 'ms-hint' + (ok ? '' : ' warn') }, ok ? '기록은 이 브라우저에 저장돼요. 다른 기기로 옮기거나 지켜 두려면 백업 코드를 써요.' : '이 브라우저는 지금 기록을 저장하지 못해요. 백업 코드를 꼭 저장해 두세요.'),
    h('p', { class: 'ms-note' }, '사파리는 오래 열지 않으면 기록을 지울 수 있어요 — 홈 화면에 추가하거나 백업 코드를 저장해 두세요'),
    h('div', { class: 'btnrow' },
      h('button', { class: 'ms-btn sm', id: 'data-export', onclick: app.click(() => mode('export')) }, icon('copy'), '내보내기'),
      h('button', { class: 'ms-btn sm', id: 'data-download', onclick: app.click(() => {
        try {
          const blob = new Blob([store.backupFileContent(app.p)], { type: 'text/plain;charset=utf-8' });
          const a = h('a', { href: URL.createObjectURL(blob), download: store.backupFileName() }); document.body.append(a); a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        } catch { app.toast('내려받기가 안 되는 환경이에요. 내보내기로 복사해 주세요', 'warn'); }
      }) }, icon('download'), '내려받기'),
      h('button', { class: 'ms-btn sm', id: 'data-import', onclick: app.click(() => mode('import')) }, icon('data'), '가져오기')),
    area, file,
    h('div', { class: 'set danger-row' }, h('span', { class: 'txt' }, h('b', {}, '처음부터 다시'), h('small', {}, '엽전, 별, 주자, 기록이 모두 지워져요. 설정은 남아요')),
      h('button', { class: 'ms-btn sm danger', id: 'data-reset', onclick: app.click(() => app.confirm('정말 처음부터 다시 할까요? 되돌릴 수 없어요.', () => {
        const keep = app.p.settings; app.p = defaultProgress(); app.p.settings = keep;
        try { for (const k of store.listGhosts()) store.removeGhost(k); } catch { /* ignore */ }
        app.persist(); app.toast('새로 시작해요', 'good'); app.showHome();
      })) }, '다시 하기')));
}
