// 앱: 화면 전환, 게임 루프, 런(구역 진행·체크포인트·기록), 일시정지, 튜토리얼, 저장 연동.
import { BODIES, BODY_TIPS, CODEX_ORDER } from '../data/bodies';
import { RULES } from '../data/rules';
import { ZONES } from '../data/zones';
import { Audio } from '../platform/audio';
import { load, reset as resetSave, save, storageInfo, type SaveData } from '../platform/storage';
import { Renderer } from '../render/renderer';
import { bodyIcon } from '../render/sprites';
import { EMPTY_INPUT, step } from '../sim/engine';
import type { BodyId, GameEvent, Input } from '../sim/types';
import { World, carryFrom, createWorld, newStats, type CarryBody } from '../sim/world';
import { Hud, el, fmtTime } from './hud';
import { InputManager } from './input';
import { APP_HTML } from './screens';

const ACHIEVEMENTS: { id: string; name: string; desc: string }[] = [
  { id: 'first_possess', name: '첫 갈아타기', desc: '처음으로 적의 몸을 빼앗는다' },
  { id: 'clutch', name: '죽기 직전', desc: '마지막 기회에 빙의로 살아남는다' },
  { id: 'clear', name: '코어 정지', desc: '감시 코어 관리자를 처치한다' },
  { id: 'three_bodies', name: '삼중 인격', desc: '3종 이상의 몸을 갈아타며 클리어' },
  { id: 'no_shield', name: '방패 없이', desc: '방패병을 한 번도 쓰지 않고 클리어' },
  { id: 'minimal', name: '절제', desc: '빙의 3회 이하로 클리어' },
  { id: 'fast', name: '급행', desc: '6분 안에 클리어' },
  { id: 'wall', name: '돌파구', desc: '금이 간 벽을 부순다' },
  { id: 'switch', name: '원격 조작', desc: '원거리 스위치를 켠다' },
  { id: 'all_bodies', name: '전신 수집', desc: '빙의 가능한 몸 5종을 모두 써본다' },
];

interface Run { seed: number; zoneIndex: number; world: World; elapsed: number; hard: boolean; wallBroken: boolean; switchOn: boolean; bodiesEver: Set<BodyId> }

