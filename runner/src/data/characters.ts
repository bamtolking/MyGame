// Playable characters (주자). Every character is a SIDEGRADE that changes one verb — never a stat ladder.
// Nothing is upgradeable; unlocks are earned by play (stars / rank / coins with the price shown up front).
// Balance knobs are only maxHp, drainMul and the skill period; score-multiplier skills are forbidden.

export type SkillDef =
  | { kind: 'none' }
  | { kind: 'jellyBurst'; every: number; dur: number }   // on-screen 별사탕 turn into 왕별사탕
  | { kind: 'shield'; every: number; startCharged?: boolean }  // a bubble that absorbs the next obstacle hit (holds 1; not pits)
  | { kind: 'heal'; every: number; amount: number }
  | { kind: 'magnet'; every: number; dur: number }
  | { kind: 'giant'; every: number; dur: number }
  | { kind: 'coinRain'; every: number; dur: number };

export type Unlock = { kind: 'start' } | { kind: 'stars'; n: number } | { kind: 'coins'; cost: number } | { kind: 'rank'; n: number };
/** procedural body silhouette (src/render/characters.ts) */
export type Shape = 'disc' | 'fish' | 'skewer' | 'fishcake' | 'star' | 'potato';

export interface CharacterDef {
  id: string;
  name: string;          // Korean display name
  title: string;         // short epithet
  desc: string;          // one line, what makes it play differently
  skillName: string;
  skillDesc: string;
  shape: Shape;
  maxHp: number;
  drainMul: number;
  maxJumps: number;      // 2 = double jump (default); 3 = triple
  glide: number;         // 0 = none; else max fall speed (px/s) while jump is held in the air
  magnetR: number;       // passive pickup pull radius (0 = none)
  revive: number;        // 0 = none; else revives once at this fraction of max HP
  skill: SkillDef;
  unlock: Unlock;
  palette: { body: string; shade: string; accent: string; cheek: string };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'hotteok', name: '호떡이', title: '달콤한 첫 주자', shape: 'disc',
    desc: '균형 잡힌 첫 주자. 주기적으로 화면의 별사탕을 왕별사탕으로 바꿔요.',
    skillName: '꿀 폭발', skillDesc: '14초마다 4초 동안 화면의 별사탕이 왕별사탕으로',
    maxHp: 100, drainMul: 1, maxJumps: 2, glide: 0, magnetR: 0, revive: 0,
    skill: { kind: 'jellyBurst', every: 14, dur: 4 }, unlock: { kind: 'start' },
    palette: { body: '#d9953f', shade: '#a8672a', accent: '#6b3a16', cheek: '#ff9a8a' },
  },
  {
    id: 'bungeo', name: '붕이', title: '붕어빵 헤엄꾼', shape: 'fish',
    desc: '공중에서 점프를 누르고 있으면 지느러미로 천천히 내려와요. 긴 구덩이도 여유롭게.',
    skillName: '지느러미 활공', skillDesc: '공중에서 점프를 누르고 있으면 천천히 떨어짐 (늘 켜짐)',
    maxHp: 100, drainMul: 1, maxJumps: 2, glide: 240, magnetR: 0, revive: 0,
    skill: { kind: 'none' }, unlock: { kind: 'stars', n: 10 },
    palette: { body: '#e0a24e', shade: '#b8762c', accent: '#7a4a1c', cheek: '#ff9f8f' },
  },
  {
    id: 'kkochi', name: '꼬치', title: '떡꼬치 삼단뛰기', shape: 'skewer',
    desc: '공중에서 한 번 더! 3단 점프로 높은 길을 노려요. 대신 따끈함이 조금 적어요.',
    skillName: '3단 점프', skillDesc: '공중 점프를 두 번까지 (늘 켜짐)',
    maxHp: 90, drainMul: 1, maxJumps: 3, glide: 0, magnetR: 0, revive: 0,
    skill: { kind: 'none' }, unlock: { kind: 'rank', n: 5 },
    palette: { body: '#e2543f', shade: '#b5322a', accent: '#6e2a1a', cheek: '#ffc0a0' },
  },
  {
    id: 'eomuk', name: '어묵이', title: '뜨끈한 국물', shape: 'fishcake',
    desc: '국물 방울막이 다음 장애물 한 번을 막아 줘요. 출발할 때부터 차 있어요.',
    skillName: '국물 방울막', skillDesc: '16초마다 방울막 1개 (장애물 피격 1회 막음, 구덩이는 제외)',
    maxHp: 100, drainMul: 1, maxJumps: 2, glide: 0, magnetR: 0, revive: 0,
    skill: { kind: 'shield', every: 16, startCharged: true }, unlock: { kind: 'rank', n: 12 },
    palette: { body: '#f0c98a', shade: '#c99a5a', accent: '#7a5a3a', cheek: '#ffab9a' },
  },
  {
    id: 'dalgona', name: '달콩', title: '달고나 끌림', shape: 'star',
    desc: '가까운 별사탕과 엽전이 저절로 끌려와요. 대신 조금 빨리 식어요.',
    skillName: '달콤 자석', skillDesc: '늘 켜진 작은 자석 (반경 150)',
    maxHp: 100, drainMul: 1.08, maxJumps: 2, glide: 0, magnetR: 150, revive: 0,
    skill: { kind: 'none' }, unlock: { kind: 'coins', cost: 2500 },
    palette: { body: '#e9a93c', shade: '#b97a1c', accent: '#6b4412', cheek: '#ffb08a' },
  },
  {
    id: 'goguma', name: '고구미', title: '군고구마 뚝심', shape: 'potato',
    desc: '한 판에 한 번, 다 식어도 다시 일어나요. 대신 최대 따끈함이 적어요.',
    skillName: '한 번 더', skillDesc: '판당 1회, 최대치의 35%로 되살아남',
    maxHp: 85, drainMul: 1, maxJumps: 2, glide: 0, magnetR: 0, revive: 0.35,
    skill: { kind: 'none' }, unlock: { kind: 'stars', n: 30 },
    palette: { body: '#8a4a7a', shade: '#5e2e56', accent: '#4a2240', cheek: '#ffb37a' },
  },
];

export const CHAR_BY_ID: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
