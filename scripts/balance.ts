// npm run balance — 봇 정책 × 시드 스윕 (node로 직접 실행)
import { runBot, type Policy } from '../tests/bot.ts';
const policies: Policy[] = (process.argv[2] ? process.argv[2].split(',') : ['greedy', 'balanced', 'upgrade', 'idle']) as Policy[];
const seeds = process.argv[3] ? Number(process.argv[3]) : 6;
const rows: string[] = [];
for (const p of policies) {
  const rs = []; for (let seed = 1; seed <= seeds; seed++) rs.push(runBot(seed, p));
  const avg = (rs.reduce((a, r) => a + r.round, 0) / rs.length).toFixed(1);
  const wins = rs.filter(r => r.won).length;
  const line = `${p.padEnd(9)} avgRound=${avg} wins=${wins}/${rs.length} rounds=[${rs.map(r => r.round).join(',')}] peak=[${rs.map(r => r.peak).join(',')}] mythics=[${rs.map(r => r.crafts).join(',')}] firstHero=[${rs.map(r => r.firstHero).join(',')}] firstLegend=[${rs.map(r => r.firstLegend).join(',')}] firstMythic=[${rs.map(r => r.firstMythic).join(',')}] summons=[${rs.map(r => r.summons).join(',')}] reasons=[${rs.map(r => r.reason.slice(0, 6)).join(',')}]`;
  console.log(line); rows.push(line);
}
