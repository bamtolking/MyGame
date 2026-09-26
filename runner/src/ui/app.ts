// App shell: screens, main loop (fixed step + interpolation), input wiring, audio routing, saving.
import { DT, VIEW_H } from '../data/physics';
import { BONUS_WORD, LOW_HP_FRAC } from '../data/tuning';
import { CHARACTERS, CHAR_BY_ID } from '../data/characters';
import { STAGES } from '../data/stages';
import { BIOME_BY_ID } from '../data/biomes';
import { newRun, stepRun, totalScore, jellyPct, type RunConfig } from '../sim/run';
import type { RunState, SimEvent, Mode } from '../sim/types';
import { Renderer, type GhostView } from '../render/renderer';
import { Audio } from '../platform/audio';
import * as store from '../platform/storage';
import { applyRun, stageStarCount, defaultProgress, dailySeed, dailyChar, todayKey, stageUnlocked, totalStars, unlockState, buyCharacter, canReroll, reroll, type Progress, type RunReward, type GhostRec } from '../meta/progress';
import { missionText, MISSION_REWARD, RANK_XP } from '../meta/missions';
import { InputState, keyZone, type Zone } from './input';
import { CONTENT_HASH } from '../sim/content';
import { h, clear } from './dom';
import { charCard, charPortrait, fmtNum, deathExplain, nearMissHints, hitName } from './panels';

const MAX_STEPS = 5;
export const VERSION = '0.1.0-beta.1';

type Screen = 'home' | 'chars' | 'adventure' | 'daily' | 'missions' | 'settings' | 'run' | 'results';

interface RunCtx {
  s: RunState; cfg: RunConfig;
  ghost: RunState | null; ghostLog: number[]; ghostIdx: number; ghostBits: number;
  acc: number; lastT: number; prevX: number; prevY: number;
  paused: boolean; ended: boolean; endT: number; reward: RunReward | null; lastCount: number; resumeT: number;
}

export class App {
  root: HTMLElement;
  p: Progress;
  audio = new Audio();
  input = new InputState();
  renderer: Renderer | null = null;
  run: RunCtx | null = null;
  screen: Screen = 'home';
  fps = 0; private frames = 0; private fpsT = 0; private frameSkip = 0;
  private raf = 0;
  private resultsReadyAt = 0;
  saveMsg = '';

  constructor(root: HTMLElement) {
    this.root = root;
    const l = store.load(); this.p = l.p;
    this.applySettings();
    this.showHome();
    if (l.error) this.toast(l.error, 'warn', 5);
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('pagehide', () => this.persist());
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    // browser gestures must never eat game input
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', stop);
    document.addEventListener('selectstart', e => { if (!(e.target as HTMLElement)?.closest?.('input,textarea')) e.preventDefault(); });
    document.addEventListener('gesturestart', stop as EventListener);
    this.input.onPress = () => this.audio.unlock();
    try { const as = (navigator as any).audioSession; if (as) as.type = 'ambient'; } catch { /* ignore */ }
    try { (navigator as any).storage?.persist?.(); } catch { /* ignore */ }
  }

  // ------------------------------------------------------------------ persistence & settings
  persist(): void {
    const r = store.save(this.p);
    this.saveMsg = r.ok ? (r.error ?? '') : (r.error ?? '저장 실패');
    if (!r.ok || r.error) this.toast(this.saveMsg, 'warn', 4);
  }
  applySettings(): void {
    const st = this.p.settings;
    this.audio.setVolumes(st.sfx, st.bgm);
    if (this.renderer) this.renderer.opts = { reduceMotion: st.reduceMotion, highContrast: st.highContrast, lowFx: st.lowFx, showHitbox: st.showHitbox };
    document.documentElement.classList.toggle('reduce-motion', st.reduceMotion);
  }

  // ------------------------------------------------------------------ generic UI bits
  toast(text: string, kind: 'info' | 'good' | 'warn' = 'info', sec = 2.5): void {
    let box = document.getElementById('toasts'); if (!box) { box = h('div', { id: 'toasts' }); document.body.append(box); }
    const el = h('div', { class: 'toast ' + kind }, text); box.append(el);
    setTimeout(() => el.classList.add('out'), sec * 1000); setTimeout(() => el.remove(), sec * 1000 + 400);
  }
  private nav(screen: Screen): void {
    this.stopLoop(); this.screen = screen; this.input.reset(); this.input.enabled = false; clear(this.root);
    this.renderer = null; this.run = null; this.audio.setMusic(null);
  }
  private topbar(title: string, back: () => void = () => this.showHome()): HTMLElement {
    return h('header', { class: 'topbar' },
      h('button', { class: 'back', 'aria-label': '뒤로', onclick: () => { this.audio.play('click'); back(); } }, '←'),
      h('h2', {}, title),
      h('div', { class: 'wallet' }, h('span', { class: 'coin' }, '●'), ` ${fmtNum(this.p.coins)}`),
    );
  }
  private click(fn: () => void): () => void { return () => { this.audio.unlock(); this.audio.play('click'); fn(); }; }

