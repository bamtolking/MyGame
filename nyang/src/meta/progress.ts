// 집사 레벨(경험치), 칭호, 오늘의 상자 연속 기록. DOM 없음.

/** level → level+1 에 필요한 경험치 */
export function xpToNext(level: number): number {
  return 250 + 150 * (level - 1);
}

export interface LevelInfo { level: number; into: number; need: number }

/** 누적 경험치 → 레벨과 현재 레벨 안에서의 진행 */
export function levelOf(totalXp: number): LevelInfo {
  let level = 1, rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpToNext(level) && level < 999) { rest -= xpToNext(level); level++; }
  return { level, into: rest, need: xpToNext(level) };
}

/** 한 판 끝났을 때 받는 경험치: 점수 기반 + 새로 발견한 고양이 */
export function gameXp(score: number, newCats: number): number {
  return Math.floor(score / 80) + 30 * newCats + 20;
}

const TITLES: Array<[number, string, string]> = [
  [1, '초보 집사', 'Newbie Butler'],
  [5, '견습 집사', 'Apprentice Butler'],
  [10, '숙련 집사', 'Skilled Butler'],
  [15, '베테랑 집사', 'Veteran Butler'],
  [20, '전설의 집사', 'Legendary Butler'],
  [30, '고양이의 신', 'Cat Whisperer'],
];

export function titleOf(level: number, lang: 'ko' | 'en'): string {
  let t = TITLES[0];
  for (const row of TITLES) if (level >= row[0]) t = row;
  return lang === 'ko' ? t[1] : t[2];
}

export interface Streak { count: number; best: number; last: string }

/** 날짜 키(YYYY-MM-DD)의 하루 전 */
export function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** 오늘의 상자를 끝냈을 때 연속 기록 갱신 */
export function bumpStreak(s: Streak, today: string): Streak {
  if (s.last === today) return s;
  const count = s.last === prevDay(today) ? s.count + 1 : 1;
  return { count, best: Math.max(s.best, count), last: today };
}

/** 지금 이어지고 있는 연속 기록 (어제나 오늘 했으면 유지, 아니면 0) */
export function liveStreak(s: Streak, today: string): number {
  return s.last === today || s.last === prevDay(today) ? s.count : 0;
}
