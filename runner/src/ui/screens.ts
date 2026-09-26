// Menu screens (home, characters, map, daily, missions, settings). Each takes the App it renders into.
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { STAGES } from '../data/stages';
import { BIOME_BY_ID } from '../data/biomes';
import * as store from '../platform/storage';
import { dailySeed, dailyChar, todayKey, stageUnlocked, totalStars, stageStarCount, unlockState, buyCharacter, canReroll, reroll, defaultProgress, type GhostRec } from '../meta/progress';
import { missionText, MISSION_REWARD, RANK_XP } from '../meta/missions';
import { h, clear } from './dom';
import { charCard, charPortrait, fmtNum } from './panels';
import { VERSION, type App } from './app';

export function showHome(app: App): void {
  app.nav('home');
  const p = app.p; const ch = CHAR_BY_ID[p.loadout.main];
  const partner = p.loadout.partner ? CHAR_BY_ID[p.loadout.partner] : null;
  const first = !p.tutorialDone;
  const best = p.bestEndless;
  const dk = todayKey(); const daily = p.daily[dk];
  const el = h('div', { class: 'screen home' },
    h('div', { class: 'home-top' },
      h('div', { class: 'wallet big' }, h('span', { class: 'coin' }, '●'), ` ${fmtNum(p.coins)}`),
      h('div', { class: 'rank' }, `랭크 ${p.rank}`, h('div', { class: 'xpbar' }, h('i', { style: `width:${Math.min(100, 100 * p.xp / RANK_XP(p.rank))}%` }))),
    ),
    h('div', { class: 'logo' }, h('small', {}, '야시장 간식들의'), h('h1', {}, '말랑 대탈출'), h('div', { class: 'tag' }, '두 버튼 러너 · 에너지 없음 · 광고 없음')),
    h('div', { class: 'hero' }, charPortrait(ch, 150), h('div', { class: 'hero-info' },
      h('b', {}, ch.name), h('small', {}, ch.title), partner ? h('div', { class: 'partner' }, charPortrait(partner, 40), h('small', {}, `이어달리기: ${partner.name}`)) : h('small', { class: 'muted' }, '이어달리기 파트너 없음'),
    )),
    h('div', { class: 'menu' },
      h('button', { class: 'primary huge', id: 'btn-run', onclick: app.click(() => first ? app.startRun({ mode: 'tutorial', seed: 1, charId: p.loadout.main }) : app.startEndless()) }, first ? '튜토리얼로 시작!' : '달리기!', h('small', {}, first ? '1분이면 충분해요' : best ? `최고 ${fmtNum(best.score)}점 · ${fmtNum(best.dist)}m` : '무한 질주')),
      h('div', { class: 'row' },
        h('button', { onclick: app.click(() => app.showAdventure()) }, '모험', h('small', {}, `★ ${totalStars(p)}/${STAGES.length * 3}`)),
        h('button', { onclick: app.click(() => app.showDaily()) }, '오늘의 코스', h('small', {}, daily ? `오늘 최고 ${fmtNum(daily.best)}` : '매일 같은 코스')),
      ),
      h('div', { class: 'row' },
        h('button', { onclick: app.click(() => app.showChars()) }, '캐릭터', h('small', {}, `${p.unlocked.length}/${CHARACTERS.length}`)),
        h('button', { onclick: app.click(() => app.showMissions()) }, '미션', h('small', {}, `${p.missions.filter(m => m.progress >= m.target * 0.5).length ? '거의 다 됐어요!' : '3개 진행 중'}`)),
        h('button', { onclick: app.click(() => app.showSettings()) }, '설정', h('small', {}, '조작·접근성')),
      ),
      !first ? h('button', { class: 'ghost small', onclick: app.click(() => app.startRun({ mode: 'tutorial', seed: 1, charId: p.loadout.main })) }, '튜토리얼 다시 보기') : null,
    ),
    h('div', { class: 'foot' }, `v${VERSION} · 오프라인 싱글 플레이 · 저장: ${store.storageInfo.available ? '이 브라우저' : '⚠ 저장 불가 — 설정에서 내보내기'}`),
  );
  app.root.append(el);
}

