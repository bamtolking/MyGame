// 판을 거듭하며 쌓이는 것: 경험치·레벨, 생존 포인트, 영구 강화, 해금, 업적, 통계, 생존 일지, 오늘의 도전.
// 브라우저 localStorage에 저장. (node 테스트를 위해 저장소를 주입할 수 있음)
import * as C from '../../shared/constants.js';

const KEY = 'dh_profile_v1';
export const DIFF_XP_MUL = { EASY: 0.7, NORMAL: 1, HARD: 1.4, NIGHTMARE: 2 };

// ---------- 해금 조건 ----------
export const UNLOCKS = {
  classes: {
    HUNTER: { level: 3, text: '계정 3레벨' },
    COOK: { stat: 'bestDay', value: 5, text: '한 판에 5일 생존' },
    KNIGHT: { stat: 'kills', value: 300, text: '누적 300마리 처치' },
    BUILDER: { stat: 'built', value: 150, text: '누적 건물 150개' },
  },
  maps: {
    SNOW: { stat: 'bestDay', value: 5, text: '한 판에 5일 생존' },
    DESERT: { stat: 'wins', value: 1, text: '아무 전장에서 승리' },
    SWAMP: { level: 5, text: '계정 5레벨' },
    VOLCANO: { stat: 'winsHard', value: 1, text: '어려움 이상에서 승리' },
  },
  difficulties: {
    HARD: { stat: 'winsNormal', value: 1, text: '보통 이상에서 승리' },
    NIGHTMARE: { stat: 'winsHard', value: 1, text: '어려움에서 승리' },
  },
};

// ---------- 업적 ----------
// run: 이번 판 요약으로 판정 / total: 누적 프로필로 판정
export const ACHIEVEMENTS = [
  { key: 'first_night', name: '첫 밤', icon: '🌙', desc: '첫 밤을 살아남기', points: 2, run: (r) => r.day >= 2 },
  { key: 'day5', name: '닷새', icon: '📅', desc: '한 판에 5일 생존', points: 3, run: (r) => r.day >= 5 },
  { key: 'day10', name: '열흘', icon: '🗓️', desc: '한 판에 10일 생존', points: 5, run: (r) => r.day >= 10 },
  { key: 'endless15', name: '끝없는 밤', icon: '♾️', desc: '한 판에 15일 생존', points: 8, run: (r) => r.day >= 15 },
  { key: 'first_win', name: '살아남았다', icon: '🏆', desc: '첫 승리', points: 5, run: (r) => r.won },
  { key: 'win_MEADOW', name: '초원의 주인', icon: '🌿', desc: '초원에서 승리', points: 4, run: (r) => r.won && r.map === 'MEADOW' },
  { key: 'win_SNOW', name: '설원의 주인', icon: '❄️', desc: '설원에서 승리', points: 4, run: (r) => r.won && r.map === 'SNOW' },
  { key: 'win_DESERT', name: '사막의 주인', icon: '🏜️', desc: '사막에서 승리', points: 4, run: (r) => r.won && r.map === 'DESERT' },
  { key: 'win_SWAMP', name: '늪지의 주인', icon: '🐸', desc: '늪지에서 승리', points: 4, run: (r) => r.won && r.map === 'SWAMP' },
  { key: 'win_VOLCANO', name: '화산의 주인', icon: '🌋', desc: '화산에서 승리', points: 6, run: (r) => r.won && r.map === 'VOLCANO' },
  { key: 'win_hard', name: '역경', icon: '😈', desc: '어려움에서 승리', points: 8, run: (r) => r.won && r.difficulty === 'HARD' },
  { key: 'win_nightmare', name: '악몽을 이겨내다', icon: '💀', desc: '악몽에서 승리', points: 15, run: (r) => r.won && r.difficulty === 'NIGHTMARE' },
  { key: 'boss', name: '괴수 사냥꾼', icon: '👑', desc: '괴수 처치', points: 5, run: (r) => r.stats.bossKills >= 1 },
  { key: 'elite5', name: '정예 사냥', icon: '⭐', desc: '한 판에 정예 5마리 처치', points: 4, run: (r) => r.stats.eliteKills >= 5 },
  { key: 'thief', name: '되찾았다', icon: '🎒', desc: '도둑을 잡아 자원 되찾기', points: 3, run: (r) => r.stats.recovers >= 1 },
  { key: 'perks8', name: '축복받은 자', icon: '✨', desc: '한 판에 특전 8개', points: 4, run: (r) => r.stats.perks >= 8 },
  { key: 'coop_win', name: '함께라면', icon: '👥', desc: '협동으로 승리', points: 6, run: (r) => r.won && r.players >= 2 },
  { key: 'daily', name: '오늘의 생존자', icon: '📆', desc: '오늘의 도전에서 3일 생존', points: 3, run: (r) => r.daily && r.day >= 3 },
  { key: 'fisher', name: '강태공', icon: '🎣', desc: '누적 낚시 50회', points: 3, total: (p) => p.stats.fish >= 50 },
  { key: 'built100', name: '건축가의 길', icon: '🧱', desc: '누적 건물 100개', points: 3, total: (p) => p.stats.built >= 100 },
  { key: 'built500', name: '성벽', icon: '🏰', desc: '누적 건물 500개', points: 6, total: (p) => p.stats.built >= 500 },
  { key: 'kills100', name: '백인장', icon: '⚔️', desc: '누적 100마리 처치', points: 3, total: (p) => p.stats.kills >= 100 },
  { key: 'kills1000', name: '천인장', icon: '🗡️', desc: '누적 1000마리 처치', points: 8, total: (p) => p.stats.kills >= 1000 },
  { key: 'all_classes', name: '만능', icon: '🎭', desc: '모든 캐릭터로 한 번씩 플레이', points: 5, total: (p) => Object.keys(p.stats.classRuns).length >= Object.keys(C.CLASSES).length },
  { key: 'level10', name: '베테랑', icon: '🎖️', desc: '계정 10레벨', points: 6, total: (p) => p.level >= 10 },
];

