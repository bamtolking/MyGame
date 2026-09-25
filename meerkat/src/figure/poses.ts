/**
 * 자주 쓰는 기본 자세 (운동 애니메이션 작성용)
 * 규칙은 rig.ts 상단 주석 참고.
 */
import { both, type Pose } from './rig';

/** 두 자세 합치기 (뒤쪽이 우선) */
export function merge(...ps: Pose[]): Pose {
  const out: any = {};
  for (const p of ps) {
    for (const [k, v] of Object.entries(p)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = { ...(out[k] ?? {}), ...v };
      else out[k] = v;
    }
  }
  return out;
}

/** 편하게 선 자세 */
export const STAND: Pose = both({ sh: { abd: 6 }, el: 8 });

/** 의자에 앉아 손을 허벅지에 */
export const SIT: Pose = merge(both({ hip: { flex: 88, abd: 6 }, kn: 88, sh: { flex: 8, abd: 8 }, el: 58, an: 2 }), { lumbar: { flex: 2 } });

/** 무릎 세우고 바로 누운 자세 (훅 라잉) */
export const HOOK: Pose = merge({ root: { pitch: -90 } }, both({ hip: { flex: 55 }, kn: 105, an: 10, sh: { abd: 14 }, el: 4 }));

/** 다리 펴고 바로 누운 자세 */
export const SUPINE: Pose = merge({ root: { pitch: -90 } }, both({ sh: { abd: 12 }, el: 4, an: -20 }));

/** 엎드린 자세 */
export const PRONE: Pose = merge({ root: { pitch: 90 } }, both({ sh: { abd: 14 }, el: 4, an: -70 }), { neck: { flex: 8 } });

/** 네발 기기 자세 (손목 어깨 아래, 무릎 골반 아래) */
export const QUAD: Pose = merge({ root: { pitch: 80 } }, both({ hip: { flex: 80 }, kn: 90, sh: { flex: 80 }, wr: 90, an: -70 }), { neck: { flex: -12 } });

/** 왼쪽으로 옆으로 누운 자세 (무릎 45°) */
export const SIDE_LYING: Pose = merge({ root: { roll: 90 } }, both({ hip: { flex: 45 }, kn: 90 }), {
  shL: { flex: 165 },
  elL: 110,
  shR: { flex: 60 },
  elR: 20,
  neck: { side: -6 },
});

/** 오른무릎을 바닥에 댄 하프 닐링 */
export const HALF_KNEEL: Pose = merge({ hipL: { flex: 90 }, knL: 90, anL: 0, hipR: { flex: -8 }, knR: 92, anR: -60 }, both({ sh: { abd: 8 }, el: 10 }));

/** 벽에 등을 기대고 선 자세 */
export const WALL: Pose = merge(STAND, { head: { flex: 2 } });