export function showChars(app: App): void {
  app.nav('chars');
  const p = app.p;
  const list = h('div', { class: 'cards' });
  const render = () => {
    clear(list);
    for (const c of CHARACTERS) {
      const us = unlockState(p, c.id);
      list.append(charCard(c, {
        unlocked: us.ok, reason: us.ok ? '' : us.reason, main: p.loadout.main === c.id, partner: p.loadout.partner === c.id, coins: p.coins, best: p.bestByChar[c.id] ?? 0,
        onMain: () => { app.audio.play('click'); if (p.loadout.partner === c.id) p.loadout.partner = p.loadout.main; p.loadout.main = c.id; app.persist(); render(); },
        onPartner: () => { app.audio.play('click'); p.loadout.partner = p.loadout.partner === c.id ? null : c.id; if (p.loadout.partner === p.loadout.main) p.loadout.partner = null; app.persist(); render(); },
        onTrial: () => { app.audio.play('click'); app.startRun({ mode: 'endless', seed: (Math.random() * 2 ** 32) >>> 0, charId: c.id, trial: true }); },
        onBuy: () => { const r = buyCharacter(p, c.id); if (r.ok) { app.audio.play('reward'); app.toast(`${c.name} 합류!`, 'good'); app.persist(); } else { app.audio.play('error'); app.toast(r.error!, 'warn'); } render(); },
      }));
    }
  };
  render();
  app.root.append(h('div', { class: 'screen list' }, app.topbar('캐릭터'),
    h('p', { class: 'hint' }, '모든 캐릭터는 강하고 약한 게 아니라 "다르게" 달려요. 강화도 뽑기도 없어요. 주자가 쓰러지면 파트너가 체력 절반으로 이어 달려요(무한 질주·오늘의 코스).'),
    list));
}

