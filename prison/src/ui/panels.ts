// Sheets, modals and the info card. Each function builds DOM for the App.
import type { App } from './app';
import type { Prisoner, Staff, Room, Job } from '../sim/types';
import { NEED_KEYS, NEED_INFO } from '../sim/types';
import { h, bar, money, clock } from './dom';
import { CHAPTERS } from '../data/objectives';
import { chapterProgress } from '../sim/objectives';
import { ACTIVITY_INFO, DEFAULT_REGIME, HOUR_SECONDS, type Activity } from '../data/regime';
import { SECURITY_INFO, RIOT_SQUAD_COST, type SecurityLevel } from '../data/economy';
import { STAFF, STAFF_BY_ID } from '../data/staff';
import { ROOMS } from '../data/rooms';
import { OBJ_BY_ID } from '../data/objects';
import { STRUCT_BY_INDEX } from '../data/structures';
import { capacity, totalCapacity } from '../sim/economy';
import { roomOf, validRooms } from '../sim/grid';
import { jobAt } from '../sim/build';
import { hourOf, dayOf } from '../sim/prisoner';
import { STAFF_ICON } from './toolbar';
import * as store from '../platform/storage';

const ACTS: Activity[] = ['sleep', 'eat', 'free', 'yard', 'work', 'shower', 'lockup'];
export const STATE_TEXT: Record<string, string> = { idle: '대기', move: '이동 중', sleep: '수면 중', eat: '식사 중', shower: '샤워 중', rest: '휴식 중', work: '노동 중', fight: '싸움 중!', escape: '탈주 중!', subdued: '제압됨', heal: '치료 중', release: '출소 중', wait: '기다리는 중' };
export const INTENT_TEXT: Record<string, string> = { none: '', sleep: '수면', eat: '식사', shower: '샤워', yard: '운동장', common: '휴게실', work: '작업장', cell: '감방', holding: '대기실', solitary: '독방', infirmary: '의무실', escape: '탈주', release: '출소', wander: '배회', riot: '난동' };
export function secBadge(sec: SecurityLevel): HTMLElement { return h('span', { class: 'badge', style: `background:${SECURITY_INFO[sec].color}` }, SECURITY_INFO[sec].name); }
export const moodColor = (m: number): string => m >= 65 ? '#4caf50' : m >= 45 ? '#ffb74d' : '#e5484d';

export function sheetFrame(app: App, title: string, content: HTMLElement, modal = false): HTMLElement {
  return h('div', { class: modal ? 'modal-body' : 'sheet-body' },
    h('div', { class: 'sheet-head' }, h('h3', {}, title), h('button', { class: 'close', onclick: () => modal ? app.closeModal() : app.closeSheet() }, '✕')),
    h('div', { class: 'sheet-content' }, content));
}

// ---------- Objectives ----------
export function objectivesPanel(app: App): HTMLElement {
  const s = app.state!; const c = h('div');
  if (s.chapter >= CHAPTERS.length) c.append(h('div', { class: 'card' }, h('h4', {}, '🎖 명예 교도소장'), h('div', { class: 'story' }, '모든 장을 달성했습니다. 교도소는 계속 운영할 수 있습니다. 수감자 수와 무사고 일수 기록에 도전해 보세요.')));
  else {
    const ch = CHAPTERS[s.chapter]; const prog = chapterProgress(s);
    c.append(h('div', { class: 'card' }, h('h4', {}, ch.title), h('div', { class: 'story' }, ch.story), h('div', { class: 'sub', style: 'margin-top:6px' }, `보상 ${money(ch.reward)} · 평판 +5${ch.unlock ? ' · 최고 보안 수감자 해금' : ''}`)));
    for (const p of prog) c.append(h('div', { class: 'cond' + (p.done ? ' done' : '') }, h('div', { class: 'mark' }, p.done ? '✅' : '⬜'), h('div', { class: 'txt' }, p.cond.text), h('div', { class: 'num' }, `${Math.min(p.cur, p.cond.n)}/${p.cond.n}`)));
  }
  if (s.chapter > 0) c.append(h('div', { class: 'card' }, h('h4', {}, `달성한 장: ${s.chapter}/${CHAPTERS.length}`), h('div', { class: 'sub' }, CHAPTERS.slice(0, s.chapter).map(c => c.title).join(' · '))));
  c.append(h('div', { class: 'card' }, h('h4', {}, '기본 원칙'), h('ul', { class: 'help', style: 'padding-left:18px;margin:4px 0' },
    h('li', {}, '방은 벽(운동장은 울타리)으로 밀폐되고 외부와 연결되지 않아야 유효합니다. 외벽에는 감옥문을 쓰세요.'),
    h('li', {}, '수감자 5명당 교도관 1명, 8명당 요리사 1명이 기준입니다.'),
    h('li', {}, '탈주 벌금 $1,500, 사망 벌금 $2,500, 평판이 0이 되면 해임됩니다.'))));
  return sheetFrame(app, '🎯 목표', c);
}

