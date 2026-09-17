// Screens, HUD and the attempt loop. Ties together sim (engine), game (session/storage/loop), render and input.
import { MISSIONS } from '../data/missions';
import { FixedLoop } from '../game/loop';
import { MissionSession, emptyMissionSave, type MissionSave } from '../game/session';
import { SaveStore, type SaveData } from '../game/storage';
import { DT, MAX_GHOSTS, PLAYER, WEAPONS, type WeaponId } from '../sim/constants';
import { createAttempt, nearestGenerator, secondsLeft, stepAttempt } from '../sim/engine';
import { compileMap } from '../sim/maps';
import { endKindLabel, pathPreview, recordingSeconds } from '../sim/recording';
import type { AttemptState, GameEvent, MapData, MissionDef, Recording } from '../sim/types';
import { Renderer } from '../render/renderer';
import { GHOST_STYLES, PLAYER_STYLE, drawEnemy, drawGhostBadge, drawThief } from '../render/sprites';
import type { Enemy } from '../sim/types';
import { Sfx } from './audio';
import { TouchInput } from './input';
import { makeBot, type BotScript } from '../sim/bot';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T => { const el = root.querySelector(sel); if (!el) throw new Error('missing ' + sel); return el as T; };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const fmt = (ticks: number): string => (ticks * DT).toFixed(1) + '초';

export class App {
  root: HTMLElement; store = new SaveStore(); data: SaveData; sfx = new Sfx();
  mission!: MissionDef; map!: MapData; session!: MissionSession; weapon: WeaponId = 'rifle';
  st: AttemptState | null = null; loop: FixedLoop; renderer: Renderer; input: TouchInput;
  private attemptId = 0; private hudTimer = 0; private endShown = false; private endAt = 0; private paused = false; private awayPause = false;
  private raf = 0; private toastTimer = 0; private hintIndex = 0; private lastHint = -99;
  private canvasWrap: HTMLElement; problems: string[] = []; private lastFrame = 0; fps = 0;
  /** Test hook: when set, the bot supplies the current player's input instead of touch (same rules, same engine). */
  autopilot: ReturnType<typeof makeBot> | null = null;
  setAutopilot(script: BotScript | null): void { this.autopilot = script && this.map ? makeBot(this.map, script) : null; }

