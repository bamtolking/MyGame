// 스테이지 데이터 규칙 검사(코드 실행 없이 데이터만 본다).
import type { LevelDef } from './types';
import { WORLD_W, WORLD_H, GROUND_Y } from '../data/physics';
import { SOLUTIONS } from '../data/solutions';

export const MIN_THICKNESS = 22; // 이보다 얇은 블록은 최대 속도 발사체가 관통할 수 있음(실험으로 확인)

export function lintLevel(lv: LevelDef): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const b of lv.bodies) {
    if (ids.has(b.id)) out.push(`중복 id ${b.id}`);
    ids.add(b.id);
    if (b.kind === 'block') {
      if (Math.min(b.w, b.h) < MIN_THICKNESS) out.push(`${b.id}: 두께 ${Math.min(b.w, b.h)} < ${MIN_THICKNESS}`);
      if (b.x - b.w / 2 < -20 || b.x + b.w / 2 > WORLD_W + 20 || b.y - b.h / 2 < 0) out.push(`${b.id}: 화면 밖 배치`);
      if (!b.static && !b.angle && b.y + b.h / 2 > GROUND_Y + 1 && !(lv.ground?.length)) out.push(`${b.id}: 바닥 아래 배치`);
    }
    if (b.kind === 'ball' && (b.r < 11 || b.x < 0 || b.x > WORLD_W)) out.push(`${b.id}: 공 크기/위치 이상`);
  }
  for (const r of lv.ropes ?? []) { if (ids.has(r.id)) out.push(`밧줄 id가 물체 id와 겹침 ${r.id}`); if (r.a.body && !ids.has(r.a.body)) out.push(`밧줄 ${r.id}: 없는 물체 ${r.a.body}`); if (r.b.body && !ids.has(r.b.body)) out.push(`밧줄 ${r.id}: 없는 물체 ${r.b.body}`); if (!r.a.body && !r.b.body) out.push(`밧줄 ${r.id}: 양쪽 모두 고정점`); }
  for (const h of lv.hinges ?? []) { if (!ids.has(h.body)) out.push(`힌지 ${h.id}: 없는 물체 ${h.body}`); const b = lv.bodies.find((x) => x.id === h.body); if (b && b.kind === 'block' && b.static) out.push(`힌지 ${h.id}: 정적 물체`); }
  if (lv.goals.length === 0) out.push('목표 없음');
  for (const g of lv.goals) { if (!ids.has(g.body)) out.push(`목표: 없는 물체 ${g.body}`); if (g.judge === 'drop' && !g.zone) out.push(`목표 ${g.body}: 낙하 구역 없음`); const b = lv.bodies.find((x) => x.id === g.body); if (b && 'role' in b && b.role !== 'target') out.push(`목표 ${g.body}: role이 target이 아님`); if (b && 'static' in b && b.static) out.push(`목표 ${g.body}: 정적`); }
  for (const p of lv.protects ?? []) { if (!ids.has(p.body)) out.push(`보호물: 없는 물체 ${p.body}`); const b = lv.bodies.find((x) => x.id === p.body); if (b && 'role' in b && b.role !== 'protect') out.push(`보호물 ${p.body}: role이 protect가 아님`); if (b && b.kind === 'block' && !(b.x >= p.safeZone.x && b.x <= p.safeZone.x + p.safeZone.w && b.y >= p.safeZone.y && b.y <= p.safeZone.y + p.safeZone.h)) out.push(`보호물 ${p.body}: 시작 위치가 안전 구역 밖`); }
  if (lv.shots < 1 || lv.shots > 3) out.push('탄 수는 1~3');
  if (lv.stars.three > lv.stars.two || lv.stars.two > lv.shots) out.push('별 기준 이상');
  if (lv.hints.length < 2) out.push('힌트 2단계 필요');
  if (!SOLUTIONS[lv.solutionRef]) out.push('해법 기록 없음');
  if (lv.launcher.x < 0 || lv.launcher.y > WORLD_H) out.push('발사대 위치 이상');
  return out;
}
