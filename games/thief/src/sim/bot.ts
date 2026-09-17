// Scripted "current player" input for tests and solution fixtures.
// It only produces joystick vectors / button presses, so it plays by exactly the same rules as a human.
import { TILE } from './constants';
import type { AttemptState, MapData, PlayerInput } from './types';

export interface BotStep {
  /** walk to this tile (BFS through the grid, then straight segments) */
  to?: [number, number];
  /** stand still for this many seconds */
  wait?: number;
  /** wait until predicate is true (max seconds) */
  until?: { laserOff?: string; generatorDead?: string; vaultOpen?: boolean; hasCore?: boolean; enemyDead?: number; max: number };
  /** press interact once when starting this step */
  interact?: boolean;
  /** allow dashing on this segment */
  dash?: boolean;
  /** press finish */
  finish?: boolean;
}
export interface BotScript { weapon: 'rifle' | 'shotgun'; steps: BotStep[] }

function bfs(map: MapData, from: [number, number], to: [number, number]): [number, number][] | null {
  const { cols, rows, solidGrid } = map; const key = (c: number, r: number): number => r * cols + c;
  const prev = new Int32Array(cols * rows).fill(-1); const q: number[] = [key(from[0], from[1])]; prev[q[0]] = q[0];
  const goal = key(to[0], to[1]);
  while (q.length) {
    const k = q.shift() as number; if (k === goal) break;
    const c = k % cols, r = (k / cols) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || solidGrid[nr][nc]) continue;
      const nk = key(nc, nr); if (prev[nk] >= 0) continue; prev[nk] = k; q.push(nk);
    }
  }
  if (prev[goal] < 0) return null;
  const path: [number, number][] = []; let k = goal;
  while (k !== prev[k]) { path.push([k % cols, (k / cols) | 0]); k = prev[k]; }
  path.push(from); path.reverse();
  // compress straight runs
  const out: [number, number][] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) { const a = path[i - 1], b = path[i], c = path[i + 1]; if ((b[0] - a[0]) !== (c[0] - b[0]) || (b[1] - a[1]) !== (c[1] - b[1])) out.push(b); }
  out.push(path[path.length - 1]);
  return out;
}

const center = (t: [number, number]): { x: number; y: number } => ({ x: (t[0] + 0.5) * TILE, y: (t[1] + 0.5) * TILE });
const tileOf = (x: number, y: number): [number, number] => [Math.floor(x / TILE), Math.floor(y / TILE)];

/** Creates an input provider that follows the script. Call `input(st)` once per tick before stepping. */
export function makeBot(map: MapData, script: BotScript): { input: (st: AttemptState) => PlayerInput; done: () => boolean; stepIndex: () => number } {
  let si = 0; let waypoints: { x: number; y: number }[] | null = null; let waitTicks = 0; let untilTicks = 0; let started = false;
  const input = (st: AttemptState): PlayerInput => {
    const p = st.player; const out: PlayerInput = { mx: 0, my: 0, dash: false, interact: false, finish: false };
    while (si < script.steps.length) {
      const s = script.steps[si];
      if (!started) {
        started = true;
        if (s.interact) out.interact = true;
        if (s.finish) { out.finish = true; si++; started = false; return out; }
        if (s.to) { const path = bfs(map, tileOf(p.x, p.y), s.to); if (!path) throw new Error(`bot: no path to ${s.to}`); waypoints = path.slice(1).map(center); if (waypoints.length === 0) waypoints = [center(s.to)]; }
        if (s.wait) waitTicks = Math.round(s.wait * 60);
        if (s.until) untilTicks = Math.round(s.until.max * 60);
      }
      if (s.to && waypoints && waypoints.length) {
        const w = waypoints[0]; const dx = w.x - p.x, dy = w.y - p.y; const d = Math.hypot(dx, dy);
        if (d < 6) { waypoints.shift(); continue; }
        out.mx = dx / d; out.my = dy / d;
        if (s.dash && p.dashCd <= 0 && d > 110) out.dash = true;
        return out;
      }
      if (s.wait && waitTicks > 0) { waitTicks--; return out; }
      if (s.until && untilTicks > 0) {
        const u = s.until; untilTicks--;
        const ok = (u.laserOff ? st.lasers.find((l) => l.id === u.laserOff)?.phase === 'off' : true)
          && (u.generatorDead ? st.generators.find((g) => g.id === u.generatorDead)?.alive === false : true)
          && (u.vaultOpen ? st.vault.open : true) && (u.hasCore ? p.hasCore : true)
          && (u.enemyDead !== undefined ? st.enemies[u.enemyDead].alive === false : true);
        if (!ok) return out;
      }
      si++; started = false; waypoints = null;
    }
    return out;
  };
  return { input, done: () => si >= script.steps.length, stepIndex: () => si };
}