  constructor(root: HTMLElement) {
    this.root = root; root.innerHTML = TEMPLATE;
    const l = this.store.load(MISSIONS); this.data = l.data; this.problems = l.problems;
    this.sfx.muted = this.data.settings.muted; this.sfx.volume = this.data.settings.volume;
    const canvas = $('#cv') as HTMLCanvasElement; this.canvasWrap = $('#screen-play');
    this.renderer = new Renderer(canvas); this.renderer.fx.intensity = this.data.settings.fxIntensity; this.input = new TouchInput(canvas);
    this.loop = new FixedLoop({ onTick: () => this.tick(), onRender: () => this.draw() });
    this.bind(); this.showTitle();
    const unlockAudio = (): void => { this.sfx.unlock(); };
    window.addEventListener('pointerdown', unlockAudio, { passive: true }); window.addEventListener('keydown', unlockAudio);
    window.addEventListener('resize', () => this.resize()); this.resize();
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.onAway(); });
    window.addEventListener('blur', () => this.onAway());
    window.addEventListener('pagehide', () => this.onAway());
    const frame = (t: number): void => { this.raf = requestAnimationFrame(frame); if (this.st) { this.loop.frame(t); } if (this.lastFrame) { const d = t - this.lastFrame; if (d > 0) this.fps = this.fps * 0.9 + (1000 / d) * 0.1; } this.lastFrame = t; };
    this.raf = requestAnimationFrame(frame);
    (window as unknown as { __game: App }).__game = this;
  }

  // ---------- persistence ----------
  save(): void { if (!this.store.save(this.data)) this.toast('저장에 실패했습니다 (브라우저 저장소 사용 불가)', 2500); }
  missionSave(def: MissionDef): MissionSave { let m = this.data.missions[def.id]; if (!m) { m = emptyMissionSave(def.version); this.data.missions[def.id] = m; } return m; }

  // ---------- screens ----------
  private show(id: string): void { for (const s of this.root.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id); }
  showTitle(): void {
    this.stopAttempt(); this.show('screen-title');
    const list = $('#missions'); list.innerHTML = '';
    for (const m of MISSIONS) {
      const locked = m.index > this.data.unlocked; const ms = this.data.missions[m.id]; const rec = ms?.record;
      const r = rec && rec.clears > 0 ? `클리어 ${rec.clears}회<br>최고 ${rec.bestTicks !== null ? fmt(rec.bestTicks) : '-'} · 최소 분신 ${rec.minGhosts ?? '-'}${rec.noDamageClear ? '<br>무피격 ✓' : ''}` : locked ? '이전 작전 클리어 시 해금' : (ms?.slots.some((s) => s) ? `기록 ${ms.slots.filter((s) => s).length}개 보관 중` : '미클리어');
      const b = document.createElement('button'); b.className = 'mission card' + (locked ? ' locked' : ''); b.disabled = locked;
      b.innerHTML = `<div class="num">${m.index}</div><div><div class="t">${esc(m.title)}</div><div class="s">${esc(m.subtitle)}</div></div><div class="r">${r}</div>`;
      b.addEventListener('click', () => { this.sfx.play('click'); this.openMission(m); });
      list.appendChild(b);
    }
    this.drawBanner();
    $('#save-problems').innerHTML = this.problems.length ? `<div class="card" style="border-color:#7a3b3b">${this.problems.map(esc).join('<br>')}</div>` : '';
    $('#storage-note').textContent = this.store.persistent ? '저장: 이 브라우저의 로컬 저장소. 시도 도중에 앱을 닫으면 그 시도는 처음부터 다시 시작되고, 승인한 분신 기록·최고 기록·설정만 남습니다.' : '경고: 이 브라우저는 로컬 저장소를 쓸 수 없어 진행 상황이 유지되지 않습니다.';
  }
  private drawBanner(): void {
    const cv = $('#banner') as HTMLCanvasElement; const w = cv.clientWidth || 340, h = 150; const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr; cv.height = h * dpr; const ctx = cv.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#10142a'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = '#2c3352'; ctx.fillRect(0, h - 22, w, 22); ctx.fillStyle = '#414a7c'; ctx.fillRect(0, h - 22, w, 5);
    const t = 1.3; const cx = w / 2;
    const mk = (kind: Enemy['kind'], x: number, y: number, facing: number): Enemy => ({ id: 0, kind, x, y, hx: x, hy: y, facing, hp: 1, maxHp: 1, alive: true, state: 'idle', stateTicks: 0, targetX: x, targetY: y, contactCd: 0, attackCd: 0, hitFlash: 0, kx: 0, ky: 0, lastSeenTicks: 0, deathTick: -1 });
    drawEnemy(ctx, mk('turret', cx + 120, 62, Math.PI), cx, 80, t); drawEnemy(ctx, mk('chaser', cx + 70, 96, Math.PI), cx, 80, t); drawEnemy(ctx, mk('heavy', cx + 140, 104, Math.PI), cx, 80, t);
    ctx.strokeStyle = GHOST_STYLES[0].tint!; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(cx - 120, 96); ctx.quadraticCurveTo(cx - 90, 50, cx - 40, 70); ctx.stroke(); ctx.setLineDash([]);
    drawThief(ctx, cx - 120, 96, -0.4, 0, false, 0, 0, 0, GHOST_STYLES[0], 'rifle', false, t); drawGhostBadge(ctx, cx - 120, 96, 0, false, GHOST_STYLES[0]);
    drawThief(ctx, cx - 40, 100, 0.1, 0, true, 0.3, 0, 0, PLAYER_STYLE, 'shotgun', true, t);
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 18 + i * 22, 100 + i * 1.5); ctx.lineTo(cx - 8 + i * 22, 101 + i * 1.5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(79,216,255,0.9)'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'left'; ctx.fillText('이전 기록 = 분신', cx - 150, 34); ctx.fillStyle = '#ffd27a'; ctx.fillText('지금의 나', cx - 58, 138);
  }
  openMission(def: MissionDef): void {
    this.mission = def; this.map = compileMap(def);
    const ms = this.missionSave(def); this.session = new MissionSession(def, ms); this.data.missions[def.id] = this.session.save;
    if (this.session.retired) { this.toast('맵이 바뀌어 이전 분신 기록을 사용할 수 없어 비웠습니다.', 3200); this.save(); }
    this.showPrep();
  }
  showPrep(msg?: string): void {
    this.stopAttempt(); this.show('screen-prep');
    const def = this.mission; const s = this.session; const rec = s.save.record;
    $('#prep-title').textContent = `작전 ${def.index}. ${def.title}`; $('#prep-sub').textContent = def.subtitle;
    $('#prep-hints').innerHTML = def.hints.map((h) => `<li>${esc(h)}</li>`).join('');
    $('#prep-record').innerHTML = rec.clears > 0 ? `클리어 ${rec.clears}회 · 최고 탈출 <b>${rec.bestTicks !== null ? fmt(rec.bestTicks) : '-'}</b> · 최소 분신 <b>${rec.minGhosts ?? '-'}</b>${rec.noDamageClear ? ' · 무피격 ✓' : ''}${rec.bestComposition ? `<br><span class="small">최고 기록 구성: ${esc(rec.bestComposition)}</span>` : ''}` : `아직 클리어하지 않았습니다 · 시도 ${rec.attempts}회`;
    const banner = $('#prep-banner'); banner.style.display = s.rerecording !== null ? 'block' : 'none';
    if (s.rerecording !== null) banner.innerHTML = `<b>${s.rerecording + 1}번 기록을 다시 만드는 중</b><br><span class="small">이번 시도에서 ${s.rerecording + 1}번 분신은 제외됩니다. 새 기록을 저장하기 전까지 기존 기록은 보존되고, 취소하면 되살아납니다.</span>`;
    $('#prep-msg').textContent = msg || '';
    this.renderWeapons('#prep-weapons'); this.renderSlots();
  }
  private renderWeapons(sel: string): void {
    const box = $(sel); box.innerHTML = '';
    for (const w of Object.values(WEAPONS)) { const b = document.createElement('button'); b.className = w.id === this.weapon ? 'on' : ''; b.innerHTML = `<b>${w.id === 'rifle' ? '🔫' : '💥'} ${w.name}</b><small>${w.id === 'rifle' ? '중거리 · 단일 대상 · 발전기/포탑에 좋음' : '근거리 · 넓은 범위 · 밀집 경비에 좋음'}</small>`; b.addEventListener('click', () => { this.weapon = w.id; this.sfx.play('click'); this.renderWeapons(sel); }); box.appendChild(b); }
  }
  private renderSlots(): void {
    const box = $('#slots'); box.innerHTML = ''; const s = this.session;
    for (let i = 0; i < MAX_GHOSTS; i++) {
      const r = s.slots[i]; const card = document.createElement('div'); card.className = 'card slot' + (s.rerecording === i ? ' excluded' : '');
      const color = GHOST_STYLES[i].tint || '#4fd8ff';
      if (!r) { card.innerHTML = `<canvas width="64" height="64"></canvas><div class="info"><b style="color:${color}">${i + 1}번 분신</b><br><span class="small">비어 있음 — 다음 시도의 기록을 여기에 추가할 수 있습니다.</span></div><div class="act"></div>`; box.appendChild(card); continue; }
      const ek = endKindLabel[r.endKind];
      card.innerHTML = `<canvas width="64" height="64"></canvas><div class="info"><b style="color:${color}">${i + 1}번 분신</b> <span class="badge">${WEAPONS[r.weapon].name}</span><br>${ek.icon} ${ek.label} · ${recordingSeconds(r)}초 · 공격 ${r.shots.length}회<br><span class="small">${ek.note}${s.rerecording === i ? ' · <b style="color:var(--warn)">이번 시도 제외</b>' : ''}</span></div><div class="act"><button data-a="re">다시 녹화</button><button data-a="del" class="danger">삭제</button></div>`;
      this.drawPreview(card.querySelector('canvas') as HTMLCanvasElement, r, color);
      (card.querySelector('[data-a=re]') as HTMLButtonElement).addEventListener('click', () => { this.sfx.play('click'); if (s.rerecording === i) { s.cancelRerecord(); this.showPrep('다시 녹화를 취소했습니다. 기존 기록을 유지합니다.'); } else { s.beginRerecord(i); this.showPrep(); } });
      (card.querySelector('[data-a=del]') as HTMLButtonElement).addEventListener('click', () => { if (!confirm(`${i + 1}번 분신 기록을 삭제할까요?`)) return; s.removeSlot(i); this.save(); this.showPrep(`${i + 1}번 기록을 삭제했습니다.`); });
      box.appendChild(card);
    }
  }
  private drawPreview(cv: HTMLCanvasElement, r: Recording, color: string): void {
    const ctx = cv.getContext('2d')!; const W = cv.width, H = cv.height; ctx.fillStyle = '#0f1326'; ctx.fillRect(0, 0, W, H);
    const sc = Math.min((W - 8) / this.map.width, (H - 8) / this.map.height); const ox = (W - this.map.width * sc) / 2, oy = (H - this.map.height * sc) / 2;
    ctx.fillStyle = '#2c3352'; for (const w of this.map.solids) ctx.fillRect(ox + w.x * sc, oy + w.y * sc, Math.max(1, w.w * sc), Math.max(1, w.h * sc));
    const pts = pathPreview(r, 60); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(ox + p.x * sc, oy + p.y * sc) : ctx.moveTo(ox + p.x * sc, oy + p.y * sc))); ctx.stroke();
    const l = pts[pts.length - 1]; if (l) { ctx.fillStyle = r.endKind === 'death' ? '#ff6a6a' : color; ctx.beginPath(); ctx.arc(ox + l.x * sc, oy + l.y * sc, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ffcf4d'; ctx.beginPath(); ctx.arc(ox + (this.mission.vault.at[0] + 0.5) * 40 * sc, oy + (this.mission.vault.at[1] + 0.5) * 40 * sc, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- attempt ----------
  startAttempt(): void {
    this.show('screen-play'); this.resize();
    const ghosts = this.session.ghostsForAttempt();
    this.st = createAttempt(this.map, { weapon: this.weapon, ghosts });
    this.attemptId++; this.endShown = false; this.endAt = 0; this.paused = false; this.awayPause = false; this.hintIndex = 0; this.lastHint = -99;
    this.loop.reset(); this.loop.resume(performance.now()); this.renderer.resetCamera(); this.input.release(); this.input.enabled = true;
    $('#end').classList.remove('on'); $('#pause').classList.remove('on');
    const gb = $('#ghostbar'); gb.innerHTML = this.st.ghosts.map((g) => `<span style="color:${GHOST_STYLES[g.slot].tint}">${g.slot + 1}번 ${WEAPONS[g.rec.weapon].name}</span>`).join('') + (this.session.rerecording !== null ? `<span style="color:var(--warn)">${this.session.rerecording + 1}번 제외(다시 녹화)</span>` : '');
    $('#joyhint').style.display = this.data.introSeen ? 'none' : 'block';
    this.toast(this.st.ghosts.length ? `시도 시작 — 분신 ${this.st.ghosts.length}명이 이전 기록대로 움직입니다` : (this.mission.hints[0] || '시도 시작'), 2200);
    this.sfx.play('rewind'); this.updateHud(true);
  }
  stopAttempt(): void { this.st = null; this.input.enabled = false; this.input.release(); }
  private tick(): void {
    const st = this.st; if (!st || this.paused) return;
    if (st.outcome) { if (!this.endShown && performance.now() >= this.endAt) this.showEnd(); return; }
    const inp = this.autopilot ? this.autopilot.input(st) : this.input.consume();
    stepAttempt(st, inp);
    this.renderer.handleEvents(st.events, st); this.playEvents(st.events, st);
    if (st.player.moving && st.player.dashTicks <= 0 && st.tick % 12 === 0) this.sfx.play('step');
    const oc = (st as AttemptState).outcome; if (oc) { this.endAt = performance.now() + (oc.kind === 'escape' ? 900 : 600); this.input.release(); this.onOutcome(st); }
    if (++this.hudTimer >= 4) { this.hudTimer = 0; this.updateHud(false); }
    this.tutorialHints(st);
  }
  private draw(): void { const st = this.st; if (!st) return; if (!this.paused) this.renderer.update(DT * 1); this.renderer.render(st, this.input.joy); }
  private playEvents(evs: GameEvent[], st: AttemptState): void {
    for (const e of evs) switch (e.kind) {
      case 'shot': this.sfx.play(e.owner === 'enemy' ? 'turret' : e.owner === 'ghost' ? 'shoot_ghost' : e.weapon === 'shotgun' ? 'shoot_shotgun' : 'shoot_rifle'); break;
      case 'hit': if (e.target === 'enemy') this.sfx.play('hit'); else if (e.target === 'generator') this.sfx.play('genhit'); break;
      case 'enemyDied': this.sfx.play('enemy_die'); break;
      case 'generatorDestroyed': this.sfx.play('generator'); this.toast(`${e.by === 'player' ? '내가' : `${Number(e.by.slice(5)) + 1}번 분신이`} 발전기를 파괴 → 레이저 꺼짐`, 1800); break;
      case 'laserChanged': if (e.phase === 'off') this.sfx.play('laser_off'); else if (e.phase === 'warn') this.sfx.play('laser_warn'); break;
      case 'plateChanged': this.sfx.play(e.pressed ? 'plate_on' : 'plate_off'); break;
      case 'vaultChanged': if (e.open) this.sfx.play('vault'); break;
      case 'corePicked': this.sfx.play('core'); this.toast('코어 확보! 출구로 돌아가세요', 1800); break;
      case 'playerHit': this.sfx.play('hurt'); break;
      case 'playerDied': this.sfx.play('die'); break;
      case 'dash': if (e.owner === 'player') this.sfx.play('dash'); break;
      case 'ghostSpawn': if (st.tick <= 2) this.sfx.play('rewind'); break;
      case 'ghostHold': this.sfx.play('hold'); break;
      case 'turretWarn': this.sfx.play('turret_warn'); break;
      case 'timeWarning': this.sfx.play(e.secondsLeft <= 1 ? 'tick_final' : 'tick'); break;
      case 'escape': this.sfx.play('escape'); break;
      case 'timeout': this.sfx.play('timeout'); break;
      case 'finish': this.sfx.play('finish'); break;
      default: break;
    }
  }
  private tutorialHints(st: AttemptState): void {
    if (!this.data.settings.showHints || this.mission.index !== 1) return;
    const sec = st.tick * DT; const p = st.player;
    if (this.hintIndex === 0 && sec > 2.5 && st.ghosts.length === 0) { this.hintIndex = 1; this.toast('왼쪽 위 발전기 ⚡ 를 부수면 오른쪽 레이저가 꺼집니다. 가까이 가면 자동으로 공격합니다.', 3000); }
    if (this.hintIndex <= 1 && p.focusGenerator === null && nearestGenerator(st, PLAYER.interactRange) && sec - this.lastHint > 6) { this.hintIndex = 2; this.lastHint = sec; this.toast('발전기 옆: [발전기 조준] 버튼으로 경비보다 발전기를 먼저 쏩니다', 2600); }
    if (this.hintIndex <= 2 && st.ghosts.length > 0 && sec > 1.5 && sec < 1.7) { this.hintIndex = 3; this.toast('1번 분신이 아까의 나입니다. 이번엔 오른쪽 길로 가서 레이저가 꺼지길 기다려 보세요.', 3200); }
  }
  private updateHud(force: boolean): void {
    const st = this.st; if (!st) return; const p = st.player;
    const left = secondsLeft(st); const timer = $('#timer'); timer.textContent = left.toFixed(1); timer.classList.toggle('low', left <= 5);
    let hearts = ''; for (let i = 0; i < PLAYER.maxHp; i++) hearts += `<span class="${i < p.hp ? '' : 'off'}">♥</span>`; $('#hearts').innerHTML = hearts;
    const core = $('#core'); core.textContent = p.hasCore ? '💠 코어 → 출구' : st.vault.open ? '🔓 금고 열림' : '🔒 금고 잠김'; core.classList.toggle('has', p.hasCore);
    const dash = $('#btn-dash'); const cd = p.dashCd; dash.classList.toggle('cd', cd > 0); dash.innerHTML = cd > 0 ? `대시<br><small>${(cd * DT).toFixed(1)}</small>` : '대시';
    const it = $('#btn-interact') as HTMLButtonElement; const g = nearestGenerator(st, PLAYER.interactRange);
    if (g) { it.disabled = false; it.classList.add('on'); it.classList.remove('core'); it.innerHTML = p.focusGenerator ? '조준<br>해제' : '발전기<br>조준'; }
    else { it.disabled = true; it.classList.remove('on', 'core'); it.innerHTML = '상호작용'; }
    if (force) { $('#end').classList.remove('on'); }
  }

  // ---------- outcome ----------
  private onOutcome(st: AttemptState): void {
    const o = st.outcome!; const composition = [...st.ghosts.map((g) => `${g.slot + 1}번 ${WEAPONS[g.rec.weapon].name}`), `나 ${WEAPONS[st.player.weapon].name}`].join(' + ');
    const flags = this.session.applyResult({ attemptId: this.attemptId, outcome: o.kind, ticks: o.tick, ghostsUsed: st.ghosts.length, damageTaken: st.damageTaken, composition });
    this.lastFlags = flags;
    if (o.kind === 'escape') { if (this.mission.index >= this.data.unlocked && this.mission.index < MISSIONS.length) { this.data.unlocked = this.mission.index + 1; this.unlockedNow = true; } else this.unlockedNow = false; }
    if (!this.data.introSeen) this.data.introSeen = true;
    this.save();
  }
  private lastFlags = { firstClear: false, newBestTime: false, newMinGhosts: false, noDamage: false }; private unlockedNow = false;
  private showEnd(): void {
    const st = this.st!; const o = st.outcome!; this.endShown = true; const s = this.session; const rec = st.recording;
    const sheet = $('#end .sheet'); const ek = endKindLabel[o.kind];
    let html = '';
    if (o.kind === 'escape') {
      const f = this.lastFlags;
      html += `<h3>탈출 성공! ${fmt(o.tick)}</h3><div class="line">분신 ${st.ghosts.length}명 · 받은 피해 ${st.damageTaken}${f.newBestTime ? ' · <span class="new">최고 시간!</span>' : ''}${f.newMinGhosts ? ' · <span class="new">최소 분신!</span>' : ''}${f.noDamage ? ' · 무피격' : ''}${this.unlockedNow ? ' · <span class="new">다음 작전 해금</span>' : ''}</div>`;
      html += `<div class="contrib">${this.contributions(st)}</div>`;
      html += `<div class="stack">${this.mission.index < MISSIONS.length && this.data.unlocked > this.mission.index ? `<button class="primary" data-a="next">다음 작전 ▶</button>` : ''}<button data-a="retry">다시 도전 (기록 유지)</button><div class="mini"><button data-a="prep">기록 관리</button><button data-a="title">작전 목록</button></div></div>`;
    } else {
      const why = o.kind === 'death' ? `사망 — ${esc(o.cause || '')}` : o.kind === 'finish' ? `기록 마침 (${fmt(o.tick)})` : '시간 종료';
      html += `<h3>${ek.icon} ${why}</h3><div class="line">이 기록을 분신으로 쓰면: ${ek.note}. ${rec.shots.length ? `공격 ${rec.shots.length}회` : '공격 없음'}${st.stats.player.generators ? ` · 발전기 ${st.stats.player.generators}` : ''}${st.stats.player.kills ? ` · 처치 ${st.stats.player.kills}` : ''}${st.player.hasCore ? ' · <b>코어는 분신이 옮길 수 없습니다</b>' : ''}</div>`;
      html += '<div class="stack">';
      if (s.rerecording !== null) html += `<button class="primary" data-a="replace">이 기록으로 ${s.rerecording + 1}번 교체하고 재도전</button><button data-a="cancel-re">취소 — 기존 ${s.rerecording + 1}번 기록 유지하고 재도전</button>`;
      else if (s.freeSlot() >= 0) html += `<button class="primary" data-a="add">이번 기록 추가하고 재도전 → ${s.freeSlot() + 1}번 분신</button>`;
      else html += `<div class="line">분신 슬롯이 가득 찼습니다. 교체할 슬롯:</div><div class="mini">${[0, 1, 2].map((i) => `<button data-a="add" data-slot="${i}">${i + 1}번 교체</button>`).join('')}</div>`;
      html += `<button data-a="retry">이번 기록 버리고 재도전</button><div class="mini"><button data-a="prep">기록 하나 다시 만들기</button><button data-a="title">작전 목록</button></div></div>`;
    }
    html += `<div class="row" style="margin-top:10px"><span class="small">다음 시도 무기:</span>${Object.values(WEAPONS).map((w) => `<button class="chip ${w.id === this.weapon ? 'on' : ''}" data-w="${w.id}" style="flex:0;padding:4px 10px">${w.name}</button>`).join('')}</div>`;
    sheet.innerHTML = html; $('#end').classList.add('on');
    for (const b of sheet.querySelectorAll<HTMLButtonElement>('button[data-w]')) b.addEventListener('click', () => { this.weapon = b.dataset.w as WeaponId; this.sfx.play('click'); this.showEnd(); });
    for (const b of sheet.querySelectorAll<HTMLButtonElement>('button[data-a]')) b.addEventListener('click', () => {
      this.sfx.play('click'); const a = b.dataset.a;
      if (a === 'add') { const slot = b.dataset.slot !== undefined ? Number(b.dataset.slot) : undefined; const used = s.commitRecording(rec, slot); if (used < 0) return; this.save(); this.startAttempt(); this.toast(`${used + 1}번 분신 추가 — 이제 아까의 내가 같이 움직입니다`, 2400); }
      else if (a === 'replace') { const used = s.commitRecording(rec); this.save(); this.startAttempt(); this.toast(`${used + 1}번 기록 교체 완료`, 2000); }
      else if (a === 'cancel-re') { s.cancelRerecord(); this.save(); this.startAttempt(); }
      else if (a === 'retry') { if (s.rerecording !== null) { s.cancelRerecord(); this.save(); } this.startAttempt(); }
      else if (a === 'prep') { if (s.rerecording !== null) s.cancelRerecord(); this.showPrep(); }
      else if (a === 'title') { if (s.rerecording !== null) s.cancelRerecord(); this.showTitle(); }
      else if (a === 'next') { const n = MISSIONS[this.mission.index]; if (n) this.openMission(n); else this.showTitle(); }
    });
  }
  private contributions(st: AttemptState): string {
    const lines: string[] = [];
    for (const g of st.ghosts) { const k = `ghost${g.slot}`; const s = st.stats[k]; const parts: string[] = []; if (s.generators) parts.push(`발전기 ${s.generators}`); if (s.kills) parts.push(`처치 ${s.kills}`); if (s.plateTicks) parts.push(`발판 ${(s.plateTicks * DT).toFixed(1)}초`); if (!parts.length) parts.push(s.damage ? `피해 ${s.damage}` : '기여 없음'); lines.push(`<span style="color:${GHOST_STYLES[g.slot].tint}">${g.slot + 1}번 분신</span> (${WEAPONS[g.rec.weapon].name}): ${parts.join(' · ')}`); }
    const p = st.stats.player; const mine: string[] = []; if (p.generators) mine.push(`발전기 ${p.generators}`); if (p.kills) mine.push(`처치 ${p.kills}`); if (p.plateTicks) mine.push(`발판 ${(p.plateTicks * DT).toFixed(1)}초`); mine.push('코어 회수 · 탈출');
    lines.push(`<b>나</b> (${WEAPONS[st.player.weapon].name}): ${mine.join(' · ')}`);
    return lines.join('<br>');
  }

  // ---------- pause ----------
  pause(msg?: string): void { if (!this.st || this.st.outcome || this.paused) return; this.paused = true; this.loop.pause(); this.input.release(); this.sfx.suspend(); $('#pause-msg').textContent = msg || ''; $('#pause').classList.add('on'); this.renderSettings('#settings-pause'); }
  resume(): void { if (!this.paused) return; this.paused = false; this.awayPause = false; this.loop.resume(performance.now()); this.sfx.resume(); $('#pause').classList.remove('on'); }
  private onAway(): void { if (this.st && !this.st.outcome && !this.paused) { this.awayPause = true; this.pause('화면을 벗어나 자동으로 멈췄습니다. 시간·분신·적 모두 함께 멈춰 있습니다.'); } }
  private renderSettings(sel = '#settings-main'): void {
    const s = this.data.settings; const box = $(sel);
    box.innerHTML = `<div class="range"><label>음소거</label><button data-s="mute" class="${s.muted ? 'on chip' : 'chip'}" style="flex:0">${s.muted ? '켜짐' : '꺼짐'}</button></div><div class="range"><label>음량</label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-s="vol"></div><div class="range"><label>효과 강도</label><input type="range" min="0" max="1" step="0.1" value="${s.fxIntensity}" data-s="fx"><span class="small">흔들림·파티클</span></div><div class="range"><label>도움말 문구</label><button data-s="hints" class="chip" style="flex:0">${s.showHints ? '켜짐' : '꺼짐'}</button></div>`;
    (box.querySelector('[data-s=mute]') as HTMLButtonElement).addEventListener('click', () => { s.muted = !s.muted; this.sfx.muted = s.muted; this.sfx.apply(); this.save(); this.renderSettings(sel); });
    (box.querySelector('[data-s=vol]') as HTMLInputElement).addEventListener('input', (e) => { s.volume = Number((e.target as HTMLInputElement).value); this.sfx.volume = s.volume; this.sfx.apply(); this.save(); this.sfx.play('click'); });
    (box.querySelector('[data-s=fx]') as HTMLInputElement).addEventListener('input', (e) => { s.fxIntensity = Number((e.target as HTMLInputElement).value); this.renderer.fx.intensity = s.fxIntensity; this.renderer.reduceMotion = s.fxIntensity < 0.35; this.save(); });
    (box.querySelector('[data-s=hints]') as HTMLButtonElement).addEventListener('click', () => { s.showHints = !s.showHints; this.save(); this.renderSettings(sel); });
  }

  // ---------- misc ----------
  toast(msg: string, ms = 1800): void { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(this.toastTimer); this.toastTimer = window.setTimeout(() => t.classList.remove('on'), ms); }
  private resize(): void { const r = this.canvasWrap.getBoundingClientRect(); const w = r.width || window.innerWidth, h = r.height || window.innerHeight; this.renderer.resize(w, h, window.devicePixelRatio || 1); }
  private bind(): void {
    $('#btn-start').addEventListener('click', () => { this.sfx.unlock(); this.sfx.play('click'); this.startAttempt(); });
    $('#btn-back').addEventListener('click', () => { this.sfx.play('click'); if (this.session.rerecording !== null) this.session.cancelRerecord(); this.showTitle(); });
    $('#btn-dash').addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.press('dash'); });
    $('#btn-interact').addEventListener('pointerdown', (e) => { e.preventDefault(); this.input.press('interact'); });
    $('#btn-finish').addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.st && !this.st.outcome && this.st.player.alive) this.input.press('finish'); });
    $('#btn-pause').addEventListener('click', () => { this.sfx.play('click'); this.pause(); });
    $('#btn-resume').addEventListener('click', () => { this.sfx.play('click'); this.resume(); });
    $('#btn-restart').addEventListener('click', () => { this.sfx.play('click'); this.resume(); if (this.session.rerecording !== null) { /* keep re-record mode: restart the same kind of attempt */ } this.startAttempt(); });
    $('#btn-quit').addEventListener('click', () => { this.sfx.play('click'); this.resume(); if (this.session.rerecording !== null) this.session.cancelRerecord(); this.showPrep(); });
    $('#btn-settings').addEventListener('click', () => { this.sfx.play('click'); this.renderSettings('#settings-main'); $('#settings-sheet').classList.add('on'); });
    $('#btn-settings-close').addEventListener('click', () => { $('#settings-sheet').classList.remove('on'); });
    $('#btn-reset').addEventListener('click', () => { if (!confirm('모든 저장 데이터(분신 기록·최고 기록·해금·설정)를 지울까요?')) return; this.store.clear(); this.data = this.store.load(MISSIONS).data; this.problems = []; this.showTitle(); this.toast('저장 데이터를 초기화했습니다.'); });
  }
}

