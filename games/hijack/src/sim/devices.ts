// 환경 장치: 패널·수리 단자·과부하 단자·출구·소환구·웨이브. 순수 로직.
import { BODIES } from '../data/bodies';
import { RULES } from '../data/rules';
import type { Device } from './types';
import { World, makeEntity, openDoor } from './world';

export function deviceLabel(d: Device | null): string {
  if (!d) return '';
  switch (d.kind) {
    case 'panel': return '패널 조작';
    case 'repair': return '수리 단자';
    case 'overload': return '과부하 단자';
    default: return '';
  }
}

export function updateDevices(w: World, dt: number, pressedInteract: boolean): void {
  const p = w.player;
  // 상호작용 대상
  let best: Device | null = null; let bd = RULES.interactRange;
  for (const d of w.devices) {
    const usable = (d.kind === 'panel' && !d.used) || (d.kind === 'repair' && d.uses > 0) || (d.kind === 'overload' && !d.used);
    if (!usable) continue;
    const dd = Math.hypot(d.x - p.x, d.y - p.y) - p.radius; if (dd < bd) { bd = dd; best = d; }
  }
  w.interactTarget = best; w.interactLabel = deviceLabel(best);
  // 채널 진행
  if (w.channel) {
    const d = w.device(w.channel.deviceId);
    if (!d || p.hp <= 0 || Math.hypot(d.x - p.x, d.y - p.y) - p.radius > RULES.interactRange + 20) { w.channel = null; w.say('조작이 중단됐다', 1.5, 'warn'); }
    else { w.channel.t += dt; if (w.channel.t >= w.channel.need) { completeDevice(w, d); w.channel = null; } }
  }
  if (pressedInteract && best && !w.channel && p.hp > 0) {
    const mech = p.body === 'mechanic';
    if (best.kind === 'panel') w.channel = { deviceId: best.id, t: 0, need: 1.0, label: '패널 조작 중' };
    else if (best.kind === 'repair') { if (mech) completeDevice(w, best); else w.channel = { deviceId: best.id, t: 0, need: 2.5, label: '수리 중(정비병은 즉시)' }; }
    else if (best.kind === 'overload') { if (mech) w.channel = { deviceId: best.id, t: 0, need: 1.5, label: '과부하 진행 중' }; else { w.say('과부하 단자는 정비병만 조작할 수 있다', 2.5, 'warn'); w.emit({ type: 'possessFail', x: best.x, y: best.y }); } }
  }
  // 출구
  const ex = w.device('exit', 'exit');
  if (ex && ex.open && p.hp > 0) {
    const tx = Math.floor(p.x / RULES.tile), ty = Math.floor(p.y / RULES.tile);
    if (ex.tiles.some((t) => t.tx === tx && t.ty === ty)) { w.phase = 'zoneclear'; w.stats.zoneTimes[w.zoneIndex] = w.zoneTime; w.emit({ type: 'zoneEnter', text: 'clear' }); }
  }
  // 소환 대기열
  if (w.spawnQueue.length) {
    const keep = [];
    for (const s of w.spawnQueue) {
      s.t -= dt;
      if (s.t <= 0) { const e = makeEntity(w, s.body, 'enemy', s.x, s.y, Math.PI / 2, s.tag); e.ai.state = 'alert'; e.ai.alertedAt = w.time; e.attackCd = 0.9; e.invulnUntil = 0; w.emit({ type: 'wave', x: s.x, y: s.y, body: s.body, text: 'spawn' }); }
      else keep.push(s);
    }
    w.spawnQueue = keep;
  }
  updateWaves(w, dt);
}

function completeDevice(w: World, d: Device): void {
  const p = w.player;
  if (d.kind === 'panel') { d.used = true; const door = w.door(d.doorId); if (door) openDoor(w, door); w.emit({ type: 'switch', x: d.x, y: d.y }); w.say('패널 작동 — 문이 열렸다', 2.5); }
  else if (d.kind === 'repair') {
    d.uses--;
    if (p.body === 'mechanic') { p.hp = p.hpMax; if (p.stability != null && p.stabilityMax != null) p.stability = Math.min(p.stabilityMax, p.stability + 40); w.say('정비병 수리: 체력 전부 회복 · 안정도 +40', 3); }
    else { p.hp = Math.min(p.hpMax, p.hp + Math.round(p.hpMax * 0.35)); if (p.stability != null && p.stabilityMax != null) p.stability = Math.min(p.stabilityMax, p.stability + 20); w.say('수리 단자: 체력 35% · 안정도 +20 회복', 3); }
    if (p.stability != null && p.stability > 0) p.collapsing = false;
    w.emit({ type: 'repair', x: p.x, y: p.y, amount: 30, id: p.id });
  } else if (d.kind === 'overload') {
    d.used = true; let n = 0;
    for (const e of w.entities) if (e.alive && e.body === 'turret' && e.tag === d.turretTag && !e.disabled) { e.disabled = true; n++; w.emit({ type: 'turretOff', x: e.x, y: e.y }); }
    if (d.doorId) { const door = w.door(d.doorId); if (door) openDoor(w, door); }
    w.emit({ type: 'switch', x: d.x, y: d.y, text: 'overload' });
    w.say(`과부하 성공 — 포탑 ${n}기 정지`, 3);
  }
}

function spawnWave(w: World, i: number): void {
  const wave = w.zone.waves![i];
  wave.spawns.forEach((s, k) => {
    const sp = w.device(s.spawner, 'spawner') ?? w.devices.find((d) => d.kind === 'spawner');
    if (sp) w.spawnQueue.push({ body: s.body, x: sp.x, y: sp.y, t: 0.9 + k * 0.2, tag: 'wave' });
  });
  w.waveLabel = wave.label;
  w.emit({ type: 'wave', text: wave.label, body: wave.spawns[0].body });
  w.say(`${wave.label} 접근 중 — ${wave.spawns.map((s) => BODIES[s.body].name).join(', ')}`, 3.5, 'warn');
}

function updateWaves(w: World, dt: number): void {
  const waves = w.zone.waves; if (!waves || w.waveDone) return;
  if (w.waveIndex < 0) { w.waveIndex = 0; w.waveTimer = waves[0].at; }
  const remaining = w.aliveEnemies().length + w.spawnQueue.length;
  if (w.waveIndex < waves.length) {
    w.waveTimer -= dt;
    const ready = w.waveIndex === 0 ? w.waveTimer <= 0 : (remaining <= 1 || w.waveTimer <= 0);
    if (ready) { spawnWave(w, w.waveIndex); w.waveIndex++; w.waveTimer = 42; }
  } else if (remaining <= 1 || w.waveTimer <= 0) {
    w.waveDone = true;
    const door = w.zone.waveDoor ? w.door(w.zone.waveDoor) : null; if (door) openDoor(w, door);
    w.say('봉쇄 해제 — 출구가 열렸다', 3.5);
    w.emit({ type: 'wave', text: 'done' });
  }
}

export function waveStatus(w: World): string {
  const waves = w.zone.waves; if (!waves) return '';
  if (w.waveDone) return '봉쇄 해제';
  const remaining = w.aliveEnemies().length + w.spawnQueue.length;
  if (w.waveIndex <= 0) return '봉쇄 중';
  const next = w.waveIndex < waves.length ? `다음: ${Math.ceil(w.waveTimer)}초 또는 경비 1명 이하` : `출구: ${Math.ceil(w.waveTimer)}초 또는 경비 1명 이하`;
  return `${w.waveLabel} · 남은 경비 ${remaining} · ${next}`;
}
