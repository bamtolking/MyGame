// Results (GDD §10.4): ONE screen, no scroll (fits 360×640), input ignored for RESULTS_INPUT_GUARD and only a
// FRESH pointerdown / keydown counts, so a thumb still mashing jump at the KO can never skip it. 다시 달리기 is the
// biggest button (portrait: where the jump pad was; landscape: under the right thumb); holding jump for 0.4 s
// also retries. Everything the run earned (missions, unlocks, achievements) is shown inline — no modal chains.
// Pure helpers (deathExplain, warmthLedger, scoreBreakdown, almostChips, tipFor) are exported for tests/menus.
import type { RunState } from '../sim/types';
import type { RunConfig } from '../sim/run';
import { totalScore, jellyPct } from '../sim/run';
import { SCORE, HIT_DAMAGE, FALL_DAMAGE, BONUS_WORD } from '../data/tuning';
import { GROUND_Y } from '../data/physics';
import { BIOME_BY_ID, BIOMES } from '../data/biomes';
import { STAGE_BY_ID, STAGES } from '../data/stages';
import { CHAR_BY_ID } from '../data/characters';
import { COMPANION_BY_ID } from '../data/companions';
import { stageUnlocked, DAILY_MEDALS, type Progress, type RunReward } from '../meta/progress';
import { missionText } from '../meta/missions';
import { drawHazardIcon } from '../render/renderer';
import { keyZone } from './input';
import { h, onTap } from './dom';

export const RESULTS_INPUT_GUARD = 0.35;   // s
export const HOLD_RETRY_T = 0.4;           // s of holding jump that also retries

export function fmtNum(n: number): string { return Math.round(n).toLocaleString('ko-KR'); }

export type KoKind = 'spike' | 'tall' | 'hang' | 'low' | 'pit' | 'drain' | 'cap';
const VERB: Record<KoKind, string> = {
  spike: '한 번 점프', tall: '2단 점프', hang: '슬라이드를 누르고 있기', low: '점프하지 말고 달리기', pit: '끝에서 점프',
  drain: '꿀물 길을 따라가요', cap: '끝까지 달렸어요',
};
/** The tutorial / hint verb for a hazard kind (short, for overlays). */
export const HINT_VERB: Record<string, { text: string; sub: string; zone: 'jump' | 'slide' | null }> = {
  spike: { text: '점프!', sub: '가시 앞에서 한 번 눌러요', zone: 'jump' },
  tall: { text: '2단 점프!', sub: '뛰어오른 뒤 공중에서 한 번 더', zone: 'jump' },
  hang: { text: '슬라이드 누르고 있기!', sub: '매달린 것 밑을 미끄러져요', zone: 'slide' },
  low: { text: '점프하지 말고 달리기', sub: '낮은 처마 밑은 그대로 지나가요', zone: null },
  pit: { text: '끝에서 점프!', sub: '땅이 끊기기 직전에 눌러요', zone: 'jump' },
};

/** Screen name of a hazard kind in a biome (skins follow the biome, GDD §11.3). */
export function hitName(kind: string, biome = 'market'): string {
  const bi = BIOME_BY_ID[biome] ?? BIOMES[0];
  const k = kind === 'low' ? 'hang' : kind;
  return (bi.hazardName as Record<string, string>)[k] ?? kind;
}

/** Was the hanging hazard at world x a low ceiling (row 8: run under it standing)? */
export function isLowCeiling(s: RunState, x: number): boolean {
  const hz = s.level.hazards.find(z => z.kind === 'hang' && Math.abs((z.x0 + z.x1) / 2 - x) < 2);
  return !!hz && hz.y1 < GROUND_Y - 60;
}
export function hazardKindAt(s: RunState, kind: string, x: number): KoKind {
  if (kind === 'hang' && isLowCeiling(s, x)) return 'low';
  return (['spike', 'tall', 'hang', 'pit'].includes(kind) ? kind : 'spike') as KoKind;
}

