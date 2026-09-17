/** Post-match analysis: evidence-based improvement tips from the match log. */
import { unitDef } from '../data/units.ts';
import type { MatchState, Player } from './state.ts';

export interface Tip { text: string; }

function waveValueBy(p: Player, pred: (id: string) => boolean, fromT: number, toT: number): number {
  let v = 0;
  for (const w of p.waves) {
    if (w.t < fromT || w.t >= toT) continue;
    for (const [id, n] of Object.entries(w.counts)) if (pred(id)) v += unitDef(id).cost * n;
  }
  return v;
}
function fmt(t: number) { return `${Math.floor(t / 60)}분`; }

export function analyze(s: MatchState, me: number): Tip[] {
  const p = s.players[me];
  const enemies = s.players.filter((q) => q.team !== p.team);
  const tips: Tip[] = [];
  const endT = s.result ? s.result.t : s.t;
  const windows: [number, number][] = [];
  for (let t = 0; t < endT; t += 180) windows.push([t, Math.min(endT, t + 180)]);
  const isAir = (id: string) => unitDef(id).layer === 'air';
  const isAA = (id: string) => unitDef(id).roles.includes('antiair');
  const isSoftAA = (id: string) => { const d = unitDef(id); return !!d.weapon && d.weapon.targets === 'both' && !d.roles.includes('antiair'); };
  const isLight = (id: string) => unitDef(id).armorTags.includes('light');
  const isAoe = (id: string) => unitDef(id).roles.includes('aoe');
  const isArmored = (id: string) => unitDef(id).armorTags.includes('armored');
  const isAntiArmor = (id: string) => unitDef(id).roles.includes('antiarmor');
  const isFlank = (id: string) => unitDef(id).roles.includes('flanker');

  // 1. air vs AA
  for (const [a, b] of windows) {
    const eAir = enemies.reduce((v, e) => v + waveValueBy(e, isAir, a, b), 0);
    const myAA = waveValueBy(p, isAA, a, b) + 0.4 * waveValueBy(p, isSoftAA, a, b);
    if (eAir >= 500 && myAA < eAir * 0.35) { tips.push({ text: `${fmt(a)}~${fmt(b)} 구간에 적 항공 병력(${Math.round(eAir)} 크레딧)이 많았지만 대공 투자는 ${Math.round(myAA)}에 그쳤습니다. 요격 병종을 보강해 보세요.` }); break; }
  }
  // 2. enemy AoE vs my light swarm
  for (const [a, b] of windows) {
    const eAoe = enemies.reduce((v, e) => v + waveValueBy(e, isAoe, a, b), 0);
    const myLight = waveValueBy(p, isLight, a, b);
    const myTotal = waveValueBy(p, () => true, a, b);
    if (eAoe >= 400 && myTotal > 0 && myLight / myTotal > 0.7) { tips.push({ text: `${fmt(a)}~${fmt(b)} 구간에 적 광역 병종이 많았는데 아군 편성의 ${Math.round((myLight / myTotal) * 100)}%가 소형 병력이었습니다. 편성을 위아래로 분산하거나 중장갑을 섞어 보세요.` }); break; }
  }
  // 3. enemy armor vs my anti-armor
  for (const [a, b] of windows) {
    const eArm = enemies.reduce((v, e) => v + waveValueBy(e, isArmored, a, b), 0);
    const myAA = waveValueBy(p, isAntiArmor, a, b);
    if (eArm >= 600 && myAA < eArm * 0.25) { tips.push({ text: `${fmt(a)}~${fmt(b)} 구간에 적 중장갑(${Math.round(eArm)} 크레딧) 대비 대장갑 병종 투자가 ${Math.round(myAA)}로 적었습니다.` }); break; }
  }
  // 4. rear units lost to flankers
  const eFlank = enemies.reduce((v, e) => v + waveValueBy(e, isFlank, 0, endT), 0);
  const st = s.stats[me].byType;
  let rearDeaths = 0;
  for (const [id, v] of Object.entries(st)) { const d = unitDef(id); if (d.behavior === 'artillery' || d.behavior === 'support') rearDeaths += v.deaths; }
  if (eFlank >= 300 && rearDeaths >= 3) tips.push({ text: `적 측면 병력이 출격하는 동안 후방 포병·지원 병력이 ${rearDeaths}회 손실됐습니다. 편성판 뒤쪽 가장자리 행에 경계 병력을 두어 보세요.` });
  // 5. economy
  if (endT > 360 && p.econLevel === 0) tips.push({ text: `경기 내내 경제 연구를 하지 않았습니다. 초반 4분 이내의 연구는 대부분 회수됩니다.` });
  else if (endT > 300 && p.econLevel >= 5 && s.result && s.result.winner !== p.team) {
    const early = waveValueBy(p, () => true, 0, 150);
    const eEarly = enemies.reduce((v, e) => v + waveValueBy(e, () => true, 0, 150), 0) / Math.max(1, enemies.length);
    if (early < eEarly * 0.7) tips.push({ text: `초반 2.5분 병력 투자(${Math.round(early)})가 상대(${Math.round(eEarly)})보다 적었습니다. 경제 연구를 조금 늦추고 전열을 먼저 세워 보세요.` });
  }
  // 6. unused cannon
  if (s.result && s.result.winner !== p.team && !s.cannon[p.team].used) tips.push({ text: '비상 방어포를 사용하지 않았습니다. 적 대군이 기지 근처에 몰렸을 때 한 번 쓸 수 있습니다.' });
  // 7. front-line share
  let tankPop = 0, totalPop = 0;
  for (const w of p.waves.slice(-3)) for (const [id, n] of Object.entries(w.counts)) { const d = unitDef(id); totalPop += d.pop * n; if (d.roles.includes('tank')) tankPop += d.pop * n; }
  if (totalPop > 20 && tankPop / totalPop < 0.15) tips.push({ text: `최근 출격 편성의 전열(방어 병종) 비중이 ${Math.round((tankPop / totalPop) * 100)}%였습니다. 원거리 병력을 보호할 앞열을 늘려 보세요.` });
  return tips.slice(0, 3);
}