// ---------- Regime ----------
export function regimePanel(app: App): HTMLElement {
  const s = app.state!; const c = h('div');
  let selected: Activity = 'free';
  const palette = h('div', { class: 'palette' });
  const grid = h('div', { class: 'regime-grid' });
  const summary = h('div', { class: 'sub', style: 'margin-top:8px' });
  const renderPalette = () => { palette.replaceChildren(...ACTS.map(a => h('button', { class: selected === a ? 'on' : '', style: `background:${ACTIVITY_INFO[a].color}`, onclick: () => { selected = a; renderPalette(); } }, ACTIVITY_INFO[a].name))); };
  const renderGrid = () => {
    grid.replaceChildren(...s.regime.map((a, hr) => h('button', { style: `background:${ACTIVITY_INFO[a].color}`, onclick: () => { app.act({ type: 'regime', hour: hr, act: selected }); renderGrid(); } }, `${hr}시`, h('small', {}, ACTIVITY_INFO[a].name))));
    const cnt: Record<string, number> = {}; for (const a of s.regime) cnt[a] = (cnt[a] || 0) + 1;
    const warn: string[] = []; if ((cnt.eat || 0) < 2) warn.push('식사 시간이 2회 미만'); if ((cnt.sleep || 0) < 6) warn.push('수면 6시간 미만'); if (!cnt.shower && !cnt.free) warn.push('샤워/자유 시간 없음');
    summary.replaceChildren(ACTS.map(a => `${ACTIVITY_INFO[a].name} ${cnt[a] || 0}h`).join(' · '), h('br'), warn.length ? h('span', { style: 'color:#ffb74d' }, '⚠ ' + warn.join(', ')) : h('span', { style: 'color:#9be39f' }, '균형 잡힌 일과입니다.'));
  };
  renderPalette(); renderGrid();
  c.append(h('div', { class: 'sub' }, '활동을 고른 뒤 시간 칸을 탭하세요. 현재 ' + clock(hourOf(s)) + ' → ' + ACTIVITY_INFO[s.regime[hourOf(s)]].name), palette, grid, summary,
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => { app.act({ type: 'regimeAll', regime: DEFAULT_REGIME }); renderGrid(); } }, '기본값 복원')),
    h('div', { class: 'card' }, ...ACTS.map(a => h('div', { style: 'font-size:12px;margin:2px 0' }, h('b', { style: `color:${ACTIVITY_INFO[a].color}` }, ACTIVITY_INFO[a].name), ' — ' + ACTIVITY_INFO[a].desc))));
  return sheetFrame(app, '🕗 일과표', c);
}

// ---------- Staff ----------
export function staffPanel(app: App): HTMLElement {
  const s = app.state!; const c = h('div');
  let wages = 0; for (const st of s.staff) if (!st.temp && st.state !== 'leave') wages += STAFF_BY_ID[st.type].wage;
  const guards = s.staff.filter(st => st.type === 'guard' && st.state !== 'leave').length;
  c.append(h('div', { class: 'card' }, h('h4', {}, `직원 ${s.staff.filter(st => st.state !== 'leave').length}명 · 급여 ${money(wages)}/일`), h('div', { class: 'sub' }, `수감자 ${s.prisoners.length}명 → 권장 교도관 ${Math.max(1, Math.ceil(s.prisoners.length / 5))}명 (현재 ${guards}) · 요리사 ${Math.max(1, Math.ceil(s.prisoners.length / 8))}명`)));
  for (const def of STAFF) {
    const list = s.staff.filter(st => st.type === def.id && st.state !== 'leave');
    const card = h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { style: 'flex:2' }, h('h4', {}, `${STAFF_ICON[def.id]} ${def.name} ${list.length}명`), h('div', { class: 'sub' }, def.desc)), h('button', { class: 'primary', style: 'flex:1', onclick: () => { app.act({ type: 'hire', staff: def.id }); app.renderSheet(); } }, `고용 ${money(def.hireCost)}`, h('small', { style: 'color:#4a3210' }, ` +${money(def.wage)}/일`))));
    const ul = h('div', { class: 'list', style: 'margin-top:6px' });
    for (const st of list) ul.append(h('div', { class: 'item' }, h('div', { class: 'grow' }, `${st.name}${st.temp ? ' (진압대)' : ''}`, h('small', {}, `${staffStateText(st)} · 체력 ${Math.round(st.hp)}/${st.maxHp}`)), h('button', { onclick: () => { app.closeSheet(); app.focusOn(st.x, st.y); app.select({ kind: 'staff', id: st.id }); } }, '📍'), st.temp ? null : h('button', { class: 'danger', onclick: () => app.confirm(`${def.name} ${st.name}을(를) 해고할까요?`, () => { app.act({ type: 'fire', id: st.id }); app.renderSheet(); }) }, '해고')));
    if (list.length) card.append(ul); c.append(card);
  }
  c.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { style: 'flex:2' }, h('h4', {}, '🚨 진압대 요청'), h('div', { class: 'sub' }, '무장 교도관 4명이 24시간 주둔. 폭동·대규모 싸움 때 사용.')), h('button', { class: 'danger', style: 'flex:1', onclick: () => { app.act({ type: 'riotSquad' }); app.renderSheet(); } }, money(RIOT_SQUAD_COST)))));
  return sheetFrame(app, '👮 직원', c);
}
export function staffStateText(st: Staff): string {
  switch (st.state) { case 'idle': return '대기'; case 'move': return '이동 중'; case 'work': return st.type === 'guard' ? '순찰 중' : st.type === 'workman' ? '작업 중' : st.type === 'cook' ? '조리 중' : '근무 중'; case 'fight': return '진압 중!'; case 'chase': return '추격 중!'; case 'injured': return '부상'; case 'leave': return '퇴근'; }
  return st.state;
}

