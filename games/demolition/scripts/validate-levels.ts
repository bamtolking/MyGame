// 전체 스테이지 검증: 데이터 규칙 검사, 무입력 안정성, 해법 재생(3회 일치), 흔들림(±1.5°, ±0.03) 성공률, 실패 입력 확인.
// 결과를 docs/level-validation.json 과 docs/LEVEL_VALIDATION.md 에 기록한다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { LEVELS } from '../src/data/levels/index';
import { SOLUTIONS } from '../src/data/solutions';
import { runShots, LevelSession } from '../src/sim/session';
import type { LevelDef, ShotInput } from '../src/sim/types';
import { lintLevel } from '../src/sim/lint';
import { FIXED_DT, GRAVITY_Y, LAUNCH, SUBSTEPS, JUDGE } from '../src/data/physics';
import Matter from 'matter-js';

interface Result {
  key: string; id: number; title: string; version: number; solutionVersion: number | null; versionMatch: boolean;
  lint: string[]; idleOk: boolean; idleDetail: string;
  replay: { success: boolean; shotsUsed: number; goals: string; protectsSafe: boolean; stars: number; steps: number; maxCombo: number; failReason: string | null } | null;
  deterministic: boolean; perturb: { total: number; ok: number }; failInputs: { input: string; state: string; reason: string | null; goals: number }[];
  starThreeOk: boolean; verified: boolean; notes: string[];
}

function summary(s: LevelSession) {
  return { success: s.state === 'success', shotsUsed: s.shotsUsed, goals: `${s.goalsDone}/${s.goals.length}`, protectsSafe: s.protects.every((p) => !p.failed), stars: s.stars, steps: s.step_, maxCombo: s.maxCombo, failReason: s.failReason };
}