/** Why did the run end? Always concrete: the hazard (biome skin name) + the verb that clears it. */
export function deathExplain(s: RunState): { kind: KoKind; biome: string; name: string; verb: string; line: string } {
  const cause = s.deathCause ?? 'drain';
  const biome = s.lastHit?.biome ?? s.biome;
  if (cause === 'cap') return { kind: 'cap', biome, name: '10분 완주', verb: VERB.cap, line: '10분을 끝까지 달렸어요!' };
  if (cause === 'drain' || !s.lastHit) return { kind: 'drain', biome, name: '다 식었어요', verb: VERB.drain, line: '다 식었어요 — 꿀물 길을 따라가요' };
  const raw = cause === 'pit' ? 'pit' : cause.startsWith('hit:') ? cause.slice(4) : s.lastHit.kind;
  const kind = hazardKindAt(s, raw, s.lastHit.x);
  const name = kind === 'low' ? '낮은 처마' : hitName(kind, biome);
  return { kind, biome, name, verb: VERB[kind], line: `${name} — ${VERB[kind]}` };
}

/** 따끈함 장부: where the warmth went. */
export function warmthLedger(s: RunState): { time: number; hits: number; hitDmg: number; falls: number; fallDmg: number; honey: number } {
  const noHit = !!s.assistOpts?.noHitDamage;
  const falls = s.stats.falls; const paid = Math.max(0, falls - (s.stats.pitsGuarded ?? 0));
  return {
    time: Math.round(s.stats.drained), hits: s.stats.hits, hitDmg: noHit ? 0 : s.stats.hits * HIT_DAMAGE,
    falls, fallDmg: noHit ? 0 : paid * FALL_DAMAGE, honey: Math.round(s.stats.hpFromPotions),
  };
}

/** 점수 내역 — by source (flat values from SCORE; 흐름 보너스 is whatever the flow multiplier added on top). */
export function scoreBreakdown(s: RunState): { key: string; label: string; value: number }[] {
  const st = s.stats;
  const rows: { key: string; label: string; value: number }[] = [
    { key: 'dist', label: '거리', value: Math.floor(s.dist * SCORE.perMeter) },
    { key: 'jelly', label: '별사탕', value: (st.jellies - st.bigJellies) * SCORE.jelly },
    { key: 'big', label: '왕별사탕', value: st.bigJellies * SCORE.big },
    { key: 'line', label: '한 줄', value: st.lines * SCORE.line },
    { key: 'near', label: '아슬아슬', value: st.nearMisses * SCORE.nearMiss },
    { key: 'bonus', label: '보름달 잔치', value: st.bonusJellies * SCORE.bonusJelly + st.moonCakes * SCORE.moonCake },
    { key: 'smash', label: '부수기', value: st.smashed * SCORE.smash },
    { key: 'coin', label: '엽전', value: st.coins * SCORE.coin },
    { key: 'letter', label: '글자', value: st.letters * SCORE.letter },
    { key: 'pouch', label: '복주머니', value: st.pouches * SCORE.pouch },
  ];
  const sum = rows.reduce((a, r) => a + r.value, 0);
  const flow = Math.max(0, totalScore(s) - sum);
  rows.splice(3, 0, { key: 'flow', label: '흐름 보너스', value: flow });
  return rows;
}

/** '아깝다' chips — at most 3, nearest first. */
export function almostChips(s: RunState, rw: RunReward, p: Progress, dateKey: string): string[] {
  const out: { t: string; gap: number }[] = [];
  const dist = Math.floor(s.dist);
  if (!s.trial && s.mode !== 'tutorial') {
    if (s.mode === 'endless' || s.mode === 'daily') {
      const best = s.mode === 'endless' ? (rw.newBest ? 0 : p.bestEndless?.dist ?? 0) : (rw.newBest ? 0 : p.daily[dateKey]?.dist ?? 0);
      const d = best - dist;
      if (best > 0 && d > 0 && d / best <= 0.3) out.push({ t: `최고까지 ${fmtNum(d)}m`, gap: d / best });
      if (s.mode === 'daily') { const next = DAILY_MEDALS.find(m => m > dist); if (next && next - dist <= next * 0.25) out.push({ t: `다음 메달까지 ${fmtNum(next - dist)}m`, gap: (next - dist) / next }); }
    }
    if (s.mode === 'stage' && s.stageId) {
      const st = STAGE_BY_ID[s.stageId];
      if (s.phase !== 'clear' && s.level.stageLen > 0) { const d = Math.max(1, s.level.stageLen - dist); if (d / s.level.stageLen <= 0.35) out.push({ t: `도착까지 ${fmtNum(d)}m`, gap: d / s.level.stageLen }); }
      if (st && s.phase === 'clear') { const pc = jellyPct(s); const g = st.stars.jellyPct - pc; if (g > 0 && g <= 20 && !((p.starMask[st.id] ?? 0) & 2)) out.push({ t: `★2까지 ${g}%`, gap: g / st.stars.jellyPct }); }
    }
    const got = s.letters.filter(Boolean).length;
    if (got >= 3 && got < BONUS_WORD.length) out.push({ t: `글자 ${BONUS_WORD.length - got}개 부족`, gap: (BONUS_WORD.length - got) / BONUS_WORD.length });
    for (const m of p.missions) {
      const k = m.target > 0 ? m.progress / m.target : 0;
      if (k >= 0.8 && k < 1) out.push({ t: `미션 ${Math.floor(k * 100)}% · ${missionText(m)}`, gap: 1 - k });
    }
  }
  return out.sort((a, b) => a.gap - b.gap).slice(0, 3).map(o => o.t);
}