// ---------- Intake / prisoners ----------
export function intakePanel(app: App): HTMLElement {
  const s = app.state!; const c = h('div'); const cap = capacity(s); const total = totalCapacity(s);
  c.append(h('div', { class: 'card' }, h('h4', {}, `수감자 ${s.prisoners.length}명 / 수용 가능 ${total}명`), h('div', { class: 'sub' }, `빈 감방 침대 ${cap.freeBeds} · 대기실 여유 ${cap.holding} · 매일 08:00 버스 도착 (자동 접수 시)`),
    h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: s.autoIntake ? 'on' : '', onclick: () => { app.act({ type: 'autoIntake', on: !s.autoIntake }); app.renderSheet(); } }, s.autoIntake ? '자동 접수 켜짐' : '자동 접수 꺼짐'), h('button', { class: 'primary', disabled: cap.total === 0, onclick: () => { app.act({ type: 'intake', n: 1 }); app.renderSheet(); } }, '지금 1명'), h('button', { class: 'primary', disabled: cap.total === 0, onclick: () => { app.act({ type: 'intake', n: 4 }); app.renderSheet(); } }, '지금 4명'))));
  const mix = h('div', { class: 'mix' });
  for (const sec of ['min', 'med', 'max'] as SecurityLevel[]) {
    const info = SECURITY_INFO[sec]; const locked = !s.unlocked.includes(sec);
    mix.append(h('button', { class: s.intakeMix[sec] && !locked ? 'on' : '', disabled: locked, style: s.intakeMix[sec] && !locked ? `background:${info.color}` : '', onclick: () => { app.act({ type: 'mix', sec, on: !s.intakeMix[sec] }); app.renderSheet(); } }, (locked ? '🔒 ' : '') + info.name, h('small', { style: 'display:block;color:inherit;opacity:.8' }, `$${info.grant}/일 · ${info.desc}`)));
  }
  c.append(h('div', { class: 'card' }, h('h4', {}, '접수 등급'), mix));
  const list = h('div', { class: 'list' });
  const sorted = [...s.prisoners].sort((a, b) => b.anger - a.anger);
  for (const p of sorted) list.append(h('div', { class: 'item' }, h('div', { style: `width:10px;height:36px;border-radius:5px;background:${moodColor(p.mood)}` }), h('div', { class: 'grow' }, h('span', {}, p.name, ' ', secBadge(p.sec)), h('small', {}, `${prisonerStateText(p)} · 기분 ${Math.round(p.mood)} · 분노 ${Math.round(p.anger)} · 남은 형기 ${Math.max(0, p.arrivedDay + p.sentence - dayOf(s))}일`)), h('button', { onclick: () => { app.closeSheet(); app.focusOn(p.x, p.y); app.select({ kind: 'prisoner', id: p.id }); } }, '📍')));
  c.append(h('div', { class: 'card' }, h('h4', {}, `수감자 명단 (분노 순)`), s.prisoners.length ? list : h('div', { class: 'sub' }, '아직 수감자가 없습니다.')));
  return sheetFrame(app, '🚌 수감 접수', c);
}
export function prisonerStateText(p: Prisoner): string {
  if (p.state === 'move') return '이동 → ' + (INTENT_TEXT[p.intent] || '');
  if (p.state === 'rest' || p.state === 'wait') return (STATE_TEXT[p.state]) + (INTENT_TEXT[p.intent] ? ` (${INTENT_TEXT[p.intent]})` : '');
  return STATE_TEXT[p.state] || p.state;
}