const results: Result[] = [];
for (const lv of LEVELS) {
  const sol = SOLUTIONS[lv.solutionRef];
  const r: Result = { key: lv.key, id: lv.id, title: lv.title, version: lv.version, solutionVersion: sol?.levelVersion ?? null, versionMatch: !!sol && sol.levelVersion === lv.version, lint: lintLevel(lv), idleOk: false, idleDetail: '', replay: null, deterministic: false, perturb: { total: 0, ok: 0 }, failInputs: [], starThreeOk: false, verified: false, notes: [] };
  // 1) 무입력 8초: 목표 달성/실패가 없어야 하고 목표 블록이 움직이지 않아야 함
  {
    const s = new LevelSession(lv);
    const before = lv.goals.map((g) => { const e = s.world.mustEntry(g.body); return { x: e.body.position.x, y: e.body.position.y, a: e.body.angle }; });
    for (let i = 0; i < 60 * 8; i++) s.step();
    const moved = lv.goals.map((g, i) => { const e = s.world.mustEntry(g.body); return Math.hypot(e.body.position.x - before[i].x, e.body.position.y - before[i].y) + Math.abs(e.body.angle - before[i].a) * 50; });
    const maxMoved = Math.max(0, ...moved);
    r.idleOk = s.goalsDone === 0 && !s.failReason && maxMoved < 3;
    r.idleDetail = `목표 ${s.goalsDone} 실패 ${s.failReason ?? '-'} 최대 이동 ${maxMoved.toFixed(2)}px`;
    s.dispose();
  }
  if (!sol) { r.notes.push('해법 기록 없음'); results.push(r); continue; }
  // 2) 해법 재생 3회 → 결과 동일
  const runs = [0, 1, 2].map(() => { const s = runShots(lv, sol.shots); const sum = summary(s); const pos = [...s.world.entries.values()].filter((e) => !e.removed).map((e) => `${e.id}:${e.body.position.x.toFixed(3)},${e.body.position.y.toFixed(3)}`).join('|'); s.dispose(); return { sum, pos }; });
  r.replay = runs[0].sum;
  r.deterministic = runs.every((x) => JSON.stringify(x.sum) === JSON.stringify(runs[0].sum) && x.pos === runs[0].pos);
  r.starThreeOk = r.replay.success && r.replay.shotsUsed <= lv.stars.three;
  // 3) 흔들림: 각 발사에 ±1.5°, ±0.03 (모든 조합 중 첫 발 기준 8방향 + 다발이면 마지막 발 8방향)
  const deltas: [number, number][] = [[-1.5, 0], [1.5, 0], [0, -0.03], [0, 0.03], [-1.5, -0.03], [1.5, 0.03], [-1.5, 0.03], [1.5, -0.03]];
  const variants: ShotInput[][] = [];
  for (const [da, dp] of deltas) variants.push(sol.shots.map((sh, i) => (i === 0 ? { angleDeg: sh.angleDeg + da, power: Math.min(1, Math.max(0.05, sh.power + dp)) } : sh)));
  if (sol.shots.length > 1) for (const [da, dp] of deltas) variants.push(sol.shots.map((sh, i) => (i === sol.shots.length - 1 ? { angleDeg: sh.angleDeg + da, power: Math.min(1, Math.max(0.05, sh.power + dp)) } : sh)));
  let ok = 0;
  for (const v of variants) { const s = runShots(lv, v); if (s.state === 'success') ok++; s.dispose(); }
  r.perturb = { total: variants.length, ok };
  // 4) 실패 입력: 약한 빗나감, 정반대 각도, (보호물이 있으면) 상자 방향 낮은 발사
  const failCandidates: [string, ShotInput[]][] = [['약한 발사 10°/0.3', [{ angleDeg: 10, power: 0.3 }]], ['수직 발사 88°/0.5', [{ angleDeg: 88, power: 0.5 }]]];
  if (lv.protects?.length) failCandidates.push(['보호상자 방향 낮은 발사 5°/0.6', [{ angleDeg: 5, power: 0.6 }]]);
  for (const [name, shots] of failCandidates) {
    // 남은 탄을 모두 같은 입력으로 사용해 결과를 확정시킨다
    const full = Array.from({ length: lv.shots }, () => shots[0]);
    const s = runShots(lv, full);
    r.failInputs.push({ input: name, state: s.state, reason: s.failReason, goals: s.goalsDone });
    s.dispose();
  }
  r.verified = r.lint.length === 0 && r.versionMatch && r.idleOk && r.replay.success && r.replay.protectsSafe && r.deterministic && r.starThreeOk && r.failInputs.every((f) => f.state !== 'success');
  results.push(r);
  console.log(`${lv.key} ${lv.title}: ${r.verified ? '검증 통과' : '검토 필요'} | 재생 ${r.replay.success ? '성공' : '실패'} ${r.replay.shotsUsed}발 ${r.replay.goals} 별${r.replay.stars} | 흔들림 ${ok}/${variants.length} | 무입력 ${r.idleOk ? 'OK' : 'NG'} | 규칙 ${r.lint.length ? r.lint.join('; ') : 'OK'} | 실패입력 ${r.failInputs.map((f) => `${f.state}`).join(',')}`);
}

mkdirSync('docs', { recursive: true });
const env = { node: process.version, matter: '0.20.0', fixedDt: FIXED_DT, substeps: SUBSTEPS, gravity: GRAVITY_Y, maxSpeed: LAUNCH.maxSpeed, judge: JUDGE, date: new Date().toISOString() };
writeFileSync('docs/level-validation.json', JSON.stringify({ env, results }, null, 2));

