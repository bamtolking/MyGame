// 개발용 해법 탐색: 각도×세기 격자를 실제 물리로 재생해 성공 지도를 출력한다.
// 사용: npx tsx scripts/solve.ts L03 [--fine] [--first "a,p"]  (첫 발을 고정하고 두 번째 발을 탐색)
import { LEVELS } from '../src/data/levels/index';
import { runShots } from '../src/sim/session';
import type { ShotInput } from '../src/sim/types';

const key = process.argv[2] ?? 'L01';
const fine = process.argv.includes('--fine');
const firstIdx = process.argv.indexOf('--first');
const first: ShotInput | null = firstIdx > 0 ? (() => { const [a, p] = process.argv[firstIdx + 1].split(',').map(Number); return { angleDeg: a, power: p }; })() : null;
const watchIdx = process.argv.indexOf('--watch');
const watchId = watchIdx > 0 ? process.argv[watchIdx + 1] : null; // 이 물체가 50px 이상 움직였으면 'm' 표시
const level = LEVELS.find((l) => l.key === key);
if (!level) { console.error('no level', key); process.exit(1); }

const angles: number[] = []; for (let a = 0; a <= 85; a += fine ? 1 : 2.5) angles.push(a);
const powers: number[] = []; for (let p = 0.25; p <= 1.0001; p += fine ? 0.025 : 0.05) powers.push(Math.round(p * 1000) / 1000);

// 입력 없이 기다렸을 때 저절로 달성되는지(자동 성공 오류) 먼저 확인
{
  const idle = runShots(level, [], 60 * 8);
  if (idle.goalsDone > 0 || idle.failReason) console.log(`!! 경고: 입력 없이 ${idle.goalsDone}개 목표 달성 / 실패 사유 ${idle.failReason} — 초기 배치가 불안정함`);
  idle.dispose();
}
const t0 = Date.now();
const grid: string[][] = [];
const successes: { a: number; p: number; steps: number; shots: number }[] = [];
for (const p of powers) {
  const row: string[] = [];
  for (const a of angles) {
    const shots = first ? [first, { angleDeg: a, power: p }] : [{ angleDeg: a, power: p }];
    const s = runShots(level, shots);
    let ch = '.';
    if (s.state === 'success') { ch = '#'; successes.push({ a, p, steps: s.step_, shots: s.shotsUsed }); }
    else if (s.state === 'failed') ch = s.failReason === 'protectHit' ? 'H' : s.failReason === 'protectOut' ? 'O' : (s.goalsDone > 0 ? String(s.goalsDone) : '.');
    else {
      const cut = [...s.world.ropes.values()].some((r) => r.cut);
      ch = s.goalsDone > 0 ? 'abcdefghi'[s.goalsDone - 1] : cut ? 'r' : '?';
      if (ch === '?' && watchId) { const e = s.world.entries.get(watchId); if (e && (e.removed || Math.hypot(e.body.position.x - e.init.x, e.body.position.y - e.init.y) > 50 || Math.abs(e.body.angle - e.init.angle) > 0.35)) ch = 'm'; }
    }
    row.push(ch);
    s.dispose();
  }
  grid.push(row);
}
console.log(`${level.key} ${level.title} v${level.version} shots=${level.shots} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${first ? `first=${first.angleDeg},${first.power}` : ''}`);
console.log('행=세기(power) 열=각도(angle). #=성공 숫자=달성 목표 수(실패) a~e=달성 목표 수(탄 남음) r=밧줄만 절단 H=보호상자 직접 명중 O=안전구역 이탈 .=실패 ?=변화 없음(탄 남음)');
console.log('       ' + angles.map((a) => (a % 10 === 0 ? String(a).padStart(2, ' ') : '  ')).join('').replace(/ {2}/g, (m) => m));
for (let i = 0; i < powers.length; i++) console.log(powers[i].toFixed(3).padStart(6) + ' ' + grid[i].join(' '));
console.log(`성공 ${successes.length}/${angles.length * powers.length}`);
// 견고한 해법: 이웃 8칸이 모두 성공인 지점
const idx = (a: number, p: number) => [powers.indexOf(p), angles.indexOf(a)];
const robust = successes.filter(({ a, p }) => {
  const [pi, ai] = idx(a, p);
  for (let dp = -1; dp <= 1; dp++) for (let da = -1; da <= 1; da++) {
    const r = grid[pi + dp]?.[ai + da];
    if (r !== '#') return false;
  }
  return true;
});
console.log('견고(이웃 8칸 성공):', robust.slice(0, 40).map((r) => `${r.a}°/${r.p}`).join(' '));