  // ------------------------------------------------------------------ home
  showHome(): void {
    this.nav('home');
    const p = this.p; const ch = CHAR_BY_ID[p.loadout.main];
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
        h('button', { class: 'primary huge', id: 'btn-run', onclick: this.click(() => first ? this.startRun({ mode: 'tutorial', seed: 1, charId: p.loadout.main }) : this.startEndless()) }, first ? '튜토리얼로 시작!' : '달리기!', h('small', {}, first ? '1분이면 충분해요' : best ? `최고 ${fmtNum(best.score)}점 · ${fmtNum(best.dist)}m` : '무한 질주')),
        h('div', { class: 'row' },
          h('button', { onclick: this.click(() => this.showAdventure()) }, '모험', h('small', {}, `★ ${totalStars(p)}/${STAGES.length * 3}`)),
          h('button', { onclick: this.click(() => this.showDaily()) }, '오늘의 코스', h('small', {}, daily ? `오늘 최고 ${fmtNum(daily.best)}` : '매일 같은 코스')),
        ),
        h('div', { class: 'row' },
          h('button', { onclick: this.click(() => this.showChars()) }, '캐릭터', h('small', {}, `${p.unlocked.length}/${CHARACTERS.length}`)),
          h('button', { onclick: this.click(() => this.showMissions()) }, '미션', h('small', {}, `${p.missions.filter(m => m.progress >= m.target * 0.5).length ? '거의 다 됐어요!' : '3개 진행 중'}`)),
          h('button', { onclick: this.click(() => this.showSettings()) }, '설정', h('small', {}, '조작·접근성')),
        ),
        !first ? h('button', { class: 'ghost small', onclick: this.click(() => this.startRun({ mode: 'tutorial', seed: 1, charId: p.loadout.main })) }, '튜토리얼 다시 보기') : null,
      ),
      h('div', { class: 'foot' }, `v${VERSION} · 오프라인 싱글 플레이 · 저장: ${store.storageInfo.available ? '이 브라우저' : '⚠ 저장 불가 — 설정에서 내보내기'}`),
    );
    this.root.append(el);
  }

  // ------------------------------------------------------------------ characters
  showChars(): void {
    this.nav('chars');
    const p = this.p;
    const list = h('div', { class: 'cards' });
    const render = () => {
      clear(list);
      for (const c of CHARACTERS) {
        const us = unlockState(p, c.id);
        list.append(charCard(c, {
          unlocked: us.ok, reason: us.ok ? '' : us.reason, main: p.loadout.main === c.id, partner: p.loadout.partner === c.id, coins: p.coins, best: p.bestByChar[c.id] ?? 0,
          onMain: () => { this.audio.play('click'); if (p.loadout.partner === c.id) p.loadout.partner = p.loadout.main; p.loadout.main = c.id; this.persist(); render(); },
          onPartner: () => { this.audio.play('click'); p.loadout.partner = p.loadout.partner === c.id ? null : c.id; if (p.loadout.partner === p.loadout.main) p.loadout.partner = null; this.persist(); render(); },
          onTrial: () => { this.audio.play('click'); this.startRun({ mode: 'endless', seed: (Math.random() * 2 ** 32) >>> 0, charId: c.id, trial: true }); },
          onBuy: () => { const r = buyCharacter(p, c.id); if (r.ok) { this.audio.play('reward'); this.toast(`${c.name} 합류!`, 'good'); this.persist(); } else { this.audio.play('error'); this.toast(r.error!, 'warn'); } render(); },
        }));
      }
    };
    render();
    this.root.append(h('div', { class: 'screen list' }, this.topbar('캐릭터'),
      h('p', { class: 'hint' }, '모든 캐릭터는 강하고 약한 게 아니라 "다르게" 달려요. 강화도 뽑기도 없어요. 주자가 쓰러지면 파트너가 체력 절반으로 이어 달려요(무한 질주·오늘의 코스).'),
      list));
  }

  // ------------------------------------------------------------------ adventure
  showAdventure(): void {
    this.nav('adventure');
    const p = this.p; const worlds = Array.from(new Set(STAGES.map(s => s.world)));
    const body = h('div', { class: 'worlds' });
    for (const w of worlds) {
      const stages = STAGES.filter(s => s.world === w); const bi = BIOME_BY_ID[stages[0].biome];
      const locked = false; const gate = 0;
      const sec = h('section', { class: 'world', style: `--w1:${bi?.sky[0] ?? '#333'};--w2:${bi?.sky[1] ?? '#555'}` },
        h('h3', {}, `${w}. ${bi?.name ?? ''}`, locked ? h('small', {}, ` 🔒 별 ${gate}개 필요`) : null));
      const grid = h('div', { class: 'stages' });
      for (const st of stages) {
        const ok = stageUnlocked(p, st.id); const stars = stageStarCount(p, st.id);
        grid.append(h('button', { class: 'stage' + (ok ? '' : ' locked'), disabled: !ok, onclick: this.click(() => this.stageSheet(st.id)) },
          h('b', {}, st.id), h('span', { class: 'stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)), h('small', {}, ok ? st.name : '🔒')));
      }
      sec.append(grid); body.append(sec);
    }
    this.root.append(h('div', { class: 'screen list' }, this.topbar('모험'), h('p', { class: 'hint' }, '스테이지는 매번 같은 코스예요. ★1 도착 · ★2 젤리 목표 · ★3 체력 목표. 최고 기록은 고스트로 함께 달려요.'), body));
  }
  private stageSheet(id: string): void {
    const st = STAGES.find(s => s.id === id)!; const p = this.p; const stars = stageStarCount(p, id);
    const ghost = store.loadGhost<GhostRec>('stage:' + id);
    this.modal(h('div', { class: 'sheet' },
      h('h3', {}, `${st.id} ${st.name}`),
      h('div', { class: 'goals' },
        goal(stars >= 1, `도착하기 (${st.length}m)`),
        goal(stars >= 2, `젤리 ${st.stars.jellyPct}% 이상 먹고 도착`),
        goal(stars >= 3, `황금 복주머니 3개 (${[0,1,2].filter(i => ((p.pouches[id] ?? 0) >> i) & 1).length}/3)`)),
      h('p', { class: 'muted' }, p.stageBest[id] ? `최고 ${fmtNum(p.stageBest[id])}점${ghost ? ' · 고스트와 함께 달려요' : ''}` : '첫 도전!'),
      h('button', { class: 'primary', onclick: this.click(() => { this.closeModal(); this.startRun({ mode: 'stage', seed: st.seed, charId: p.loadout.main, stageId: id, assist: this.assistOpts() }); }) }, '출발!'),
      h('button', { class: 'ghost', onclick: this.click(() => this.closeModal()) }, '닫기'),
    ));
  }

  // ------------------------------------------------------------------ daily
  showDaily(): void {
    this.nav('daily');
    const p = this.p; const dk = todayKey(); const d = p.daily[dk];
    const hist = Object.entries(p.daily).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
    this.root.append(h('div', { class: 'screen list' }, this.topbar('오늘의 코스'),
      h('div', { class: 'panel center' },
        h('div', { class: 'date' }, dk),
        h('p', {}, '오늘은 모두가 같은 코스, 같은 캐릭터로 달려요. 몇 번이든 다시 도전할 수 있고, 놓친 날이 있어도 불이익은 없어요.'),
        h('div', { class: 'bigstat' }, d ? fmtNum(d.best) : '—', h('small', {}, d ? `오늘 최고 · ${d.tries}번 도전` : '아직 기록 없음')),
        h('div', { class: 'hero small' }, charPortrait(CHAR_BY_ID[dailyChar(dk)], 64), h('div', { class: 'hero-info' }, h('small', {}, '오늘의 캐릭터'), h('b', {}, CHAR_BY_ID[dailyChar(dk)].name), h('small', {}, p.unlocked.includes(dailyChar(dk)) ? '' : '아직 없는 캐릭터도 오늘은 달릴 수 있어요'))),
        h('button', { class: 'primary huge', onclick: this.click(() => this.startRun({ mode: 'daily', seed: dailySeed(dk), charId: dailyChar(dk), assist: this.assistOpts() })) }, '오늘의 코스 달리기'),
        d ? h('button', { class: 'ghost', onclick: this.click(() => this.share(`말랑 대탈출 오늘의 코스 ${dk}: ${fmtNum(d.best)}점!`)) }, '기록 공유 (복사)') : null,
      ),
      hist.length ? h('div', { class: 'panel' }, h('h3', {}, '지난 기록'), ...hist.map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, `${fmtNum(v.best)}점 (${CHAR_BY_ID[v.charId]?.name ?? ''})`)))) : null,
    ));
  }
  private share(text: string): void {
    const nav: any = navigator;
    if (nav.share) { nav.share({ text }).catch(() => {}); return; }
    try { nav.clipboard.writeText(text).then(() => this.toast('복사했어요', 'good'), () => this.toast(text, 'info', 6)); } catch { this.toast(text, 'info', 6); }
  }

  // ------------------------------------------------------------------ missions
  showMissions(): void {
    this.nav('missions');
    const p = this.p;
    const list = h('div', { class: 'missions' });
    const render = () => {
      clear(list);
      p.missions.forEach((m, i) => {
        const rw = MISSION_REWARD[m.level]; const pct = Math.min(100, 100 * m.progress / m.target);
        list.append(h('div', { class: 'mission' },
          h('div', { class: 'mstars' }, '★'.repeat(rw.xp)),
          h('div', { class: 'mbody' }, h('b', {}, missionText(m)), h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })), h('small', {}, `${fmtNum(Math.min(m.progress, m.target))} / ${fmtNum(m.target)} · 보상 코인 ${rw.coins}`)),
          h('button', { class: 'small', disabled: !canReroll(p, i), title: '다른 미션으로 바꾸기', onclick: this.click(() => { if (reroll(p, i)) { this.persist(); render(); } }) }, '교체'),
        ));
      });
    };
    render();
    this.root.append(h('div', { class: 'screen list' }, this.topbar('미션'),
      h('div', { class: 'panel' }, h('div', { class: 'kv' }, h('span', {}, `랭크 ${p.rank}`), h('b', {}, `${p.xp} / ${RANK_XP(p.rank)} ★`)), h('div', { class: 'xpbar wide' }, h('i', { style: `width:${Math.min(100, 100 * p.xp / RANK_XP(p.rank))}%` })), h('small', { class: 'muted' }, '미션 ★로 랭크가 오르고, 랭크가 오르면 코인과 새 캐릭터를 받아요.')),
      h('p', { class: 'hint' }, '미션은 언제나 3개. 완료하면 바로 새 미션이 와요. 하루 한 번 무료 교체, 5판 동안 진전이 없으면 언제든 교체할 수 있어요.'),
      list,
      h('div', { class: 'panel' }, h('h3', {}, '누적 기록'),
        kv('달린 판', `${fmtNum(p.totals.runs)}판`), kv('달린 거리', `${fmtNum(p.totals.dist)}m`), kv('먹은 젤리', fmtNum(p.totals.jellies)), kv('보너스 타임', `${p.totals.bonusTimes}번`), kv('완료한 미션', `${p.missionsDone}개`)),
    ));
  }

  // ------------------------------------------------------------------ settings
  showSettings(): void {
    this.nav('settings');
    const st = this.p.settings;
    const save = () => { this.applySettings(); this.persist(); };
    const toggle = (key: keyof typeof st, label: string, desc: string) => h('label', { class: 'set' },
      h('span', {}, h('b', {}, label), h('small', {}, desc)),
      h('input', { type: 'checkbox', checked: !!st[key], onchange: (e: Event) => { (st as any)[key] = (e.target as HTMLInputElement).checked; save(); } }));
    const slider = (key: 'bgm' | 'sfx', label: string) => h('label', { class: 'set' }, h('span', {}, h('b', {}, label)),
      h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st[key], oninput: (e: Event) => { st[key] = parseFloat((e.target as HTMLInputElement).value); this.audio.setVolumes(st.sfx, st.bgm); }, onchange: () => { save(); this.audio.unlock(); this.audio.play('jelly'); } }));
    const exportBox = h('textarea', { rows: 3, placeholder: '여기에 내보낸 코드를 붙여넣고 "불러오기"' }) as HTMLTextAreaElement;
    this.root.append(h('div', { class: 'screen list' }, this.topbar('설정'),
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
          h('button', { onclick: this.click(() => { exportBox.value = store.exportString(this.p); exportBox.select(); try { navigator.clipboard?.writeText(exportBox.value); this.toast('코드를 복사했어요', 'good'); } catch { /* ignore */ } }) }, '내보내기'),
          h('button', { onclick: this.click(() => { const r = store.importString(exportBox.value); if (!r.p) { this.toast(r.error!, 'warn'); return; } this.confirm('불러온 데이터로 지금 진행을 덮어쓸까요?', () => { this.p = r.p!; this.persist(); this.applySettings(); this.toast('불러왔어요', 'good'); this.showSettings(); }); }) }, '불러오기'),
        ), exportBox,
        h('button', { class: 'danger', onclick: this.click(() => this.confirm('모든 진행(코인·별·캐릭터·기록)을 지울까요? 되돌릴 수 없어요.', () => { const keep = this.p.settings; this.p = defaultProgress(); this.p.settings = keep; this.persist(); this.showHome(); })) }, '처음부터 다시'),
      ),
      h('div', { class: 'foot' }, `말랑 대탈출 v${VERSION} · 서버·계정·결제·광고 없음`),
    ));
  }

  // ------------------------------------------------------------------ modal helpers
  modal(content: HTMLElement, dismissable = true): void {
    this.closeModal();
    const m = h('div', { id: 'modal', onclick: (e: Event) => { if (dismissable && e.target === m) this.closeModal(); } }, content);
    document.body.append(m);
  }
  closeModal(): void { document.getElementById('modal')?.remove(); }
  confirm(text: string, yes: () => void): void {
    this.modal(h('div', { class: 'sheet' }, h('p', {}, text),
      h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: this.click(() => this.closeModal()) }, '취소'), h('button', { class: 'danger', onclick: this.click(() => { this.closeModal(); yes(); }) }, '확인'))));
  }

  assistOpts() { const st = this.p.settings; return { noHitDamage: st.assistNoHit, halfDrain: st.assistHalfDrain, autoSlide: st.assistAutoSlide }; }

  // ------------------------------------------------------------------ run lifecycle
  startEndless(): void { const p = this.p; this.startRun({ mode: 'endless', seed: (Math.random() * 2 ** 32) >>> 0, charId: p.loadout.main, partnerId: p.loadout.partner, assist: this.assistOpts() }); }

  startRun(cfg: RunConfig): void {
    this.audio.unlock();
    this.nav('run');
    const s = newRun(cfg);
    let ghost: RunState | null = null; let log: number[] = [];
    const gkey = cfg.mode === 'stage' ? 'stage:' + cfg.stageId : cfg.mode === 'daily' ? 'daily:' + todayKey() : '';
    const g: GhostRec | null = gkey ? store.loadGhost<GhostRec>(gkey) : null;
    if (g && this.p.settings.ghost && g.seed === s.seed && g.content === CONTENT_HASH) {
      ghost = newRun({ mode: g.mode as Mode, seed: g.seed, charId: g.charId, partnerId: g.partnerId, companionId: g.companionId, stageId: g.stageId, assist: g.assistOpts });
      log = g.log;
    }
    this.run = { s, cfg, ghost, ghostLog: log, ghostIdx: 0, ghostBits: 0, acc: 0, lastT: performance.now(), prevX: s.body.x, prevY: s.body.y, paused: false, ended: false, endT: 0, reward: null, lastCount: -1, resumeT: 0 };
    this.buildRunDom();
    this.input.reset(); this.input.enabled = true;
    const bi = BIOME_BY_ID[s.biome]; if (bi) this.audio.setMusic({ bpm: bi.bpm, key: bi.key });
    this.startLoop();
  }

  private buildRunDom(): void {
    const swap = this.p.settings.swapSides;
    const pad = (zone: Exclude<Zone, null>) => {
      const b = h('div', { class: `pad ${zone}`, 'data-zone': zone }, h('span', { class: 'ic' }, zone === 'jump' ? '▲' : '▼'), h('b', {}, zone === 'jump' ? '점프' : '슬라이드'), h('small', {}, zone === 'jump' ? '탭 · 공중에서 한 번 더' : '누르고 있기'));
      return b;
    };
    const pads = h('div', { id: 'pads', class: swap ? 'swap' : '' }, pad('jump'), pad('slide'));
    const stage = h('div', { id: 'stage' }, h('canvas', { id: 'cv' }));
    const hints = h('div', { id: 'lhints', class: swap ? 'swap' : '' }, h('div', { class: 'lh jump' }, '▲ 점프'), h('div', { class: 'lh slide' }, '▼ 슬라이드'));
    const pauseBtn = h('button', { id: 'btn-pause', 'aria-label': '일시정지', onclick: () => this.setPaused(true) }, 'Ⅱ');
    const runEl = h('div', { id: 'run', class: 'screen run' }, stage, hints, pads, pauseBtn);
    this.root.append(runEl);
    this.renderer = new Renderer(document.getElementById('cv') as HTMLCanvasElement);
    this.applySettings();
    // pointer input on the whole run surface; each pointer keeps its zone
    const zoneAt = (e: PointerEvent): Zone => {
      const t = e.target as HTMLElement; const pz = t.closest?.('.pad') as HTMLElement | null;
      if (pz) return pz.dataset.zone as Zone;
      if (t.closest?.('button')) return null;
      const left = e.clientX < window.innerWidth / 2;
      return (left !== swap) ? 'jump' : 'slide';
    };
    const down = (e: PointerEvent) => {
      if (!this.run || this.run.paused || this.run.ended) return;
      const z = zoneAt(e); if (!z) return;
      e.preventDefault();
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      this.input.pointerDown(e.pointerId, z);
      document.querySelector(`.pad.${z}`)?.classList.add('on'); document.querySelector(`.lh.${z}`)?.classList.add('on');
    };
    const up = (e: PointerEvent) => {
      this.input.pointerUp(e.pointerId);
      for (const z of ['jump', 'slide']) if (!(z === 'slide' ? this.input.slideHeld : this.input.jumpHeld)) { document.querySelector(`.pad.${z}`)?.classList.remove('on'); document.querySelector(`.lh.${z}`)?.classList.remove('on'); }
    };
    runEl.addEventListener('pointerdown', down);
    runEl.addEventListener('pointerup', up); runEl.addEventListener('pointercancel', up); runEl.addEventListener('lostpointercapture', up as EventListener);
    runEl.addEventListener('touchstart', e => { if (!(e.target as HTMLElement).closest('button')) e.preventDefault(); }, { passive: false });
    runEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    this.layout();
  }

  layout(): void {
    const stage = document.getElementById('stage'); if (!stage || !this.renderer) return;
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    document.getElementById('run')?.classList.toggle('portrait', portrait);
    const r = stage.getBoundingClientRect();
    if (r.width > 10 && r.height > 10) this.renderer.resize(r.width, r.height);
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    if (this.screen !== 'run' || !this.run) return;
    if (down && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); if (!this.run.ended) this.setPaused(!this.run.paused); return; }
    if (this.run.ended) { if (down && (e.code === 'Space' || e.code === 'Enter') && performance.now() > this.resultsReadyAt && document.getElementById('res-retry')) { e.preventDefault(); (document.getElementById('res-retry') as HTMLButtonElement).click(); } return; }
    if (!keyZone(e.code)) return;
    e.preventDefault();
    if (this.run.paused) return;
    this.audio.unlock();
    if (down) this.input.keyDown(e.code, e.repeat); else this.input.keyUp(e.code);
  }

  autoPause(): void { if (this.run && !this.run.paused && !this.run.ended && this.run.s.phase !== 'over') this.setPaused(true); }

  setPaused(p: boolean): void {
    const rc = this.run; if (!rc || rc.ended) return;
    rc.paused = p; this.input.reset();
    document.querySelectorAll('.pad.on,.lh.on').forEach(el => el.classList.remove('on'));
    if (p) {
      this.audio.suspend();
      const st = this.p.settings;
      this.modal(h('div', { class: 'sheet' },
        h('h3', {}, '일시정지'),
        h('p', { class: 'muted' }, `${fmtNum(totalScore(rc.s))}점 · ${Math.floor(rc.s.dist)}m`),
        h('button', { class: 'primary', onclick: this.click(() => { this.closeModal(); this.resume(); }) }, '계속 달리기'),
        h('button', { onclick: this.click(() => { this.closeModal(); rc.paused = false; this.startRun(rc.cfg.mode === 'endless' ? { ...rc.cfg, seed: (Math.random() * 2 ** 32) >>> 0 } : rc.cfg); }) }, '처음부터'),
        h('label', { class: 'set' }, h('span', {}, h('b', {}, '소리')), h('input', { type: 'checkbox', checked: st.sfx > 0 || st.bgm > 0, onchange: (e: Event) => { const on = (e.target as HTMLInputElement).checked; st.sfx = on ? 0.8 : 0; st.bgm = on ? 0.5 : 0; this.applySettings(); this.persist(); } })),
        h('button', { class: 'ghost', onclick: this.click(() => { this.closeModal(); this.showHome(); }) }, '그만하고 나가기 (기록 안 됨)'),
      ), false);
    }
  }
  private resume(): void {
    const rc = this.run; if (!rc) return;
    this.audio.resume();
    // short countdown so nothing happens the instant you tap "continue". Done here (not in the sim) so the
    // input log / ghost replay stays step-exact.
    if (rc.s.phase === 'run') rc.resumeT = 1.0;
    rc.paused = false; rc.acc = 0; rc.lastT = performance.now();
  }

  // ------------------------------------------------------------------ loop
  private startLoop(): void { cancelAnimationFrame(this.raf); const f = (t: number) => { this.frame(t); if (this.run) this.raf = requestAnimationFrame(f); }; this.raf = requestAnimationFrame(f); }
  private stopLoop(): void { cancelAnimationFrame(this.raf); this.raf = 0; }

  frame(now: number): void {
    const rc = this.run; const r = this.renderer; if (!rc || !r) return;
    let real = (now - rc.lastT) / 1000; rc.lastT = now;
    if (real > 0.25 && !rc.paused && !rc.ended && rc.s.phase === 'run') { this.setPaused(true); real = 0; }
    real = Math.min(real, 0.1);
    const s = rc.s;
    if (rc.resumeT > 0 && !rc.paused) { rc.resumeT = Math.max(0, rc.resumeT - real); r.resumeCount = rc.resumeT; if (rc.resumeT === 0) this.audio.play('go'); }
    else r.resumeCount = 0;
    if (!rc.paused && rc.resumeT <= 0) {
      rc.acc += real * Math.max(0.5, Math.min(1, this.p.settings.gameSpeed || 1));
      let n = 0;
      while (rc.acc >= DT && n < MAX_STEPS) {
        rc.prevX = s.body.x; rc.prevY = s.body.y;
        const beforeCd = s.phase === 'countdown' ? Math.ceil(s.countdown / 0.5) : -1;
        stepRun(s, this.input.take());
        if (s.phase === 'countdown') { const c = Math.ceil(s.countdown / 0.5); if (c !== beforeCd && c > 0) this.audio.play('count'); }
        else if (beforeCd > 0 && s.phase === 'run') this.audio.play('go');
        if (rc.ghost) this.stepGhost(rc);
        rc.acc -= DT; n++;
      }
      if (n >= MAX_STEPS) rc.acc = 0;
    }
    if (s.events.length) { r.consume(s.events, s); this.onEvents(s.events, s); s.events.length = 0; }
    // interpolation (skip across teleports)
    const a = Math.min(1, rc.acc / DT);
    const tele = Math.abs(s.body.x - rc.prevX) > 100;
    const ix = tele ? s.body.x : rc.prevX + (s.body.x - rc.prevX) * a;
    const iy = tele ? s.body.y : rc.prevY + (s.body.y - rc.prevY) * a;
    let gv: GhostView | null = null;
    if (rc.ghost && rc.ghost.phase !== 'over' && s.bonusStage === 'none' && rc.ghost.bonusStage === 'none') { const gb = rc.ghost.body; gv = { x: gb.x, y: gb.y, sliding: gb.sliding, onGround: gb.onGround, charId: rc.ghost.charId, scale: gb.scale }; }
    // battery saver: draw every other frame on fast displays
    this.frameSkip ^= 1;
    r.pbDist = s.mode === 'endless' && !s.trial ? (this.p.bestEndless?.dist ?? 0) : 0;
    if (!(this.p.settings.lowFx && this.frameSkip)) r.draw(s, ix, iy, this.p.settings.lowFx ? real * 2 : real, gv);
    this.audio.tick();
    this.frames++; this.fpsT += real; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    if ((s.phase === 'over' || s.phase === 'clear') && !rc.ended) this.endRun(rc);
  }

  private stepGhost(rc: RunCtx): void {
    const g = rc.ghost!; const log = rc.ghostLog; const i = g.steps;
    let jump = false;
    while (rc.ghostIdx < log.length && log[rc.ghostIdx] === i) { rc.ghostBits = log[rc.ghostIdx + 1]; jump = (rc.ghostBits & 1) === 1; rc.ghostIdx += 2; }
    stepRun(g, { jump, slide: (rc.ghostBits & 2) === 2, jumpHeld: (rc.ghostBits & 4) === 4 });
    g.events.length = 0;
  }

  private onEvents(evs: SimEvent[], s: RunState): void {
    const a = this.audio;
    for (const e of evs) {
      switch (e.t) {
        case 'jump': a.play(e.n === 2 ? 'jump2' : 'jump'); break;
        case 'land': a.play('land'); break;
        case 'slide': a.play('slide'); break;
        case 'pickup':
          if (e.type === 'jelly' || e.type === 'bonusJelly') a.play('jelly');
          else if (e.type === 'big') a.play('big');
          else if (e.type === 'coin') a.play('coin');
          else if (e.type === 'potion' || e.type === 'bigPotion') a.play('potion');
          else if (e.type === 'letter') a.play('letter', e.letter ?? 0);
          break;
        case 'hit': a.play(e.shielded ? 'shield' : 'hit'); if (!e.shielded && this.p.settings.vibrate) try { navigator.vibrate?.(40); } catch { /* ignore */ } break;
        case 'smash': a.play('smash'); break;
        case 'power': a.play('power'); break;
        case 'powerEnd': a.play('powerEnd'); break;
        case 'bonusStart': a.play('bonus'); a.setMusic('bonus'); break;
        case 'bonusEnd': { a.play('bonusEnd'); const bi = BIOME_BY_ID[s.biome]; if (bi) a.setMusic({ bpm: bi.bpm, key: bi.key }); break; }
        case 'fall': a.play('fall'); break;
        case 'speedUp': a.play('speed'); break;
        case 'biome': { const bi = BIOME_BY_ID[e.id]; if (bi && s.bonusStage === 'none') a.setMusic({ bpm: bi.bpm, key: bi.key }); break; }
        case 'skill': a.play('skill'); break;
        case 'lowHp': a.play('lowhp'); break;
        case 'revive': case 'relay': a.play('relay'); break;
        case 'nearMiss': a.play('near'); break;
        case 'streak': a.play('streak'); break;
        case 'death': a.play('death'); a.setMusic(null); break;
        case 'clear': a.play('clear'); a.setMusic(null); break;
      }
    }
  }

  // ------------------------------------------------------------------ results
  private endRun(rc: RunCtx): void {
    rc.ended = true; this.input.reset(); this.input.enabled = false;
    const s = rc.s;
    rc.reward = applyRun(this.p, s);
    if (rc.reward.ghost && rc.reward.ghostKey) { store.saveGhost(rc.reward.ghostKey, rc.reward.ghost); store.pruneDailyGhosts(7); }
    this.persist();
    setTimeout(() => { if (this.run === rc) this.showResults(rc); }, 350);
  }

  private showResults(rc: RunCtx): void {
    const s = rc.s; const rw = rc.reward!; const p = this.p;
    this.resultsReadyAt = performance.now() + 650;   // a mashing thumb can't skip the results by accident
    const cleared = s.phase === 'clear';
    const st = s.stageId ? STAGES.find(x => x.id === s.stageId) : null;
    const nextStage = st ? STAGES[STAGES.findIndex(x => x.id === st.id) + 1] : null;
    const title = s.trial ? '시험 달리기 끝' : s.mode === 'tutorial' ? (cleared ? '튜토리얼 완료!' : '연습 끝') : s.mode === 'stage' ? (cleared ? '도착!' : '아쉬워요!') : rw.newBest ? '새 기록!' : '달리기 끝';
    const why = deathExplain(s);
    const hints = nearMissHints(s, rw);
    const stat = (k: string, v: string) => h('div', { class: 'st' }, h('small', {}, k), h('b', {}, v));
    const retry = () => {
      if (performance.now() < this.resultsReadyAt) return;
      this.audio.play('click'); this.closeModal();
      if (rc.cfg.trial) this.startRun({ ...rc.cfg, seed: (Math.random() * 2 ** 32) >>> 0 });
      else if (rc.cfg.mode === 'endless') this.startEndless(); else if (rc.cfg.mode === 'tutorial') this.startEndless(); else this.startRun(rc.cfg);
    };
    const el = h('div', { class: 'sheet results' },
      h('h2', {}, title, s.assist ? h('small', { class: 'tagx' }, ' 느긋 모드') : null),
      h('div', { class: 'bigscore', id: 'res-score' }, '0'),
      rw.newBest && s.mode !== 'tutorial' ? h('div', { class: 'newbest' }, rw.prevBest ? `이전 최고 ${fmtNum(rw.prevBest)}` : '첫 기록!') : rw.prevBest ? h('div', { class: 'muted' }, `최고 ${fmtNum(rw.prevBest)}`) : null,
      st ? h('div', { class: 'goals' },
        goal(cleared, `도착 (${st.length}m)`), goal(cleared && jellyPct(s) >= st.stars.jellyPct, `젤리 ${st.stars.jellyPct}% (이번 ${jellyPct(s)}%)`), goal(cleared && ((p.pouches[st.id] ?? 0) & 7) === 7, `황금 복주머니 3개 (이번 ${[0,1,2].filter(i => (s.pouchesGot >> i) & 1).length}개)`)) : null,
      !cleared && s.mode !== 'tutorial' ? h('div', { class: 'why' }, h('b', {}, why.title), h('small', {}, why.detail)) : null,
      ...hints.map(t => h('div', { class: 'almost' }, t)),
      h('div', { class: 'stats' },
        stat('거리', `${fmtNum(Math.floor(s.dist))}m`), stat('젤리', `${fmtNum(s.stats.jellies)} (${jellyPct(s)}%)`), stat('곰젤리', fmtNum(s.stats.bigJellies)),
        stat('보너스 타임', `${s.stats.bonusTimes}번`), stat('연속 무피격', `${s.stats.bestStreak}회`), stat('아슬아슬', `${s.stats.nearMisses}번`)),
      h('div', { class: 'rewards' },
        h('div', { class: 'kv' }, h('span', {}, '코인'), h('b', {}, `+${fmtNum(rw.coins)}`)),
        h('small', { class: 'muted' }, [rw.coinsFromPickups ? `주운 코인 ${rw.coinsFromPickups}` : '', rw.coinsFromDist ? `거리 ${rw.coinsFromDist}` : '', rw.coinsFromMissions ? `미션 ${rw.coinsFromMissions}` : '', rw.coinsFromRank ? `랭크 ${rw.coinsFromRank}` : ''].filter(Boolean).join(' · ') || '—'),
        ...rw.missionsDone.map(m => h('div', { class: 'mdone' }, `✔ ${m.text} (+★${m.xp})`)),
        rw.rankUps ? h('div', { class: 'mdone' }, `랭크 업! → ${p.rank}`) : null,
        ...rw.unlocked.map(id => h('div', { class: 'mdone' }, `🎉 새 캐릭터 합류: ${CHAR_BY_ID[id]?.name}`)),
        h('div', { class: 'mlist' }, ...p.missions.map(m => h('div', { class: 'mini' }, h('span', {}, missionText(m)), h('small', {}, `${fmtNum(Math.min(m.progress, m.target))}/${fmtNum(m.target)}`)))),
      ),
      h('button', { class: 'primary huge', id: 'res-retry', onclick: retry }, s.mode === 'tutorial' ? '무한 질주 시작!' : '다시 달리기'),
      h('div', { class: 'row' },
        cleared && nextStage && stageUnlocked(p, nextStage.id) ? h('button', { onclick: this.click(() => { this.closeModal(); this.startRun({ ...rc.cfg, stageId: nextStage.id, seed: nextStage.seed }); }) }, `다음: ${nextStage.id}`) : null,
        h('button', { class: 'ghost', onclick: this.click(() => { this.closeModal(); if (s.trial) this.showChars(); else if (s.mode === 'stage') this.showAdventure(); else this.showHome(); }) }, s.trial ? '캐릭터 목록' : s.mode === 'stage' ? '모험 지도' : '홈으로'),
      ),
    );
    this.modal(el, false);
    // score count-up (any tap skips)
    const target = rw.score; const sc = document.getElementById('res-score')!; const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 900); sc.textContent = fmtNum(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1 && document.body.contains(sc)) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); el.addEventListener('pointerdown', () => { sc.textContent = fmtNum(target); }, { once: true });
    if (rw.newBest || rw.newStars || rw.missionsDone.length) this.audio.play('reward');
  }
}

function goal(ok: boolean, text: string): HTMLElement { return h('div', { class: 'goal' + (ok ? ' ok' : '') }, ok ? '★ ' : '☆ ', text); }
function kv(k: string, v: string): HTMLElement { return h('div', { class: 'kv' }, h('span', {}, k), h('b', {}, v)); }
void VIEW_H; void BONUS_WORD; void LOW_HP_FRAC; void hitName;
