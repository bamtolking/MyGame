// 개발용: 스테이지의 안정화 직후 상태와, 선택적으로 발사 후 상태를 출력한다.
// npx tsx scripts/describe.ts L04 [angle,power] [--cut r1] [--steps 300]
import Matter from 'matter-js';
import { LEVELS } from '../src/data/levels/index';
import { LevelSession } from '../src/sim/session';
const key = process.argv[2];
const level = LEVELS.find((l) => l.key === key)!;
const s = new LevelSession(level);
const dump = (title: string) => {
  console.log(`== ${title} step=${s.step_} state=${s.state} settled=${s.isSettledNow()} goals=${s.goalsDone}/${s.goals.length} fail=${s.failReason}`);
  for (const e of s.world.entries.values()) {
    if (e.kind === 'ground') continue;
    const b = e.body;
    console.log(`  ${e.id.padEnd(10)} ${e.kind.padEnd(10)} pos=(${b.position.x.toFixed(1)},${b.position.y.toFixed(1)}) ang=${(b.angle * 180 / Math.PI).toFixed(1)}° v=${Matter.Body.getSpeed(b).toFixed(2)} sleep=${b.isSleeping} removed=${e.removed}${e.isStatic ? ' static' : ''} init=(${e.init.x.toFixed(0)},${e.init.y.toFixed(0)})`);
  }
  for (const r of s.world.ropes.values()) { const { a, b } = s.world.ropeEndpoints(r); console.log(`  rope ${r.id} cut=${r.cut} a=(${a.x.toFixed(0)},${a.y.toFixed(0)}) b=(${b.x.toFixed(0)},${b.y.toFixed(0)}) len=${Math.hypot(a.x - b.x, a.y - b.y).toFixed(1)}/${r.restLength.toFixed(1)}`); }
};
dump('안정화 직후');
const cutIdx = process.argv.indexOf('--cut');
if (cutIdx > 0) { s.world.cutRope(s.world.ropes.get(process.argv[cutIdx + 1])!); console.log('밧줄 강제 절단', process.argv[cutIdx + 1]); }
const remIdx = process.argv.indexOf('--remove');
if (remIdx > 0) { s.world.removeEntry(s.world.mustEntry(process.argv[remIdx + 1])); s.world.wakeAllDynamic(); console.log('강제 제거', process.argv[remIdx + 1]); }
// 발사 목록: "a,p" 또는 "a,p;a,p" (조준 가능 상태가 될 때마다 다음 발사)
const shotList = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3].split(';').map((t) => t.split(',').map(Number)) : [];
let shotIdx = 0;
const tryFire = () => { if (shotIdx < shotList.length && s.state === 'aiming') { const a = shotList[shotIdx++]; s.launch({ angleDeg: a[0], power: a[1] }); console.log('발사', a); } };
tryFire();
const stepsIdx = process.argv.indexOf('--steps');
const steps = stepsIdx > 0 ? Number(process.argv[stepsIdx + 1]) : 360;
for (let i = 1; i <= steps; i++) {
  s.step();
  tryFire();
  const showHits = process.argv.includes('--hits');
  for (const ev of s.drainEvents()) if (ev.t !== 'hit' || (showHits && ev.speed > 3)) console.log(`  [${(s.step_ / 60).toFixed(2)}s]`, ev.t === 'hit' ? `hit ${ev.material}/${ev.other} v=${ev.speed.toFixed(1)} at ${ev.x.toFixed(0)},${ev.y.toFixed(0)}` : JSON.stringify(ev));
  if (i % 60 === 0) dump(`${(i / 60).toFixed(0)}초 후`);
  if (s.state === 'success' || s.state === 'failed') { dump('결과'); break; }
}
