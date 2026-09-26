// Playable characters. Every character is a SIDEGRADE: one signature verb or skill, never a raw stat ladder.
// Nothing here is upgradeable; unlocks are earned by play (stars / mission rank / coins with the price shown).

export type SkillDef =
  | { kind: 'none' }
  | { kind: 'jellyBurst'; every: number; dur: number }   // jellies on screen turn into big jellies
  | { kind: 'shield'; every: number }                   // a bubble that absorbs the next hit (holds 1)
  | { kind: 'heal'; every: number; amount: number }
  | { kind: 'magnet'; every: number; dur: number }
  | { kind: 'giant'; every: number; dur: number }
  | { kind: 'coinRain'; every: number; dur: number };   // jellies on screen turn into coins

export type Unlock = { kind: 'start' } | { kind: 'stars'; n: number } | { kind: 'coins'; cost: number } | { kind: 'rank'; n: number };

export interface CharacterDef {
  id: string;
  name: string;          // Korean display name
  title: string;         // short epithet
  desc: string;          // one line, what makes it play differently
  skillName: string;
  skillDesc: string;
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
    id: 'hotteok', name: '호떡이', title: '달콤한 첫 주자', desc: '균형 잡힌 기본 주자. 주기적으로 화면의 젤리를 큰 젤리로 바꿉니다.',
    skillName: '꿀 폭발', skillDesc: '14초마다 4초 동안 화면의 젤리가 큰 젤리로',
    maxHp: 100, drainMul: 1, maxJumps: 2, glide: 0, magnetR: 0, revive: 0,
    skill: { kind: 'jellyBurst', every: 14, dur: 4 }, unlock: { kind: 'start' },
    palette: { body: '#d9953f', shade: '#a8672a', accent: '#6b3a16', cheek: '#ff9a8a' },
  },
];

export const CHAR_BY_ID: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