// ---------- Report ----------
export function reportPanel(app: App): HTMLElement {
  const s = app.state!; const c = h('div'); const f = s.finance.today; const y = s.finance.history[s.finance.history.length - 1];
  const row = (k: string, v: number) => h('tr', {}, h('td', {}, k), h('td', { class: v > 0 ? 'pos' : v < 0 ? 'neg' : '' }, (v > 0 ? '+' : '') + money(v)));
  let grant = 0; for (const p of s.prisoners) grant += SECURITY_INFO[p.sec].grant; if (validRooms(s, 'office').length) grant = Math.round(grant * 1.1);
  let wages = 0; for (const st of s.staff) if (!st.temp && st.state !== 'leave') wages += STAFF_BY_ID[st.type].wage;
  c.append(h('div', { class: 'card' }, h('h4', {}, `💰 자금 ${money(s.money)} · 평판 ${s.reputation}/100`), h('table', { class: 'fin' },
    row('오늘 자정 예상 보조금', grant), row('오늘 자정 급여', -wages), row('오늘 식재료', -f.food), row('오늘 건설·고용', -f.build), row('오늘 노동 수입', f.work), row('오늘 벌금', -f.fines), row('오늘 보상', f.bonus), row('예상 일일 순수익', grant - wages - f.food - f.build + f.work - f.fines + f.bonus))));
  if (y) c.append(h('div', { class: 'card' }, h('h4', {}, `어제 (${y.day}일차)`), h('table', { class: 'fin' }, row('보조금', y.grant), row('급여', -y.wages), row('식재료', -y.food), row('건설·고용', -y.build), row('노동', y.work), row('벌금', -y.fines), row('보상', y.bonus), row('순수익', y.grant - y.wages - y.food - y.build + y.work - y.fines + y.bonus))));
  const st = s.stats; const mood = s.prisoners.length ? s.prisoners.reduce((a, p) => a + p.mood, 0) / s.prisoners.length : 0;
  c.append(h('div', { class: 'card' }, h('h4', {}, '📈 통계'), h('div', { class: 'sub' }, `누적 수감 ${st.intake} · 출소 ${st.released} · 탈주 ${st.escapes} · 사망 ${st.deaths} · 싸움 ${st.fights} · 제압 ${st.subdued} · 폭동 ${st.riots}`), h('div', { class: 'sub' }, `무사고 ${st.daysNoIncident}일 연속 · 기분 55+ ${st.moodDays}일 연속 · 노동 수입 누계 ${money(st.workIncome)} · 현재 평균 기분 ${Math.round(mood)} · 식사 재고 ${Math.round(s.meals)}/${s.mealCap}`)));
  // danger summary
  const issues: HTMLElement[] = [];
  const invalid = s.cache.rooms.filter(r => !r.valid);
  for (const r of invalid.slice(0, 8)) issues.push(h('div', { class: 'item' }, h('div', { class: 'grow' }, `⚠ ${ROOMS[r.zone].name} (${r.tiles.length}칸)`, h('small', {}, r.issues.join(', '))), h('button', { onclick: () => { app.closeSheet(); app.focusOn(r.cx, r.cy); app.select({ kind: 'tile', x: Math.floor(r.cx), y: Math.floor(r.cy) }); } }, '📍')));
  const unreachable = s.jobs.filter(j => j.unreachable);
  if (unreachable.length) issues.push(h('div', { class: 'item' }, h('div', { class: 'grow' }, `⛔ 접근 불가 작업 ${unreachable.length}개`, h('small', {}, '작업반이 갈 수 없는 곳입니다. 문을 달거나 벽을 열어주세요.')), h('button', { onclick: () => { app.closeSheet(); app.focusOn(unreachable[0].x + 0.5, unreachable[0].y + 0.5); } }, '📍')));
  const guards = s.staff.filter(x => x.type === 'guard' && x.state !== 'leave').length;
  if (s.prisoners.length > guards * 5) issues.push(h('div', { class: 'item' }, h('div', { class: 'grow' }, '👮 교도관 부족', h('small', {}, `수감자 ${s.prisoners.length}명에 교도관 ${guards}명`))));
  if (s.prisoners.length && s.meals < s.prisoners.length) issues.push(h('div', { class: 'item' }, h('div', { class: 'grow' }, '🍲 식사 재고 부족', h('small', {}, `재고 ${Math.round(s.meals)}인분, 요리사 ${s.staff.filter(x => x.type === 'cook').length}명`))));
  const bedless = s.prisoners.filter(p => p.bedId < 0).length; if (bedless) issues.push(h('div', { class: 'item' }, h('div', { class: 'grow' }, `🛏 감방 없는 수감자 ${bedless}명`, h('small', {}, '대기실에 머뭅니다. 유효한 감방(침대+변기, 밀폐)을 지으세요.'))));
  c.append(h('div', { class: 'card' }, h('h4', {}, '🚨 위험 요약'), issues.length ? h('div', { class: 'list' }, ...issues) : h('div', { class: 'sub ok', style: 'color:#9be39f' }, '특이사항 없음')));
  return sheetFrame(app, '📊 보고서', c);
}

