// localStorage: 설정과 기록만 저장 (게임 중간 저장은 없음 — 라운드가 실시간으로 흐르는 게임)
export interface Settings { name: string; sound: boolean; volume: number; serverUrl: string; peerHost: string; lowFx: boolean; token: string; lastRoom: string }
export interface Records { games: number; wins: number; bestRound: number; bestKills: number; mythics: number; coop: number }
const KEY = 'nrd.v1';
const defaults = (): { settings: Settings; records: Records } => ({
  settings: { name: '', sound: true, volume: 0.5, serverUrl: '', peerHost: '', lowFx: false, token: '', lastRoom: '' },
  records: { games: 0, wins: 0, bestRound: 0, bestKills: 0, mythics: 0, coop: 0 },
});
export function load(): { settings: Settings; records: Records } {
  const d = defaults();
  try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') { Object.assign(d.settings, o.settings ?? {}); Object.assign(d.records, o.records ?? {}); } } } catch { /* ignore */ }
  if (!d.settings.token) d.settings.token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return d;
}
export function save(data: { settings: Settings; records: Records }): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}