export function defaultProfile() {
  return {
    v: 1, xp: 0, level: 1, points: 0, spent: 0, upgrades: {}, achievements: {},
    stats: { runs: 0, wins: 0, winsNormal: 0, winsHard: 0, bestDay: 0, bestScore: 0, kills: 0, built: 0, fish: 0, gathered: { wood: 0, stone: 0, iron: 0, food: 0 }, playTicks: 0, classRuns: {}, mapRuns: {}, bestByMap: {} },
    runs: [], daily: { date: '', best: 0, done: false },
    settings: { sound: true, vibrate: true }, tipsSeen: false, created: Date.now(),
  };
}
export const xpToNext = (level) => 150 + 90 * (level - 1);

const memoryStore = () => { const m = new Map(); return { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v) }; };
const localStore = () => ({
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
});
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function dateKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

export class Profile {
  constructor(storage) {
    this.store = storage || (typeof localStorage !== 'undefined' ? localStore() : memoryStore());
    this.data = defaultProfile();
    try { const raw = this.store.get(KEY); if (raw) this.data = mergeDeep(defaultProfile(), JSON.parse(raw)); } catch {}
  }
  save() { this.store.set(KEY, JSON.stringify(this.data)); }
  reset() { this.data = defaultProfile(); this.save(); }
  get level() { return this.data.level; }
  get xpProgress() { return this.data.xp / xpToNext(this.data.level); }
  get meta() { return C.metaFromUpgrades(this.data.upgrades); }
  get points() { return this.data.points; }

  // ---------- 해금 ----------
  isUnlocked(kind, key) {
    const rule = (UNLOCKS[kind] || {})[key];
    if (!rule) return true;
    if (rule.level) return this.data.level >= rule.level;
    return (this.data.stats[rule.stat] || 0) >= rule.value;
  }
  unlockText(kind, key) { const r = (UNLOCKS[kind] || {})[key]; return r ? r.text : ''; }
  unlockedList() {
    const out = [];
    for (const kind of Object.keys(UNLOCKS)) for (const key of Object.keys(UNLOCKS[kind])) if (this.isUnlocked(kind, key)) out.push(kind + ':' + key);
    return out;
  }

  // ---------- 영구 강화 ----------
  upgradeLevel(key) { return this.data.upgrades[key] | 0; }
  upgradeCost(key) { const u = C.UPGRADES[key]; const lv = this.upgradeLevel(key); return lv >= u.max ? null : u.cost[lv]; }
  canBuy(key) { const c = this.upgradeCost(key); return c !== null && this.data.points >= c; }
  buy(key) {
    if (!this.canBuy(key)) return false;
    const c = this.upgradeCost(key);
    this.data.points -= c; this.data.spent += c; this.data.upgrades[key] = this.upgradeLevel(key) + 1;
    this.save(); return true;
  }