const verified = results.filter((r) => r.verified).length;
let md = `# 스테이지 검증 기록 (LEVEL_VALIDATION)\n\n`;
md += `생성: ${env.date} · Node ${env.node} · matter-js ${env.matter} · 고정 스텝 ${FIXED_DT.toFixed(5)}s × ${SUBSTEPS}회 · 중력 ${GRAVITY_Y} · 최대 발사 속도 ${LAUNCH.maxSpeed}px/s\n\n`;
md += `이 문서는 \`npm run validate\`(scripts/validate-levels.ts)가 실제 물리 재생으로 생성한다. 손으로 고치지 말 것.\n\n`;
md += `**검증 통과 ${verified}/${results.length}** (통과 기준: 데이터 규칙 OK, 해법 버전 일치, 무입력 8초 동안 변화 없음, 해법 재생 성공, 보호물 안전, 3회 재생 결과 동일, 별 3 기준 충족, 실패 입력이 성공하지 않음)\n\n`;
md += `판정 기준: 넘어뜨리기 = 초기 자세 대비 ${JUDGE.toppleAngleDeg}° 이상 기울고 중심 이동(또는 높이의 ${JUDGE.toppleFallRatio}배 낙하), ${JUDGE.holdSteps}스텝(0.3초) 유지. 떨어뜨리기 = 중심이 구역 안에 ${JUDGE.holdSteps}스텝 유지(구역을 지나 월드 밖으로 사라져도 인정). 보호상자 = 발사체 직접 접촉 또는 중심의 안전 구역 이탈 시 실패. 흔들림 검사 = 각 발사에 ±1.5°, ±0.03 세기 조합 8가지.\n\n`;
md += `| # | 스테이지 | 버전 | 핵심 원리 | 검증 입력 | 사용 탄 | 목표 | 보호물 | 별 | 3회 재생 동일 | 흔들림 성공 | 무입력 안정 | 실패 입력 | 상태 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results) {
  const sol = SOLUTIONS[r.key];
  const shots = sol ? sol.shots.map((s) => `${s.angleDeg}°/${Math.round(s.power * 100)}%`).join(' → ') : '-';
  const fails = r.failInputs.map((f) => `${f.input.split(' ')[0]}:${f.state === 'failed' ? '실패(' + (f.reason ?? '') + ')' : f.state}`).join('<br>');
  md += `| ${r.id} | ${r.title} | v${r.version}${r.versionMatch ? '' : ' (해법 v' + r.solutionVersion + ' 불일치)'} | ${sol?.note ?? '-'} | ${shots} | ${r.replay?.shotsUsed ?? '-'} | ${r.replay?.goals ?? '-'} | ${r.replay ? (r.replay.protectsSafe ? '안전' : '실패') : '-'} | ${r.replay?.stars ?? '-'} | ${r.deterministic ? '예' : '아니오'} | ${r.perturb.ok}/${r.perturb.total} | ${r.idleOk ? '예' : '아니오 (' + r.idleDetail + ')'} | ${fails} | ${r.verified ? '✅ 검증' : '⚠️ 미검증'} |\n`;
}
md += `\n## 미검증·주의 항목\n\n`;
const issues = results.filter((r) => !r.verified || r.perturb.ok < r.perturb.total * 0.6 || r.lint.length);
if (!issues.length) md += `- 없음\n`;
for (const r of issues) {
  md += `- **${r.id}. ${r.title}**: ${r.verified ? '' : '검증 미통과. '}${r.lint.length ? '규칙: ' + r.lint.join('; ') + '. ' : ''}${!r.idleOk ? '무입력 불안정(' + r.idleDetail + '). ' : ''}${r.replay && !r.replay.success ? '해법 재생 실패(' + (r.replay.failReason ?? '') + '). ' : ''}${r.perturb.ok < r.perturb.total * 0.6 ? `흔들림 성공률 낮음 ${r.perturb.ok}/${r.perturb.total} → 해법 여유가 좁다. ` : ''}${r.failInputs.some((f) => f.state === 'success') ? '실패 입력이 성공함(자동 성공 의심). ' : ''}\n`;
}
md += `\n## 검증하지 않은 것\n\n- 사람이 느끼는 재미·난이도(자동 재생만으로는 검증 불가).\n- 실제 휴대폰 기기에서의 재생(여기서는 Node.js 헤드리스 재생 + Chromium 모바일 뷰포트).\n- 다른 브라우저 엔진(Safari/JavaScriptCore)에서의 비트 단위 동일성. 흔들림 검사로 여유를 확인할 뿐이다.\n`;
writeFileSync('docs/LEVEL_VALIDATION.md', md);
console.log(`\n검증 통과 ${verified}/${results.length} → docs/LEVEL_VALIDATION.md`);
