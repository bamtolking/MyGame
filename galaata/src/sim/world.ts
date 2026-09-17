// 월드 상태와 구역 생성(맵 파싱). 순수 로직.
import { BODIES } from '../data/bodies';
import { ZONES, ENEMY_GLYPHS, TURRET_GLYPHS, type ZoneDef } from '../data/zones';
import { RULES } from '../data/rules';
import { TileMap, T } from './tilemap';
import { Rng } from './rng';
import type { BodyId, Device, DoorDev, Entity, GameEvent, Input, Phase, Projectile, RunStats, Team, Vec } from './types';

export interface CarryBody { body: BodyId; hp: number; stability: number | null }

export interface SpawnQueueItem { body: BodyId; x: number; y: number; t: number; tag: string }

export interface Channel { deviceId: string; t: number; need: number; label: string }

export function newStats(): RunStats {
  return { possessions: 0, bodiesUsed: ['intruder'], kills: 0, damageTaken: 0, timeByBody: {}, usedShield: false, lastChanceSaves: 0, zoneTimes: [] };
}

export class World {
  zone: ZoneDef;
  zoneIndex: number;
  map: TileMap;
  entities: Entity[] = [];
  projectiles: Projectile[] = [];
  devices: Device[] = [];
  events: GameEvent[] = [];
  time = 0;
  zoneTime = 0;
  phase: Phase = 'playing';
  rng: Rng;
  nextId = 1;
  playerId = 0;
  possessCd = 0;
  lastChance: { remaining: number } | null = null;
  hitstop = 0;
  timeScale = 1;
  stats: RunStats;
  waveIndex = -1;
  waveTimer = 0;
  waveLabel = '';
  waveDone = false;
  flow: Int32Array | null = null;
  flowTile = { tx: -1, ty: -1 };
  flowT = 0;
  volleyCounter = 1;
  message: { text: string; until: number; kind: 'intro' | 'hint' | 'warn' } | null = null;
  interactTarget: Device | null = null;
  interactLabel = '';
  possessTarget: Entity | null = null;
  possessBlockReason = '';
  candidates: Entity[] = [];
  channel: Channel | null = null;
  spawnQueue: SpawnQueueItem[] = [];
  nodeSpots: Vec[] = [];
  turretSpots: { x: number; y: number; facing: number }[] = [];
  playerStart: Vec = { x: 0, y: 0 };
  prevInput: Input = { mx: 0, my: 0, attack: false, skill: false, possess: false, interact: false };
  stepDamage = 0;
  defeatReason = '';
  aimPoint: Vec | null = null;
  aimTargetId = 0;
  /** 마지막 기회로 살아난 직후 표시 */
  savedFlash = 0;
  /** 어려움 모드(적 피해·안정도 감소 증가) */
  hard = false;
  /** 진단용: 플레이어가 받은 피해 기록 */
  damageLog: { t: number; amount: number; from: string; body: string }[] = [];
  constructor(zoneIndex: number, seed: number, stats?: RunStats) {
    this.zone = ZONES[zoneIndex]; this.zoneIndex = zoneIndex; this.rng = new Rng(seed + zoneIndex * 1009);
    this.stats = stats ?? newStats();
    const rows = this.zone.map; const h = rows.length; const w = rows[0].length;
    for (const r of rows) if (r.length !== w) throw new Error(`zone ${zoneIndex} map row width mismatch`);
    this.map = new TileMap(w, h);
  }
  get player(): Entity { return this.entities.find((e) => e.id === this.playerId)!; }
  emit(ev: GameEvent): void { this.events.push(ev); }
  entity(id: number): Entity | undefined { return this.entities.find((e) => e.id === id); }
  device<K extends Device['kind']>(id: string, kind?: K): Extract<Device, { kind: K }> | undefined {
    return this.devices.find((d) => d.id === id && (!kind || d.kind === kind)) as Extract<Device, { kind: K }> | undefined;
  }
  door(id: string): DoorDev | undefined { return this.device(id, 'door'); }
  say(text: string, seconds = 3.5, kind: 'intro' | 'hint' | 'warn' = 'hint'): void { this.message = { text, until: this.time + seconds, kind }; this.emit({ type: 'hint', text }); }
  /** 고정 개체(포탑·노드)가 차지한 타일: 경로 탐색에서 벽처럼 취급 */
  staticBlocked(): Set<number> {
    const s = new Set<number>(); const S = RULES.tile;
    for (const e of this.entities) if (e.alive && (e.body === 'turret' || e.body === 'node')) s.add(Math.floor(e.y / S) * this.map.w + Math.floor(e.x / S));
    return s;
  }
  aliveEnemies(): Entity[] { return this.entities.filter((e) => e.alive && e.team === 'enemy' && e.body !== 'node' && e.body !== 'boss'); }
}