export function showAdventure(app: App): void {
  app.nav('adventure');
  const p = app.p; const worlds = Array.from(new Set(STAGES.map(s => s.world)));
  const body = h('div', { class: 'worlds' });
  for (const w of worlds) {
    const stages = STAGES.filter(s => s.world === w); const bi = BIOME_BY_ID[stages[0].biome];
    const locked = false; const gate = 0;
    const sec = h('section', { class: 'world', style: `--w1:${bi?.sky[0] ?? '#333'};--w2:${bi?.sky[1] ?? '#555'}` },
      h('h3', {}, `${w}. ${bi?.name ?? ''}`, locked ? h('small', {}, ` 🔒 별 ${gate}개 필요`) : null));
    const grid = h('div', { class: 'stages' });
    for (const st of stages) {
      const ok = stageUnlocked(p, st.id); const stars = stageStarCount(p, st.id);
      grid.append(h('button', { class: 'stage' + (ok ? '' : ' locked'), disabled: !ok, onclick: app.click(() => stageSheet(app, st.id)) },
        h('b', {}, st.id), h('span', { class: 'stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)), h('small', {}, ok ? st.name : '🔒')));
    }
    sec.append(grid); body.append(sec);
  }
  app.root.append(h('div', { class: 'screen list' }, app.topbar('모험'), h('p', { class: 'hint' }, '스테이지는 매번 같은 코스예요. ★1 도착 · ★2 젤리 목표 · ★3 체력 목표. 최고 기록은 고스트로 함께 달려요.'), body));
}
export function stageSheet(app: App, id: string): void {
  const st = STAGES.find(s => s.id === id)!; const p = app.p; const stars = stageStarCount(p, id);
  const ghost = store.loadGhost<GhostRec>('stage:' + id);
  app.modal(h('div', { class: 'sheet' },
    h('h3', {}, `${st.id} ${st.name}`),
    h('div', { class: 'goals' },
      goal(stars >= 1, `도착하기 (${st.length}m)`),
      goal(stars >= 2, `젤리 ${st.stars.jellyPct}% 이상 먹고 도착`),
      goal(stars >= 3, `황금 복주머니 3개 (${[0,1,2].filter(i => ((p.pouches[id] ?? 0) >> i) & 1).length}/3)`)),
    h('p', { class: 'muted' }, p.stageBest[id] ? `최고 ${fmtNum(p.stageBest[id])}점${ghost ? ' · 고스트와 함께 달려요' : ''}` : '첫 도전!'),
    h('button', { class: 'primary', onclick: app.click(() => { app.closeModal(); app.startRun({ mode: 'stage', seed: st.seed, charId: p.loadout.main, stageId: id, assist: app.assistOpts() }); }) }, '출발!'),
    h('button', { class: 'ghost', onclick: app.click(() => app.closeModal()) }, '닫기'),
  ));
}

export function showDaily(app: App): void {
  app.nav('daily');
  const p = app.p; const dk = todayKey(); const d = p.daily[dk];
  const hist = Object.entries(p.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
  app.root.append(h('div', { class: 'screen list' }, app.topbar('오늘의 코스'),
    h('div', { class: 'panel center' },
      h('div', { class: 'date' }, dk),
      h('p', {}, '오늘은 모두가 같은 코스, 같은 캐릭터로 달려요. 몇 번이든 다시 도전할 수 있고, 놓친 날이 있어도 불이익은 없어요.'),
      h('div', { class: 'bigstat' }, d ? fmtNum(d.best) : '—', h('small', {}, d ? `오늘 최고 · ${d.tries}번 도전` : '아직 기록 없음')),
      h('div', { class: 'hero small' }, charPortrait(CHAR_BY_ID[dailyChar(dk)], 64), h('div', { class: 'hero-info' }, h('small', {}, '오늘의 캐릭터'), h('b', {}, CHAR_BY_ID[dailyChar(dk)].name), h('small', {}, p.unlocked.includes(dailyChar(dk)) ? '' : '아직 없는 캐릭터도 오늘은 달릴 수 있어요'))),
      h('button', { class: 'primary huge', onclick: app.click(() => app.startRun({ mode: 'daily', seed: dailySeed(dk), charId: dailyChar(dk), assist: app.assistOpts() })) }, '오늘의 코스 달리기'),
      d ? h('button', { class: 'ghost', onclick: app.click(() => share(app, `말랑 대탈출 오늘의 코스 ${dk}: ${fmtNum(d.best)}점!`)) }, '기록 공유 (복사)') : null,
    ),
    hist.length ? h('div', { class: 'panel' }, h('h3', {}, '지난 기록'), ...hist.map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, `${fmtNum(v.best)}점 (${CHAR_BY_ID[v.charId]?.name ?? ''})`)))) : null,
  ));
}
export function share(app: App, text: string): void {
  const nav: any = navigator;
  if (nav.share) { nav.share({ text }).catch(() => {}); return; }
  try { nav.clipboard.writeText(text).then(() => app.toast('복사했어요', 'good'), () => app.toast(text, 'info', 6)); } catch { app.toast(text, 'info', 6); }
}

export function showMissions(app: App): void {
  app.nav('missions');
  const p = app.p;
  const list = h('div', { class: 'missions' });
  const render = () => {
    clear(list);
    p.missions.forEach((m, i) => {
      const rw = MISSION_REWARD[m.level]; const pct = Math.min(100, 100 * m.progress / m.target);
      list.append(h('div', { class: 'mission' },
        h('div', { class: 'mstars' }, '★'.repeat(rw.xp)),
        h('div', { class: 'mbody' }, h('b', {}, missionText(m)), h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })), h('small', {}, `${fmtNum(Math.min(m.progress, m.target))} / ${fmtNum(m.target)} · 보상 코인 ${rw.coins}`)),
        h('button', { class: 'small', disabled: !canReroll(p, i), title: '다른 미션으로 바꾸기', onclick: app.click(() => { if (reroll(p, i)) { app.persist(); render(); } }) }, '교체'),
      ));
    });
  };
  render();
  app.root.append(h('div', { class: 'screen list' }, app.topbar('미션'),
    h('div', { class: 'panel' }, h('div', { class: 'kv' }, h('span', {}, `랭크 ${p.rank}`), h('b', {}, `${p.xp} / ${RANK_XP(p.rank)} ★`)), h('div', { class: 'xpbar wide' }, h('i', { style: `width:${Math.min(100, 100 * p.xp / RANK_XP(p.rank))}%` })), h('small', { class: 'muted' }, '미션 ★로 랭크가 오르고, 랭크가 오르면 코인과 새 캐릭터를 받아요.')),
    h('p', { class: 'hint' }, '미션은 언제나 3개. 완료하면 바로 새 미션이 와요. 하루 한 번 무료 교체, 5판 동안 진전이 없으면 언제든 교체할 수 있어요.'),
    list,
    h('div', { class: 'panel' }, h('h3', {}, '누적 기록'),
      kv('달린 판', `${fmtNum(p.totals.runs)}판`), kv('달린 거리', `${fmtNum(p.totals.dist)}m`), kv('먹은 젤리', fmtNum(p.totals.jellies)), kv('보너스 타임', `${p.totals.bonusTimes}번`), kv('완료한 미션', `${p.missionsDone}개`)),
  ));
}