/** One tip line, chosen by the most-hit kind. */
export function tipFor(s: RunState): string {
  const by: Record<string, number> = { ...s.stats.hitsBy };
  if (s.stats.falls) by.pit = (by.pit ?? 0) + s.stats.falls;
  const worst = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2) {
    switch (worst[0]) {
      case 'spike': return '가시는 가까이 왔을 때 한 번만 점프해요';
      case 'tall': return '높은 탑은 점프 두 번 — 올라가는 중에 한 번 더 눌러요';
      case 'hang': return '매달린 것은 슬라이드를 누른 채로 지나가요';
      case 'pit': return '구덩이는 끝자락에서 점프해요 — 별사탕 아치를 따라가요';
    }
  }
  if (s.phase !== 'clear' && (s.deathCause ?? 'drain') === 'drain' && s.stats.hits <= 1) return '꿀물 길을 따라가면 더 오래 따끈해요';
  if (s.phase === 'clear' && s.stageId) {
    const st = STAGE_BY_ID[s.stageId];
    if (st && jellyPct(s) < st.stars.jellyPct) return '별사탕 줄이 곧 안전한 길이에요 — 줄을 따라가면 ★2가 가까워요';
    if (((s.pouchesGot ?? 0) & 7) !== 7) return '황금 복주머니는 높은 길, 위험한 줄, 멀리 보이는 갈림길에 숨어 있어요';
  }
  if (s.stats.letters < BONUS_WORD.length && s.stats.bonusTimes === 0) return '보·름·달·잔·치 다섯 글자를 모으면 보름달 잔치가 열려요';
  if (s.stats.nearMisses === 0) return '아슬아슬하게 넘으면 흐름이 두 칸씩 쌓여요';
  return '흐름을 이어가면 별사탕 점수가 최대 +50%예요';
}

/** Next stage offered after a clear (the next unlocked one in map order). */
export function nextStageAfter(p: Progress, id: string): string | null {
  const i = STAGES.findIndex(x => x.id === id); if (i < 0) return null;
  const n = STAGES.slice(i + 1).find(x => stageUnlocked(p, x.id));
  return n ? n.id : null;
}

const MODE_NAME: Record<string, string> = { endless: '무한 달리기', stage: '골목 지도', daily: '오늘의 골목', tutorial: '첫 달리기' };
const MEDAL = ['', '동메달', '은메달', '금메달'];

export interface ResultsOpts {
  s: RunState; rw: RunReward; cfg: RunConfig; p: Progress; dateKey: string;
  portrait: boolean; swap: boolean;
  next: string | null;                       // stage id offered by '다음'
  onRetry: () => void; onHome: () => void; onNext: (() => void) | null;
  play: (name: string, arg?: number) => void;
}