  // ---------- 오늘의 도전 ----------
  dailyInfo(date = new Date()) {
    const key = dateKey(date), h = hashStr('dayhunger-' + key);
    const maps = Object.keys(C.MAPS), diffs = ['EASY', 'NORMAL', 'NORMAL', 'HARD', 'HARD', 'NIGHTMARE'];
    return { date: key, seed: h, map: maps[h % maps.length], difficulty: diffs[Math.floor(h / 7) % diffs.length], done: this.data.daily.date === key && this.data.daily.done, best: this.data.daily.date === key ? this.data.daily.best : 0 };
  }

  // ---------- 판 결과 기록 ----------
  // run = { map, difficulty, cls, day, score, kills, won, endless, players, daily, stats, ticks }
  recordRun(run) {
    const d = this.data, st = d.stats;
    const before = { level: d.level, unlocked: this.unlockedList(), achievements: new Set(Object.keys(d.achievements)) };
    const diffMul = DIFF_XP_MUL[run.difficulty] || 1;
    const xpGained = Math.round((run.day * 40 + run.kills * 2 + Math.floor(run.score / 10) + (run.won ? 300 : 0)) * diffMul);
    let pointsGained = Math.round((Math.floor(run.day * 1.5) + (run.won ? 8 : 0) + (run.stats.bossKills || 0) * 3) * diffMul);
    // 통계
    st.runs++; if (run.won) st.wins++;
    if (run.won && (run.difficulty === 'NORMAL' || run.difficulty === 'HARD' || run.difficulty === 'NIGHTMARE')) st.winsNormal++;
    if (run.won && (run.difficulty === 'HARD' || run.difficulty === 'NIGHTMARE')) st.winsHard++;
    st.bestDay = Math.max(st.bestDay, run.day); st.bestScore = Math.max(st.bestScore, run.score);
    st.kills += run.kills; st.built += run.stats.built || 0; st.fish += run.stats.fish || 0; st.playTicks += run.ticks || 0;
    for (const k of Object.keys(st.gathered)) st.gathered[k] += (run.stats.gathered && run.stats.gathered[k]) || 0;
    st.classRuns[run.cls] = (st.classRuns[run.cls] || 0) + 1; st.mapRuns[run.map] = (st.mapRuns[run.map] || 0) + 1;
    st.bestByMap[run.map] = Math.max(st.bestByMap[run.map] || 0, run.day);
    // 오늘의 도전
    if (run.daily) {
      const key = dateKey();
      if (d.daily.date !== key) d.daily = { date: key, best: 0, done: false };
      d.daily.best = Math.max(d.daily.best, run.score);
      if (!d.daily.done && run.day >= 3) { d.daily.done = true; pointsGained += 5; }
    }
    // 경험치·레벨
    d.xp += xpGained;
    const levelUps = [];
    while (d.xp >= xpToNext(d.level)) { d.xp -= xpToNext(d.level); d.level++; levelUps.push(d.level); }
    // 업적
    const newAchievements = [];
    for (const a of ACHIEVEMENTS) {
      if (d.achievements[a.key]) continue;
      const ok = a.run ? a.run(run) : a.total ? a.total(d) : false;
      if (ok) { d.achievements[a.key] = Date.now(); newAchievements.push(a); pointsGained += a.points; }
    }
    d.points += pointsGained;
    // 일지
    d.runs.unshift({ at: Date.now(), map: run.map, difficulty: run.difficulty, cls: run.cls, day: run.day, score: run.score, kills: run.kills, won: !!run.won, players: run.players || 1, daily: !!run.daily });
    if (d.runs.length > 30) d.runs.length = 30;
    const newUnlocks = this.unlockedList().filter((u) => !before.unlocked.includes(u));
    this.save();
    return { xpGained, pointsGained, levelUps, newAchievements, newUnlocks, levelBefore: before.level };
  }
}
function mergeDeep(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (extra && typeof extra === 'object') for (const k of Object.keys(extra)) out[k] = k in base ? mergeDeep(base[k], extra[k]) : extra[k];
    return out;
  }
  return extra === undefined ? base : extra;
}
