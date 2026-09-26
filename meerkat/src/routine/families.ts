/**
 * 비슷한 동작 묶음 — 한 루틴에는 같은 묶음에서 하나만 넣어요.
 * (예: 4자 스트레칭과 누워서 엉덩이 늘리기는 같은 근육을 거의 같은 방식으로 늘려요)
 * 날마다 묶음 안에서 돌아가며 골라지니 루틴이 덜 지루하고, 짧은 시간에 더 많은 부위를 챙겨요.
 * 여기에 없는 운동은 혼자서 한 묶음이에요.
 */
export const FAMILY_GROUPS: Record<string, string[]> = {
  'deep-neck-flexor': ['chin-tuck', 'wall-chin-tuck', 'chin-tuck-rotation', 'supine-chin-lift'],
  'neck-isometric': ['neck-isometric-side', 'neck-isometric-front'],
  'side-neck-stretch': ['upper-trap-stretch', 'levator-stretch'],
  'prone-scap': ['prone-y-raise', 'prone-t-raise', 'prone-w-raise', 'prone-swimmer', 'prone-cobra'],
  angel: ['wall-angel', 'floor-angel'],
  retraction: ['scap-squeeze', 'band-pull-apart'],
  'external-rotation': ['sidelying-external-rotation', 'band-external-rotation'],
  serratus: ['wall-slide-serratus', 'wall-pushup-plus'],
  'pec-stretch': ['chest-opener', 'wall-pec-stretch'],
  'posterior-shoulder': ['sleeper-stretch', 'cross-body-stretch'],
  'tspine-extension': ['chair-tspine-extension', 'foam-roller-tspine'],
  'tspine-rotation': ['open-book', 'thread-needle', 'quadruped-tspine-rotation', 'seated-twist'],
  'side-bend': ['seated-side-reach', 'standing-side-bend'],
  'prone-extension': ['sphinx-extension', 'prone-press-up', 'standing-back-extension'],
  'lumbar-flexion': ['child-pose', 'knee-to-chest', 'seated-flexion-stretch', 'quadruped-rock-back'],
  breath: ['breath-360', 'breath-9090', 'crocodile-breath', 'box-breath'],
  'dead-bug': ['dead-bug', 'heel-slide'],
  plank: ['forearm-plank', 'bear-hold'],
  'side-plank': ['side-plank-knee', 'side-plank'],
  bridge: ['glute-bridge', 'single-leg-bridge', 'marching-bridge'],
  'hip-abduction': ['clamshell', 'side-lying-abduction', 'standing-abduction', 'fire-hydrant'],
  'hip-flexor-stretch': ['half-kneel-hip-flexor', 'standing-hip-flexor'],
  'glute-stretch': ['figure4-stretch', 'supine-piriformis'],
  adductor: ['butterfly', 'adductor-rockback'],
  'hip-mobility': ['hip-9090-switch', 'standing-hip-circle'],
  squat: ['squat', 'sit-to-stand', 'wall-sit'],
  lunge: ['split-squat', 'reverse-lunge', 'step-up'],
  hinge: ['hip-hinge', 'single-leg-rdl'],
  hamstring: ['seated-hamstring', 'supine-hamstring-towel'],
  'quad-activation': ['straight-leg-raise', 'terminal-knee-extension'],
  'calf-stretch': ['calf-stretch', 'soleus-stretch'],
  'calf-raise': ['calf-raise', 'single-leg-calf-raise'],
  balance: ['single-leg-balance', 'tandem-balance'],
  'wrist-stretch': ['wrist-stretch', 'wrist-extensor-stretch', 'prayer-stretch'],
};

const FAMILY: Record<string, string> = Object.fromEntries(
  Object.entries(FAMILY_GROUPS).flatMap(([family, ids]) => ids.map((id) => [id, family])),
);

/** 운동이 속한 묶음 (없으면 운동 id 자체) */
export function familyOf(id: string): string {
  return FAMILY[id] ?? id;
}