export function makeEntity(w: World, body: BodyId, team: Team, x: number, y: number, facing = -Math.PI / 2, tag = ''): Entity {
  const d = BODIES[body];
  const e: Entity = {
    id: w.nextId++, body, team, controlled: false, x, y, vx: 0, vy: 0, mvx: 0, mvy: 0, facing, radius: d.radius,
    hp: d.hp, hpMax: d.hp, stability: null, stabilityMax: d.stability, collapsing: false, alive: true,
    attackCd: 0.3, skillCd: 0, skillUntil: 0, windup: 0, windupTarget: null, burstLeft: 0, burstVolley: 0, burstTimer: 0,
    invulnUntil: 0, lastVolley: -1, volleyDamage: 0, hitFlash: 0, shock: 0, stunUntil: 0, slowUntil: 0, contactCd: 0, possessedAt: -10,
    disabled: false, aimshotPending: false, dashDir: null, lastHitAt: -10, stabWarned: false, guardHits: 0,
    ai: { state: 'idle', home: { x, y }, strafeDir: 1, thinkT: 0, wander: null, healCd: 0, alertedAt: -10, lostT: 0, phase: 0, patternT: 2.5, ringT: 5, laserT: 6, laserTarget: null, chargeT: 0, chargeDir: null, exposedUntil: 0, summonT: 14, shielded: false, laserAge: -1, laserHit: false, chargeTele: 0, chargeDash: 0 },
    tag, deadHandled: false, deathT: 0,
  };
  w.entities.push(e);
  return e;
}

export function spawnPlayer(w: World, carry: CarryBody | null): Entity {
  const p = makeEntity(w, carry?.body ?? 'intruder', 'player', w.playerStart.x, w.playerStart.y);
  p.controlled = true;
  if (carry) {
    p.hp = Math.max(1, Math.min(p.hpMax, carry.hp));
    p.stability = p.stabilityMax == null ? null : Math.min(p.stabilityMax, carry.stability ?? p.stabilityMax);
  } else {
    p.stability = null;
  }
  w.playerId = p.id;
  return p;
}

const tileCenter = (t: number): number => t * RULES.tile + RULES.tile / 2;