export class App {
  data: SaveData;
  renderer: Renderer; input: InputManager; hud = new Hud(); audio = new Audio();
  run: Run | null = null;
  paused = false; screen: 'title' | 'game' | 'pause' | 'result' | 'codex' | 'settings' | 'help' | 'confirm' = 'title';
  private prevScreen: App['screen'] = 'title';
  private acc = 0; private lastT = 0; private hudT = 0;
  private transition: { until: number; kind: 'zone' | 'end' } | null = null;
  private tutorial = { step: 0, moved: 0, startX: 0, startY: 0, timer: 0 };
  fps = 0; private frames = 0; private fpsT = 0;
  debug = { input: null as Partial<Input> | null, shots: 0 };
  constructor() {
    const root = document.getElementById('app')!; root.innerHTML = APP_HTML;
    const { data, notice } = load(); this.data = data;
    if (notice) this.notice(notice, 6000);
    this.renderer = new Renderer(el('cv'));
    this.input = new InputManager(el('stickzone'), { attack: el('btn-attack'), skill: el('btn-skill'), possess: el('btn-possess'), interact: el('btn-interact') }, el('stickknob'), el('stickbase'));
    this.input.onAnyInput = () => this.audio.unlock();
    this.input.onPause = () => { if (this.screen === 'game') this.pause(); else if (this.screen === 'pause') this.resume(); };
    this.renderer.fx.intensity = data.settings.fx; this.audio.volume = data.settings.volume; this.audio.muted = data.settings.muted;
    this.bind();
    window.addEventListener('resize', () => this.resize()); this.resize();
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.screen === 'game') this.pause(true); });
    window.addEventListener('blur', () => { if (this.screen === 'game') this.pause(true); });
    document.addEventListener('pointerdown', () => this.audio.unlock(), { passive: true });
    this.showTitle();
    this.lastT = performance.now(); requestAnimationFrame((t) => this.frame(t));
  }
  private resize(): void { this.renderer.resize(window.innerWidth, window.innerHeight); }
  private notice(text: string, ms = 3000): void { const n = el('notice'); n.textContent = text; window.clearTimeout((n as any)._t); (n as any)._t = window.setTimeout(() => { n.textContent = ''; }, ms); }
  private persist(): void { const r = save(this.data); if (!r.ok && r.error) this.notice(r.error, 4000); }
  private show(id: App['screen']): void {
    for (const s of ['title', 'pause', 'result', 'codex', 'settings', 'help', 'confirm']) el(s).classList.toggle('hidden', s !== id);
    if (id !== 'game') el('hud').style.visibility = this.run ? 'visible' : 'hidden'; else el('hud').style.visibility = 'visible';
    this.screen = id;
  }
  private bind(): void {
    const on = (id: string, fn: () => void) => el(id).addEventListener('click', () => { this.audio.unlock(); this.audio.play('ui'); fn(); });
    on('t-start', () => { if (this.data.checkpoint) this.confirm('새 침입을 시작하면 저장된 진행(이어하기)이 사라집니다. 시작할까요?', () => this.newRun()); else this.newRun(); });
    on('t-resume', () => this.resumeCheckpoint());
    on('t-codex', () => this.showCodex()); on('t-help', () => this.showHelp()); on('t-settings', () => this.showSettings());
    on('btn-pause', () => { if (this.screen === 'game') this.pause(); });
    on('p-resume', () => this.resume()); on('p-help', () => this.showHelp()); on('p-settings', () => this.showSettings());
    on('p-quit', () => this.confirm('이 런을 포기하고 메인으로 갑니다. 현재 구역 시작 지점의 이어하기는 유지됩니다.', () => { this.run = null; this.showTitle(); }));
    on('r-retry-zone', () => this.resumeCheckpoint()); on('r-restart', () => this.newRun()); on('r-menu', () => { this.run = null; this.showTitle(); });
    on('c-back', () => this.back()); on('h-back', () => this.back()); on('s-back', () => this.back());
    on('cf-no', () => this.back());
    on('s-reset', () => this.confirm('설정·기록·도감·이어하기를 모두 지웁니다. 되돌릴 수 없습니다.', () => { resetSave(); const { data } = load(); this.data = data; this.applySettingsUI(); this.notice('저장 데이터를 초기화했습니다'); }));
    el<HTMLInputElement>('s-volume').addEventListener('input', (e) => { this.data.settings.volume = Number((e.target as HTMLInputElement).value) / 100; this.audio.volume = this.data.settings.volume; this.audio.apply(); this.persist(); });
    on('s-mute', () => { this.data.settings.muted = !this.data.settings.muted; this.audio.muted = this.data.settings.muted; this.audio.apply(); this.applySettingsUI(); this.persist(); });
    on('s-fx', () => { const o = [0.5, 1, 1.5]; this.data.settings.fx = o[(o.indexOf(this.data.settings.fx) + 1) % o.length]; this.renderer.fx.intensity = this.data.settings.fx; this.applySettingsUI(); this.persist(); });
    on('s-hints', () => { this.data.settings.hints = !this.data.settings.hints; this.applySettingsUI(); this.persist(); });
    on('s-dmg', () => { this.data.settings.showDamage = !this.data.settings.showDamage; this.applySettingsUI(); this.persist(); });
    on('s-hard', () => { if (!this.data.hardUnlocked) { this.notice('먼저 한 번 클리어하면 해금됩니다'); return; } (this.data.settings as any).hard = !(this.data.settings as any).hard; this.applySettingsUI(); this.persist(); });
  }
  private confirmCb: (() => void) | null = null;
  private confirm(text: string, yes: () => void): void {
    this.prevScreen = this.screen; el('cf-text').textContent = text; this.confirmCb = yes; this.show('confirm');
    el('cf-yes').onclick = () => { this.audio.play('ui'); const cb = this.confirmCb; this.confirmCb = null; this.back(); cb?.(); };
  }
  private back(): void {
    if (this.run && this.paused) this.show('pause'); else if (this.run && this.transition?.kind === 'end') this.show('result'); else this.showTitle();
  }
  private showTitle(): void {
    this.show('title'); this.paused = false;
    el('t-resume').classList.toggle('hidden', !this.data.checkpoint);
    if (this.data.checkpoint) el('t-resume').textContent = `이어하기 (${this.data.checkpoint.zoneIndex + 1}구역 ${ZONES[this.data.checkpoint.zoneIndex].name} · ${BODIES[this.data.checkpoint.body].name})`;
    const r = this.data.records;
    el('title-foot').innerHTML = `${r.clears ? `클리어 ${r.clears}회 · 최고 기록 ${fmtTime(r.bestTime)}` : r.runs ? `도전 ${r.runs}회 · 최고 도달 ${r.bestZone}구역` : '첫 10초: 이동 → 공격 → 약화 → 빙의'}<br/>${storageInfo.available ? '' : '⚠ 브라우저 저장소를 쓸 수 없어 기록이 저장되지 않습니다'}`;
    el('hud').style.visibility = 'hidden';
  }
  private showHelp(): void { this.prevScreen = this.screen; this.show('help'); }
  private showSettings(): void { this.prevScreen = this.screen; this.applySettingsUI(); this.show('settings'); }
  private applySettingsUI(): void {
    const s = this.data.settings; el<HTMLInputElement>('s-volume').value = String(Math.round(s.volume * 100));
    const tg = (id: string, on: boolean, txt: string) => { const b = el(id); b.textContent = txt; b.classList.toggle('on', on); };
    tg('s-mute', s.muted, s.muted ? '켬' : '끔'); tg('s-fx', s.fx !== 1, s.fx === 0.5 ? '약하게' : s.fx === 1 ? '보통' : '강하게'); tg('s-hints', s.hints, s.hints ? '켬' : '끔'); tg('s-dmg', s.showDamage, s.showDamage ? '켬' : '끔');
    tg('s-hard', !!(s as any).hard && this.data.hardUnlocked, this.data.hardUnlocked ? ((s as any).hard ? '켬' : '끔') : '잠김');
    el('settings-foot').textContent = `저장: ${storageInfo.available ? 'localStorage 사용' : '사용 불가(' + storageInfo.reason + ')'} · 버전 0.1.0-beta.1`;
  }
  private showCodex(): void {
    this.prevScreen = this.screen;
    const list = el('codex-list'); list.innerHTML = '';
    for (const id of CODEX_ORDER) {
      const d = BODIES[id]; const seen = this.data.codex.includes(id); const card = document.createElement('div'); card.className = 'card' + (seen ? '' : ' locked');
      const use = this.data.records.bodyUse[id] ?? 0;
      card.innerHTML = `<img src="${bodyIcon(id, id === 'intruder')}" alt=""/><div><div class="t">${seen ? d.name : '???'}</div><div class="r">${seen ? d.role : '아직 만나지 못함'}</div>${seen ? `<div class="d">${d.desc}<br/>무기: ${d.weapon.name} · 체력 ${d.hp} · 이동 ${d.speed}${d.stability ? ` · 안정도 ${d.stability}(초당 -${d.stabilityDecay})` : ''}${d.skill ? `<br/>스킬: ${d.skill.name} — ${d.skill.desc} (${d.skill.cooldown}초)` : ''}<ul>${BODY_TIPS[id].map((t) => `<li>${t}</li>`).join('')}</ul>${use ? `사용 시간 ${fmtTime(use)}` : ''}</div>` : ''}</div>`;
      list.appendChild(card);
    }
    const r = this.data.records;
    el('records').innerHTML = `<span>도전 횟수</span><b>${r.runs}</b><span>클리어</span><b>${r.clears}</b><span>최고 클리어 시간</span><b>${r.bestTime ? fmtTime(r.bestTime) : '-'}</b><span>최고 도달 구역</span><b>${r.bestZone || '-'}</b><span>최장 생존</span><b>${fmtTime(r.longestSurvival)}</b><span>누적 빙의</span><b>${r.possessions}</b><span>최소 빙의 클리어</span><b>${r.fewestPossessClear ? r.fewestPossessClear + '회' : '-'}</b><span>가장 많이 쓴 몸</span><b>${(Object.entries(r.bodyUse) as [BodyId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ? BODIES[(Object.entries(r.bodyUse) as [BodyId, number][]).sort((a, b) => b[1] - a[1])[0][0]].name : '-'}</b>`;
    el('ach-list').innerHTML = ACHIEVEMENTS.map((a) => `<div class="ach${this.data.achievements.includes(a.id) ? ' done' : ''}"><span>${this.data.achievements.includes(a.id) ? '✔ ' : '○ '}${a.name}</span><span style="color:var(--dim)">${a.desc}</span></div>`).join('');
    this.show('codex');
  }
  // ---------- 런 ----------
  private startZone(zoneIndex: number, carry: CarryBody | null, seed: number, statsFrom: World | null, elapsed: number, hard: boolean): void {
    const world = createWorld(zoneIndex, carry, seed, statsFrom ? statsFrom.stats : newStats());
    world.hard = hard;
    if (!this.run) this.run = { seed, zoneIndex, world, elapsed, hard, wallBroken: false, switchOn: false, bodiesEver: new Set<BodyId>(['intruder']) };
    else { this.run.zoneIndex = zoneIndex; this.run.world = world; }
    for (const e of world.entities) if (!this.data.codex.includes(e.body)) { /* 만난 몸은 도감에 */ this.data.codex.push(e.body); }
    this.renderer.camX = world.player.x; this.renderer.camY = world.player.y; this.renderer.fx.parts = []; this.renderer.fx.transfer = null;
    this.hud.reset(); this.input.reset(); this.acc = 0; this.transition = null; this.paused = false;
    this.data.checkpoint = { zoneIndex, body: world.player.body, hp: world.player.hp, stability: world.player.stability, seed, stats: world.stats, startedAt: Date.now(), elapsed };
    this.persist();
    this.show('game'); this.audio.play('zone');
    this.banner(`${zoneIndex + 1}구역 · ${world.zone.name}`, world.zone.subtitle, 1.6);
  }
  private newRun(): void {
    const seed = (Date.now() % 1000003) | 0; this.run = null; this.data.records.runs++;
    this.tutorial = { step: this.data.tutorialDone || !this.data.settings.hints ? 99 : 0, moved: 0, startX: 0, startY: 0, timer: 0 };
    this.startZone(0, null, seed, null, 0, !!(this.data.settings as any).hard && this.data.hardUnlocked);
  }
  private resumeCheckpoint(): void {
    const c = this.data.checkpoint; if (!c) { this.newRun(); return; }
    this.run = null; this.tutorial.step = 99;
    const d = BODIES[c.body];
    const carry: CarryBody | null = c.body === 'intruder' ? null : { body: c.body, hp: Math.max(c.hp, Math.round(d.hp * RULES.checkpointMinHpRatio)), stability: d.stability == null ? null : Math.max(c.stability ?? 0, d.stability * RULES.checkpointMinStabRatio) };
    const w0 = new World(0, c.seed, (c.stats as any) ?? newStats());
    this.startZone(c.zoneIndex, carry, c.seed, w0, c.elapsed, !!(this.data.settings as any).hard && this.data.hardUnlocked);
    if (!carry) { const p = this.run!.world.player; p.hp = Math.max(p.hp, Math.round(p.hpMax * RULES.checkpointMinHpRatio)); }
  }
  private banner(text: string, sub: string, seconds: number): void { const b = el('banner'); b.innerHTML = `${text}<small>${sub}</small>`; b.classList.remove('hidden'); window.clearTimeout((b as any)._t); (b as any)._t = window.setTimeout(() => b.classList.add('hidden'), seconds * 1000); }
  pause(auto = false): void {
    if (!this.run || this.screen !== 'game') return;
    this.paused = true; this.input.reset(); this.audio.suspend(); this.show('pause');
    el('pause-foot').textContent = auto ? '화면을 벗어나 자동으로 멈췄습니다. 계속하기를 누르면 이어집니다.' : '';
  }
  resume(): void { if (!this.run) return; this.paused = false; this.input.reset(); this.acc = 0; this.lastT = performance.now(); this.audio.resume(); this.show('game'); }
  // ---------- 루프 ----------
  private frame(t: number): void {
    requestAnimationFrame((tt) => this.frame(tt));
    let dt = (t - this.lastT) / 1000; this.lastT = t; if (dt > 0.05) dt = 0.05; if (dt < 0) dt = 0;
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    const run = this.run; if (!run) return;
    const w = run.world;
    if (this.screen === 'game' && !this.paused) {
      if (w.phase === 'playing') {
        this.acc += dt; run.elapsed += dt;
        const auto = (window as any).__auto as ((w: World) => Partial<Input>) | undefined;
        const inp = auto ? { ...EMPTY_INPUT, ...auto(w) } : this.debug.input ? { ...EMPTY_INPUT, ...this.debug.input } : this.input.read();
        let n = 0;
        while (this.acc >= RULES.fixedDt && n++ < 6) { step(w, inp, RULES.fixedDt); this.acc -= RULES.fixedDt; if (w.phase !== 'playing') break; }
        this.consumeEvents(w);
        this.tutorialTick(w, dt);
      }
      if (w.phase !== 'playing' && !this.transition) this.onPhaseEnd(w);
      if (this.transition && performance.now() >= this.transition.until) { const tr = this.transition; this.transition = null; if (tr.kind === 'zone') this.nextZone(); else this.showResult(); }
    }
    this.renderer.fx.update(dt);
    this.renderer.render(w, dt);
    this.hudT += dt; if (this.hudT > 0.05) { this.hudT = 0; this.hud.update(w, run.elapsed, run.hard); }
  }
  private consumeEvents(w: World): void {
    const run = this.run!;
    for (const ev of w.events) {
      if (!this.data.settings.showDamage && ev.type === 'hit' && ev.amount) { ev.amount = 0; }
      this.renderer.fx.handle(ev, w.time);
      this.sound(ev, w);
      if (ev.type === 'shot') this.debug.shots++;
      if (ev.type === 'possess' && ev.body) { run.bodiesEver.add(ev.body); if (!this.data.codex.includes(ev.body)) this.data.codex.push(ev.body); this.unlock('first_possess'); }
      if (ev.type === 'wallBreak') { run.wallBroken = true; this.unlock('wall'); }
      if (ev.type === 'switch' && !ev.text) { run.switchOn = true; this.unlock('switch'); }
      if (ev.type === 'lastChance') { /* 생존 시 possess에서 stats.lastChanceSaves 증가 */ }
      if (ev.type === 'possess' && w.stats.lastChanceSaves > 0) this.unlock('clutch');
    }
    w.events.length = 0;
  }
  private sound(ev: GameEvent, w: World): void {
    const a = this.audio;
    switch (ev.type) {
      case 'shot': if (ev.text === 'windup') a.play('windup_sniper'); else if (ev.text !== 'ring') a.play('shot_' + (ev.body ?? 'intruder')); break;
      case 'hit': if (ev.id === w.playerId) a.play('hurt'); else if (ev.amount) a.play('hit'); break;
      case 'block': a.play('block'); break;
      case 'explode': a.play('explode'); break;
      case 'die': a.play('die'); break;
      case 'possess': a.play('possess'); break;
      case 'possessFail': a.play('possessFail'); break;
      case 'skill': a.play(ev.text === 'dash' || ev.text === 'sprint' ? 'skill_dash' : ev.text === 'guard' ? 'skill_guard' : ev.text === 'repairpulse' ? 'skill_repair' : 'skill'); break;
      case 'collapseWarn': a.play('warn'); break;
      case 'collapseStart': a.play('collapse'); break;
      case 'wallBreak': a.play('wall'); break;
      case 'switch': a.play('switch'); break;
      case 'door': a.play('door'); break;
      case 'turretOff': a.play('turretOff'); break;
      case 'stun': a.play('stun'); break;
      case 'bossWarn': a.play(ev.text === 'charge' ? 'warn' : 'boss'); break;
      case 'bossPhase': a.play('bossPhase'); break;
      case 'laser': if (ev.text === 'fire') a.play('laser'); else a.play('warn'); break;
      case 'lastChance': a.play('lastChance'); break;
      case 'wave': if (ev.text !== 'spawn' && ev.text !== 'done') a.play('wave'); break;
      case 'repair': a.play('skill_repair'); break;
      case 'victory': a.play('victory'); break;
      case 'defeat': a.play('defeat'); break;
      default: break;
    }
  }
  private onPhaseEnd(w: World): void {
    if (w.phase === 'zoneclear') { this.transition = { until: performance.now() + 1300, kind: 'zone' }; this.banner('구역 통과', `${fmtTime(w.zoneTime)} · 다음 구역으로`, 1.3); this.audio.play('zone'); }
    else { this.transition = { until: performance.now() + (w.phase === 'victory' ? 2200 : 1400), kind: 'end' }; if (w.phase === 'victory') this.banner('코어 정지', '시설 탈출 성공', 2.2); else this.banner('몸을 잃었다', w.defeatReason, 1.4); }
  }
  private nextZone(): void {
    const run = this.run!; const w = run.world; const next = run.zoneIndex + 1;
    if (next >= ZONES.length) { this.showResult(); return; }
    const carry = carryFrom(w.player);
    this.startZone(next, carry, run.seed, w, run.elapsed, run.hard);
  }
  private unlock(id: string): boolean { if (this.data.achievements.includes(id)) return false; this.data.achievements.push(id); this.notice(`도전과제 달성: ${ACHIEVEMENTS.find((a) => a.id === id)?.name}`, 2500); return true; }
  private showResult(): void {
    const run = this.run!; const w = run.world; const won = w.phase === 'victory'; const st = w.stats; const r = this.data.records;
    const newAch: string[] = [];
    r.possessions += st.possessions; r.longestSurvival = Math.max(r.longestSurvival, run.elapsed); r.bestZone = Math.max(r.bestZone, run.zoneIndex + 1);
    for (const [b, t] of Object.entries(st.timeByBody) as [BodyId, number][]) r.bodyUse[b] = (r.bodyUse[b] ?? 0) + t;
    if (won) {
      r.clears++; r.bestTime = r.bestTime ? Math.min(r.bestTime, run.elapsed) : run.elapsed; r.fewestPossessClear = r.fewestPossessClear ? Math.min(r.fewestPossessClear, st.possessions) : st.possessions || 1;
      this.data.hardUnlocked = true;
      const u = (id: string, cond: boolean) => { if (cond && this.unlock(id)) newAch.push(id); };
      u('clear', true); u('three_bodies', st.bodiesUsed.filter((b) => b !== 'intruder').length >= 3); u('no_shield', !st.usedShield); u('minimal', st.possessions <= 3); u('fast', run.elapsed <= 360);
      this.data.checkpoint = null;
    } else {
      // 체크포인트는 구역 시작 시점으로 유지
    }
    if (['scout', 'shield', 'bomber', 'sniper', 'mechanic'].every((b) => this.data.codex.includes(b as BodyId) && (r.bodyUse[b as BodyId] ?? 0) > 0)) { if (this.unlock('all_bodies')) newAch.push('all_bodies'); }
    this.persist();
    el('r-title').textContent = won ? '탈출 성공' : '침입 실패';
    el('r-title').style.color = won ? 'var(--green)' : 'var(--red)';
    el('r-sub').textContent = won ? `감시 코어 관리자를 정지시켰다 · ${fmtTime(run.elapsed)}${run.hard ? ' · 어려움' : ''}` : `${run.zoneIndex + 1}구역 ${w.zone.name}에서 ${w.defeatReason} · ${fmtTime(run.elapsed)}`;
    el('r-chain').innerHTML = st.bodiesUsed.map((b, i) => `${i ? '<span>→</span>' : ''}<img src="${bodyIcon(b, true)}" title="${BODIES[b].name}" alt="${BODIES[b].name}"/>`).join('') + `<span style="width:100%;text-align:center">${st.bodiesUsed.map((b) => BODIES[b].name).join(' → ')}</span>`;
    const most = (Object.entries(st.timeByBody) as [BodyId, number][]).sort((a, b) => b[1] - a[1])[0];
    el('r-stat').innerHTML = `<span>빙의 횟수</span><b>${st.possessions}</b><span>마지막 기회 생존</span><b>${st.lastChanceSaves}</b><span>처치</span><b>${st.kills}</b><span>받은 피해</span><b>${Math.round(st.damageTaken)}</b><span>가장 오래 쓴 몸</span><b>${most ? BODIES[most[0]].name + ' ' + fmtTime(most[1]) : '-'}</b><span>도달 구역</span><b>${run.zoneIndex + 1}/5</b>${won ? `<span>최고 기록</span><b>${fmtTime(r.bestTime)}</b>` : `<span>최고 도달</span><b>${r.bestZone}구역</b>`}`;
    el('r-ach').textContent = newAch.length ? `새 도전과제: ${newAch.map((a) => ACHIEVEMENTS.find((x) => x.id === a)?.name).join(', ')}` : '';
    el('r-retry-zone').classList.toggle('hidden', won || !this.data.checkpoint);
    if (!won && this.data.checkpoint) el('r-retry-zone').textContent = `${this.data.checkpoint.zoneIndex + 1}구역부터 재도전 (${BODIES[this.data.checkpoint.body].name})`;
    this.show('result');
  }
  // ---------- 튜토리얼(1구역, 짧은 체험형) ----------
  private tip(text: string | null): void { const t = el('tip'); if (!text) { t.classList.add('hidden'); return; } t.classList.remove('hidden'); el('tiptext').textContent = text; }
  private tutorialTick(w: World, dt: number): void {
    const tu = this.tutorial; if (tu.step >= 99 || w.zoneIndex !== 0) { this.tip(null); return; }
    const p = w.player;
    switch (tu.step) {
      case 0: if (!tu.startX) { tu.startX = p.x; tu.startY = p.y; } this.tip('① 왼쪽 화면을 드래그해 이동'); if (Math.hypot(p.x - tu.startX, p.y - tu.startY) > 60) tu.step = 1; break;
      case 1: this.tip('② 공격 버튼을 누르고 있으면 가까운 적을 자동 조준 · 정찰병을 약화시켜라'); if (w.entities.some((e) => e.team === 'enemy' && e.hp < e.hpMax)) tu.step = 2; break;
      case 2: this.tip('③ 체력 35% 이하 → 흰 다이아몬드 = 빙의 가능. 가까이 가서 [빙의]'); if (w.candidates.length && w.possessTarget) this.tip('③ 지금! [빙의] 버튼'); if (w.stats.possessions > 0) { tu.step = 3; tu.timer = 0; } break;
      case 3: this.tip(`④ 새 몸! [스킬] 버튼으로 ${BODIES[p.body].skill?.name ?? '스킬'} 사용`); if (w.events.length === 0 && p.skillCd > 0) { tu.step = 4; tu.timer = 0; } break;
      case 4: this.tip('⑤ 몸마다 역할이 다르다: 방패병=포탑 통로 · 폭탄병=금 간 벽 · 폭탄병은 죽이지 말고 남겨두면 지름길'); tu.timer += dt; if (tu.timer > 6) { tu.step = 99; this.data.tutorialDone = true; this.persist(); this.tip(null); } break;
    }
  }
}
