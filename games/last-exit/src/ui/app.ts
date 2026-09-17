// 앱: 화면 전환, 메인 루프(고정 스텝), 이벤트→연출, HUD, 저장 시점
import type { RunState, SimEvent, WeaponId, Difficulty, LootId, AbilityId } from '../sim/types';
import { newRun, deserialize, bagWeight, bagValue, weightSlow, dashCooldown, enterZone } from '../sim/state';
import { flowField, flowDir, norm } from '../sim/geom';
import { step, dispatch, interactable, DT, type Interact } from '../sim/engine';
import { zoneDef, TOTAL_ZONES } from '../data/zones';
import { LOOT, ENEMIES, WEAPONS, ABILITIES, PLAYER } from '../data/balance';
import { Renderer } from '../render/renderer';
import { Audio } from '../platform/audio';
import { TouchInput, KeyInput } from '../platform/input';
import * as store from '../platform/storage';
import { h, $, clear } from './dom';
import * as sheets from './sheets';
import { unopenedChests, floorLootCount } from '../sim/zone';

const MAX_STEPS = 6;
type Warn = { el: HTMLElement; until: number };

export class App {
  root: HTMLElement;
  blob: store.SaveBlob;
  audio = new Audio();
  renderer: Renderer | null = null;
  input: TouchInput | null = null;
  keys = new KeyInput();
  state: RunState | null = null;
  running = false; paused = false; acc = 0; lastT = 0; fps = 0; frames = 0; fpsT = 0;
  sheet: string | null = null;
  warns: Warn[] = [];
  hudT = 0; hudTop = 90;
  saveStatus = ''; saveOk = true;
  tutorial = { step: -1, moved: 0, startX: 0, startY: 0, t: 0 };
  finishT = 0; finishing = false;
  bgmMode: 'explore' | 'danger' | 'escape' = 'explore';
  lastInteract: string | null = null;
  runStartSettings: { weapon: WeaponId; difficulty: Difficulty } = { weapon: 'rifle', difficulty: 'normal' };
  pendingSnapshotLabel: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    const l = store.load(); this.blob = l.blob;
    if (l.error) setTimeout(() => this.modalMsg('저장 데이터 안내', l.error!), 200);
    this.showTitle();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.input?.release(); this.audio.suspend(); if (this.state && this.running && !this.paused && this.state.status === 'active') this.openSheet('pause', { returned: true }); }
      else { this.lastT = performance.now(); this.acc = 0; }
    });
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => setTimeout(() => this.layout(), 250));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.state && this.running) { if (this.sheet) this.closeSheet(); else this.openSheet('pause'); } if (e.key.toLowerCase() === 'e' && this.state && this.running && !this.sheet) this.onInteract(); if (e.key.toLowerCase() === 'b' && this.state && this.running && !this.sheet) this.openSheet('bag'); });
  }

  // ───────── 거점 ─────────
  showTitle(): void {
    this.running = false; this.state = null; this.audio.setBgm('off'); this.input?.destroy(); this.input = null; this.renderer = null; this.sheet = null;
    clear(this.root);
    this.root.append(sheets.titleScreen(this));
    this.root.append(h('div', { id: 'sheet', class: 'hidden' }), h('div', { id: 'modal', class: 'hidden' }));
  }

  // ───────── 출정 생명주기 ─────────
  startRun(weapon: WeaponId, difficulty: Difficulty, seed?: number): void {
    this.audio.unlock();
    const m = this.blob.meta;
    if (weapon !== 'rifle' && !m.unlocks[weapon]) { this.modalMsg('무기 잠김', '거점의 해금 메뉴에서 먼저 해금하세요.'); return; }
    if (difficulty === 'hard' && !m.hardUnlocked) { this.modalMsg('어려움 잠김', '보통 난이도에서 최종 탈출에 성공하면 해금됩니다.'); return; }
    const sd = seed ?? ((Math.random() * 2 ** 32) >>> 0);
    const runId = `${Date.now().toString(36)}-${sd.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    this.state = newRun({ seed: sd, weapon, difficulty, bagUpgrades: m.bagUpgrades, runId });
    m.lastWeapon = weapon; m.lastDifficulty = difficulty; this.runStartSettings = { weapon, difficulty };
    this.tutorial = { step: m.tutorialDone ? -1 : 0, moved: 0, startX: this.state.player.x, startY: this.state.player.y, t: 0 };
    this.beginGame();
    this.snapshot('구역 1 진입');
  }
  resumeRun(): void {
    this.audio.unlock();
    const r = this.blob.run; if (!r) return;
    try {
      const s = deserialize(r.snapshot);
      if (s.status !== 'active') throw new Error('이미 종료된 출정');
      this.state = s; this.runStartSettings = { weapon: s.weapon, difficulty: s.difficulty };
      this.tutorial = { step: -1, moved: 0, startX: 0, startY: 0, t: 0 };
      this.beginGame();
      this.warn(`${s.zone}구역 ${r.label} 시점에서 이어합니다`, 'info', 4);
      if (s.phase === 'ability' && s.abilityOffer) this.openSheet('ability');
    } catch (e) {
      this.blob.run = null; this.saveAll();
      this.modalMsg('이어하기 실패', '저장된 출정을 복원할 수 없어 정리했습니다: ' + (e as Error).message);
    }
  }
  beginGame(): void {
    clear(this.root); this.buildGameDom();
    this.renderer = new Renderer($('cv') as HTMLCanvasElement);
    this.input = new TouchInput($('cv'));
    this.input.moveZone = (x, y) => y >= this.renderer!.moveZoneTop;
    this.layout();
    this.renderer.fx.shakeOn = this.blob.meta.settings.shake; this.renderer.fx.quality = this.blob.meta.settings.lowFx ? 0.4 : 1; this.renderer.lowFx = this.blob.meta.settings.lowFx;
    this.audio.setVolumes(this.blob.meta.settings.sfx, this.blob.meta.settings.bgm); this.audio.setBgm('explore'); this.bgmMode = 'explore';
    this.paused = false; this.acc = 0; this.lastT = performance.now(); this.finishing = false; this.sheet = null; this.warns = [];
    this.renderer.resetCamera();
    if (!this.running) { this.running = true; requestAnimationFrame(t => this.frame(t)); }
    this.updateHud(true);
    if (this.state!.events.length === 0) { const z = zoneDef(this.state!.zone); this.warn(`${z.index}구역 · ${z.name}`, 'info', 3); }
    if (this.tutorial.step === 0) this.showTutorial();
  }
  abandonRun(): void {
    const s = this.state; if (!s) return;
    s.status = 'abandoned'; s.phase = 'done';
    store.settleRun(this.blob, s); this.saveAll();
    this.showTitle();
  }
  /** 탈출·사망 확정: 정산 1회 + 저장 + 결과 화면 */
  finishRun(): void {
    const s = this.state; if (!s || s.status === 'active') return;
    const before = this.blob.meta.vault;
    const r = store.settleRun(this.blob, s);
    store.noteCodex(this.blob.meta, [], Object.keys(s.bag.items).filter(k => s.bag.items[k as LootId] > 0) as LootId[]);
    const sv = this.saveAll();
    this.paused = true;
    this.openSheet('result', { before, awarded: r.awarded, already: r.already, saveOk: sv.ok, saveError: sv.error });
  }
  retry(): void { const { weapon, difficulty } = this.runStartSettings; this.startRun(weapon, difficulty); }

  // ───────── 저장 ─────────
  saveAll(): { ok: boolean; error?: string } {
    const r = store.save(this.blob);
    this.saveOk = r.ok; this.saveStatus = r.ok ? '저장됨' : (r.error || '저장 실패');
    if (!r.ok) this.warn('저장 실패: ' + (r.error || ''), 'bad', 4);
    return r;
  }
  snapshot(label: string): void {
    if (!this.state || this.state.status !== 'active') return;
    store.snapshotRun(this.blob, this.state, label);
    this.saveAll();
  }

  // ───────── 게임 DOM ─────────
  buildGameDom(): void {
    const g = h('div', { id: 'game' },
      h('canvas', { id: 'cv' }),
      h('div', { id: 'hud' },
        h('div', { id: 'topbar' },
          h('div', { id: 'hpbar' }, h('div', { class: 'fill' }), h('div', { class: 'shield' }), h('div', { class: 'txt' }, '100 / 100')),
          h('div', { class: 'statrow' }, h('span', { class: 'chip', id: 'st-zone' }, '1구역'), h('span', { class: 'chip', id: 'st-bag' }, '가방 0/30'), h('span', { class: 'chip gold', id: 'st-value' }, '미확정 ◆0'), h('span', { class: 'spacer' }), h('button', { id: 'btn-pause', onclick: () => this.openSheet('pause') }, '⏸')),
          h('div', { id: 'objective' }, ''),
          h('div', { id: 'bossbar', class: 'hidden' }, h('div', { class: 'fill' })),
          h('div', { id: 'escapebar', class: 'hidden' }, h('div', { class: 'lbl' }, '탈출 준비'), h('div', { class: 'bar' }, h('div', { class: 'fill' }))),
        ),
        h('div', { id: 'notices' }, h('div', { id: 'warn' }), h('div', { id: 'hint', class: 'hidden' })),
        h('button', { id: 'btn-interact', class: 'hidden', onpointerdown: (e: Event) => { e.preventDefault(); e.stopPropagation(); }, onclick: () => this.onInteract() }, ''),
        h('button', { id: 'btn-bag', onpointerdown: (e: Event) => { e.stopPropagation(); }, onclick: () => this.openSheet('bag') }, '가방', h('small', {}, '0/30')),
        h('button', { id: 'btn-dash', onpointerdown: (e: Event) => { e.preventDefault(); e.stopPropagation(); this.input?.queueDash(); }, onclick: (e: Event) => e.preventDefault() }, '대시', h('small', {}, '준비')),
      ),
      h('div', { id: 'sheet', class: 'hidden' }), h('div', { id: 'modal', class: 'hidden' }),
    );
    this.root.append(g);
  }
  layout(): void { if (this.renderer) { this.renderer.resize(); this.hudTop = ($('topbar')?.offsetHeight || 90); const n = document.getElementById('notices'); if (n) n.style.top = (this.hudTop + 4) + 'px'; } }

  // ───────── 루프 ─────────
  frame(t: number): void {
    if (!this.running) return;
    requestAnimationFrame(tt => this.frame(tt));
    const s = this.state; if (!s || !this.renderer || !this.input) return;
    let dt = (t - this.lastT) / 1000; this.lastT = t; if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    const simActive = !this.paused && s.status === 'active' && s.phase !== 'ability';
    if (simActive) {
      this.acc += dt; let n = 0;
      while (this.acc >= DT && n < MAX_STEPS) {
        const ti = this.input.consume(); const kv = this.keys.vec();
        const input = { mx: ti.mx || kv.x, my: ti.my || kv.y, dash: ti.dash || this.keys.dashQueued }; this.keys.dashQueued = false;
        step(s, input); this.acc -= DT; n++;
        if (s.player.dashT > 0) this.renderer.fx.trail(s.player.x, s.player.y, 'rgba(90,208,224,0.5)', 12);
        if (this.tutorial.step >= 0) this.tickTutorial(input.dash);
      }
      if (n >= MAX_STEPS) this.acc = 0; // 긴 프레임 지연은 버림 (즉사 방지)
    }
    if (s.events.length) { const evs = s.events.slice(); s.events.length = 0; this.handleEvents(evs); }
    if (this.finishing) { this.finishT -= dt; if (this.finishT <= 0) { this.finishing = false; this.finishRun(); } }
    this.renderer.updateCamera(s, dt);
    this.renderer.draw(s, this.input.joy, dt, this.hudTop);
    this.hudT += dt; if (this.hudT >= 0.08) { this.hudT = 0; this.updateHud(); }
    this.audio.tick();
    const now = performance.now(); this.warns = this.warns.filter(w => { if (now > w.until) { w.el.remove(); return false; } return true; });
    // 배경음 강도
    const want: typeof this.bgmMode = s.escape?.active ? 'escape' : (s.enemies.length > 0 || s.spawns.length > 0) ? 'danger' : 'explore';
    if (want !== this.bgmMode) { this.bgmMode = want; this.audio.setBgm(this.paused ? 'off' : want); }
  }

  handleEvents(evs: SimEvent[]): void {
    const s = this.state!; const fx = this.renderer!.fx; const a = this.audio; const p = s.player;
    for (const ev of evs) {
      switch (ev.t) {
        case 'shot': { fx.flash(ev.x + Math.cos(ev.a) * 22, ev.y + Math.sin(ev.a) * 22, ev.weapon === 'shotgun' ? 12 : 7, '#ffe0a0'); a.play(`shoot_${ev.weapon}${ev.tier >= 2 ? '2' : ''}`); if (ev.weapon === 'shotgun') fx.kick(2); break; }
        case 'hit': fx.burst(ev.x, ev.y, 3, '#ffd27a', 90, 2, 0.2); a.play('hit'); break;
        case 'kill': { const col = ev.type === 'chaser' ? '#a86b4a' : ev.type === 'runner' ? '#e3c23a' : ev.type === 'shooter' ? '#7b4fb0' : ev.type === 'armored' ? '#7d94ad' : ev.type === 'bomber' ? '#e07a2f' : '#b366ff'; fx.burst(ev.x, ev.y, ev.type === 'boss' ? 60 : 12, col, ev.type === 'boss' ? 260 : 140, 3.5, 0.5, 'shard', 300); fx.ring(ev.x, ev.y, ev.type === 'boss' ? 90 : 22, col, 0.3); a.play(ev.type === 'boss' ? 'boss_dead' : 'kill'); store.noteCodex(this.blob.meta, [ev.type], []); break; }
        case 'beam': fx.beam(ev.pts, ev.tier); for (let i = 2; i < ev.pts.length; i += 2) fx.burst(ev.pts[i], ev.pts[i + 1], 3, '#9ff0ff', 80, 2, 0.2); break;
        case 'explode': { const col = ev.kind === 'bomber' ? '#ff5c2f' : ev.kind === 'boss' ? '#ff9a3b' : '#ffd27a'; fx.ring(ev.x, ev.y, ev.r, col, 0.35); fx.burst(ev.x, ev.y, ev.kind === 'boss' ? 6 : 14, col, 200, 3, 0.35, 'smoke'); fx.kick(ev.kind === 'shock' ? 3 : 6); a.play(ev.kind === 'shock' ? 'shock' : ev.kind === 'boss' ? 'boss_cone' : 'explode'); break; }
        case 'pickup': { fx.text(ev.x, ev.y, `+${LOOT[ev.type].name}${ev.count > 1 ? ' ×' + ev.count : ''}`, LOOT[ev.type].color); a.play(ev.type === 'relic' ? 'pickup_relic' : 'pickup'); store.noteCodex(this.blob.meta, [], [ev.type]); if (ev.type === 'relic') fx.ring(p.x, p.y, 30, '#e9c46a', 0.4); if (this.tutorial.step === 2) this.advanceTutorial(); break; }
        case 'chest': fx.burst(ev.x, ev.y, 14, ev.kind === 'safe' ? '#3f7a52' : '#a8703f', 160, 3, 0.45, 'shard', 320); fx.ring(ev.x, ev.y, ev.kind === 'safe' ? 40 : 26, '#e9c46a', 0.35); a.play(ev.kind === 'safe' ? 'safe' : 'chest'); break;
        case 'hurt': fx.kick(ev.shield ? 3 : 6); a.play(ev.shield ? 'shieldhit' : 'hurt'); fx.text(p.x, p.y - 14, `-${ev.amount}`, ev.shield ? '#5ad0e0' : '#ff5c6c', 0.7); break;
        case 'dash': a.play('dash'); if (this.tutorial.step === 1) this.advanceTutorial(); break;
        case 'spawnWarn': a.play('spawn'); break;
        case 'collapseWarn': this.warn('⚠ 통로 붕괴 경고 — 표시된 바닥에서 벗어나세요', 'warn', 3); fx.kick(2); a.play('warn'); break;
        case 'collapse': fx.kick(12); a.play('collapse'); this.renderer!.resetCamera(); break;
        case 'escaped': { a.play('escape_ok'); fx.ring(p.x, p.y, 120, '#6ee7a0', 0.8); fx.burst(p.x, p.y, 40, '#e9c46a', 220, 3, 0.8, 'shard', 200); this.warn('탈출 성공!', 'good', 3); this.finishing = true; this.finishT = 1.1; this.input?.release(); break; }
        case 'dead': { a.play('lose'); fx.burst(p.x, p.y, 30, '#ff5c6c', 200, 3, 0.8, 'shard', 200); fx.kick(10); this.warn(`쓰러졌습니다 (${ev.cause})`, 'bad', 3); this.finishing = true; this.finishT = 1.3; this.input?.release(); break; }
        case 'bossSpawn': a.play('boss'); this.warn('금고 파수꾼 등장!', 'bad', 3); fx.kick(8); break;
        case 'bossPhase': a.play('boss'); this.warn('파수꾼이 격화되었습니다! 패턴이 빨라집니다', 'bad', 3); fx.kick(6); break;
        case 'bossDead': this.warn('파수꾼 처치! 최종 출구가 열렸습니다', 'good', 4); break;
        case 'cleared': { a.play('cleared'); const z = zoneDef(ev.zone); this.warn(z.escape ? '구역 정리 완료 — 탈출 지점과 출구가 열렸습니다' : z.boss ? '' : '구역 정리 완료 — 출구 개방', 'good', 3); this.pendingSnapshotLabel = z.boss ? '보스 처치' : '목표 완료'; if (s.phase === 'ability') this.openSheet('ability'); else this.snapshot(this.pendingSnapshotLabel); if (z.escape && this.tutorial.step === 3) this.advanceTutorial(); break; }
        case 'alarm': a.play('alarm'); this.warn('경보 발생! 추가 적 접근', 'bad', 3); fx.kick(4); break;
        case 'bagFull': this.warn('가방이 가득 찼습니다 (무게 초과) — 가방에서 버릴 수 있습니다', 'warn', 2.5); a.play('error'); break;
        case 'drop': a.play('drop'); break;
        case 'toast': this.warn(ev.text, ev.kind, 3); break;
        case 'escapeStart': a.play('escape_start'); this.warn('탈출 준비 시작 — 구역 안에서 버티세요', 'warn', 3); if (this.tutorial.step === 4) this.advanceTutorial(); break;
        case 'escapeCancel': break;
        case 'zoneEnter': { const z = zoneDef(ev.zone); this.warn(`${z.index}구역 · ${z.name}`, 'info', 3); this.renderer!.resetCamera(); a.play('door'); this.snapshot(`구역 ${ev.zone} 진입`); if (ev.zone > 1) this.blob.meta.codex.bestZone = Math.max(this.blob.meta.codex.bestZone, ev.zone); break; }
        case 'tier': a.play('tier'); fx.ring(p.x, p.y, 60, '#ffe680', 0.6); break;
        case 'heal': fx.text(p.x, p.y - 24, `+${ev.amount} 체력`, '#6ee7a0'); a.play('heal'); break;
        case 'shield': fx.text(p.x, p.y - 24, `보호막 ${ev.amount}`, '#5ad0e0'); a.play('heal'); break;
        case 'knock': break;
      }
    }
  }

  // ───────── HUD ─────────
  warn(text: string, kind: 'info' | 'warn' | 'good' | 'bad', sec = 2.5): void {
    if (!text) return; const box = document.getElementById('warn'); if (!box) return;
    const el = h('div', { class: 'w ' + kind }, text); box.append(el);
    this.warns.push({ el, until: performance.now() + sec * 1000 });
    while (this.warns.length > 3) { const w = this.warns.shift()!; w.el.remove(); }
  }
  updateHud(force = false): void {
    const s = this.state; if (!s || !document.getElementById('hpbar')) return;
    const p = s.player; const hp = document.getElementById('hpbar')!;
    (hp.querySelector('.fill') as HTMLElement).style.width = `${Math.max(0, p.hp / p.maxHp * 100)}%`;
    (hp.querySelector('.shield') as HTMLElement).style.width = `${Math.min(100, p.shield / p.maxHp * 100)}%`;
    hp.querySelector('.txt')!.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}${p.shield > 0 ? `  +${Math.ceil(p.shield)} 보호막` : ''}`;
    hp.classList.toggle('low', p.hp / p.maxHp < 0.35);
    const z = zoneDef(s.zone); $('st-zone').textContent = `${s.zone}/${TOTAL_ZONES} ${z.name}`;
    const w = bagWeight(s), max = s.bag.maxWeight; const slow = weightSlow(s);
    const bag = $('st-bag'); bag.textContent = `가방 ${w}/${max}${slow > 0 ? ` −${Math.round(slow * 100)}%` : ''}`; bag.className = 'chip' + (w >= max ? ' full' : slow > 0 ? ' heavy' : '');
    $('st-value').innerHTML = `미확정 <b>◆${bagValue(s)}</b>`;
    const obj = $('objective'); const zr = s.zoneRt;
    if (s.status !== 'active') obj.textContent = '';
    else if (z.boss) obj.innerHTML = zr.bossDead ? '<b>최종 출구 개방</b> — 출구에서 최종 탈출을 요청하세요' : zr.bossSpawned ? '금고 파수꾼 처치' : '파수꾼이 깨어납니다…';
    else if (!zr.cleared) obj.innerHTML = `목표: 적 처치 <b>${zr.kills}/${zr.killsRequired}</b>${s.enemies.length ? ` · 남은 적 ${s.enemies.length}` : ''}`;
    else { const ch = unopenedChests(s), fl = floorLootCount(s); obj.innerHTML = `<b>출구 개방</b>${z.escape ? ' · 탈출 지점 사용 가능' : ''}${ch ? ` · 상자 ${ch}` : ''}${fl ? ` · 바닥 전리품 ${fl}` : ''}`; }
    const bb = $('bossbar'); if (s.bossBar) { bb.classList.remove('hidden'); (bb.querySelector('.fill') as HTMLElement).style.width = `${s.bossBar.hp / s.bossBar.max * 100}%`; } else bb.classList.add('hidden');
    // 대시
    const dash = $('btn-dash'); const cd = p.dashCd; const cdMax = dashCooldown(s);
    dash.classList.toggle('cd', cd > 0); dash.querySelector('small')!.textContent = cd > 0 ? `${cd.toFixed(1)}초` : '준비';
    dash.style.background = cd > 0 ? `conic-gradient(#5ad0e0 ${(1 - cd / cdMax) * 360}deg, #1c2436 0deg)` : '';
    // 가방 버튼
    const bb2 = $('btn-bag'); bb2.querySelector('small')!.textContent = `${w}/${max}`; bb2.className = w >= max ? 'full' : slow > 0 ? 'heavy' : '';
    // 상호작용
    const it = interactable(s); const ib = $('btn-interact');
    if (it && s.status === 'active') { ib.classList.remove('hidden'); ib.className = it.kind === 'escapeCancel' ? 'cancel' : it.danger ? 'danger' : ''; const sub = it.kind === 'escape' ? `가치 ◆${bagValue(s)} 확보` : it.kind === 'final' ? `가치 ◆${bagValue(s)} 확보` : it.kind === 'door' && z.escape ? '탈출 기회 포기' : it.kind === 'door' ? '되돌아올 수 없음' : it.kind === 'safe' ? '경보 위험' : it.kind === 'drone' ? '전리품 ↔ 체력' : ''; ib.innerHTML = `${it.label}${sub ? `<small>${sub}</small>` : ''}`; } else ib.classList.add('hidden');
    // 탈출 진행
    const eb = $('escapebar'); const wasHidden = eb.classList.contains('hidden');
    if (s.escape?.active) { eb.classList.remove('hidden'); eb.classList.toggle('paused', !s.escape.inside); eb.querySelector('.lbl')!.textContent = s.escape.inside ? `${s.escape.final ? '최종 ' : ''}탈출 준비 ${s.escape.progress.toFixed(1)} / ${s.escape.need}초` : '⚠ 탈출 구역 밖 — 진행 정지'; (eb.querySelector('.fill') as HTMLElement).style.width = `${s.escape.progress / s.escape.need * 100}%`; }
    else eb.classList.add('hidden');
    if (wasHidden !== eb.classList.contains('hidden') || force) { this.hudTop = $('topbar').offsetHeight; $('notices').style.top = (this.hudTop + 4) + 'px'; }
  }

  // ───────── 상호작용 ─────────
  onInteract(): void {
    const s = this.state; if (!s || this.sheet) return;
    const it = interactable(s); if (!it) return;
    this.audio.play('ui');
    if (it.kind === 'door') this.openSheet('door');
    else if (it.kind === 'safe') this.openSheet('safe', { id: (it.action as any).id });
    else if (it.kind === 'drone') this.openSheet('drone');
    else { const r = dispatch(s, it.action); if (!r.ok && r.msg) this.warn(r.msg, 'warn'); this.updateHud(true); }
  }
  act(a: Parameters<typeof dispatch>[1]): boolean { const s = this.state; if (!s) return false; const r = dispatch(s, a); if (!r.ok && r.msg) this.warn(r.msg, 'warn'); if (s.events.length) { const evs = s.events.slice(); s.events.length = 0; this.handleEvents(evs); } this.updateHud(true); return r.ok; }

  // ───────── 시트 ─────────
  openSheet(kind: string, data: any = {}): void {
    const el = document.getElementById('sheet'); if (!el) return;
    this.sheet = kind; this.input?.release();
    if (this.state && this.running) { this.paused = true; this.audio.setBgm('off'); }
    clear(el); el.classList.remove('hidden');
    el.append(sheets.buildSheet(this, kind, data));
  }
  closeSheet(): void {
    const el = document.getElementById('sheet'); if (el) { clear(el); el.classList.add('hidden'); }
    this.sheet = null;
    if (this.state && this.running && this.state.status === 'active') { this.paused = false; this.lastT = performance.now(); this.acc = 0; this.audio.resume(); this.audio.setBgm(this.bgmMode); }
  }
  modalMsg(title: string, text: string, onOk?: () => void): void {
    const el = document.getElementById('modal'); if (!el) { alert(text); return; }
    clear(el); el.classList.remove('hidden');
    el.append(h('div', { class: 'panel' }, h('h2', {}, title), h('p', {}, text), h('button', { class: 'primary', onclick: () => { clear(el); el.classList.add('hidden'); onOk?.(); } }, '확인')));
  }
  confirm(title: string, text: string, okLabel: string, onOk: () => void, danger = false): void {
    const el = document.getElementById('modal'); if (!el) return;
    clear(el); el.classList.remove('hidden');
    const close = () => { clear(el); el.classList.add('hidden'); };
    el.append(h('div', { class: 'panel' }, h('h2', {}, title), h('p', {}, text), h('div', { class: 'btnrow' }, h('button', { onclick: close }, '취소'), h('button', { class: danger ? 'danger' : 'primary', onclick: () => { close(); onOk(); } }, okLabel))));
  }

  // ───────── 디버그 훅 (자동 테스트 전용, 게임 규칙에 영향 없음) ─────────
  debug = {
    dirTo: (gx: number, gy: number): [number, number] => { const s = this.state; if (!s) return [0, 0]; const f = flowField(s.zoneRt.rows, gx, gy, !!s.zoneRt.door?.open); const d = flowDir(s.zoneRt.rows, f, s.player.x, s.player.y, !!s.zoneRt.door?.open); return d[0] === 0 && d[1] === 0 ? norm(gx - s.player.x, gy - s.player.y) : d; },
    toScreen: (x: number, y: number): [number, number] => this.renderer ? this.renderer.worldToScreen(x, y) : [0, 0],
    jumpZone: (n: number): void => { const s = this.state; if (!s) return; enterZone(s, n); this.renderer?.resetCamera(); },
    setHp: (hp: number): void => { if (this.state) this.state.player.hp = hp; },
    summary: () => { const s = this.state; if (!s) return null; return { zone: s.zone, phase: s.phase, status: s.status, hp: s.player.hp, x: s.player.x, y: s.player.y, kills: s.zoneRt.kills, need: s.zoneRt.killsRequired, enemies: s.enemies.length, spawns: s.spawns.length, bag: { ...s.bag.items }, weight: bagWeight(s), value: bagValue(s), cleared: s.zoneRt.cleared, escape: s.escape ? { active: s.escape.active, progress: s.escape.progress, inside: s.escape.inside } : null, time: s.time, fps: this.fps, paused: this.paused, sheet: this.sheet, dashCd: s.player.dashCd, tier: s.tier, abilities: { ...s.abilities }, boss: s.bossBar, vault: this.blob.meta.vault, loots: s.loots.length, chests: s.chests.filter(c => !c.opened).length, door: s.zoneRt.door, pad: s.zoneRt.exitPad, save: this.saveStatus }; },
  };

  // ───────── 튜토리얼 ─────────
  tutorialText(): string {
    return ['왼쪽 아래 빈 곳을 누른 채 끌면 이동합니다. 적이 사거리에 들어오면 자동으로 공격합니다.',
      '적의 주황색 예고 범위가 보이면 오른쪽 아래 대시 버튼으로 피하세요. 대시 중엔 짧게 무적입니다.',
      '상자를 건드리면 열립니다. 전리품 가까이 가면 자동으로 줍습니다.',
      '위쪽의 가방 무게와 "미확정" 가치를 확인하세요. 쓰러지면 이번 출정 전리품은 모두 잃습니다.',
      '2구역을 정리하면 탈출 지점이 열립니다. 그 안에서 "탈출 요청" 후 8초를 버티면 보상이 확정됩니다. 다음 구역으로 가면 이 기회는 사라집니다.'][this.tutorial.step] || '';
  }
  showTutorial(): void { const el = document.getElementById('hint'); if (!el) return; if (this.tutorial.step < 0) { el.classList.add('hidden'); return; } clear(el); el.classList.remove('hidden'); el.append(h('span', {}, `${this.tutorial.step + 1}/5 ${this.tutorialText()}`), h('button', { onclick: () => this.skipTutorial() }, '건너뛰기')); }
  advanceTutorial(): void { this.tutorial.step++; this.tutorial.t = 0; if (this.tutorial.step >= 5) this.skipTutorial(); else this.showTutorial(); }
  skipTutorial(): void { this.tutorial.step = -1; this.blob.meta.tutorialDone = true; this.saveAll(); const el = document.getElementById('hint'); el?.classList.add('hidden'); }
  tickTutorial(_dash: boolean): void {
    const s = this.state!; const t = this.tutorial; t.t += DT;
    if (t.step === 0) { const d = Math.hypot(s.player.x - t.startX, s.player.y - t.startY); if (d > 70) this.advanceTutorial(); }
    else if (t.step === 3 && t.t > 7) this.advanceTutorial();
  }
}