export function createWorld(zoneIndex: number, carry: CarryBody | null, seed: number, stats?: RunStats): World {
  const w = new World(zoneIndex, seed, stats);
  const rows = w.zone.map; const m = w.map;
  const doorTiles = new Map<string, { tx: number; ty: number }[]>();
  const exitTiles: { tx: number; ty: number }[] = [];
  const switches: { tx: number; ty: number; door: string }[] = [];
  const panels: { tx: number; ty: number; door: string }[] = [];
  let vents = 0;
  for (let ty = 0; ty < m.h; ty++) {
    for (let tx = 0; tx < m.w; tx++) {
      const c = rows[ty][tx]; let tile: number = T.FLOOR;
      switch (c) {
        case '#': case ' ': tile = T.WALL; break;
        case '.': tile = T.FLOOR; break;
        case ',': tile = T.FLOOR_ALT; break;
        case '~': tile = T.PIT; break;
        case 'X': tile = T.CRACK; w.devices.push({ id: `crack_${tx}_${ty}`, kind: 'crackedWall', x: tileCenter(tx), y: tileCenter(ty), tx, ty, hp: 50, hpMax: 50, broken: false }); break;
        case 'A': case 'B': case 'C': tile = T.DOOR; if (!doorTiles.has(c)) doorTiles.set(c, []); doorTiles.get(c)!.push({ tx, ty }); break;
        case '1': case '2': case '3': switches.push({ tx, ty, door: 'ABC'[Number(c) - 1] }); break;
        case '!': panels.push({ tx, ty, door: 'A' }); break;
        case '@': panels.push({ tx, ty, door: 'B' }); break;
        case '$': panels.push({ tx, ty, door: 'C' }); break;
        case 'E': tile = T.EXIT; exitTiles.push({ tx, ty }); break;
        case 'P': w.playerStart = { x: tileCenter(tx), y: tileCenter(ty) }; break;
        case 'R': w.devices.push({ id: `repair_${tx}_${ty}`, kind: 'repair', x: tileCenter(tx), y: tileCenter(ty), uses: 1, channel: 0 }); break;
        case 'O': w.devices.push({ id: `overload_${tx}_${ty}`, kind: 'overload', x: tileCenter(tx), y: tileCenter(ty), used: false, turretTag: w.zone.overload?.turretTag ?? 'corridor', doorId: w.zone.overload?.doorId ?? null, channel: 0 }); break;
        case 'V': tile = T.VENT; w.devices.push({ id: `v${vents++}`, kind: 'spawner', x: tileCenter(tx), y: tileCenter(ty), tag: '' }); break;
        case 'Z': makeEntity(w, 'boss', 'enemy', tileCenter(tx), tileCenter(ty), Math.PI / 2, 'boss'); break;
        case 'N': w.nodeSpots.push({ x: tileCenter(tx), y: tileCenter(ty) }); break;
        case 'T': w.turretSpots.push({ x: tileCenter(tx), y: tileCenter(ty), facing: tx < m.w / 2 ? 0 : Math.PI }); break;
        default:
          if (ENEMY_GLYPHS[c]) makeEntity(w, ENEMY_GLYPHS[c], 'enemy', tileCenter(tx), tileCenter(ty), Math.PI / 2);
          else if (c in TURRET_GLYPHS) makeEntity(w, 'turret', 'enemy', tileCenter(tx), tileCenter(ty), TURRET_GLYPHS[c], 'corridor');
          else throw new Error(`zone ${zoneIndex}: unknown glyph '${c}' at ${tx},${ty}`);
      }
      m.tiles[ty * m.w + tx] = tile;
    }
  }
  for (const [id, tiles] of doorTiles) {
    let lock: DoorDev['lock'] = 'none';
    if (switches.some((s) => s.door === id)) lock = 'switch';
    else if (panels.some((p) => p.door === id)) lock = 'panel';
    else if (w.zone.waveDoor === id) lock = 'waves';
    else if (w.zone.overload?.doorId === id) lock = 'overload';
    const cx = tiles.reduce((a, t) => a + tileCenter(t.tx), 0) / tiles.length; const cy = tiles.reduce((a, t) => a + tileCenter(t.ty), 0) / tiles.length;
    const door: DoorDev = { id, kind: 'door', x: cx, y: cy, tiles, open: false, label: `문 ${id}`, lock };
    w.devices.push(door);
    if (lock === 'none') openDoor(w, door, false);
  }
  for (const s of switches) w.devices.push({ id: `switch_${s.door}`, kind: 'switch', x: tileCenter(s.tx), y: tileCenter(s.ty), on: false, doorId: s.door, radius: 18 });
  for (const p of panels) w.devices.push({ id: `panel_${p.door}`, kind: 'panel', x: tileCenter(p.tx), y: tileCenter(p.ty), doorId: p.door, used: false, channel: 0, channelNeed: 1.0 });
  if (exitTiles.length) {
    const cx = exitTiles.reduce((a, t) => a + tileCenter(t.tx), 0) / exitTiles.length; const cy = exitTiles.reduce((a, t) => a + tileCenter(t.ty), 0) / exitTiles.length;
    w.devices.push({ id: 'exit', kind: 'exit', x: cx, y: cy, tiles: exitTiles, open: true });
  }
  m.version++;
  spawnPlayer(w, carry);
  w.say(w.zone.intro, 4.5, 'intro');
  w.emit({ type: 'zoneEnter', text: w.zone.name });
  return w;
}

export function openDoor(w: World, door: DoorDev, announce = true): void {
  if (door.open) return;
  door.open = true;
  for (const t of door.tiles) w.map.set(t.tx, t.ty, T.FLOOR);
  if (announce) w.emit({ type: 'door', x: door.x, y: door.y, text: `${door.label} 개방` });
}

export function carryFrom(p: Entity): CarryBody { return { body: p.body, hp: p.hp, stability: p.stability }; }
