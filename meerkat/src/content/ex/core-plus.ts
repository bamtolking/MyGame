/**
 * 운동 라이브러리 · 호흡·코어 (추가 동작)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { HANDS_ON_HIPS, HOOK, PRONE, QUAD, SIT, STAND, SUPINE, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 이 파일에서 쓰는 자세 조각 ─────────────────────

// 90/90 호흡: 바로 누워 발바닥을 벽에 (엉덩이·무릎 90°), 양손은 아래 갈비뼈 옆
const RIB_HANDS: Pose = both({ sh: { flex: -8, abd: 34, rot: -37 }, el: 130, wr: 28 });
const B90: Pose = merge(SUPINE, both({ hip: { flex: 90, abd: 4 }, kn: 90, an: 0 }), RIB_HANDS, { neck: { flex: 6 } });
const B90_TUCK: Pose = merge(B90, { root: { pitch: -95 }, lumbar: { flex: 5 } }, both({ hip: { flex: 86, abd: 4 } }));
const B90_IN: Pose = merge(B90_TUCK, { thorax: { flex: -4 }, neck: { flex: 9 } }, both({ sh: { flex: -8, abd: 37, rot: -37 }, el: 127, wr: 28 }));
const B90_OUT: Pose = merge(B90_TUCK, { thorax: { flex: 3 }, neck: { flex: 4 } }, both({ sh: { flex: -8, abd: 32, rot: -37 }, el: 132, wr: 28 }));

// 악어 호흡: 엎드려 두 손을 포개 이마 밑에
const CROC: Pose = merge(PRONE, both({ sh: { flex: 37, abd: 147, rot: 103, hab: 26 }, el: 114, wr: 1, an: -70, hip: { abd: 6, rot: 20 } }), {
  neck: { flex: -4 },
  head: { flex: -7 },
});
/** 들숨: 허리(요추 구간)가 1~2cm 솟고 가슴·골반은 바닥에 그대로 */
const CROC_IN: Pose = merge(CROC, { root: { pitch: 85 }, thorax: { flex: 10 }, neck: { flex: -9 } }, both({ hip: { flex: -5, abd: 6, rot: 20 } }));

// 상자 호흡: 바르게 앉아 오른손은 배꼽 위, 왼손은 허벅지 위
const BOX_OUT: Pose = merge(SIT, { neck: { flex: -2 }, head: { flex: 3 }, shR: { flex: 3, abd: 17, rot: -57 }, elR: 90, wrR: 30 });
/** 들숨: 배 위의 손이 1~2cm 앞으로, 갈비뼈가 살짝 올라옴 (어깨는 그대로) */
const BOX_IN: Pose = merge(BOX_OUT, { thorax: { flex: -3 }, neck: { flex: 1 }, shR: { flex: 7, abd: 18, rot: -57 }, elR: 87, wrR: 27 });

// 뒤꿈치 밀기: 무릎 세우고 누워 양손은 골반 앞 뼈 위
const HS_HANDS: Pose = both({ sh: { flex: -8, abd: 28, rot: -54 }, el: 83, wr: -13 });
/** 발바닥이 매트에 평평하게 닿는 무릎 세운 자세 (뒤꿈치 ~ 엉덩이 약 30cm) */
const HS_HOOK: Pose = merge(HOOK, both({ hip: { flex: 42 }, kn: 96, an: -36 }), HS_HANDS);
/** 뒤꿈치를 매트에 댄 채 무릎이 거의 펴질 때까지 */
const HS_R_OUT: Pose = merge(HS_HOOK, { hipR: { flex: 4 }, knR: 14, anR: -16 });
const HS_L_OUT: Pose = merge(HS_HOOK, { hipL: { flex: 4 }, knL: 14, anL: -16 });

// 팔로프 프레스: 무릎 살짝 굽혀 서서 두 손을 명치 앞에 / 정면으로 곧게
const PP_BASE: Pose = merge(STAND, both({ hip: { flex: 10, abd: 8 }, kn: 14, an: 4 }));
const PP_SET: Pose = merge(PP_BASE, both({ sh: { flex: 17, abd: 13, rot: -28, hab: -14 }, el: 134, wr: -35 }));
/** 두 손이 몸 가운데 선에서 만나도록 팔을 살짝 모아(수평 모음 17°) 곧게 */
const PP_PRESS: Pose = merge(PP_BASE, both({ sh: { flex: 86, hab: -17 }, el: 3, wr: -5 }));

// 옆 플랭크: 오른쪽 팔꿈치로 받치고 오른쪽으로 누움 (왼손은 골반 위)
const SIDE_TOP_ARM: Pose = { shL: HANDS_ON_HIPS.shL, elL: HANDS_ON_HIPS.elL };
/** 시작: 골반·다리는 매트에, 몸통을 옆으로 세워 팔꿈치(어깨 바로 아래)로 받침 */
const SPL_DOWN: Pose = merge({ root: { roll: -84 } }, both({ hip: { abd: -3 }, an: 0 }), SIDE_TOP_ARM, {
  lumbar: { side: 21 },
  thorax: { side: 21 },
  shR: { abd: 41 },
  elR: 90,
});
/** 버티기: 팔꿈치와 오른발 바깥 날만 닿고 머리~발목 일직선 */
const SPL_UP: Pose = merge({ root: { roll: -71 } }, both({ hip: { abd: -3 }, an: 0 }), SIDE_TOP_ARM, { shR: { abd: 72 }, elR: 90 });

// 곰 자세: 네발 → 발가락 세우기 → 무릎 들기
// (손·무릎·발끝이 바닥에 닿도록 맞춘 각도: 손목은 어깨 아래, 무릎은 골반 아래)
const BEAR_QUAD: Pose = merge(QUAD, { root: { pitch: 83 }, neck: { flex: -8 } }, both({ hip: { flex: 83 }, kn: 88, an: -61, sh: { flex: 83 }, wr: 90 }));
const BEAR_TOES: Pose = merge(BEAR_QUAD, both({ kn: 111, an: 41 }));
/** 발끝 위치는 그대로, 무릎만 바닥에서 약 2.3 뜸(잘 보이게 실제 2~3cm보다 살짝 크게) · 등은 수평 */
const BEAR_UP: Pose = merge(BEAR_QUAD, { root: { pitch: 88 }, neck: { flex: -6 } }, both({ hip: { flex: 88 }, kn: 105, an: 40, sh: { flex: 88 } }));