export function showSettings(app: App): void {
  app.nav('settings');
  const st = app.p.settings;
  const save = () => { app.applySettings(); app.persist(); };
  const toggle = (key: keyof typeof st, label: string, desc: string) => h('label', { class: 'set' },
    h('span', {}, h('b', {}, label), h('small', {}, desc)),
    h('input', { type: 'checkbox', checked: !!st[key], onchange: (e: Event) => { (st as any)[key] = (e.target as HTMLInputElement).checked; save(); } }));
  const slider = (key: 'bgm' | 'sfx', label: string) => h('label', { class: 'set' }, h('span', {}, h('b', {}, label)),
    h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st[key], oninput: (e: Event) => { st[key] = parseFloat((e.target as HTMLInputElement).value); app.audio.setVolumes(st.sfx, st.bgm); }, onchange: () => { save(); app.audio.unlock(); app.audio.play('jelly'); } }));
  const exportBox = h('textarea', { rows: 3, placeholder: '여기에 내보낸 코드를 붙여넣고 "불러오기"' }) as HTMLTextAreaElement;
  app.root.append(h('div', { class: 'screen list' }, app.topbar('설정'),
    h('div', { class: 'panel' }, h('h3', {}, '소리'), slider('bgm', '배경음'), slider('sfx', '효과음')),
    h('div', { class: 'panel' }, h('h3', {}, '조작'),
      toggle('swapSides', '버튼 좌우 바꾸기', '점프를 오른쪽, 슬라이드를 왼쪽에'),
      toggle('vibrate', '진동', '부딪히면 짧게 진동 (지원 기기만)'),
      h('p', { class: 'muted' }, '키보드: 점프 = 스페이스/↑/W/Z · 슬라이드 = ↓/S/X/Shift (누르고 있기) · 일시정지 = Esc/P'),
    ),
    h('div', { class: 'panel' }, h('h3', {}, '편의·접근성'),
      toggle('assistNoHit', '부딪혀도 따끈함 유지', '장애물에 부딪혀도 식지 않아요 (기록에 표시)'), toggle('assistHalfDrain', '식는 속도 절반', '시간에 따라 식는 속도가 절반 (기록에 표시)'), toggle('assistAutoSlide', '자동 슬라이드', '매달린 장애물 앞에서 저절로 슬라이드'),
      h('label', { class: 'set' }, h('span', {}, h('b', {}, '게임 속도'), h('small', {}, '느리게 하면 반응할 시간이 늘어요. 코스는 그대로예요.')),
        h('select', { onchange: (e: Event) => { st.gameSpeed = parseFloat((e.target as HTMLSelectElement).value); save(); } },
          ...[1, 0.9, 0.8, 0.7].map(v => h('option', { value: v, selected: Math.abs((st.gameSpeed || 1) - v) < 0.01 }, `${Math.round(v * 100)}%`)))),
      toggle('reduceMotion', '흔들림·번쩍임 줄이기', '화면 흔들림, 번쩍임, 회전 효과를 끕니다'),
      toggle('highContrast', '장애물 강조', '모든 장애물을 진한 빨강 + 흰 테두리로'),
      toggle('lowFx', '배터리 절약', '30fps · 효과 줄이기'),
      toggle('ghost', '고스트 표시', '모험·오늘의 코스에서 내 최고 기록과 함께 달리기'),
      toggle('showHitbox', '판정 상자 보기', '실제 충돌 판정을 초록/분홍 상자로 표시'),
    ),
    h('div', { class: 'panel' }, h('h3', {}, '저장 데이터'),
      h('p', { class: 'muted' }, `상태: ${store.storageInfo.available ? '이 브라우저에 자동 저장' : '⚠ 저장소를 쓸 수 없어요 — 내보내기로 백업하세요'}`),
      h('div', { class: 'row' },
        h('button', { onclick: app.click(() => { exportBox.value = store.exportString(app.p); exportBox.select(); try { navigator.clipboard?.writeText(exportBox.value); app.toast('코드를 복사했어요', 'good'); } catch { /* ignore */ } }) }, '내보내기'),
        h('button', { onclick: app.click(() => { const r = store.importString(exportBox.value); if (!r.p) { app.toast(r.error!, 'warn'); return; } app.confirm('불러온 데이터로 지금 진행을 덮어쓸까요?', () => { app.p = r.p!; app.persist(); app.applySettings(); app.toast('불러왔어요', 'good'); app.showSettings(); }); }) }, '불러오기'),
      ), exportBox,
      h('button', { class: 'danger', onclick: app.click(() => app.confirm('모든 진행(코인·별·캐릭터·기록)을 지울까요? 되돌릴 수 없어요.', () => { const keep = app.p.settings; app.p = defaultProgress(); app.p.settings = keep; app.persist(); app.showHome(); })) }, '처음부터 다시'),
    ),
    h('div', { class: 'foot' }, `말랑 대탈출 v${VERSION} · 서버·계정·결제·광고 없음`),
  ));
}


function goal(ok: boolean, text: string): HTMLElement { return h('div', { class: 'goal' + (ok ? ' ok' : '') }, ok ? '★ ' : '☆ ', text); }
function kv(k: string, v: string): HTMLElement { return h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, v)); }