/** Build + mount the results overlay into `host`. Returns a disposer (removes key listeners & timers). */
export function mountResults(host: HTMLElement, o: ResultsOpts): { el: HTMLElement; dispose: () => void; readyAt: number } {
  const { s, rw, p } = o;
  const cleared = s.phase === 'clear';
  const stage = s.stageId ? STAGE_BY_ID[s.stageId] : null;
  const readyAt = performance.now() + RESULTS_INPUT_GUARD * 1000;
  const ready = () => performance.now() >= readyAt;
  let done = false;
  const act = (fn: () => void) => { if (done) return; done = true; dispose(); fn(); };

  // ---- title / score
  const title = s.trial ? '시험 달리기 끝' : s.mode === 'stage' ? (cleared ? '도착!' : '아쉬워요!') : rw.newBest ? '새 기록!' : '달리기 끝';
  const who = CHAR_BY_ID[s.mainId]?.name ?? '';
  const modeLine = `${s.stageId ? `${s.stageId} ${stage?.name ?? ''}` : MODE_NAME[s.mode] ?? ''}${who ? ' · ' + who : ''}${s.relayUsed && CHAR_BY_ID[s.charId] ? '→' + CHAR_BY_ID[s.charId].name : ''}`;
  const scoreEl = h('b', { id: 'res-score' }, '0');
  const sub: string[] = [`${fmtNum(Math.floor(s.dist))}m`];
  if (s.trial) sub.push('기록·보상 없음');
  else if (rw.newBest && rw.prevBest > 0) sub.push(`이전 최고 ${fmtNum(rw.prevBest)}`);
  else if (!rw.newBest && rw.prevBest > 0) sub.push(`최고 ${fmtNum(rw.prevBest)}`);
  if (s.assist) sub.push('도움 켬');
  const head = h('header', { class: 'res-head' },
    h('div', { class: 'res-title' }, h('h2', {}, title), h('small', {}, modeLine)),
    h('div', { class: 'res-score' + (rw.newBest && !s.trial ? ' best' : '') }, scoreEl, h('small', {}, '점')),
    h('div', { class: 'res-sub' }, sub.join(' · ')),
  );

  // ---- stage stars (pop on clear) + the three conditions
  let starsEl: HTMLElement | null = null;
  if (stage && !s.trial) {
    const mask = (rw.prevMask | rw.starMask) & 7; const fresh = rw.starMask & ~rw.prevMask;
    const pouchCount = [0, 1, 2].filter(i => ((p.pouches[stage.id] ?? 0) >> i) & 1).length;
    const thisPouch = [0, 1, 2].filter(i => (s.pouchesGot >> i) & 1).length;
    starsEl = h('div', { class: 'res-stars' },
      h('div', { class: 'stars' }, ...[0, 1, 2].map(i => h('span', { class: 'st' + ((mask >> i) & 1 ? ' on' : '') + ((fresh >> i) & 1 ? ' new' : ''), style: `animation-delay:${0.25 + i * 0.18}s` }, '★'))),
      h('small', {}, [cleared ? '도착' : '도착 전', `별사탕 ${jellyPct(s)}%/${stage.stars.jellyPct}%`, `복주머니 ${cleared ? pouchCount : thisPouch}/3`].join(' · ')),
    );
  }

  // ---- 쓰러짐 card
  let koEl: HTMLElement | null = null;
  if (!cleared && !s.trial) {
    const why = deathExplain(s);
    const cv = document.createElement('canvas'); const W = 58, H = 42; const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); if (g) { g.scale(dpr, dpr); try { drawHazardIcon(g, why.kind === 'low' ? 'hang' : why.kind, why.biome, W, H, why.kind === 'low'); } catch { /* ignore */ } }
    koEl = h('div', { class: 'res-ko k-' + why.kind }, cv, h('div', {}, h('b', {}, why.kind === 'drain' || why.kind === 'cap' ? why.line : `${why.name} — ${why.verb}`), h('small', {}, why.kind === 'drain' ? '시간이 지나면 조금씩 식어요' : why.kind === 'cap' ? '더 달릴 길이 없어요' : why.kind === 'pit' ? '마지막으로 빠진 곳' : '마지막으로 부딪힌 것')));
  }

  // ---- 따끈함 장부
  const L = warmthLedger(s);
  const segs: [string, number, string][] = [['time', L.time, '시간'], ['hit', L.hitDmg, '부딪힘'], ['pit', L.fallDmg, '구덩이'], ['honey', L.honey, '꿀물']];
  const tot = Math.max(1, segs.reduce((a, x) => a + x[1], 0));
  const ledgerTxt = [`시간 −${fmtNum(L.time)}`];
  if (L.hits) ledgerTxt.push(`부딪힘 ${L.hits}회 −${fmtNum(L.hitDmg)}`);
  if (L.falls) ledgerTxt.push(`구덩이 ${L.falls}회 −${fmtNum(L.fallDmg)}`);
  if (L.honey) ledgerTxt.push(`꿀물 +${fmtNum(L.honey)}`);
  const ledger = s.mode === 'tutorial' ? null : h('div', { class: 'res-ledger' },
    h('span', { class: 'lbl' }, '따끈함 장부'),
    h('div', { class: 'bar' }, ...segs.filter(x => x[1] > 0).map(x => h('i', { class: 'sg-' + x[0], style: `flex:${x[1] / tot}` }))),
    h('small', {}, ledgerTxt.join(' · ')));

  // ---- 점수 내역
  const rows = scoreBreakdown(s).filter(r => r.value > 0 || r.key === 'dist' || r.key === 'jelly');
  const breakdown = h('div', { class: 'res-break' }, ...rows.map(r => h('span', { class: 'chip-' + r.key }, h('small', {}, r.label), h('b', {}, fmtNum(r.value)))));

  // ---- '아깝다' chips + tip
  const almost = almostChips(s, rw, p, o.dateKey);
  const almostEl = almost.length ? h('div', { class: 'res-almost' }, ...almost.map(t => h('span', {}, t))) : null;
  const tipEl = s.trial ? null : h('div', { class: 'res-tip' }, h('b', {}, '팁'), ' ', tipFor(s));

  // ---- earned (inline: coins, missions, unlocks, achievements, rank, medal)
  const earned: HTMLElement[] = [];
  if (!s.trial) {
    if (rw.coins > 0) earned.push(h('span', { class: 'e-coin' }, `엽전 +${fmtNum(rw.coins)}`));
    for (const m of rw.missionsDone) earned.push(h('span', { class: 'e-mission' }, `✔ ${m.text}`));
    if (rw.rankUps) earned.push(h('span', { class: 'e-rank' }, `계급 ${p.rank}!`));
    if (rw.medal > rw.prevMedal) earned.push(h('span', { class: 'e-medal' }, `${MEDAL[rw.medal]}!`));
    if (rw.pouchesNew) earned.push(h('span', { class: 'e-pouch' }, `황금 복주머니 +${rw.pouchesNew}`));
    for (const id of rw.unlocked) { const n = CHAR_BY_ID[id]?.name ?? COMPANION_BY_ID[id]?.name; if (n) earned.push(h('span', { class: 'e-unlock' }, `새 친구: ${n}`)); }
    for (const a of rw.achievements ?? []) earned.push(h('span', { class: 'e-ach' }, `업적: ${a.name}`));
  }
  const earnedEl = earned.length ? h('div', { class: 'res-earned' }, ...earned) : null;

  // ---- buttons (≤ 6-char nouns). Retry is the biggest; '다음' only after a stage clear.
  const retryBtn = h('button', { class: 'primary res-retry', id: 'res-retry', type: 'button' }, h('span', {}, '다시 달리기'), h('i', { class: 'hold' }));
  const homeBtn = h('button', { class: 'ghost res-home', id: 'res-home', type: 'button' }, '홈');
  const nextBtn = cleared && o.onNext && o.next ? h('button', { class: 'res-next', id: 'res-next', type: 'button' }, '다음', h('small', {}, o.next)) : null;
  const side = h('div', { class: 'res-side' }, nextBtn, homeBtn);
  const btns = h('div', { class: 'res-btns' + (o.portrait && o.swap ? ' swap' : '') }, retryBtn, side);

  const main = h('div', { class: 'res-main' }, head, starsEl, koEl, ledger, breakdown, almostEl, earnedEl, tipEl);
  const el = h('div', { id: 'results', class: 'res ' + (o.portrait ? 'portrait' : 'landscape') + (cleared ? ' cleared' : '') + (nextBtn ? ' has-next' : '') },
    h('div', { class: 'res-card' }, main, btns));
  host.append(el);

  // ---- fit: never scroll — drop the least important bits until it fits
  const optional: (HTMLElement | null)[] = [tipEl, earnedEl && earned.length > 2 ? earned[earned.length - 1] : null, almostEl && almostEl.children.length > 1 ? almostEl.lastElementChild as HTMLElement : null, ledger?.querySelector('small') as HTMLElement ?? null, almostEl, head.querySelector('.res-sub') as HTMLElement];
  const fits = () => main.scrollHeight <= main.clientHeight + 1;
  for (const x of optional) { if (fits()) break; if (x) x.style.display = 'none'; }
  if (!fits()) { const rest = Array.from(breakdown.children) as HTMLElement[]; for (let i = rest.length - 1; i > 2 && !fits(); i--) rest[i].style.display = 'none'; }
  if (!fits() && earnedEl) earnedEl.style.display = 'none';

  // ---- score count-up (any tap skips)
  const target = rw.score || totalScore(s); const t0 = performance.now(); let raf = 0; let skipped = false;
  const tick = () => { const k = skipped ? 1 : Math.min(1, (performance.now() - t0) / 900); scoreEl.textContent = fmtNum(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  const timers: number[] = [];
  if (starsEl) { const fresh = rw.starMask & ~rw.prevMask; [0, 1, 2].forEach(i => { if ((fresh >> i) & 1) timers.push(window.setTimeout(() => o.play('star', i), 250 + i * 180)); }); }
  if (!s.trial && (rw.newBest || rw.newStars || rw.missionsDone.length)) timers.push(window.setTimeout(() => o.play('reward'), 150));
  if (!s.trial && rw.unlocked.length) timers.push(window.setTimeout(() => o.play('unlock'), 700));

  // ---- input: guard + fresh presses only
  const armed = new WeakSet<HTMLElement>();
  let hold: { id: number | string; t: number; raf: number } | null = null;
  const setHold = (k: number) => retryBtn.style.setProperty('--hold', String(Math.max(0, Math.min(1, k))));
  const startHold = (id: number | string) => {
    const t = performance.now();
    const step = () => { if (!hold) return; const k = (performance.now() - hold.t) / (HOLD_RETRY_T * 1000); setHold(k); if (k >= 1) { hold = null; setHold(0); act(o.onRetry); return; } hold.raf = requestAnimationFrame(step); };
    hold = { id, t, raf: requestAnimationFrame(step) };
  };
  const endHold = (id: number | string) => { if (hold && hold.id === id) { cancelAnimationFrame(hold.raf); hold = null; setHold(0); } };
  const inJumpZone = (x: number) => { const left = x < window.innerWidth / 2; return o.portrait ? (left !== o.swap) : (left !== o.swap); };
  const onDown = (e: PointerEvent) => {
    skipped = true;
    if (!ready()) { e.preventDefault(); e.stopPropagation(); return; }
    const btn = (e.target as HTMLElement).closest?.('button') as HTMLElement | null;
    if (btn) { armed.add(btn); return; }
    if (inJumpZone(e.clientX)) startHold(e.pointerId);
  };
  const onUp = (e: PointerEvent) => endHold(e.pointerId);
  el.addEventListener('pointerdown', onDown, true);
  el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
  // a tap = a fresh pointerdown (armed above) + its pointerup on the button — never `click`, which the browser drops
  // while the other thumb still rests on the glass (slide held through the KO)
  const wire = (b: HTMLElement | null, fn: (() => void) | null) => {
    if (!b || !fn) return;
    onTap(b, () => { if (!ready() || !armed.has(b)) return; armed.delete(b); o.play('click'); act(fn); });
  };
  wire(retryBtn, o.onRetry); wire(homeBtn, o.onHome); wire(nextBtn, o.onNext);
  const onKey = (e: KeyboardEvent) => {
    if (e.type === 'keydown') {
      if (e.repeat || !ready()) { if (e.code === 'Space' || e.code === 'Enter') e.preventDefault(); return; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); act(o.onRetry); return; }
      if (keyZone(e.code) === 'jump') { e.preventDefault(); skipped = true; startHold('k:' + e.code); return; }
      if (e.code === 'Escape' || e.code === 'KeyH') { e.preventDefault(); act(o.onHome); return; }
      if ((e.code === 'KeyN' || e.code === 'ArrowRight') && nextBtn && o.onNext) { e.preventDefault(); act(o.onNext); }
    } else endHold('k:' + e.code);
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  function dispose(): void {
    cancelAnimationFrame(raf); if (hold) cancelAnimationFrame(hold.raf); hold = null;
    for (const t of timers) clearTimeout(t);
    window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
  }
  return { el, dispose, readyAt };
}