// ---------- Log ----------
export function logPanel(app: App): HTMLElement {
  const s = app.state!; const c = h('div', { class: 'list' });
  for (const l of [...s.log].reverse()) { const d = Math.floor(l.t / HOUR_SECONDS / 24) + 1, hr = Math.floor(l.t / HOUR_SECONDS) % 24, mn = Math.floor((l.t / HOUR_SECONDS % 1) * 60); c.append(h('div', { class: 'item', style: l.kind === 'bad' ? 'border-left:3px solid #e5484d' : l.kind === 'warn' ? 'border-left:3px solid #ffb74d' : l.kind === 'good' ? 'border-left:3px solid #4caf50' : '' }, h('div', { class: 'grow' }, l.text, h('small', {}, `${d}일차 ${clock(hr, mn)}`)))); }
  if (!s.log.length) c.append(h('div', { class: 'sub' }, '기록 없음'));
  return sheetFrame(app, '📜 기록', c);
}

// ---------- Settings / help ----------
export function settingsPanel(app: App): HTMLElement {
  const st = app.blob.meta.settings; const c = h('div', { class: 'settings' });
  const range = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.sfx, oninput: (e: Event) => { st.sfx = parseFloat((e.target as HTMLInputElement).value); app.audio.setVolume(st.sfx); app.saveAll(); } });
  c.append(h('label', {}, '효과음', range));
  const tog = (label: string, get: () => boolean, set: (v: boolean) => void) => { const b = h('button', { class: get() ? 'on' : '', onclick: () => { set(!get()); b.className = get() ? 'on' : ''; b.textContent = get() ? '켜짐' : '꺼짐'; app.saveAll(); app.applySettings(); } }, get() ? '켜짐' : '꺼짐'); return h('label', {}, label, b); };
  c.append(tog('격자 표시', () => st.showGrid, v => { st.showGrid = v; }), tog('효과 줄이기(저사양)', () => st.lowFx, v => { st.lowFx = v; }), tog('도움말 힌트', () => st.hints, v => { st.hints = v; }));
  c.append(h('div', { class: 'card' }, h('div', { class: 'sub' }, `저장: ${app.saveStatus || (store.storageInfo.available ? '브라우저 로컬 저장' : '⚠ 저장 불가: ' + store.storageInfo.reason)}`)));
  if (app.state) c.append(h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => { app.saveRun(); app.toast('저장했습니다', 'good'); } }, '지금 저장'), h('button', { class: 'ghost', onclick: () => app.confirm('타이틀로 돌아갈까요? (진행은 저장됩니다)', () => { app.saveRun(); app.showTitle(); }) }, '타이틀로')));
  c.append(h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'ghost', onclick: () => app.openSheet('export') }, '내보내기/불러오기')));
  return sheetFrame(app, '⚙ 설정', c);
}
export function exportPanel(app: App): HTMLElement {
  if (app.state) app.saveRun();
  const ta = h('textarea', { readonly: true }) as HTMLTextAreaElement; ta.value = store.exportString(app.blob);
  const inp = h('textarea', { placeholder: 'PRSN1. 으로 시작하는 문자열을 붙여넣기' }) as HTMLTextAreaElement;
  const msg = h('div', { class: 'sub' });
  const c = h('div', {}, h('div', { class: 'sub' }, '아래 문자열을 복사해 두면 다른 기기/브라우저에서 이어할 수 있습니다.'), ta,
    h('div', { class: 'row' }, h('button', { onclick: () => { ta.select(); try { navigator.clipboard?.writeText(ta.value); msg.textContent = '복사했습니다'; } catch { msg.textContent = '직접 선택해 복사하세요'; } } }, '복사')),
    h('h4', { style: 'margin:12px 0 4px' }, '불러오기'), inp,
    h('div', { class: 'row' }, h('button', { class: 'danger', onclick: () => { const r = store.importString(inp.value); if (!r.blob) { msg.textContent = r.error || '실패'; return; } app.confirm('현재 저장을 덮어쓰고 불러올까요?', () => { app.blob = r.blob!; store.save(app.blob); app.showTitle(); }); } }, '불러오기 (현재 저장 덮어씀)')), msg);
  return sheetFrame(app, '💾 내보내기/불러오기', c);
}
export function helpPanel(app: App): HTMLElement {
  const c = h('div', { class: 'help' },
    h('h4', {}, '목표'), h('p', {}, '빈 부지에 교도소를 짓고 수감자를 받아 운영합니다. 7개 장(목표)을 차례로 달성하면 명예 교도소장이 됩니다. 자금이 -$8,000 아래로 떨어지거나 평판이 0이 되면 해임됩니다.'),
    h('h4', {}, '조작'), h('ul', { style: 'padding-left:18px' }, h('li', {}, '👆 선택 도구: 탭으로 정보 보기, 드래그로 화면 이동, 두 손가락으로 확대·축소.'), h('li', {}, '건설·구역·물건 도구: 드래그하여 사각형 범위에 적용. 벽·울타리는 3×3 이상이면 테두리만 그립니다.'), h('li', {}, '건설 비용은 계획 즉시 차감되고 작업반이 와서 짓습니다. 철거는 50% 환불, 계획 취소는 전액 환불.')),
    h('h4', {}, '방(구역)'), h('p', {}, '구역을 칠하면 벽으로 나뉜 연결된 칸이 한 방이 됩니다. 각 방은 필수 물건과 최소 크기가 있고, 외부와 연결되지 않아야(밀폐) 유효합니다. 방 이름 앞 ⚠ 를 탭하면 부족한 것을 알려줍니다.'),
    h('h4', {}, '보안'), h('p', {}, '벽·울타리는 모두 막습니다. 일반 문은 누구나 통과(탈주자 포함), 감옥문은 직원과 질서 있는 이동만 통과합니다. 🔒 보안 보기에서 빨간 칸은 외부와 이어진 곳으로, 거기 서 있는 수감자는 탈주할 수 있습니다.'),
    h('h4', {}, '욕구와 사고'), h('p', {}, '배고픔·피로·위생·운동·여가·자유·불안 7가지 욕구가 기분을 결정합니다. 기분이 낮으면 분노가 쌓여 싸움·탈주가 일어나고, 분노한 수감자가 25% 이상이면 폭동이 납니다. 교도관은 싸움을 진압하고 탈주자를 추격합니다. 제압된 수감자는 6시간 독방/감방 징벌을 받습니다.'),
    h('h4', {}, '경제'), h('p', {}, '자정마다 수감자 1명당 보조금(최소 $110·일반 $160·최고 $240)을 받고 직원 급여를 냅니다. 식사 1인분 식재료 $3. 작업장 노동은 시간당 $14/명. 사무실이 유효하면 보조금 +10%.'),
    h('h4', {}, '일과표'), h('p', {}, '24시간 일과를 편집할 수 있습니다. 식사는 하루 3회, 수면 6~8시간, 운동·자유 시간이 있어야 기분이 유지됩니다. 노동 시간에 작업장이 없으면 자유 시간으로 처리됩니다.'));
  return sheetFrame(app, '❓ 도움말', c);
}

