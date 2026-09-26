// Balance sweep: 10 classes × N seeds of a full play-through (stand-in human follows the story, 6 AI companions).
// Runs in parallel child processes and writes docs/balance-results.md.   Usage: node scripts/balance.ts [minutes] [seeds]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import type { SimResult } from '../tests/sim.ts';
import { CLASSES, CLASS_IDS } from '../src/shared/data/classes.ts';
const MIN = Number(process.argv[2] ?? 180), SEEDS = Number(process.argv[3] ?? 2);
const jobs: [string, number][] = []; for (const cls of CLASS_IDS) for (let s = 1; s <= SEEDS; s++) jobs.push([cls, s]);
const results: SimResult[] = []; let running = 0; const par = Math.max(1, Math.min(jobs.length, cpus().length));
const t0 = Date.now();
await new Promise<void>(done => {
  const next = () => {
    if (!jobs.length && !running) return done();
    while (running < par && jobs.length) {
      const [cls, seed] = jobs.shift()!; running++;
      const p = spawn(process.execPath, ['tests/balance-run.ts', cls, String(seed), String(MIN)]); let out = '';
      p.stdout.on('data', d => (out += d)); p.stderr.on('data', d => process.stderr.write(d));
      p.on('exit', () => { running--; try { const r = JSON.parse(out.trim().split('\n').pop()!); results.push(r); console.log(`${cls}#${seed}: Lv${r.finalLevel} deaths ${r.deaths} quest ${r.questAt[MIN]}`); } catch { console.error('run failed', cls, seed); } next(); });
    }
  };
  next();
});
results.sort((a, b) => CLASS_IDS.indexOf(a.cls) - CLASS_IDS.indexOf(b.cls) || a.seed - b.seed);
const marks = [5, 10, 20, 30, 45, 60, 90, 120, 150, 180].filter(m => m <= MIN);
const firstAt = (r: SimResult, lv: number) => { const e = Object.entries(r.levelAt).find(([, l]) => l >= lv); return e ? `${e[0]}분` : '-'; };
const cn: Record<string, string> = Object.fromEntries(CLASS_IDS.map(c => [c, CLASSES[c].name]));
let md = `# 밸런스 스윕 결과\n\n생성: ${new Date().toISOString().slice(0, 16)} · \`node scripts/balance.ts ${MIN} ${SEEDS}\` · 실행 시간 ${Math.round((Date.now() - t0) / 1000)}초\n\n`;
md += `조건: 오프라인 월드와 동일(AI 동료 6명, 핏빛 달 7분 간격). 모든 직업을 레벨 1부터 플레이합니다(실제 게임에서는 해금 후 전직). "사람" 역할은 이야기(퀘스트)를 따라가는 AI가 대신 플레이하며, 장비 장착·합성·강화를 스스로 합니다. **사람 플레이 데이터가 아니므로** 실제 체감과 차이가 있을 수 있습니다.\n\n`;
md += `## 레벨 진행 (분 → 레벨)\n\n| 직업 | 시드 | ${marks.map(m => `${m}분`).join(' | ')} | Lv10 도달 | Lv20 도달 | Lv30 도달 |\n|---|---|${marks.map(() => '---').join('|')}|---|---|---|\n`;
for (const r of results) md += `| ${cn[r.cls]} | ${r.seed} | ${marks.map(m => r.levelAt[m] ?? '-').join(' | ')} | ${firstAt(r, 10)} | ${firstAt(r, 20)} | ${firstAt(r, 30)} |\n`;
md += `\n## 이야기·전투·경제\n\n| 직업 | 시드 | 이야기 진행(${MIN}분) | 첫 보스 처치 | 처치 수 | 쓰러짐 | 쓰러짐 주원인 | 불가사리 성공 | 누적 금화 | 전설 획득 | 전투력 |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results) md += `| ${cn[r.cls]} | ${r.seed} | ${r.questAt[MIN] ?? '-'}/19 | ${r.firstBossMin ?? '-'}분 | ${r.kills.toLocaleString()} | ${r.deaths} | ${r.deathsBy.slice(0, 3).map(([k, n]) => `${k} ${n}`).join(', ')} | ${r.wbWins}/${r.wbTries} | ${r.gold.toLocaleString()} | ${r.legend} | ${r.power.toLocaleString()} |\n`;
md += `\n## 서버 비용\n\n| 직업 | 시드 | 채널 틱 평균(ms, 7명) | 클라이언트 수신량(B/s) |\n|---|---|---|---|\n`;
for (const r of results) md += `| ${cn[r.cls]} | ${r.seed} | ${r.tickMs} | ${r.bytesPerSec.toLocaleString()} |\n`;
writeFileSync('docs/balance-results.md', md); console.log('docs/balance-results.md written');