const TEMPLATE = `
<div id="screen-title" class="screen">
  <div class="scroll">
    <h1>나 혼자 도둑단</h1>
    <canvas id="banner"></canvas>
    <p class="sub"><b>25초의 공범</b> — 실패한 시도의 내 행동이 다음 시도에서 분신으로 재생됩니다. 분신에게 한 가지 일을 맡기고, 나는 다른 길로 코어를 가져오세요.</p>
    <div id="save-problems"></div>
    <div id="missions"></div>
    <div class="row" style="margin-top:12px"><button id="btn-settings" class="ghost">설정</button><button id="btn-reset" class="ghost danger">저장 초기화</button></div>
    <p class="sub" id="storage-note" style="margin-top:12px"></p>
    <p class="sub">조작: 화면 왼쪽 아무 곳이나 눌러 조이스틱 · 자동 공격 · 오른쪽 버튼으로 대시/조준/기록 마치기. PC: <kbd>WASD</kbd> <kbd>Space</kbd> 대시 <kbd>E</kbd> 조준 <kbd>F</kbd> 기록 마치기</p>
    <p class="sub small">웹 베타 v0.1 · 서버·로그인·결제 없음 · 기록은 이 기기 브라우저에만 저장</p>
  </div>
</div>
<div id="screen-prep" class="screen">
  <div class="scroll">
    <button id="btn-back" class="ghost" style="padding:8px 12px">‹ 작전 목록</button>
    <h1 id="prep-title"></h1><p class="sub" id="prep-sub"></p>
    <ul class="sub" id="prep-hints" style="padding-left:18px"></ul>
    <div class="card" id="prep-record"></div>
    <div class="card" id="prep-banner" style="display:none;border-color:var(--warn)"></div>
    <h2>무기</h2><div class="weapons" id="prep-weapons"></div>
    <h2>분신 기록 (최대 3개)</h2>
    <div id="slots"></div>
    <p class="sub" id="prep-msg"></p>
    <p class="sub small">기록 종료 방식: ⏹ 일찍 마침 = 남은 시간 동안 마지막 위치 유지(발판 점유 가능) · ✖ 사망 = 그 시각 이후 사라짐 · ⏱ 시간 종료 = 25초 재생 후 종료 · 분신은 코어를 옮기거나 대신 탈출할 수 없습니다.</p>
  </div>
  <div class="footer"><button id="btn-start" class="primary">출발 (25초)</button></div>
</div>
<div id="screen-play" class="screen">
  <canvas id="cv"></canvas>
  <div id="hud"><div id="timer">25.0</div><div id="hearts"></div><div id="core"></div><button id="btn-pause">⏸</button></div>
  <div id="ghostbar"></div>
  <div id="toast"></div>
  <div id="joyhint">왼쪽 아무 곳이나<br>누르고 끌어서 이동</div>
  <div id="controls"><button id="btn-finish">기록<br>마치기</button><button id="btn-interact" disabled>상호작용</button><button id="btn-dash" class="big">대시</button></div>
  <div id="end" class="overlay"><div class="sheet"></div></div>
  <div id="pause" class="overlay center"><div class="sheet"><h3>일시정지</h3><div class="line" id="pause-msg"></div><div class="stack"><button id="btn-resume" class="primary">계속하기</button><button id="btn-restart">이 시도 처음부터</button><div id="settings-pause"></div><button id="btn-quit" class="ghost">작전 화면으로 (이번 시도 취소)</button></div></div></div>
</div>
<div id="settings-sheet" class="overlay center"><div class="sheet"><h3>설정</h3><div id="settings-main"></div><button id="btn-settings-close" class="primary" style="width:100%;margin-top:8px">닫기</button></div></div>
`;