// ---------- Info card ----------
export function infoCard(app: App): HTMLElement | null {
  const s = app.state!; const sel = app.selection; if (!sel) return null;
  const close = h('button', { class: 'close', onclick: () => app.select(null) }, '✕');
  if (sel.kind === 'prisoner') {
    const p = s.cache.prisonerIndex.get(sel.id); if (!p) return null;
    const traits: string[] = []; if (p.volatility > 1.3) traits.push('폭력적'); if (p.escapist) traits.push('탈주 성향'); if (p.injured) traits.push('부상');
    const needs = h('div', { class: 'needs' }, ...NEED_KEYS.map(k => h('div', { class: 'need' }, h('span', {}, NEED_INFO[k].icon + NEED_INFO[k].name), bar(p.needs[k], p.needs[k] > 70 ? '#e5484d' : p.needs[k] > 40 ? '#ffb74d' : '#4caf50'))));
    return h('div', {},
      h('div', { class: 'head' }, h('div', { class: 'name' }, p.name, ' ', secBadge(p.sec)), close),
      h('div', { class: 'desc' }, `${prisonerStateText(p)} · 형기 ${p.sentence}일 (남은 ${Math.max(0, p.arrivedDay + p.sentence - dayOf(s))}일)${traits.length ? ' · ' + traits.join(', ') : ''}${p.punishedUntil > s.time ? ' · 징벌 중 ' + Math.ceil((p.punishedUntil - s.time) / HOUR_SECONDS) + 'h' : ''}${p.bedId < 0 ? ' · 감방 없음' : ''}`),
      h('div', { class: 'row', style: 'margin-top:4px;font-size:11px' }, h('span', { style: 'flex:0 0 auto' }, '기분'), bar(p.mood, moodColor(p.mood), String(Math.round(p.mood))), h('span', { style: 'flex:0 0 auto' }, '분노'), bar(p.anger, '#e5484d', String(Math.round(p.anger))), h('span', { style: 'flex:0 0 auto' }, '체력'), bar(p.hp / p.maxHp * 100, '#4c8dff', String(Math.round(p.hp)))),
      needs,
      h('div', { class: 'btns' }, h('button', { class: app.renderer.follow?.id === p.id ? 'on' : '', onclick: () => app.toggleFollow('prisoner', p.id) }, '📍 따라가기')));
  }
  if (sel.kind === 'staff') {
    const st = s.cache.staffIndex.get(sel.id); if (!st) return null; const def = STAFF_BY_ID[st.type];
    return h('div', {},
      h('div', { class: 'head' }, h('div', { class: 'name' }, `${STAFF_ICON[st.type]} ${def.name} ${st.name}${st.temp ? ' (진압대)' : ''}`), close),
      h('div', { class: 'desc' }, `${staffStateText(st)} · 급여 ${money(def.wage)}/일`),
      h('div', { class: 'row', style: 'margin-top:4px;font-size:11px' }, h('span', { style: 'flex:0 0 auto' }, '체력'), bar(st.hp / st.maxHp * 100, '#4c8dff', String(Math.round(st.hp)))),
      h('div', { class: 'btns' }, h('button', { class: app.renderer.follow?.id === st.id ? 'on' : '', onclick: () => app.toggleFollow('staff', st.id) }, '📍 따라가기'), st.temp ? null : h('button', { class: 'danger', onclick: () => app.confirm(`${def.name} ${st.name}을(를) 해고할까요?`, () => { app.act({ type: 'fire', id: st.id }); app.select(null); }) }, '해고')));
  }
  // tile
  if (sel.kind !== 'tile') return null;
  const { x, y } = sel; if (x < 0 || y < 0 || x >= s.w || y >= s.h) return null;
  const i = y * s.w + x; const job = jobAt(s, x, y); const stI = s.struct[i]; const objId = s.objAt[i]; const ob = objId >= 0 ? s.cache.objIndex.get(objId) : null; const room = roomOf(s, x, y);
  const parts: (HTMLElement | null)[] = []; let title = '';
  if (job) { title = (job.kind === 'build' ? '건설 예정: ' : '철거 예정: ') + (job.struct ? STRUCT_BY_INDEX[job.struct]!.name : job.obj ? OBJ_BY_ID[job.obj].name : ob ? OBJ_BY_ID[ob.type].name : ''); parts.push(h('div', { class: 'desc' }, `진행 ${Math.round(job.progress / job.total * 100)}% · ${job.workerId >= 0 ? '작업반 배정됨' : job.unreachable ? '⛔ 접근 불가 — 작업반이 갈 수 있는 길(문)이 필요합니다' : '작업반 대기 중'}`)); parts.push(h('div', { class: 'btns' }, h('button', { class: 'danger', onclick: () => { app.act({ type: 'cancel', x, y }); app.select({ kind: 'tile', x, y }); } }, job.kind === 'build' ? '취소 (전액 환불)' : '철거 취소'))); }
  else if (ob) { const d = OBJ_BY_ID[ob.type]; title = `${d.icon} ${d.name}`; parts.push(h('div', { class: 'desc' }, d.desc + (ob.owner >= 0 ? ` · 배정: ${s.cache.prisonerIndex.get(ob.owner)?.name || ''}` : '') + (ob.users ? ` · 사용 중 ${ob.users}` : ''))); parts.push(h('div', { class: 'btns' }, h('button', { class: 'danger', onclick: () => { app.act({ type: 'demolish', x0: x, y0: y, x1: x, y1: y }); app.select({ kind: 'tile', x, y }); } }, '철거 (50% 환불)'))); }
  else if (stI) { const d = STRUCT_BY_INDEX[stI]!; title = d.name; parts.push(h('div', { class: 'desc' }, d.desc)); parts.push(h('div', { class: 'btns' }, h('button', { class: 'danger', onclick: () => { app.act({ type: 'demolish', x0: x, y0: y, x1: x, y1: y }); app.select({ kind: 'tile', x, y }); } }, '철거 (50% 환불)'))); }
  if (room) parts.push(roomInfo(app, room, !title));
  if (!title) { if (room) title = ROOMS[room.zone].name; else title = s.terrain[i] === 2 ? '도로 (수감자·직원 출입구)' : s.terrain[i] === 1 ? '흙바닥' : '잔디'; }
  if (!room && !ob && !stI && !job) parts.push(h('div', { class: 'desc' }, s.cache.insecure[i] ? '🔓 외부와 연결된 곳 (탈주 가능 지대)' : '🔒 밀폐된 곳'));
  return h('div', {}, h('div', { class: 'head' }, h('div', { class: 'name' }, title), close), ...parts);
}
function roomInfo(app: App, r: Room, full: boolean): HTMLElement {
  const s = app.state!; const def = ROOMS[r.zone];
  const occ = s.prisoners.filter(p => roomOf(s, Math.floor(p.x), Math.floor(p.y)) === r).length;
  const counts: Record<string, number> = {}; for (const id of r.objs) { const t = s.cache.objIndex.get(id)!.type; counts[t] = (counts[t] || 0) + 1; }
  const objTxt = Object.entries(counts).map(([k, n]) => `${OBJ_BY_ID[k].name} ${n}`).join(', ') || '물건 없음';
  return h('div', { style: full ? '' : 'margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px' },
    full ? null : h('div', {}, h('b', {}, `${def.name} 안`)),
    h('div', { class: 'desc' }, `${r.tiles.length}칸 · ${objTxt} · 수감자 ${occ}명 · ${r.secure ? '밀폐됨' : '외부와 연결'}`),
    r.valid ? h('div', { class: 'ok' }, '✅ 유효한 ' + def.name) : h('div', { class: 'issues' }, '⚠ ' + r.issues.join(' · ')),
    full ? h('div', { class: 'desc' }, def.desc) : null);
}