export const CORE_PLUS: Exercise[] = [
  // ───────────────────────── 90/90 호흡
  {
    id: 'breath-9090',
    name: { ko: '90/90 호흡', en: '90/90 breathing' },
    phase: 'breath',
    position: 'supine',
    regions: ['core', 'lowBack'],
    targets: { lordosis: 0.8, stress: 0.8, lowBackPain: 0.5, stiffness: 0.3 },
    equipment: ['mat', 'wall'],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 90 },
    setup: {
      ko: [
        '발이 벽 쪽을 향하게 매트에 바로 누워요. 엉덩이는 벽에서 약 50cm 떨어뜨려요.',
        '무릎을 굽혀 두 발바닥을 골반 너비로 벽에 대고, 엉덩이·무릎이 모두 90도가 되게 거리를 맞춰요. 허벅지는 천장을 향해 수직, 정강이는 바닥과 평행이에요.',
        '양손은 아래 갈비뼈 옆에 가볍게 얹고, 뒤통수를 매트에 대요. 턱이 천장으로 들리면 접은 수건(2~3cm)을 머리 밑에 깔아요.',
      ],
      en: [
        'Lie on your back on a mat with your feet toward a wall, hips about 50 cm from it.',
        'Bend your knees and place both soles on the wall hip-width apart, adjusting the distance so hips and knees are both at 90°: thighs vertical, shins parallel to the floor.',
        'Rest your hands lightly on the sides of your lower ribs and the back of your head on the mat. If your chin points up, slide a folded towel (2–3 cm) under your head.',
      ],
    },
    steps: {
      ko: [
        '발뒤꿈치로 벽을 바닥 쪽으로 살짝 끌어내리듯 눌러요(힘 10 중 2~3). 허벅지 뒤쪽이 은은하게 켜지며 골반이 살짝 말리고, 허리와 매트 사이 틈이 줄어들어요.',
        '입으로 숨을 끝까지 내쉬며 갈비뼈를 배꼽 쪽으로 내려요. 여기가 출발점이에요.',
        '코로 4초 동안 들이마셔요. 배만 불룩 내밀지 말고, 손 밑의 옆구리 갈비뼈와 등 뒤쪽까지 360도로 부풀게 해요.',
        '입으로 “후—” 6~8초 동안 길게 내쉬며, 갈비뼈가 아래·안쪽으로 내려가는 것을 손으로 느껴요. 마지막 2초는 아랫배가 살짝 조여질 때까지 내쉬어요.',
        '2~3초 쉬었다가 다시 들이마셔요. 골반 말림은 유지한 채 타이머가 끝날 때까지 반복해요(90초면 약 7회).',
      ],
      en: [
        'Press your heels lightly down the wall toward the floor (2–3/10 effort). The backs of your thighs switch on gently, your pelvis curls slightly and the gap under your low back shrinks.',
        'Breathe all the way out through your mouth, letting your ribs drop toward your belly button. This is your starting point.',
        'Breathe in through your nose for 4 seconds. Don’t just push the belly out — expand 360° into the side ribs under your hands and into your back.',
        'Breathe out through your mouth with a long “hoo” for 6–8 seconds, feeling the ribs move down and in under your hands. Use the last 2 seconds to empty until your lower belly firms slightly.',
        'Pause 2–3 seconds, then breathe in again. Keep the pelvic curl and repeat until the timer ends (about 7 breaths in 90 seconds).',
      ],
    },
    breathing: {
      ko: '코로 4초 들이마시고, 입으로 6~8초 길게 내쉰 뒤 2~3초 멈춰요. 내쉬는 시간이 항상 들이마시는 시간보다 길어야 해요. 어깨와 목은 움직이지 않아요.',
      en: 'In through the nose for 4 seconds, out through the mouth for 6–8 seconds, then pause 2–3 seconds. The exhale is always longer than the inhale. Shoulders and neck stay still.',
    },
    feel: {
      ko: '허벅지 뒤쪽과 아랫배가 은은하게 켜지고, 들이마실 때 옆구리와 등 아래쪽이 매트 쪽으로 퍼지면 정답이에요. 허리 긴장이 스르르 풀리는 느낌도 좋아요. 어지럽거나 손끝이 저리면 평소 호흡으로 돌아가 쉬세요.',
      en: 'The backs of your thighs and your lower belly switch on gently, and your side ribs and lower back spread into the mat as you inhale. Your low back should feel it let go. If you feel dizzy or your fingertips tingle, return to normal breathing and rest.',
    },
    easier: {
      ko: '벽 대신 의자나 소파 위에 종아리를 올려 다리를 완전히 쉬게 하고 호흡만 해요. 골반 말기가 어렵다면 생략하고 긴 날숨에만 집중해도 돼요.',
      en: 'Rest your calves on a chair or sofa instead of the wall so your legs fully relax, and just breathe. If the pelvic curl is hard, skip it and focus on the long exhale.',
    },
    harder: {
      ko: '꼬리뼈를 매트에서 1cm만 떼는 ‘90/90 힙 리프트’로 해 보거나 날숨을 10초까지 늘려요. 익숙해지면 ‘데드버그’로 넘어가요.',
      en: 'Try the 90/90 hip lift — curl your tailbone just 1 cm off the mat — or stretch the exhale to 10 seconds. Then progress to the dead bug.',
    },
    cues: {
      ko: ['뒤꿈치로 벽을 살짝', '코로 4초 들이마셔요', '입으로 길게 후—', '갈비뼈를 내려요'],
      en: ['Heels press the wall lightly', 'In through the nose for four', 'Long breath out', 'Let your ribs drop'],
    },
    mistakes: {
      ko: [
        '허리가 젖혀져 매트에서 크게 뜸 → 발뒤꿈치로 벽을 살짝 끌어내려 골반을 말고, 허리와 매트 사이 틈을 줄여요.',
        '가슴과 어깨가 들썩이며 숨 쉼 → 손을 옆구리 갈비뼈에 두고, 그 손을 옆과 뒤로 밀어내듯 들이마셔요.',
        '발로 벽을 세게 밀어 몸이 머리 쪽으로 밀려남 → 벽을 앞으로 미는 대신 뒤꿈치를 벽에 대고 바닥 쪽으로 살짝 끌어내려요.',
        '짧게 내쉬고 바로 들이마심 → 날숨을 6초 이상 끝까지 내쉬고, 2~3초 멈춘 뒤 들이마셔요.',
      ],
      en: [
        'Low back arching high off the mat → Draw your heels down the wall to curl the pelvis and close the gap under your back.',
        'Chest and shoulders heaving → Keep your hands on your side ribs and breathe in as if pushing them out sideways and back.',
        'Pushing the wall so hard you slide toward your head → Instead of pushing forward, hook your heels on the wall and draw them gently toward the floor.',
        'Short exhale, quick inhale → Breathe out fully for at least 6 seconds and pause 2–3 seconds before the next breath.',
      ],
    },
    why: {
      ko: '허리가 과하게 젖혀지고 갈비뼈가 들린 자세에서는 횡격막이 제 역할을 못 하고 허리 근육이 늘 긴장해요. 다리를 90/90으로 받쳐 골반을 살짝 말고 길게 내쉬면 갈비뼈가 내려오고 복부가 깨어나, 허리 곡선이 편안한 위치로 돌아오는 데 도움이 돼요.',
      en: 'With an over-arched low back and flared ribs, the diaphragm can’t do its job and the back muscles stay switched on. Supporting the legs at 90/90, curling the pelvis slightly and exhaling fully brings the ribs down and wakes the abs, helping your low back settle into a comfortable curve.',
    },
    muscles: { ko: '횡격막, 복횡근·내복사근, 햄스트링(가볍게)', en: 'Diaphragm, transversus abdominis and internal obliques, hamstrings (lightly)' },
    caution: {
      ko: '호흡 중 어지럽거나 손끝이 저리면 평소 호흡으로 돌아가 쉬세요. 허벅지 뒤쪽에 쥐가 나면 누르는 힘을 줄여요.',
      en: 'If you feel dizzy or your fingertips tingle, go back to normal breathing and rest. If the backs of your thighs cramp, press more lightly.',
    },
    anim: {
      view: 90,
      elev: 14,
      zoom: 1.1,
      props: [{ kind: 'mat' }, { kind: 'wall', wall: 'front', dist: 0 }],
      anchor: ['pelvis'],
      // 재생 시간 = 실제 호흡 박자 (쉬기 2초 → 들숨 4초 → 날숨 7초)
      keys: [B90_OUT, B90_IN, B90_OUT],
      labels: [
        { ko: '벽 누른 채 2초 쉬기', en: 'Heels on wall, pause 2 s' },
        { ko: '코로 4초 들이마시기', en: 'Inhale 4 s, ribs widen' },
        { ko: '입으로 6~8초 내쉬기', en: 'Exhale 6–8 s, ribs drop' },
      ],
      durations: [4, 7, 0.1],
      pauses: [2, 0.3, 0],
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.6 },
        { a: 'hipR', b: 'knR', side: 'back', kind: 'work', from: 0.2, to: 0.8, r: 2.2 },
        { a: 'backMid', b: 'pelvis', side: 'back', kind: 'stretch', r: 2.4 },
      ],
    },
  },

  // ───────────────────────── 악어 호흡
  {
    id: 'crocodile-breath',
    name: { ko: '악어 호흡', en: 'Crocodile breathing' },
    phase: 'breath',
    position: 'prone',
    regions: ['core', 'lowBack'],
    targets: { stress: 0.9, lowBackPain: 0.5, stiffness: 0.4, neckPain: 0.3, lordosis: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 90 },
    setup: {
      ko: [
        '매트에 엎드려 두 다리를 골반 너비로 편하게 벌리고, 발끝은 바깥으로 툭 떨어뜨려요.',
        '두 손을 포개 손등 위에 이마를 올려요. 팔꿈치는 어깨보다 약간 위, 옆으로 벌려 바닥에 내려놓아요.',
        '코끝이 바닥을 향하고 뒷목이 길게 펴지게 해요. 이마가 불편하면 접은 수건을 손 위에 깔아요.',
      ],
      en: [
        'Lie face down on a mat, legs relaxed hip-width apart and toes falling outward.',
        'Stack your hands and rest your forehead on the backs of them. Let your elbows rest on the floor out to the sides, a little above shoulder level.',
        'Point your nose at the floor so the back of your neck is long. If your forehead is uncomfortable, put a folded towel on your hands.',
      ],
    },
    steps: {
      ko: [
        '입으로 한 번 편하게 내쉬며 어깨·엉덩이·다리 힘을 모두 빼고 바닥에 몸을 맡겨요.',
        '코로 4초 동안 천천히 들이마셔요. 배가 바닥을 누르고, 그 힘에 밀려 허리와 옆구리가 천장 쪽으로 부풀어 올라요.',
        '허리 위에 작은 쿠션이 얹혀 있다고 상상하고, 그 쿠션이 1~2cm 들렸다 내려가는 것을 느껴요.',
        '입으로 6초 동안 길게 내쉬며 허리와 옆구리가 다시 바닥 쪽으로 가라앉게 해요.',
        '2초 쉬었다가 다시 들이마셔요. 타이머가 끝날 때까지 반복해요(90초면 약 7회).',
      ],
      en: [
        'Breathe out once through your mouth and let your shoulders, glutes and legs go heavy on the floor.',
        'Breathe in slowly through your nose for 4 seconds. Your belly presses into the floor, and that pushes your low back and sides up toward the ceiling.',
        'Imagine a small cushion resting on your low back and feel it rise and fall 1–2 cm.',
        'Breathe out through your mouth for 6 seconds, letting your low back and sides sink back down.',
        'Pause 2 seconds, then breathe in again. Repeat until the timer ends (about 7 breaths in 90 seconds).',
      ],
    },
    breathing: {
      ko: '코로 4초 들이마시고, 입으로 6초 길게 내쉰 뒤 2초 쉬어요. 들이마실 때 배는 바닥을, 허리는 천장을 향해 부풀어요. 어깨와 목은 들썩이지 않아요.',
      en: 'In through the nose for 4 seconds, out through the mouth for 6, then rest 2. As you inhale, the belly spreads into the floor and the low back rises toward the ceiling. Shoulders and neck stay quiet.',
    },
    feel: {
      ko: '들이마실 때 배가 바닥을 누르고 허리·옆구리가 위로 부풀면 정답이에요. 몇 번 지나면 몸이 바닥으로 녹아내리듯 편안해져요. 허리가 아프거나 다리가 저리면 배 밑에 얇은 베개를 받치거나 멈추세요.',
      en: 'Your belly presses into the floor and your low back and sides rise as you inhale. After a few breaths your body should feel like it’s melting into the floor. If your back hurts or your legs tingle, put a thin pillow under your belly or stop.',
    },
    easier: {
      ko: '배 밑에 얇은 베개를 받치면 허리가 편해요. 엎드리기 힘들면 ‘90/90 호흡’이나 앉아서 하는 ‘360° 복식 호흡’으로 바꿔요.',
      en: 'A thin pillow under your belly makes the low back more comfortable. If lying face down is hard, switch to 90/90 breathing or seated 360° breathing.',
    },
    harder: {
      ko: '날숨을 8초까지 늘리고 120초 동안 해요. 익숙해지면 ‘아기 자세’에서 등 뒤로 숨을 보내는 연습으로 넘어가요.',
      en: 'Lengthen the exhale to 8 seconds and go for 120 seconds. Then practise sending your breath into your back in child’s pose.',
    },
    cues: {
      ko: ['이마는 손등 위에', '허리로 숨을 채워요', '배는 바닥을 눌러요', '길게 내쉬며 녹아요'],
      en: ['Forehead on your hands', 'Fill your low back', 'Belly into the floor', 'Long exhale, melt down'],
    },
    mistakes: {
      ko: [
        '어깨와 목이 들썩이며 숨 쉼 → 팔꿈치를 바닥에 무겁게 내려놓고, 숨을 허리 쪽으로 보낸다고 생각해요.',
        '허리를 일부러 젖히거나 엉덩이에 힘을 줌 → 근육으로 들어 올리지 말고, 숨이 들어와서 저절로 부풀게 둬요.',
        '고개를 한쪽으로 돌려 목이 비틀림 → 이마를 손등에 대고 코끝이 바닥을 향하게 해요.',
        '숨을 빠르게 몰아쉼 → 4초 들이마시고 6초 내쉬는 속도를 지켜요.',
      ],
      en: [
        'Shoulders and neck heaving → Let your elbows rest heavily on the floor and think of sending the breath to your low back.',
        'Arching on purpose or squeezing the glutes → Don’t lift with muscles; let the incoming breath do the rising.',
        'Turning your head so the neck twists → Keep your forehead on your hands with your nose pointing down.',
        'Breathing fast → Keep to 4 seconds in and 6 seconds out.',
      ],
    },
    why: {
      ko: '엎드리면 바닥이 배가 앞으로 나가는 것을 막아 주기 때문에, 숨이 자연스럽게 옆구리와 등 아래쪽으로 들어가요. 가슴·목으로 얕게 쉬는 습관을 줄이고 허리 주변 긴장을 풀어, 긴장된 날 몸을 차분하게 가라앉히는 데 좋아요.',
      en: 'Lying face down, the floor stops the belly from pushing forward, so the breath naturally flows into your sides and lower back. It eases the habit of shallow chest-and-neck breathing and relaxes the muscles around the low back — a great way to settle down on a tense day.',
    },
    muscles: { ko: '횡격막(뒤쪽 섬유), 늑간근, 허리 주변 근육 이완(요방형근·척추기립근)', en: 'Diaphragm (rear fibres), intercostals, relaxing the low-back muscles (quadratus lumborum, erector spinae)' },
    caution: {
      ko: '엎드렸을 때 속이 불편하거나 허리가 아프면 바로 자세를 바꾸세요. 임신 중에는 옆으로 누워서 호흡하세요.',
      en: 'If lying face down upsets your stomach or hurts your back, change position straight away. During pregnancy, do your breathing lying on your side instead.',
    },
    avoid: ['pregnant'],
    anim: {
      view: 55,
      elev: 28,
      zoom: 1.1,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      // 재생 시간 = 실제 호흡 박자 (쉬기 2초 → 들숨 4초 → 날숨 6초)
      keys: [CROC, CROC_IN, CROC],
      labels: [
        { ko: '힘 빼고 2초 쉬기', en: 'Relax, pause 2 s' },
        { ko: '허리로 4초 들이마시기', en: 'Inhale 4 s, back rises' },
        { ko: '6초 길게 내쉬기', en: 'Exhale 6 s, sink down' },
      ],
      durations: [4, 6, 0.1],
      pauses: [2, 0.3, 0],
      focus: [{ a: 'backMid', b: 'pelvis', side: 'back', kind: 'stretch', from: 0, to: 1, r: 3.4 }],
    },
  },

  // ───────────────────────── 상자 호흡
  {
    id: 'box-breath',
    name: { ko: '상자 호흡', en: 'Box breathing' },
    phase: 'breath',
    position: 'seated',
    regions: ['core'],
    targets: { stress: 1, neckPain: 0.3, headache: 0.3, stiffness: 0.2 },
    equipment: [],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 96 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 1/3에 앉아 두 발을 골반 너비로 바닥에 평평하게 두고, 무릎은 90도로 해요.',
        '골반을 세워 허리를 곧게 펴고, 어깨를 한 번 으쓱했다가 툭 떨어뜨려 힘을 빼요.',
        '오른손은 배꼽 위에, 왼손은 허벅지 위에 편하게 올려요. 눈은 감거나 1~2m 앞 바닥을 부드럽게 봐요.',
      ],
      en: [
        'Sit on the front third of a chair, feet flat and hip-width apart, knees at 90°.',
        'Stack your pelvis upright so your back is tall; shrug once and let your shoulders drop.',
        'Rest your right hand on your belly button and your left hand on your thigh. Close your eyes or look softly at the floor 1–2 m ahead.',
      ],
    },
    steps: {
      ko: [
        '먼저 입으로 숨을 편하게 끝까지 내쉬어요.',
        '코로 4초 동안 들이마셔요(하나-둘-셋-넷). 배 위의 손이 앞으로 1~2cm 밀려 나오고 갈비뼈가 옆으로 살짝 벌어져요.',
        '숨을 채운 채 4초 멈춰요. 목구멍을 꽉 조이지 말고, 어깨 힘을 뺀 채 부드럽게 멈춰요.',
        '입이나 코로 4초 동안 고르게 내쉬어요. 배 위의 손이 제자리로 들어가요.',
        '숨을 비운 채 4초 멈춰요. 여기까지가 상자 한 바퀴(16초)예요.',
        '타이머가 끝날 때까지 상자를 반복해요(6바퀴 ≈ 1분 36초). 숨이 차면 3초씩으로 줄여도 돼요.',
      ],
      en: [
        'First, breathe out comfortably through your mouth until empty.',
        'Breathe in through your nose for 4 seconds (one-two-three-four). The hand on your belly moves out 1–2 cm and your ribs widen slightly.',
        'Hold the breath in for 4 seconds. Don’t clamp your throat — keep your shoulders soft and simply pause.',
        'Breathe out evenly through your mouth or nose for 4 seconds. The hand on your belly sinks back.',
        'Hold empty for 4 seconds. That’s one lap of the box (16 seconds).',
        'Keep going round the box until the timer ends (6 laps ≈ 1 min 36 s). If you feel short of air, shorten each side to 3 seconds.',
      ],
    },
    breathing: {
      ko: '들숨 4초 → 멈춤 4초 → 날숨 4초 → 멈춤 4초. 네 변의 길이가 같은 상자를 그린다고 생각하며 속으로 숫자를 세요. 멈출 때 억지로 참지 말고 편하게 멈춰요.',
      en: 'In 4 → hold 4 → out 4 → hold 4. Picture tracing a box with four equal sides and count silently. Pause gently at each hold rather than straining.',
    },
    feel: {
      ko: '배 위의 손이 들숨에 나오고 날숨에 들어가며, 어깨는 거의 움직이지 않으면 정답이에요. 몇 바퀴 지나면 호흡과 심장 박동이 차분해지고 어깨·턱 힘이 풀려요. 어지럽거나 가슴이 답답하면 멈춤 없이 편하게 숨 쉬세요.',
      en: 'The hand on your belly moves out as you inhale and in as you exhale, while your shoulders barely move. After a few laps your breathing and heartbeat slow and your shoulders and jaw let go. If you feel dizzy or tight in the chest, drop the holds and breathe normally.',
    },
    easier: {
      ko: '3-3-3-3초로 줄이거나, 멈춤을 빼고 ‘4초 들이마시고 6초 내쉬기’만 해요.',
      en: 'Shorten to 3-3-3-3, or drop the holds and simply breathe in for 4 and out for 6.',
    },
    harder: {
      ko: '5-5-5-5초, 6-6-6-6초로 조금씩 늘려요. 익숙해지면 회의 전이나 잠들기 전처럼 긴장되는 순간에 눈을 뜬 채로도 해 보세요.',
      en: 'Build up to 5-5-5-5, then 6-6-6-6. Once it’s easy, use it with your eyes open in tense moments, like before a meeting or bed.',
    },
    cues: {
      ko: ['코로 4초 들이마셔요', '채운 채 4초 멈춰요', '4초 동안 내쉬어요', '비운 채 4초 멈춰요'],
      en: ['In for four', 'Hold it for four', 'Out for four', 'Hold empty for four'],
    },
    mistakes: {
      ko: [
        '들이마실 때 어깨가 귀 쪽으로 올라감 → 배 위의 손을 앞으로 밀어낸다는 느낌으로 배와 옆구리에 숨을 채워요.',
        '멈출 때 목을 조이고 얼굴이 찡그려짐 → 턱과 입 힘을 빼고, 숨을 ‘잠깐 쉬게 둔다’는 느낌으로 부드럽게 멈춰요.',
        '숫자를 점점 빨리 셈 → 시계 초침이나 휴대폰 타이머에 맞춰 1초씩 세요.',
        '허리가 구부정하게 무너짐 → 좌골로 앉아 정수리를 천장 쪽으로 길게 뻗어요.',
      ],
      en: [
        'Shoulders rising toward your ears on the inhale → Fill your belly and sides as if pushing the hand on your belly forward.',
        'Clamping the throat and scrunching your face on the holds → Relax your jaw and mouth and simply let the breath rest.',
        'Counting faster and faster → Follow a clock’s second hand or a phone timer.',
        'Slumping → Sit on your sit bones and reach the crown of your head toward the ceiling.',
      ],
    },
    why: {
      ko: '같은 박자로 들이마시고, 멈추고, 내쉬는 호흡은 숨을 느리게 만들어 긴장된 몸을 쉬게 하는 데 도움이 돼요. 스트레스로 어깨·목이 굳고 숨이 얕아지기 쉬운 책상 앞에서 1~2분이면 할 수 있는 리셋이에요.',
      en: 'Breathing in, holding and breathing out to an even beat slows your breathing and helps a tense body rest. It’s a 1–2 minute reset you can do at your desk, where stress tends to stiffen the neck and shoulders and make breathing shallow.',
    },
    muscles: { ko: '횡격막, 늑간근 (목·어깨의 보조 호흡근은 쉬게)', en: 'Diaphragm, intercostals (the neck and shoulder helper muscles stay quiet)' },
    caution: {
      ko: '어지럽거나 숨이 차거나 가슴이 답답하면 멈춤을 빼고 평소대로 숨 쉬세요. 호흡기·심장 질환이 있다면 숨 참기 없이 편한 호흡만 해요.',
      en: 'If you feel dizzy, breathless or tight in the chest, drop the holds and breathe normally. If you have a heart or lung condition, skip the breath holds and just breathe comfortably.',
    },
    anim: {
      view: 40,
      elev: 8,
      zoom: 1.2,
      props: [{ kind: 'chair' }],
      keys: [BOX_OUT, BOX_IN, BOX_IN, BOX_OUT],
      labels: [
        { ko: '비운 채 4초 멈춤', en: 'Hold empty, 4 s' },
        { ko: '코로 4초 들이마시기', en: 'Inhale, 4 s' },
        { ko: '채운 채 4초 멈춤', en: 'Hold full, 4 s' },
        { ko: '4초 동안 내쉬기', en: 'Exhale, 4 s' },
      ],
      durations: [4, 4, 4, 4],
      pauses: [0, 0, 0, 0],
      focus: [{ a: 'chest', b: 'pelvis', side: 'front', kind: 'work', from: 0.2, to: 0.85, r: 2.8 }],
      trace: ['haR'],
    },
  },

  // ───────────────────────── 누워서 뒤꿈치 밀기
  {
    id: 'heel-slide',
    name: { ko: '누워서 뒤꿈치 밀기', en: 'Heel slide' },
    phase: 'activate',
    position: 'supine',
    regions: ['core', 'lowBack'],
    targets: { lordosis: 0.7, lowBackPain: 0.7, swayback: 0.3, pelvicTilt: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 12, rest: 20 },
    setup: {
      ko: [
        '매트에 바로 누워 두 무릎을 세우고, 발은 골반 너비로 벌려 발뒤꿈치를 엉덩이에서 약 30cm 떨어뜨려요.',
        '양손을 골반 앞 튀어나온 뼈 위에 얹어요. 골반이 기울거나 돌아가는지 손으로 확인하는 용도예요.',
        '허리는 매트에 꾹 누르지도 크게 띄우지도 않은 자연스러운 곡선(손바닥이 겨우 들어갈 틈)으로 둬요.',
        '숨을 내쉬며 배꼽 아래를 척추 쪽으로 살짝 당겨 배에 힘 10 중 3 정도를 줘요.',
      ],
      en: [
        'Lie on your back with knees bent, feet hip-width apart and heels about 30 cm from your buttocks.',
        'Place your hands on the bony points at the front of your pelvis — they’ll tell you if the pelvis tips or rotates.',
        'Leave your low back in its natural curve — not pressed flat, not arched high (just enough room for a flat hand).',
        'As you breathe out, draw the area below your belly button gently toward your spine — about 3/10 effort.',
      ],
    },
    steps: {
      ko: [
        '배의 힘을 유지한 채, 오른발 뒤꿈치를 매트 위로 3초에 걸쳐 천천히 밀어내요. 뒤꿈치는 바닥에 닿은 채 미끄러져요.',
        '무릎이 거의 펴질 때까지(살짝 굽은 정도) 밀어요. 허리가 뜨거나 골반이 돌아가려 하면 그 직전에서 멈춰요.',
        '3초에 걸쳐 뒤꿈치를 처음 자리로 끌어와요. 돌아오는 동안에도 허리 모양은 그대로예요.',
        '이번엔 왼발로 똑같이 해요.',
        '오른쪽·왼쪽 한 번씩이 1회예요. 8회(한쪽 8번) 하는 내내 골반 위 두 손의 높이가 같은지 확인해요.',
      ],
      en: [
        'Keeping the gentle brace, slide your right heel away along the mat over 3 seconds. The heel stays in contact with the floor.',
        'Slide until the knee is almost straight (a slight bend remains). If your back starts to lift or your pelvis starts to rotate, stop just before that.',
        'Take 3 seconds to draw the heel back to the start. Your low back keeps the same shape on the way back.',
        'Now do the same with the left foot.',
        'One right plus one left is 1 rep. Do 8 reps (8 slides per side), checking throughout that the hands on your pelvis stay level.',
      ],
    },
    breathing: {
      ko: '뒤꿈치를 밀어낼 때 입으로 길게 내쉬고, 끌어올 때 코로 들이마셔요. 숨 쉬는 동안에도 배의 가벼운 힘은 유지해요.',
      en: 'Breathe out through your mouth as the heel slides away, and in through your nose as it comes back. Keep the light brace while you breathe.',
    },
    feel: {
      ko: '아랫배와 옆구리가 은은하게 단단해지고, 움직이는 다리의 허벅지 앞이 가볍게 일하면 정답이에요. 허리가 뻐근하거나 젖혀지면 범위를 줄이세요. 허리나 다리가 찌릿하면 멈추세요.',
      en: 'Your lower belly and sides feel gently firm and the front of the moving thigh works lightly. If your low back aches or arches, shorten the slide. Stop if you feel zinging pain in your back or leg.',
    },
    easier: {
      ko: '뒤꿈치를 반만(15~20cm) 밀어도 충분해요. 배에 힘주기가 어렵다면 ‘90/90 호흡’이나 ‘누워서 골반 기울이기’부터 해요.',
      en: 'Sliding halfway (15–20 cm) is plenty. If bracing is hard, start with 90/90 breathing or the supine pelvic tilt.',
    },
    harder: {
      ko: '뒤꿈치를 바닥에서 1~2cm 띄운 채 밀었다 당기거나, 반대쪽 무릎을 90도로 들어 올린 상태에서 해요. 다음 단계는 ‘데드버그’예요.',
      en: 'Hover the heel 1–2 cm above the floor as you slide, or hold the other knee up at 90°. The next step is the dead bug.',
    },
    cues: {
      ko: ['배에 살짝 힘 주고', '뒤꿈치를 멀리', '허리는 그대로', '천천히 끌어와요'],
      en: ['Light brace', 'Slide the heel away', 'Low back stays still', 'Draw it back slowly'],
    },
    mistakes: {
      ko: [
        '다리를 펼 때 허리가 젖혀지며 매트에서 뜸 → 뒤꿈치를 덜 밀고, 내쉬며 아랫배 힘을 다시 챙긴 뒤 움직여요.',
        '골반이 움직이는 다리 쪽으로 돌아감 → 골반 앞 뼈 위 두 손의 높이가 같게 유지되는 범위까지만 밀어요.',
        '허리를 매트에 꾹 눌러 엉덩이가 말림 → 허리는 자연스러운 곡선 그대로, 배에는 힘 10 중 3만 줘요.',
        '뒤꿈치를 휙 빠르게 밀어냄 → 3초 밀고 3초 끌어오는 속도를 지켜요.',
      ],
      en: [
        'Low back arching off the mat as the leg straightens → Slide less far, and re-set the lower-belly brace on an exhale before moving.',
        'Pelvis rotating toward the moving leg → Slide only as far as your two hands on the pelvis stay level.',
        'Jamming the back into the mat so the hips curl → Keep the natural curve and use only 3/10 effort in the belly.',
        'Shooting the heel out quickly → Keep to 3 seconds out and 3 seconds back.',
      ],
    },
    why: {
      ko: '팔다리가 움직일 때 허리가 따라 흔들리지 않게 잡아 주는 깊은 복근 조절을 가장 쉬운 자세에서 연습해요. 허리가 쉽게 젖혀지는 과전만·요통이 있는 분이 ‘데드버그’로 넘어가기 전 기초가 돼요.',
      en: 'Practises, in the easiest position, the deep-ab control that keeps your low back steady while your legs move. It lays the groundwork for the dead bug if your back tends to over-arch or ache.',
    },
    muscles: { ko: '복횡근, 내복사근, (움직이는 다리) 장요근·대퇴직근', en: 'Transversus abdominis, internal obliques, iliopsoas and rectus femoris of the moving leg' },
    caution: {
      ko: '허리나 다리로 찌릿하게 뻗치는 통증이 생기면 멈추세요.',
      en: 'Stop if you feel shooting pain into your back or leg.',
    },
    anim: {
      view: 90,
      elev: 14,
      zoom: 1.15,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      // 등(허리)을 바닥 기준으로 고정: 다리가 움직여도 몸통은 그대로
      ground: { joints: ['backMid'], y: 0 },
      keys: [HS_HOOK, HS_R_OUT, HS_HOOK, HS_L_OUT],
      labels: [
        { ko: '무릎 세우고 배에 힘', en: 'Knees bent, light brace' },
        { ko: '오른 뒤꿈치 밀어내기', en: 'Slide right heel out' },
        { ko: '3초 동안 끌어오기', en: 'Draw back over 3 s' },
        { ko: '왼 뒤꿈치 밀어내기', en: 'Slide left heel out' },
      ],
      durations: [3, 3, 3, 3],
      pauses: [0.6, 0.5, 0.6, 0.5],
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.6 },
        { a: 'waist', b: 'hipR', side: 'front', kind: 'work', from: 0.4, to: 1, r: 2 },
      ],
      trace: ['heelR'],
    },
  },

  // ───────────────────────── 팔로프 프레스
  {
    id: 'pallof-press',
    name: { ko: '팔로프 프레스', en: 'Pallof press' },
    phase: 'activate',
    position: 'standing',
    regions: ['core', 'lowBack'],
    targets: { lateralShift: 0.7, lowBackPain: 0.6, lordosis: 0.4, pelvicTilt: 0.3, swayback: 0.3 },
    equipment: ['band'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, holdSec: 3, perSide: true, rest: 20 },
    setup: {
      ko: [
        '밴드를 문고리나 튼튼한 기둥에 가슴(명치) 높이로 묶어요.',
        '고정점이 오른쪽 옆에 오게 옆으로 서서, 밴드가 팽팽해질 때까지 옆으로 한두 걸음 떨어져요.',
        '발은 골반 너비보다 조금 넓게, 무릎은 살짝(10~15도) 굽히고, 엉덩이에 가볍게 힘을 줘요.',
        '두 손으로 밴드를 포개 잡고 명치 앞에 붙여요. 팔꿈치는 옆구리 가까이 둬요.',
      ],
      en: [
        'Tie a band to a door handle or sturdy post at chest (breastbone) height.',
        'Stand side-on with the anchor on your right, then step sideways one or two steps until the band is taut.',
        'Feet a little wider than hip-width, knees slightly bent (10–15°), glutes lightly engaged.',
        'Hold the band with both hands stacked and pressed against your breastbone, elbows close to your sides.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 배에 힘 10 중 4~5 정도로 단단히 힘을 줘요. 갈비뼈는 내리고 골반과 배꼽은 정면을 봐요.',
        '2초에 걸쳐 두 손을 명치에서 정면으로 곧게 밀어 팔을 펴요.',
        '밴드가 손을 오른쪽(고정점 쪽)으로 끌어도 손이 몸 가운데 선에서 벗어나지 않게 3초 버텨요.',
        '2초에 걸쳐 손을 다시 명치 앞으로 가져와요.',
        '10회 반복한 뒤 몸을 돌려 고정점을 왼쪽에 두고 똑같이 해요.',
      ],
      en: [
        'Breathe out and brace your belly firmly (about 4–5/10). Ribs down, pelvis and belly button facing forward.',
        'Take 2 seconds to press both hands straight out from your breastbone until your arms are straight.',
        'The band tries to pull your hands to the right (toward the anchor) — hold them on your midline for 3 seconds.',
        'Take 2 seconds to bring your hands back to your breastbone.',
        'Do 10 reps, then turn around so the anchor is on your left and repeat.',
      ],
    },
    breathing: {
      ko: '팔을 밀어낼 때 입으로 내쉬고, 버티는 3초 동안 코로 짧게 숨 쉬고, 명치로 돌아오며 들이마셔요. 숨을 참지 마세요.',
      en: 'Exhale as you press out, take short breaths through your nose during the 3-second hold, and inhale as you bring the hands back. Don’t hold your breath.',
    },
    feel: {
      ko: '옆구리와 배 앞쪽이 비틀림을 막으려고 대각선으로 단단해지고, 엉덩이도 함께 버티면 정답이에요. 팔과 어깨만 힘들면 밴드를 약하게 하고 몸통에 집중하세요. 허리에 날카로운 통증이나 다리 저림이 생기면 멈추세요.',
      en: 'Your sides and the front of your belly firm up diagonally to stop the twist, with your glutes helping. If only your arms and shoulders are working, use a lighter band and focus on the trunk. Stop if you feel sharp back pain or tingling in your legs.',
    },
    easier: {
      ko: '고정점 쪽으로 반 걸음 다가가 밴드를 느슨하게 하거나, 무릎을 꿇고 앉은 자세에서 해요. 팔을 끝까지 펴지 않고 반만 밀어도 돼요.',
      en: 'Step half a step toward the anchor to slacken the band, or do it tall-kneeling. You can also press only halfway out.',
    },
    harder: {
      ko: '고정점에서 한 걸음 더 떨어지거나, 팔을 편 상태에서 머리 위로 천천히 들어 올렸다 내려요. 두 발을 모으거나 한쪽 무릎을 꿇어 받침면을 좁혀도 돼요.',
      en: 'Step one more step away from the anchor, or raise your straight arms slowly overhead and back down. A narrower stance — feet together or half-kneeling — also makes it harder.',
    },
    cues: {
      ko: ['배를 단단하게', '명치에서 곧게 밀어요', '손은 가운데 그대로', '3초 버텨요'],
      en: ['Brace your core', 'Press straight out', 'Hands stay centred', 'Hold for three'],
    },
    mistakes: {
      ko: [
        '손이 고정점 쪽으로 끌려감 → 밴드를 약하게 하거나 반 걸음 다가서서, 손을 가슴 가운데 선에 유지해요.',
        '몸통이나 골반이 고정점 쪽으로 돌아감 → 배꼽과 두 무릎이 정면을 보게 하고 엉덩이에 힘을 줘요.',
        '허리를 젖히며 밀어냄 → 갈비뼈를 골반 쪽으로 내리고 무릎을 살짝 굽혀요.',
        '어깨가 귀 쪽으로 올라가 팔로만 버팀 → 날개뼈를 내리고, 팔은 막대처럼 곧게 둔 채 몸통으로 버텨요.',
      ],
      en: [
        'Hands drifting toward the anchor → Use a lighter band or step closer, and keep your hands on your midline.',
        'Trunk or hips turning toward the anchor → Keep your belly button and both knees facing forward and squeeze your glutes.',
        'Arching your back as you press → Draw your ribs toward your pelvis and keep a soft bend in your knees.',
        'Shoulders hiking up so the arms do the work → Set your shoulder blades down; keep the arms straight like a rod and resist with your trunk.',
      ],
    },
    why: {
      ko: '밴드가 몸을 옆으로 돌리려는 힘을 몸통이 버텨 내는 ‘회전 방지’ 운동이에요. 허리를 거의 움직이지 않고 옆구리와 복부를 강화해, 몸이 한쪽으로 쏠리거나 비틀리는 습관을 잡고 일상에서 허리를 지키는 데 도움이 돼요.',
      en: 'An “anti-rotation” exercise: your trunk resists the band’s pull to twist you sideways. It strengthens your sides and abs with almost no spinal movement, helping you control a habit of leaning or twisting to one side and protecting your back in daily life.',
    },
    muscles: { ko: '외·내복사근, 복횡근, 둔근, 견갑 안정근', en: 'External and internal obliques, transversus abdominis, glutes, shoulder-blade stabilisers' },
    caution: {
      ko: '시작 전에 밴드 묶은 곳이 단단한지 확인하세요. 허리에 날카로운 통증이 생기면 멈춰요.',
      en: 'Check that the band is tied securely before you start. Stop if you feel sharp pain in your back.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 60,
      elev: 16,
      zoom: 1.1,
      props: [{ kind: 'band', at: 'haR', off: [-50, 0, 0], key: 0 }],
      keys: [PP_SET, PP_PRESS],
      labels: [
        { ko: '옆으로 서서 명치 앞', en: 'Side-on, hands at chest' },
        { ko: '곧게 밀어 3초 버티기', en: 'Press out, hold 3 s' },
      ],
      durations: [2, 2],
      pauses: [0.8, 3],
      focus: [
        { a: 'shR', b: 'hipL', side: 'front', kind: 'work', from: 0.35, to: 0.95, r: 2.4 },
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', from: 0.3, to: 0.9, r: 2 },
      ],
      trace: ['haR'],
    },
  },

  // ───────────────────────── 옆 플랭크
  {
    id: 'side-plank',
    name: { ko: '옆 플랭크', en: 'Side plank' },
    phase: 'integrate',
    position: 'sideLying',
    regions: ['core', 'hip'],
    targets: { lateralShift: 0.9, pelvicTilt: 0.7, lowBackPain: 0.5, shoulderTilt: 0.3 },
    equipment: ['mat'],
    level: 3,
    dose: { kind: 'hold', sets: 2, value: 20, perSide: true, rest: 20 },
    setup: {
      ko: [
        '매트에 오른쪽으로 누워 오른쪽 팔꿈치를 어깨 바로 아래에 두고, 아래팔은 몸과 직각이 되게 앞쪽 바닥에 놓아요.',
        '두 다리를 곧게 펴서 왼발을 오른발 위에 포개요. 위에서 봤을 때 머리·어깨·골반·발목이 한 줄이에요.',
        '왼손은 왼쪽 골반 위에 얹고, 시선은 정면에 둬 목을 척추와 일직선으로 해요.',
      ],
      en: [
        'Lie on your right side on a mat with your right elbow directly under your shoulder and the forearm on the floor pointing forward, at a right angle to your body.',
        'Straighten both legs and stack the left foot on top of the right. Seen from above, head, shoulders, hips and ankles form one line.',
        'Rest your left hand on your left hip and look straight ahead so your neck lines up with your spine.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 배와 엉덩이에 힘을 주고, 오른 팔꿈치로 바닥을 밀어 어깨를 귀에서 멀리 떨어뜨려요.',
        '2초에 걸쳐 골반을 들어 올려 머리부터 발목까지 일직선을 만들어요. 몸은 오른 팔꿈치와 오른발 바깥 날로만 받쳐요.',
        '골반이 처지거나 뒤로 빠지지 않게 20초 버텨요. 숨은 짧고 고르게 계속 쉬어요.',
        '2초에 걸쳐 골반을 매트에 내려놓고 잠깐 쉬어요.',
        '돌아누워 왼쪽도 똑같이 해요. 양쪽 번갈아 2세트예요.',
      ],
      en: [
        'Exhale, brace your belly and glutes, and push the floor away with your right elbow so your shoulder moves away from your ear.',
        'Take 2 seconds to lift your hips until you form a straight line from head to ankles, supported only by your right elbow and the outer edge of your right foot.',
        'Hold for 20 seconds without letting the hips sag or drift back. Keep breathing in short, even breaths.',
        'Take 2 seconds to lower your hips to the mat and rest briefly.',
        'Turn over and repeat on the left. Alternate sides for 2 sets.',
      ],
    },
    breathing: {
      ko: '골반을 들어 올릴 때 내쉬고, 버티는 동안 코로 짧고 고르게 숨 쉬어요. 숨을 참으면 금방 지치니 계속 쉬어요.',
      en: 'Exhale as you lift, then breathe short, even breaths through your nose while holding. Holding your breath tires you quickly — keep breathing.',
    },
    feel: {
      ko: '바닥 쪽(오른쪽) 옆구리와 엉덩이 옆, 어깨 주변이 단단하게 일하면 정답이에요. 허리에 찌르는 통증이나 어깨 앞쪽 통증이 생기면 무릎을 대는 방법으로 바꾸세요.',
      en: 'Your lower (right) side, the outside of your hip and the muscles around your shoulder work hard. If you feel stabbing pain in your back or pain at the front of your shoulder, switch to the knee version.',
    },
    easier: {
      ko: '무릎을 90도로 굽혀 무릎으로 받치는 ‘무릎 사이드 플랭크’로 해요. 또는 위쪽 발을 아래쪽 발 앞 바닥에 놓아 받침을 넓혀요.',
      en: 'Do the side plank from your knees with knees bent 90°. Or place the top foot on the floor in front of the bottom foot for a wider base.',
    },
    harder: {
      ko: '버티는 시간을 30~45초로 늘리거나, 위쪽 팔을 천장으로 곧게 뻗어요. 더 나아가 위쪽 다리를 20~30cm 들어 올린 채 버텨요.',
      en: 'Build the hold to 30–45 seconds or reach the top arm straight to the ceiling. Next, hold with the top leg lifted 20–30 cm.',
    },
    cues: {
      ko: ['팔꿈치는 어깨 아래', '골반을 높이', '머리부터 발까지 일직선', '숨은 계속'],
      en: ['Elbow under shoulder', 'Hips high', 'Head-to-heel line', 'Keep breathing'],
    },
    mistakes: {
      ko: [
        '골반이 바닥 쪽으로 처짐 → 아래쪽 골반을 천장 쪽으로 밀어 올리고, 버티기 힘들면 시간을 줄이거나 무릎을 대요.',
        '엉덩이가 뒤로 빠져 몸이 ‘ㄱ’자로 접힘 → 엉덩이를 앞으로 밀어 어깨·골반·발목을 한 줄에 맞춰요.',
        '어깨가 귀 쪽으로 으쓱 올라감 → 팔꿈치로 바닥을 밀어 겨드랑이 아래를 길게 만들어요.',
        '팔꿈치가 어깨보다 머리 쪽으로 나가 있음 → 시작 전에 팔꿈치를 어깨 바로 아래에 다시 놓아요.',
      ],
      en: [
        'Hips sagging toward the floor → Drive the bottom hip up toward the ceiling; if you can’t, shorten the hold or drop to your knees.',
        'Hips drifting back so you fold in half → Push your hips forward to line up shoulders, hips and ankles.',
        'Shoulder shrugging toward your ear → Push the floor away with your elbow to lengthen under your armpit.',
        'Elbow placed ahead of the shoulder → Reset the elbow directly under your shoulder before you lift.',
      ],
    },
    why: {
      ko: '몸통 옆 근육(요방형근·복사근)과 엉덩이 옆 근육(중둔근)을 함께 강화해, 골반이 한쪽으로 기울거나 몸이 옆으로 치우치는 자세를 바로잡는 데 도움이 돼요. 허리를 굽히지 않고 코어를 단련하는 맥길 ‘빅 3’ 중 하나예요.',
      en: 'Strengthens the side-trunk muscles (quadratus lumborum, obliques) together with the side-hip muscle (glute med), helping correct a pelvis that tips or a trunk that shifts to one side. One of McGill’s “Big 3” for training the core without bending the spine.',
    },
    muscles: { ko: '요방형근, 외·내복사근, 중둔근, 어깨 안정근(전거근·회전근개)', en: 'Quadratus lumborum, external and internal obliques, gluteus medius, shoulder stabilisers (serratus anterior, rotator cuff)' },
    caution: {
      ko: '어깨가 빠진 적이 있거나 어깨 통증이 심하면 하지 마세요. 허리나 다리가 찌릿하면 바로 내려오세요.',
      en: 'Skip this if you’ve dislocated your shoulder or have significant shoulder pain. Come down straight away if you feel tingling in your back or leg.',
    },
    avoid: ['shoulderSevere', 'pregnant', 'lowBackSevere'],
    anim: {
      view: 0,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['anR'],
      keys: [SPL_DOWN, SPL_UP],
      labels: [
        { ko: '오른 팔꿈치로 받치기', en: 'Prop on right elbow' },
        { ko: '골반 들어 20초 버티기', en: 'Lift hips, hold 20 s' },
      ],
      durations: [2, 2],
      pauses: [0.8, 3],
      holdKey: 1,
      focus: [
        { a: 'shR', b: 'hipR', side: 'out', kind: 'work', from: 0.3, to: 0.95, r: 3 },
        { a: 'pelvis', b: 'hipR', side: 'out', kind: 'work', r: 3 },
      ],
      trace: ['hipR'],
    },
  },

  // ───────────────────────── 곰 자세 버티기
  {
    id: 'bear-hold',
    name: { ko: '곰 자세 버티기', en: 'Bear hold' },
    phase: 'activate',
    position: 'quadruped',
    regions: ['core', 'shoulder'],
    targets: { lordosis: 0.6, lowBackPain: 0.5, swayback: 0.4, roundShoulder: 0.3 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'hold', sets: 3, value: 20, rest: 20 },
    setup: {
      ko: [
        '매트에서 네발 자세를 만들어요. 손목은 어깨 바로 아래, 무릎은 골반 바로 아래, 손가락은 넓게 펴서 앞을 향하게 해요.',
        '발가락을 세워 발가락과 발볼로 매트를 짚어요. 두 발은 골반 너비예요.',
        '등은 테이블처럼 평평하게, 머리는 척추와 일직선으로 두고 두 손 사이 약간 앞 바닥을 봐요.',
      ],
      en: [
        'Get on all fours on a mat: wrists directly under shoulders, knees directly under hips, fingers spread and pointing forward.',
        'Tuck your toes so the balls of your feet and toes press into the mat, feet hip-width apart.',
        'Keep your back flat like a table and your head in line with your spine, looking at the floor just ahead of your hands.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 배에 힘 10 중 3~4를 주고, 손바닥으로 바닥을 밀어 날개뼈 사이가 꺼지지 않게 해요.',
        '등 모양은 그대로 둔 채 무릎을 바닥에서 2~3cm(손가락 두 마디)만 들어요.',
        '무릎 높이를 유지하며 20초 버텨요. 코로 들이마시고 입으로 내쉬며 숨을 계속 쉬어요.',
        '무릎을 소리 없이 천천히 내려놓고 20초 쉬어요.',
        '3세트 반복해요.',
      ],
      en: [
        'Exhale, brace your belly at about 3–4/10 and push the floor away with your palms so your upper back doesn’t sink between your shoulder blades.',
        'Keeping your back exactly as it is, lift your knees just 2–3 cm (two finger-widths) off the floor.',
        'Hold that knee height for 20 seconds, breathing in through your nose and out through your mouth.',
        'Lower your knees slowly and silently, then rest 20 seconds.',
        'Repeat for 3 sets.',
      ],
    },
    breathing: {
      ko: '무릎을 들 때 내쉬고, 버티는 동안 코로 들이마셔 옆구리와 등으로 숨을 채운 뒤 입으로 길게 내쉬어요. 숨을 참지 마세요.',
      en: 'Exhale as you lift your knees. While holding, breathe in through your nose into your sides and back, then breathe out long through your mouth. Don’t hold your breath.',
    },
    feel: {
      ko: '배 전체와 허벅지 앞, 겨드랑이 아래 어깨 주변이 단단하게 일하면 정답이에요. 허리가 뻐근하면 무릎을 너무 높이 든 거예요. 손목·어깨·무릎이 찌릿하거나 날카롭게 아프면 멈추세요.',
      en: 'Your whole belly, the fronts of your thighs and the muscles under your armpits work hard. If your low back aches, your knees are too high. Stop if you feel sharp or zinging pain in your wrists, shoulders or knees.',
    },
    easier: {
      ko: '무릎을 들지 않고 네발 자세에서 배에 힘만 주고 20초 버티거나, 무릎을 3초 들었다 내리기를 반복해요.',
      en: 'Stay on all fours and just brace for 20 seconds without lifting, or lift the knees for 3 seconds at a time and lower.',
    },
    harder: {
      ko: '버티는 시간을 30~45초로 늘리거나, 무릎을 든 채 한 손씩 번갈아 반대쪽 어깨를 톡 쳐요(골반이 흔들리지 않게). 다음 단계는 ‘플랭크’예요.',
      en: 'Build to 30–45 seconds, or tap each hand to the opposite shoulder in turn while holding — without the hips rocking. The next step is the plank.',
    },
    cues: {
      ko: ['등은 평평하게', '무릎은 2~3cm만', '바닥을 밀어요', '숨은 계속'],
      en: ['Flat back', 'Knees up just 2–3 cm', 'Push the floor away', 'Keep breathing'],
    },
    mistakes: {
      ko: [
        '엉덩이가 천장으로 솟음 → 무릎을 2~3cm만 들고, 엉덩이는 무릎 바로 위에 둬요.',
        '허리가 아래로 처짐 → 배꼽을 척추 쪽으로 살짝 당기고 갈비뼈를 내려요.',
        '날개뼈 사이가 푹 꺼짐 → 손바닥으로 바닥을 밀어 등 윗부분을 살짝 채워요.',
        '고개를 들어 앞을 봄 → 시선은 두 손 사이 약간 앞 바닥에 두고 뒷목을 길게 해요.',
      ],
      en: [
        'Hips shooting up toward the ceiling → Lift the knees only 2–3 cm and keep your hips right above your knees.',
        'Low back sagging → Draw your belly button gently toward your spine and bring your ribs down.',
        'Chest sinking between the shoulder blades → Push the floor away to fill out your upper back.',
        'Lifting your head to look forward → Look at the floor just ahead of your hands and keep the back of your neck long.',
      ],
    },
    why: {
      ko: '무릎을 살짝 띄우면 몸통이 흔들리지 않게 복부와 어깨가 함께 버텨야 해요. 허리를 움직이지 않고 코어·어깨·허벅지를 한꺼번에 깨워, 허리가 처지거나 과하게 젖혀지는 자세를 잡아 주고 ‘플랭크’로 가는 다리 역할을 해요.',
      en: 'Hovering the knees makes the abs and shoulders work together to keep the trunk still. It wakes up the core, shoulders and thighs without moving the spine, helps control a sagging or over-arched low back, and bridges the gap to the plank.',
    },
    muscles: { ko: '복횡근·복직근, 전거근, 대퇴사두근, 고관절 굴곡근', en: 'Transversus and rectus abdominis, serratus anterior, quadriceps, hip flexors' },
    caution: {
      ko: '손목이 아프면 무리하지 말고 멈추세요. 얼굴이 빨개질 정도로 숨을 참지 마세요.',
      en: 'Stop if your wrists hurt rather than pushing through. Don’t hold your breath until your face goes red.',
    },
    avoid: ['wristPain', 'shoulderSevere', 'kneePain', 'pregnant'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['haL', 'haR'],
      keys: [BEAR_QUAD, BEAR_TOES, BEAR_UP],
      labels: [
        { ko: '손은 어깨 아래 네발', en: 'All fours, hands under shoulders' },
        { ko: '발가락 세우기', en: 'Tuck your toes' },
        { ko: '무릎 2~3cm 들어 버티기', en: 'Knees up 2–3 cm, hold' },
      ],
      durations: [1.2, 1.4, 1.4],
      pauses: [0.6, 0.6, 3],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.6 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work', r: 2.6 },
        { a: 'shR', b: 'waist', kind: 'work', from: 0.05, to: 0.45, r: 2.2 },
      ],
      trace: ['knR'],
    },
  },
];