// ---------- Modals ----------
export function chapterModal(app: App, doneIdx: number): HTMLElement {
  const ch = CHAPTERS[doneIdx]; const next = CHAPTERS[doneIdx + 1];
  const c = h('div', {}, h('div', { class: 'result-big' }, `🏆 ${ch.title} 달성!`), h('div', { class: 'story', style: 'text-align:center' }, `보상 ${money(ch.reward)} · 평판 +5${ch.unlock ? ' · 최고 보안 수감자 해금' : ''}`),
    next ? h('div', { class: 'card' }, h('h4', {}, `다음: ${next.title}`), h('div', { class: 'story' }, next.story), h('ul', { style: 'padding-left:18px;margin:6px 0 0' }, ...next.conds.map(cd => h('li', { style: 'font-size:12px' }, cd.text)))) : h('div', { class: 'card' }, h('h4', {}, '🎖 명예 교도소장'), h('div', { class: 'story' }, '모든 목표를 달성했습니다! 교도소는 계속 운영할 수 있습니다.')),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'primary', onclick: () => app.closeModal() }, '계속')));
  return sheetFrame(app, '목표 달성', c, true);
}
export function gameOverModal(app: App, reason: string): HTMLElement {
  const s = app.state!; const st = s.stats;
  const c = h('div', {}, h('div', { class: 'result-big' }, reason === 'bankrupt' ? '💸 파산' : '📉 해임'), h('div', { class: 'story', style: 'text-align:center' }, reason === 'bankrupt' ? '부채가 한도를 넘었습니다. 보조금(수감자)보다 급여·건설 지출이 컸습니다.' : '탈주·사망·폭동으로 평판이 바닥났습니다.'),
    h('div', { class: 'card' }, h('div', { class: 'sub' }, `${dayOf(s)}일차 · 수감자 ${s.prisoners.length}명 · 달성 장 ${s.chapter}/${CHAPTERS.length}`), h('div', { class: 'sub' }, `탈주 ${st.escapes} · 사망 ${st.deaths} · 출소 ${st.released} · 폭동 ${st.riots}`)),
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'primary', onclick: () => { app.closeModal(); app.newRun((Math.random() * 2 ** 32) >>> 0, s.mode); } }, '새 게임'), h('button', { onclick: () => { app.closeModal(); app.blob.run = null; app.blob.runInfo = null; app.saveAll(); app.showTitle(); } }, '타이틀')));
  return sheetFrame(app, '게임 종료', c, true);
}
