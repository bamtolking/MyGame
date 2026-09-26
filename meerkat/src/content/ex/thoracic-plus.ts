/**
 * 운동 라이브러리 · 가슴·등(흉추) (추가 동작)
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both } from '../../figure/rig';
import { HOOK, PRONE, QUAD, SIT, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 파일 안에서 쓰는 자세 ─────────────────────

/** 누워서 바닥 천사: W(팔꿈치 90°, 손등·팔꿈치 바닥) → Y */
const FA_W = merge(HOOK, both({ sh: { abd: 80, rot: 88, hab: 12 }, el: 96, scap: { elev: -1 } }));
const FA_Y = merge(HOOK, both({ sh: { abd: 145, rot: 88, flex: -8 }, el: 22 }));

/** 엎드려 코브라: 팔은 몸 옆 → 날개뼈 뒤·아래로 모으기(어깨가 뒤로 올라오며 팔이 살짝 따라 뜸) → 가슴 3~5cm 들기 */
const PC_REST = merge(PRONE, both({ sh: { flex: 10, abd: 10 }, el: 4 }));
const PC_SQUEEZE = merge(PRONE, both({ sh: { flex: 12, abd: 10, rot: 10 }, el: 3, scap: { prot: -4, elev: -1.5 } }));
const PC_LIFT = merge(PRONE, both({ sh: { flex: -3, abd: 14, rot: 45 }, el: 0, scap: { prot: -4, elev: -1.5 } }), {
  thorax: { flex: -12 },
  lumbar: { flex: -3 },
  neck: { flex: 8 },
  head: { flex: 4 },
});

/** 네발에서 등 돌려 열기: 오른손은 뒤통수(팔꿈치는 옆으로), 왼손으로 바닥 짚기.
 *  몸통을 돌려도 짚은 왼팔이 바닥에 수직으로 남도록 shL.hab 을 몸통 회전만큼 반대로 주고, 날개뼈(scapL)로 어깨 높이를 보정.
 *  수평 맞추기(level)가 키마다 몸 기울기를 바꾸므로, 짚은 왼손목이 제자리(무릎 앞 z≈26.6)에 머물고 골반이 무릎 위에 남도록
 *  키마다 shL.flex 와 고관절 굽힘을 함께 맞춤 (한 사이클 내내 손목 이동 1 미만, 골반은 무릎 위 ±1) */
const QR_HAND = merge(QUAD, { shR: { flex: 0, abd: 130, rot: 110 }, elR: 120, wrR: 0 });
/** 팔꿈치를 짚은 손목 쪽으로: 등 윗부분을 왼쪽으로 돌리며 살짝 말고, 오른어깨를 수평으로 모아 팔꿈치가 가슴 밑 가운데를 넘어 왼손목 가까이 감 (손은 뒤통수에 그대로) */
const QR_DOWN = merge(QR_HAND, {
  thorax: { twist: 22, flex: 10 },
  lumbar: { twist: 2 },
  neck: { twist: 10 },
  shR: { flex: 95, abd: 115, rot: 65, hab: -30 },
  elR: 115,
  shL: { flex: 89, hab: -24 },
  scapL: { prot: 2.5 },
  hipL: { flex: 79 },
  hipR: { flex: 79 },
});
const QR_OPEN = merge(QR_HAND, {
  thorax: { twist: -38 },
  lumbar: { twist: -6 },
  neck: { twist: -24 },
  shL: { flex: 63, hab: 44 },
  scapL: { prot: -3 },
  elL: 8,
  wrL: 78,
  hipL: { flex: 67 },
  hipR: { flex: 67 },
});

/** 스핑크스: 엎드려 아래팔을 11자로 바닥에(팔꿈치는 어깨보다 한 뼘 앞·조금 넓게) → 팔꿈치 위로 가슴 들기 → 어깨 내리고 길게.
 *  첫 자세의 위팔을 hab 로 옆·아래로 향하게 잡아, 가슴을 드는 동안 팔꿈치가 바닥을 스치며 어깨 밑으로 들어오고
 *  골반·다리는 매트에 붙어 있게 함 (한 사이클 내내 골반 높이 7.5~8.6 = 바닥에 닿은 범위) */
const SP_DOWN = merge(PRONE, both({ sh: { flex: 144, abd: 22, rot: 35, hab: 68 }, el: 30 }), { thorax: { flex: -5 }, lumbar: { flex: -1 } });
const SP_UP = merge(PRONE, both({ sh: { flex: 56, abd: 8 }, el: 88 }), { lumbar: { flex: -16 }, thorax: { flex: -18 }, neck: { flex: 4 }, head: { flex: 2 } });
const SP_LONG = merge(PRONE, both({ sh: { flex: 50, abd: 8 }, el: 88, scap: { elev: -2, prot: 1 } }), { lumbar: { flex: -18 }, thorax: { flex: -22 }, neck: { flex: 4 }, head: { flex: 2 } });

/** 앉아서 옆으로 길게 뻗기: 왼손은 의자, 오른팔을 위로 → 왼쪽으로 기울이기 */
const SR_HOLD = merge(SIT, { shL: { flex: -20, abd: 20 }, elL: 45 });
const SR_UP = merge(SR_HOLD, { shR: { abd: 172, flex: 4 }, elR: 6 });
const SR_LEAN = merge(SR_UP, { shR: { abd: 182, flex: 6 }, elR: 8, lumbar: { side: 8 }, thorax: { side: 20 }, neck: { side: 6 }, shL: { flex: -45, abd: 35 }, elL: 90 });

/** 엎드려 팔 수영하기: 팔을 바닥에서 살짝 띄운 채 Y → T → 엉덩이 옆 (같은 flex 값 = 같은 높이로 원뿔을 그리며 돎) */
const SW_Y = merge(PRONE, both({ sh: { flex: 6, abd: 150, rot: 60 }, el: 4 }));
const SW_T = merge(PRONE, both({ sh: { flex: 6, abd: 90, rot: 20 }, el: 4 }));
const SW_HIP = merge(PRONE, both({ sh: { flex: 5, abd: 14, rot: -40 }, el: 10 }));

export const THORACIC_PLUS: Exercise[] = [
  {
    id: 'floor-angel',
    name: { ko: '누워서 바닥 천사', en: 'Floor angel' },
    phase: 'mobility',
    position: 'supine',
    regions: ['shoulder', 'upperBack', 'chest'],
    targets: { roundShoulder: 0.9, kyphosis: 0.7, fhp: 0.4, upperBackPain: 0.4, stiffness: 0.4, shoulderPain: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 7, holdSec: 2, rest: 15 },
    setup: {
      ko: [
        '매트에 바로 누워 무릎을 세우고, 발은 골반 너비로 벌려 발뒤꿈치를 엉덩이에서 30cm쯤 떨어뜨려요.',
        '허리 밑에는 손바닥 하나가 겨우 들어갈 자연스러운 틈만 남기고 뒤통수를 바닥에 대요. 턱이 들리면 얇게 접은 수건을 머리 밑에 받쳐요.',
        '팔을 옆으로 벌려 팔꿈치를 90°로 굽히고, 팔꿈치는 어깨보다 살짝 아래·손은 귀 옆에 둬 W 모양을 만들어요.',
        '손등과 팔꿈치 뒤쪽을 바닥에 가볍게 대요. 처음부터 다 닿지 않으면 닿는 만큼만으로도 괜찮아요.',
      ],
      en: [
        'Lie on your back on a mat with knees bent, feet hip-width apart and heels about 30 cm from your buttocks.',
        'Leave only a natural gap under your low back — about a flat hand’s thickness — and rest the back of your head down. If your chin tips up, put a thin folded towel under your head.',
        'Open your arms to the sides and bend the elbows to 90°, elbows slightly below shoulder level and hands beside your ears, making a “W”.',
        'Rest the backs of your hands and elbows lightly on the floor. If they don’t reach yet, going as far as they do is fine.',
      ],
    },
    steps: {
      ko: [
        '코로 숨을 들이쉬고, 입으로 내쉬면서 아래쪽 갈비뼈를 골반 쪽으로 살짝 내려 허리 틈이 커지지 않게 잡아요.',
        '손등과 팔꿈치가 바닥을 스치게 한 채, 4초에 걸쳐 팔을 머리 위로 미끄러뜨려 Y 모양으로 뻗어요.',
        '손등이 뜨거나 갈비뼈가 들리기 직전 지점에서 멈추고 2초 버텨요. 그 지점이 오늘의 끝 범위예요.',
        '날개뼈를 엉덩이 뒷주머니 쪽으로 끌어내리듯 팔꿈치를 옆구리 쪽으로 당겨, 3~4초에 걸쳐 W로 돌아와요.',
        '10회 반복해요. 매 회 허리 틈과 뒤통수 위치는 그대로예요.',
      ],
      en: [
        'Inhale through your nose; as you exhale through your mouth, gently draw your lower ribs toward your pelvis so the gap under your low back doesn’t grow.',
        'Keeping the backs of your hands and elbows brushing the floor, slide your arms overhead into a “Y” over 4 seconds.',
        'Stop just before your hands lift or your ribs pop up and hold 2 seconds — that point is today’s end range.',
        'Pull your elbows down toward your sides as if drawing your shoulder blades into your back pockets, returning to the “W” over 3–4 seconds.',
        'Repeat 10 times, keeping the low-back gap and the back of your head unchanged.',
      ],
    },
    breathing: {
      ko: '팔을 올리는 4초 동안 입으로 길게 내쉬며 갈비뼈를 내리고, W로 돌아오면서 코로 들이쉬어요.',
      en: 'Exhale slowly through your mouth for the 4 seconds you slide up, keeping the ribs down; inhale through your nose as you return to the “W”.',
    },
    feel: {
      ko: '가슴 앞쪽과 겨드랑이 아래가 부드럽게 늘어나고, W로 당겨 내릴 때 날개뼈 사이·아래쪽에 은은하게 힘이 들어가면 정답이에요. 어깨 앞이 찌릿하거나 손이 저리면 범위를 줄이거나 멈추세요.',
      en: 'A gentle stretch across the front of the chest and under the armpits, and a light effort between and below the shoulder blades as you pull back to the “W”. If the front of the shoulder pinches or your hands tingle, shorten the range or stop.',
    },
    easier: {
      ko: '손등이 바닥에 닿지 않으면 손과 팔꿈치 밑에 쿠션이나 접은 수건을 받치고, 팔은 W에서 귀 높이까지만 절반 범위로 움직여요.',
      en: 'If your hands don’t reach the floor, rest your hands and elbows on a cushion or folded towel, and move only half-way — from the “W” to ear level.',
    },
    harder: {
      ko: '맨 위에서 5초 버티거나, 세로로 둔 폼롤러 위에 누워서 해 보세요. 쉬워지면 서서 하는 ‘벽 천사’로 넘어가요.',
      en: 'Hold 5 seconds at the top, or lie lengthwise on a foam roller. When it feels easy, progress to the standing wall angel.',
    },
    cues: {
      ko: ['갈비뼈는 아래로', '손등은 바닥을 스치듯', '날개뼈를 뒷주머니로', '천천히 W로 내려요'],
      en: ['Ribs stay down', 'Hands brush the floor', 'Blades to back pockets', 'Slowly back to W'],
    },
    mistakes: {
      ko: [
        '허리가 들리며 갈비뼈가 튀어나옴 → 팔을 올리는 동안 길게 내쉬고, 허리 틈이 커지기 직전에서 멈춰요.',
        '손등이 바닥에서 뜸 → 뜨기 직전까지만 올려요. 억지로 누르지 말고 그 지점을 오늘의 범위로 삼아요.',
        '어깨를 귀 쪽으로 으쓱함 → 올릴 때도 목 옆을 길게 두고, 내릴 때 날개뼈를 엉덩이 쪽으로 끌어내려요.',
        '턱이 들려 목이 젖혀짐 → 턱을 살짝 당겨 뒷목을 길게 하고, 필요하면 머리 밑에 얇은 수건을 받쳐요.',
      ],
      en: [
        'Low back arching and ribs flaring → Exhale long as you reach and stop just before the low-back gap grows.',
        'Hands lifting off the floor → Go only to just before they lift; don’t force them down — that point is today’s range.',
        'Shrugging toward the ears → Keep the sides of the neck long on the way up and draw the blades down toward your hips on the way back.',
        'Chin tipping up → Tuck the chin slightly to lengthen the back of the neck, and add a thin towel under your head if needed.',
      ],
    },
    why: {
      ko: '벽 천사보다 중력 부담이 적은 누운 자세에서, 굳은 가슴·광배근을 늘리고 날개뼈를 아래로 모으는 근육을 함께 깨워요. 말린 어깨와 굽은 등을 펴는 첫 단계로 좋아요.',
      en: 'Lying down takes gravity out of the wall angel, so you can lengthen tight pecs and lats while waking up the muscles that draw the shoulder blades down — a gentle first step for rounded shoulders and a rounded upper back.',
    },
    muscles: {
      ko: '하부·중부 승모근, 전거근(힘 줌) · 대흉근, 소흉근, 광배근(늘어남)',
      en: 'Lower & middle trapezius, serratus anterior (working) · pecs & lats (lengthening)',
    },
    caution: {
      ko: '어깨가 빠질 듯한 느낌이 들거나 팔이 저리면 멈추고, 통증 없는 범위에서만 움직여요.',
      en: 'Stop if the shoulder feels unstable or your arms tingle, and move only within a pain-free range.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 0,
      elev: 70,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [FA_W, FA_Y],
      labels: [
        { ko: 'W 모양, 갈비뼈 내리기', en: 'W arms, ribs down' },
        { ko: 'Y로 밀어 올려 2초', en: 'Slide to Y, hold 2 s' },
      ],
      durations: [2.4, 2.2],
      pauses: [0.5, 1.6],
      focus: [
        { a: 'chest', b: 'shR', side: 'front', kind: 'stretch', r: 2.6 },
        { a: 'chest', b: 'shL', side: 'front', kind: 'stretch', r: 2.6 },
        // 겨드랑이 아래 광배근 (Y로 올릴수록 늘어남)
        { a: 'shR', b: 'hipR', side: 'out', kind: 'stretch', r: 2.4, from: 0.08, to: 0.45 },
        { a: 'shL', b: 'hipL', side: 'out', kind: 'stretch', r: 2.4, from: 0.08, to: 0.45 },
      ],
      trace: ['haR', 'haL'],
    },
  },
  {
    id: 'prone-cobra',
    name: { ko: '엎드려 코브라', en: 'Prone cobra' },
    phase: 'activate',
    position: 'prone',
    regions: ['upperBack', 'shoulder'],
    targets: { kyphosis: 0.9, roundShoulder: 0.9, fhp: 0.5, upperBackPain: 0.5 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 3, holdSec: 5, rest: 20 },
    setup: {
      ko: [
        '매트에 엎드려 이마 밑에 접은 수건(두께 3~4cm)을 받치고, 다리는 골반 너비로 펴서 발등을 바닥에 둬요.',
        '팔은 몸 옆으로 길게 내려 손바닥이 바닥을 보게 하고, 손은 엉덩이 옆 한 뼘 거리에 둬요.',
        '배꼽을 바닥에서 살짝 끌어올리듯 아랫배에 힘을 주고, 엉덩이를 가볍게 조여 허리를 보호해요.',
      ],
      en: [
        'Lie face down on a mat with a folded towel (3–4 cm thick) under your forehead, legs straight and hip-width apart, tops of the feet on the floor.',
        'Rest your arms long by your sides, palms facing the floor, hands about a hand-span from your hips.',
        'Lightly draw your belly button up off the floor and gently squeeze your glutes to protect your low back.',
      ],
    },
    steps: {
      ko: [
        '턱을 살짝 당겨 뒷목을 길게 하고, 시선은 계속 매트를 봐요.',
        '날개뼈를 뒤·아래로, 엉덩이 뒷주머니 쪽으로 끌어모아요.',
        '그 힘으로 가슴을 바닥에서 3~5cm만 들어요. 명치(가슴뼈 아래 끝)는 바닥에 닿아 있어요.',
        '동시에 팔을 바닥에서 살짝 띄우고, 엄지가 천장을 향하도록 팔 전체를 바깥으로 돌려요(손바닥은 바깥쪽을 봐요).',
        '5초 버티고, 2초에 걸쳐 가슴과 팔을 천천히 내려놓아요. 8회 반복해요.',
      ],
      en: [
        'Gently tuck your chin to lengthen the back of your neck and keep looking at the mat.',
        'Draw your shoulder blades back and down, toward your back pockets.',
        'Use that squeeze to lift your chest just 3–5 cm off the floor — the bottom tip of your breastbone stays down.',
        'At the same time hover your arms off the floor and rotate them outward so your thumbs point to the ceiling (palms face away from you).',
        'Hold 5 seconds, then take 2 seconds to lower your chest and arms. Repeat 8 times.',
      ],
    },
    breathing: {
      ko: '들어 올리면서 입으로 “후—” 내쉬고, 버티는 5초 동안은 코로 짧고 편하게 숨 쉬어요. 내려놓으며 들이쉬어요.',
      en: 'Exhale through your mouth as you lift, breathe easily through your nose during the 5-second hold, and inhale as you lower.',
    },
    feel: {
      ko: '날개뼈 사이와 아래쪽(등 가운데)에 힘이 꽉 모이고 가슴 앞이 펴지면 정답이에요. 허리가 조이거나 뒷목이 뻐근하면 너무 높이 든 거예요. 허리나 다리가 저리면 바로 멈추세요.',
      en: 'A strong squeeze between and below the shoulder blades (mid-back) and the chest opening up. If your low back pinches or the back of your neck strains, you’re lifting too high. Stop right away if your back or legs tingle.',
    },
    easier: {
      ko: '가슴은 바닥에 둔 채 날개뼈 모으기와 팔 띄우기만 해요. 엎드리기 불편하면 서서 하는 ‘날개뼈 모으며 팔 벌리기’로 대신해요.',
      en: 'Keep your chest on the floor and only squeeze the blades and hover the arms. If lying face down is uncomfortable, do the standing Scapular squeeze & external rotation instead.',
    },
    harder: {
      ko: '버티는 시간을 10초로 늘리거나, 팔을 머리 위로 뻗는 ‘엎드려 Y 들기’나 ‘엎드려 팔 수영하기’로 넘어가요.',
      en: 'Increase the hold to 10 seconds, or progress to the prone Y raise or the prone swimmer, where the arms work overhead.',
    },
    cues: {
      ko: ['날개뼈를 뒷주머니로', '가슴만 살짝 들어요', '엄지는 천장으로', '턱은 당긴 채'],
      en: ['Blades to back pockets', 'Lift the chest just a little', 'Thumbs to the ceiling', 'Keep the chin tucked'],
    },
    mistakes: {
      ko: [
        '고개를 들어 앞을 봄 → 시선은 매트에 두고 턱을 살짝 당겨, 머리는 가슴과 한 줄로만 따라 올라가요.',
        '허리를 꺾어 높이 들어 올림 → 가슴은 3~5cm면 충분해요. 명치는 바닥에 두고 아랫배·엉덩이 힘을 유지해요.',
        '어깨가 귀 쪽으로 으쓱함 → 날개뼈를 먼저 엉덩이 쪽으로 끌어내린 다음 가슴을 들어요.',
        '숨을 참고 버팀 → 들 때 내쉬고, 버티는 동안 코로 짧게 숨 쉬어요.',
      ],
      en: [
        'Lifting the head to look forward → Keep your eyes on the mat and chin slightly tucked; the head just rises in line with the chest.',
        'Arching the low back to lift high → 3–5 cm is plenty; keep the bottom of the breastbone down and your belly and glutes engaged.',
        'Shoulders shrugging to the ears → Draw the blades down toward your hips first, then lift the chest.',
        'Holding your breath → Exhale as you lift and breathe through your nose during the hold.',
      ],
    },
    why: {
      ko: '굽은 등을 펴 주는 등 근육(흉추 기립근)과 날개뼈를 뒤·아래로 잡아 주는 중·하부 승모근을 한 번에 깨워요. 오래 앉아 둥글게 말린 등과 어깨를 되돌리는 데 좋아요.',
      en: 'Wakes up the upper-back extensors and the middle/lower traps that hold the shoulder blades back and down — all at once. Great for undoing a rounded upper back and shoulders from long sitting.',
    },
    muscles: {
      ko: '중·하부 승모근, 능형근, 흉추 기립근, 극하근·소원근(팔 바깥 돌리기)',
      en: 'Middle & lower trapezius, rhomboids, thoracic erectors, infraspinatus & teres minor (arm rotation)',
    },
    caution: {
      ko: '허리가 불편하면 가슴은 들지 말고 팔만 띄워요. 날카로운 통증이 있거나 다리가 저리면 바로 멈추세요. 임신 중에는 하지 마세요.',
      en: 'If your low back feels uncomfortable, skip the chest lift and only hover the arms. Stop right away if you feel sharp pain or tingling in your legs. Don’t do this during pregnancy.',
    },
    avoid: ['pregnant', 'lowBackSevere', 'radiating'],
    anim: {
      view: 90,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [PC_REST, PC_SQUEEZE, PC_LIFT],
      labels: [
        { ko: '엎드려 팔은 몸 옆', en: 'Face down, arms by sides' },
        { ko: '날개뼈 뒤·아래로', en: 'Blades back & down' },
        { ko: '가슴 3~5cm 들고 5초', en: 'Chest up 3–5 cm, hold 5 s' },
      ],
      durations: [1, 1.2, 1.6],
      pauses: [0.6, 0.4, 2.6],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'backMid', side: 'back', kind: 'work', r: 2.6 },
        { a: 'shL', b: 'backMid', side: 'back', kind: 'work', r: 2.6 },
        { a: 'backTop', b: 'backMid', side: 'back', kind: 'work', r: 2.4 },
      ],
      zoom: 1.1,
    },
  },
  {
    id: 'quadruped-tspine-rotation',
    name: { ko: '네발에서 등 돌려 열기', en: 'Quadruped thoracic rotation' },
    phase: 'mobility',
    position: 'quadruped',
    regions: ['upperBack', 'chest'],
    targets: { upperBackPain: 0.8, kyphosis: 0.7, stiffness: 0.7, roundShoulder: 0.4 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 5, holdSec: 1, perSide: true, rest: 10 },
    setup: {
      ko: [
        '매트에서 네발 자세를 만들어요. 손목은 어깨 바로 아래, 무릎은 골반 바로 아래, 두 무릎 사이는 주먹 하나예요.',
        '등은 평평하게, 정수리부터 꼬리뼈까지 한 줄로 길게 두고 시선은 두 손 사이 바닥을 봐요.',
        '오른손을 뒤통수에 가볍게 얹고 팔꿈치를 옆으로 벌려요. 왼손은 바닥을 지그시 밀어 날개뼈가 등 사이로 꺼지지 않게 해요.',
      ],
      en: [
        'Come onto all fours on a mat: wrists directly under the shoulders, knees directly under the hips, knees a fist-width apart.',
        'Keep your back flat and long from the crown of your head to your tailbone, eyes on the floor between your hands.',
        'Rest your right hand lightly on the back of your head, elbow out to the side. Press the floor away with your left hand so that shoulder blade doesn’t sink.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 오른쪽 팔꿈치를 왼손목 쪽으로 천천히 내려, 등 윗부분을 아래로 감아요.',
        '팔꿈치가 왼팔 안쪽에 가까워지면 1초 멈춰요. 골반은 두 무릎 위에 그대로 있어요.',
        '숨을 들이쉬며 가슴을 오른쪽으로 돌려 팔꿈치를 천장 쪽으로 열어요. 시선은 팔꿈치를 따라가요.',
        '편하게 열리는 끝 지점(보통 45° 안팎)에서 1초 멈췄다가, 다시 아래로 감아 내려와요.',
        '8회 반복한 뒤 손을 바꿔 왼쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Exhale and slowly bring your right elbow down toward your left wrist, curling the upper back downward.',
        'Pause 1 second when the elbow nears the inside of your left arm. Your hips stay stacked over your knees.',
        'Inhale and turn your chest to the right, opening the elbow up toward the ceiling while your eyes follow it.',
        'Pause 1 second at a comfortable end point (usually about 45°), then wind back down.',
        'Do 8 reps, then switch hands and repeat on the left.',
      ],
    },
    breathing: {
      ko: '팔꿈치를 아래로 감을 때 입으로 내쉬고, 천장으로 열 때 코로 들이쉬어 갈비뼈 사이가 벌어지게 해요.',
      en: 'Exhale through your mouth as you wind the elbow down; inhale through your nose as you open to the ceiling so the ribs spread.',
    },
    feel: {
      ko: '어깨뼈 사이와 등 윗부분이 비틀리며 풀리고, 열 때 오른쪽 가슴 앞이 늘어나면 정답이에요. 허리가 비틀리는 느낌이 들거나 짚은 손목이 아프면 범위를 줄이세요.',
      en: 'The upper back and the area between your shoulder blades twisting and loosening, with a stretch across the front of the right chest as you open. If you feel it twisting in your low back or the supporting wrist hurts, shorten the range.',
    },
    easier: {
      ko: '엉덩이를 발뒤꿈치 쪽으로 반쯤 빼고 하면 허리가 고정돼 등만 돌리기 쉬워요. 손목이 아프면 주먹을 쥐고 짚거나 아래팔로 짚어요.',
      en: 'Sit your hips halfway back toward your heels — it locks the low back so only the upper back turns. If your wrist hurts, lean on a fist or on your forearm.',
    },
    harder: {
      ko: '열린 자리에서 숨을 한 번 더 쉬며 3초 버티거나, 팔을 쭉 뻗어 손끝으로 천장을 가리키며 열어요. 익숙해지면 ‘스레드 더 니들’로 넘어가요.',
      en: 'Hold the open position for 3 seconds with an extra breath, or straighten the arm and point your fingertips to the ceiling. Then progress to thread the needle.',
    },
    cues: {
      ko: ['골반은 그대로', '시선은 팔꿈치를 따라', '내쉬며 아래로 감기', '들이쉬며 천장으로'],
      en: ['Hips stay still', 'Eyes follow the elbow', 'Exhale, wind down', 'Inhale, open up'],
    },
    mistakes: {
      ko: [
        '골반이 옆으로 돌아감 → 두 무릎에 무게를 똑같이 싣고, 엉덩이를 뒤꿈치 쪽으로 조금 빼서 해요.',
        '짚은 팔 쪽 어깨가 주저앉음 → 왼손으로 바닥을 밀어 날개뼈 사이를 채운 상태로 돌려요.',
        '팔꿈치만 휘두르고 가슴은 그대로 → 가슴뼈가 팔꿈치와 함께 돈다고 생각하고, 손은 뒤통수에 붙여 둬요.',
        '목만 돌려 봄 → 시선은 팔꿈치를 따라가되, 머리는 가슴이 돌아간 만큼만 함께 돌아가요.',
      ],
      en: [
        'Hips swinging sideways → Keep equal weight on both knees and sit your hips back slightly.',
        'Supporting shoulder sagging → Press the floor away with your left hand to fill the space between your shoulder blades as you turn.',
        'Swinging only the elbow → Think of your breastbone turning with the elbow, and keep the hand on the back of your head.',
        'Cranking only the neck → Let your eyes follow the elbow, but turn your head only as far as your chest turns.',
      ],
    },
    why: {
      ko: '오래 앉아 있으면 등뼈(흉추)의 회전이 가장 먼저 굳어요. 허리를 고정한 채 등만 돌려 굳은 등을 풀고, 허리와 목이 대신 비틀리는 부담을 줄여 줘요.',
      en: 'Rotation is the first thing a desk-bound upper spine loses. Turning the upper back while the low back stays still restores it and takes strain off the low back and neck, which otherwise twist in its place.',
    },
    muscles: {
      ko: '흉추 회전 가동성, 복사근·흉추 회전근, 대흉근(늘어남), 짚은 쪽 전거근',
      en: 'Thoracic rotation mobility, obliques & thoracic rotators, pecs (lengthening), serratus anterior on the support side',
    },
    caution: {
      ko: '등이나 허리에 날카로운 통증이 생기면 범위를 줄여요. 무릎이 배기면 매트를 두 겹으로 접어 받쳐요.',
      en: 'Shorten the range if you feel sharp pain in your back. If your knees are sore, fold the mat double under them.',
    },
    avoid: ['wristPain', 'kneePain'],
    anim: {
      // 오른쪽 뒤 비스듬히: 팔꿈치가 가슴 밑으로 들어가는 모습과 천장으로 열리는 가슴이 함께 보이게 (정옆에서는 팔꿈치가 짚은 팔에 겹쳐 가려짐)
      view: 115,
      elev: 22,
      props: [{ kind: 'mat' }],
      anchor: ['knL', 'knR'],
      level: { a: ['wrL', 'haL'], b: ['knL', 'knR'] },
      keys: [QR_HAND, QR_DOWN, QR_OPEN],
      labels: [
        { ko: '한 손을 뒤통수에', en: 'One hand behind head' },
        { ko: '팔꿈치를 짚은 손목 쪽으로', en: 'Elbow toward support wrist' },
        { ko: '천장으로 열기', en: 'Open to the ceiling' },
      ],
      durations: [1.6, 2.4, 2],
      pauses: [0.5, 0.8, 1.2],
      holdKey: 2,
      focus: [
        { a: 'backTop', b: 'backMid', side: 'back', kind: 'work', r: 2.6 },
        { a: 'chest', b: 'shR', side: 'front', kind: 'stretch', r: 2.6 },
      ],
      trace: ['elR'],
    },
  },
  {
    id: 'sphinx-extension',
    name: { ko: '스핑크스 자세', en: 'Sphinx' },
    phase: 'mobility',
    position: 'prone',
    regions: ['upperBack', 'lowBack', 'chest'],
    targets: { kyphosis: 0.8, flatBack: 0.6, stiffness: 0.5, upperBackPain: 0.4, roundShoulder: 0.3, lowBackPain: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, rest: 10 },
    setup: {
      ko: [
        '매트에 엎드려 다리를 골반 너비로 펴고 발등을 바닥에 내려놓아요.',
        '아래팔을 11자로 나란히 앞으로 뻗어 바닥에 대고 손바닥은 바닥을 향해요. 팔꿈치는 어깨보다 한 뼘쯤 앞, 어깨너비보다 조금 넓게 둬요.',
        '치골(골반 앞)과 허벅지 앞은 바닥에 붙이고, 엉덩이 힘은 빼고 아랫배만 살짝 끌어올려요.',
      ],
      en: [
        'Lie face down on a mat, legs straight and hip-width apart, tops of the feet on the floor.',
        'Rest your forearms parallel on the floor pointing forward, palms down, with your elbows about a hand-span in front of your shoulders and a little wider than shoulder-width.',
        'Keep your pubic bone and the fronts of your thighs on the floor; relax your glutes and gently draw your lower belly up.',
      ],
    },
    steps: {
      ko: [
        '아래팔로 바닥을 지그시 누르며 가슴을 앞·위로 들어 올리고, 팔꿈치를 어깨 바로 아래로 끌어와 그 위에 상체를 기대요.',
        '바닥을 밀어내듯 눌러 어깨를 귀에서 멀리 내리고, 쇄골을 옆으로 넓게 펴요.',
        '가슴뼈를 앞쪽으로 길게 내밀듯 늘이고, 목은 그 연장선에 두어 시선은 손끝 한 뼘 앞 바닥을 봐요.',
        '그 자세에서 코로 천천히 5~6번 숨 쉬며 30초 버텨요.',
        '천천히 가슴을 내려 이마를 손등에 대고 10초 쉬었다가 한 번 더 해요.',
      ],
      en: [
        'Press your forearms gently into the floor and lift your chest forward and up, drawing your elbows in until they sit directly under your shoulders, then rest your upper body over them.',
        'Push the floor away to slide your shoulders down away from your ears, and broaden across your collarbones.',
        'Lengthen your breastbone forward and keep your neck in line with it, eyes on the floor a hand-span beyond your fingertips.',
        'Stay there for 30 seconds, taking 5–6 slow breaths through your nose.',
        'Slowly lower your chest, rest your forehead on your hands for 10 seconds, then do it once more.',
      ],
    },
    breathing: {
      ko: '자세를 잡은 뒤 코로 4초 들이쉬며 가슴과 등 윗부분을 부풀리고, 입으로 6초 내쉬며 어깨를 한 번 더 아래로 내려요.',
      en: 'Once in position, inhale through your nose for 4 seconds to expand the chest and upper back, then exhale through your mouth for 6 seconds as you let your shoulders sink a little further down.',
    },
    feel: {
      ko: '가슴 앞과 배 앞쪽이 부드럽게 늘어나고, 등 윗부분이 펴지며 날개뼈 주변에 은은한 힘이 느껴지면 정답이에요. 허리가 뻐근하게 조이면 팔꿈치를 조금 앞으로 옮겨 높이를 낮추고, 다리로 퍼지는 저림이 있으면 바로 멈추세요.',
      en: 'A gentle stretch across the chest and belly, the upper back lengthening and a light effort around the shoulder blades. If your low back feels squeezed, move your elbows a little forward to lower yourself; stop right away if tingling spreads into your legs.',
    },
    easier: {
      ko: '팔꿈치를 어깨보다 5~10cm 앞에 두면 높이가 낮아져 허리 부담이 줄어요. 그래도 불편하면 ‘의자 등받이 등 펴기’로 대신해요.',
      en: 'Place your elbows 5–10 cm in front of your shoulders to lower the height and ease the low back. If it’s still uncomfortable, do the chair thoracic extension instead.',
    },
    harder: {
      ko: '버티는 시간을 45초로 늘리거나, 버티는 동안 한 팔씩 앞으로 뻗었다 내려놓기를 번갈아 해요. 익숙해지면 등을 더 크게 펴는 ‘엎드려 상체 들기’로 넘어가고, 등 근육을 키우려면 ‘엎드려 코브라’를 더해요.',
      en: 'Increase the hold to 45 seconds, or alternate reaching one arm forward and back down during the hold. When it feels easy, progress to the prone press-up for more extension range, and add the prone cobra to strengthen your upper back.',
    },
    cues: {
      ko: ['어깨는 귀에서 멀리', '가슴을 앞으로 길게', '바닥을 밀어내요', '천천히 숨 쉬어요'],
      en: ['Shoulders away from ears', 'Lengthen the chest forward', 'Push the floor away', 'Slow breaths'],
    },
    mistakes: {
      ko: [
        '어깨 사이로 목이 파묻힘 → 아래팔로 바닥을 밀어내 어깨를 귀에서 멀리 내려요.',
        '고개를 젖혀 앞이나 천장을 봄 → 시선은 손끝 한 뼘 앞 바닥에 두고, 턱을 살짝 당겨 뒷목을 길게 둬요.',
        '허리만 꺾여 뻐근함 → 가슴뼈를 앞으로 늘이는 데 집중하고, 아프면 팔꿈치를 앞으로 옮겨 높이를 낮춰요.',
        '팔꿈치가 어깨보다 뒤에 있음 → 팔꿈치를 어깨 바로 아래나 조금 앞에 둬요.',
      ],
      en: [
        'Neck sinking between the shoulders → Push the floor away with your forearms to draw the shoulders down from the ears.',
        'Tipping the head back to look ahead or up → Keep your eyes on the floor a hand-span beyond your fingertips, chin slightly tucked and the back of the neck long.',
        'Hinging only at the low back → Focus on lengthening the breastbone forward, and if it aches, move the elbows forward to lower the height.',
        'Elbows behind the shoulders → Place them directly under or slightly in front of the shoulders.',
      ],
    },
    why: {
      ko: '오래 숙이고 앉아 굽어 있던 등을 팔꿈치 받침으로 편하게 펴 주는 자세예요. 가슴 앞을 열고 등을 펴는 근육을 가볍게 써서 굽은 등과 일자 허리에 좋아요.',
      en: 'A supported way to extend a spine that has been hunched over a desk. It opens the front of the chest and lightly works the back extensors — good for a rounded upper back and a flat low back.',
    },
    muscles: {
      ko: '흉추·요추 신전 가동성, 복직근·대흉근(늘어남), 전거근·하부 승모근(어깨 내리기)',
      en: 'Thoracic & lumbar extension mobility, rectus abdominis & pecs (lengthening), serratus anterior & lower traps (shoulders down)',
    },
    caution: {
      ko: '허리 뒤를 누르는 통증이 커지거나 다리가 저리면 멈추세요. 허리를 뒤로 젖힐 때 아픈 분과 임신 중인 분은 하지 마세요.',
      en: 'Stop if pain pressing into the low back increases or your legs tingle. Skip it if bending backward hurts your back, and during pregnancy.',
    },
    avoid: ['pregnant', 'lowBackSevere', 'radiating'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [SP_DOWN, SP_UP, SP_LONG],
      labels: [
        { ko: '엎드려 아래팔 대기', en: 'Face down, forearms on mat' },
        { ko: '팔꿈치로 가슴 들기', en: 'Prop up on elbows' },
        { ko: '어깨 내리고 길게 30초', en: 'Shoulders down, long, 30 s' },
      ],
      durations: [1.8, 1, 1.8],
      pauses: [0.6, 0.5, 3],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'stretch', r: 3 },
        { a: 'backTop', b: 'backMid', side: 'back', kind: 'work', r: 2.4 },
      ],
      trace: ['chest'],
    },
  },
  {
    id: 'seated-side-reach',
    name: { ko: '앉아서 옆으로 길게 뻗기', en: 'Seated side reach' },
    phase: 'stretch',
    position: 'seated',
    regions: ['upperBack', 'lowBack', 'shoulder'],
    targets: { lateralShift: 0.6, stiffness: 0.6, shoulderTilt: 0.5, pelvicTilt: 0.4, upperBackPain: 0.3, roundShoulder: 0.3 },
    equipment: ['chair'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '팔걸이 없는 의자 가운데에 앉아, 두 발을 골반 너비보다 조금 넓게 바닥에 평평히 두고 무릎은 90°로 해요.',
        '양쪽 엉덩이뼈(좌골)에 체중을 똑같이 싣고, 정수리를 천장으로 길게 세워요.',
        '왼손으로 왼쪽 엉덩이 옆 의자 가장자리를 잡아요.',
      ],
      en: [
        'Sit in the middle of a chair without armrests, feet flat and slightly wider than hip-width, knees at 90°.',
        'Put equal weight on both sit bones and grow tall through the crown of your head.',
        'Hold the edge of the seat beside your left hip with your left hand.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이쉬며 오른팔을 귀 옆으로 곧게 들어 올려, 손끝을 천장으로 길게 뻗어요.',
        '숨을 내쉬며 오른손끝으로 왼쪽 위 대각선을 멀리 짚듯 상체를 왼쪽으로 기울여요. 오른쪽 엉덩이는 의자에서 뜨지 않아요.',
        '오른쪽 겨드랑이부터 옆구리·허리 옆까지 길게 늘어나는 지점에서 멈춰요. 가슴은 정면을 보고 앞으로 숙이지 않아요.',
        '그 자세로 30초 동안 숨 쉬며, 들이쉴 때마다 오른쪽 갈비뼈 사이가 벌어지는 느낌을 느껴요.',
        '들이쉬며 천천히 가운데로 올라와 팔을 내리고, 반대쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Inhale and raise your right arm straight up beside your ear, reaching your fingertips long toward the ceiling.',
        'Exhale and lean your upper body to the left, as if reaching your right fingertips far up and over to the left. Your right sit bone stays on the chair.',
        'Stop where you feel a long stretch from your right armpit down the side of your ribs to your waist. Keep your chest facing forward — don’t fold forward.',
        'Hold for 30 seconds, feeling the right ribs spread apart with each inhale.',
        'Inhale to come slowly back to center, lower the arm and repeat on the other side.',
      ],
    },
    breathing: {
      ko: '기울일 때 입으로 길게 내쉬고, 버티는 동안 늘어나는 옆구리로 숨을 불어넣듯 코로 깊게 들이쉬어요. 내쉴 때마다 1~2cm 더 멀리 뻗어요.',
      en: 'Exhale long as you lean, then during the hold breathe deeply through your nose as if filling the stretched side; reach 1–2 cm further with each exhale.',
    },
    feel: {
      ko: '오른쪽 겨드랑이 아래(광배근)부터 옆구리·허리 옆까지 길게 늘어나면 정답이에요. 어깨 앞이 찌릿하거나 손이 저리면 팔꿈치를 굽혀 손을 머리 위에 얹고 해요.',
      en: 'A long stretch from under your right armpit (lats) down the side of your ribs to your waist. If the front of the shoulder pinches or your hand tingles, bend the elbow and rest the hand on your head.',
    },
    easier: {
      ko: '팔을 머리 위로 들기 힘들면 오른손을 뒤통수나 허리에 얹은 채 기울여요. 기울이는 각도는 10~15°면 충분해요.',
      en: 'If raising the arm overhead is hard, rest your right hand behind your head or on your waist while you lean. Even 10–15° of lean is enough.',
    },
    harder: {
      ko: '기울인 채 가슴을 바닥(왼쪽 무릎) 쪽으로 살짝 돌리면 등 뒤쪽 갈비뼈와 광배근까지 더 늘어나요. 버티는 시간을 45초로 늘려도 좋고, 서서 하는 ‘서서 옆구리 늘리기’도 좋아요.',
      en: 'While leaning, turn your chest slightly down toward your left knee to stretch further into the back of the ribs and the lat. You can also extend the hold to 45 seconds, or try the standing side bend.',
    },
    cues: {
      ko: ['엉덩이는 의자에', '위로 길게, 옆으로', '가슴은 정면', '내쉬며 조금 더'],
      en: ['Sit bones stay down', 'Up long, then over', 'Chest faces forward', 'Exhale, a bit further'],
    },
    mistakes: {
      ko: [
        '반대쪽 엉덩이가 들림 → 양쪽 좌골을 의자에 눌러 두고, 뜨기 직전까지만 기울여요.',
        '몸이 앞으로 숙여짐 → 등 뒤에 벽이 있다고 생각하고, 가슴을 정면에 둔 채 옆으로만 기울여요.',
        '어깨를 귀 쪽으로 으쓱함 → 팔은 멀리 뻗되 날개뼈는 아래로 내려 목 옆 공간을 남겨요.',
        '팔만 머리 위로 넘김 → 갈비뼈가 함께 옆으로 휜다는 느낌으로 몸통부터 기울여요.',
      ],
      en: [
        'The opposite hip lifting → Press both sit bones into the chair and lean only until just before one lifts.',
        'Folding forward → Imagine a wall behind you; keep your chest facing forward and lean purely to the side.',
        'Shrugging into the ear → Reach the arm long but keep the shoulder blade down, leaving space beside your neck.',
        'Just throwing the arm over → Lead with the trunk so your ribs curve to the side along with the arm.',
      ],
    },
    why: {
      ko: '한쪽으로 기대앉는 습관이 있으면 옆구리의 광배근·요방형근이 짧아져 어깨와 골반 높이가 달라지기 쉬워요. 짧아진 옆구리를 늘리고, 팔을 머리 위로 올릴 때 걸리는 느낌도 줄여 줘요. 더 뻣뻣한 쪽을 한 세트 더 해 주세요.',
      en: 'Habitually leaning to one side shortens the lats and quadratus lumborum, pulling your shoulder and pelvis heights out of level. This lengthens the short side and eases reaching overhead. Add an extra set on the stiffer side.',
    },
    muscles: {
      ko: '광배근, 요방형근, 복사근, 늑간근',
      en: 'Latissimus dorsi, quadratus lumborum, obliques, intercostals',
    },
    caution: {
      ko: '허리 옆이 찌릿하거나 다리로 저림이 내려가면 기울이는 범위를 줄이거나 멈추세요.',
      en: 'Reduce the lean or stop if the side of your low back feels sharp or tingling runs down your leg.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 0,
      props: [{ kind: 'chair' }],
      keys: [SR_HOLD, SR_UP, SR_LEAN],
      labels: [
        { ko: '한 손으로 의자 잡기', en: 'One hand holds the seat' },
        { ko: '반대 팔 위로 길게', en: 'Reach the other arm up' },
        { ko: '옆으로 기울여 30초', en: 'Lean over, hold 30 s' },
      ],
      durations: [1.4, 1.8, 1.8],
      pauses: [0.5, 0.6, 3],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'hipR', side: 'out', kind: 'stretch', r: 3.4 },
        // 광배근이 겨드랑이를 지나 위팔 안쪽(머리 위로 든 팔에서는 바깥 위를 향함)으로 이어지는 부분 — 정면에서 보이도록 'in'
        { a: 'elR', b: 'shR', side: 'in', kind: 'stretch', r: 2.4, from: 0.4, to: 1 },
      ],
      trace: ['haR'],
      zoom: 1.1,
    },
    coach: {
      view: 'front',
      metric: 'trunkSide',
      mode: 'hold',
      target: 10,
      dir: 1,
      hint: { ko: '정면 1.5m 앞에 휴대폰을 세워 앉은 상체와 골반이 보이게 해 주세요', en: 'Prop the phone about 1.5 m in front so your seated upper body and hips are visible' },
      more: { ko: '조금 더 옆으로 길게', en: 'Reach a little further to the side' },
      good: { ko: '좋아요, 그대로 숨 쉬어요', en: 'Great — stay there and breathe' },
    },
  },
  {
    id: 'prone-swimmer',
    name: { ko: '엎드려 팔 수영하기', en: 'Prone swimmer' },
    phase: 'activate',
    position: 'prone',
    regions: ['upperBack', 'shoulder'],
    targets: { roundShoulder: 0.9, kyphosis: 0.7, upperBackPain: 0.5, fhp: 0.3 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 8, rest: 20 },
    setup: {
      ko: [
        '매트에 엎드려 이마 밑에 접은 수건을 받치고, 턱을 살짝 당겨 뒷목을 길게 해요. 시선은 매트를 봐요.',
        '다리는 골반 너비로 펴서 발등을 바닥에 두고, 아랫배를 살짝 끌어올리고 엉덩이를 가볍게 조여요.',
        '두 팔을 머리 위로 Y자(몸과 약 150°)로 뻗고 엄지가 천장을 향하게 해요.',
      ],
      en: [
        'Lie face down with a folded towel under your forehead; tuck your chin slightly to lengthen the back of your neck, eyes on the mat.',
        'Legs straight and hip-width apart with the tops of the feet down; lightly draw your lower belly up and squeeze your glutes.',
        'Stretch both arms overhead in a “Y” (about 150° from your body) with your thumbs pointing to the ceiling.',
      ],
    },
    steps: {
      ko: [
        '날개뼈를 아래로 살짝 끌어내리며 두 팔을 바닥에서 3~5cm 띄워요.',
        '팔을 띄운 채 2초에 걸쳐 옆으로 크게 돌려, 어깨 높이의 T자를 지나가요.',
        '이어서 2초에 걸쳐 엉덩이 옆까지 내려요. 내려오면서 팔을 안쪽으로 돌려 손바닥이 천장을 보게 해요.',
        '1초 멈춘 뒤, 같은 길을 따라 3초에 걸쳐 Y자로 돌아가요. 팔은 내내 바닥에 닿지 않아요.',
        '8회 반복하고, 세트가 끝나면 팔을 내려놓고 쉬어요.',
      ],
      en: [
        'Draw your shoulder blades slightly down and lift both arms 3–5 cm off the floor.',
        'Keeping them hovering, sweep your arms wide out to the sides over 2 seconds, passing through a “T” at shoulder height.',
        'Continue for another 2 seconds down to beside your hips, turning the arms in so your palms face the ceiling.',
        'Pause 1 second, then retrace the same path back to the “Y” over 3 seconds. The arms never touch the floor.',
        'Repeat 8 times, then rest your arms on the floor between sets.',
      ],
    },
    breathing: {
      ko: '팔을 엉덩이 쪽으로 내리는 동안 입으로 길게 내쉬고, Y로 돌아가는 동안 코로 들이쉬어요. 숨을 참지 마세요.',
      en: 'Exhale slowly through your mouth as your arms travel down to your hips, and inhale through your nose as they return to the “Y”. Don’t hold your breath.',
    },
    feel: {
      ko: '어깨 뒤쪽과 날개뼈 사이·아래쪽(등 가운데)에 힘이 들어가 점점 뻐근해지면 정답이에요. 어깨 앞이나 위쪽이 찌릿하거나 걸리면 그 구간은 팔을 바닥에 스치듯 낮춰 지나가세요.',
      en: 'Effort in the backs of the shoulders and between and below the shoulder blades (mid-back), building to a burn. If the front or top of the shoulder pinches or catches, lower the arms to brush the floor through that part.',
    },
    easier: {
      ko: '팔꿈치를 살짝 굽혀 팔을 짧게 만들거나, 팔을 바닥에 스치듯 미끄러뜨리며 해요. 한 팔씩 번갈아 해도 좋아요.',
      en: 'Bend the elbows slightly to shorten the lever, or slide the arms along the floor. You can also work one arm at a time.',
    },
    harder: {
      ko: 'Y와 엉덩이 옆에서 3초씩 버티거나, 가슴을 바닥에서 2~3cm 띄운 채로 해요. 이때는 턱을 당긴 채 이마도 수건에서 살짝 떠요.',
      en: 'Hold 3 seconds at the “Y” and at your hips, or keep your chest hovering 2–3 cm off the floor throughout — your forehead then lifts slightly off the towel too, with the chin kept tucked.',
    },
    cues: {
      ko: ['팔은 바닥에서 띄워요', '날개뼈는 아래로', '크게 원을 그려요', '이마는 수건에'],
      en: ['Arms hover off the floor', 'Blades stay down', 'Make a big arc', 'Forehead on the towel'],
    },
    mistakes: {
      ko: [
        '고개를 들어 앞을 봄 → 이마를 수건에 두고 턱을 살짝 당겨, 목은 길게 그대로 둬요.',
        '허리를 꺾어 팔을 높이 들어 올림 → 팔은 3~5cm만 띄우면 충분해요. 아랫배와 엉덩이 힘을 유지해요.',
        '팔이 중간에 바닥에 떨어짐 → 속도를 늦추고, 힘들면 팔꿈치를 살짝 굽혀 팔을 짧게 만들어요.',
        '어깨를 으쓱하며 돌림 → 매 회 시작 전에 날개뼈를 엉덩이 쪽으로 끌어내려 목 옆 공간을 남겨요.',
      ],
      en: [
        'Lifting the head to look forward → Keep your forehead on the towel and chin slightly tucked so the neck stays long.',
        'Arching the low back to lift the arms high → 3–5 cm of hover is enough; keep the belly and glutes engaged.',
        'Arms dropping to the floor mid-way → Slow down, and bend the elbows a little to shorten the lever if needed.',
        'Shrugging as you sweep → Draw the blades down toward your hips before each rep, keeping space beside your neck.',
      ],
    },
    why: {
      ko: '하부·중부 승모근과 어깨 뒤 근육(회전근개)을 머리 위부터 엉덩이 옆까지 넓은 범위에서 한 번에 강화해, 말린 어깨를 뒤·아래로 잡아 주는 힘과 지구력을 길러요.',
      en: 'Strengthens the lower/middle traps and the back-of-shoulder rotator cuff through a full range from overhead to the hips, building the strength and endurance to hold rounded shoulders back and down.',
    },
    muscles: {
      ko: '하부·중부 승모근, 능형근, 후면 삼각근, 극하근·소원근, 광배근(내릴 때)',
      en: 'Lower & middle trapezius, rhomboids, posterior deltoid, infraspinatus & teres minor, lats (on the way down)',
    },
    caution: {
      ko: '어깨가 걸리거나 찌릿한 통증이 반복되면 머리 위 구간은 빼고 T와 엉덩이 옆 사이만 움직이거나, 팔을 머리 위로 올리지 않는 ‘엎드려 W 당기기’나 ‘엎드려 코브라’로 대신하세요. 임신 중에는 하지 마세요.',
      en: 'If your shoulder catches or pinches repeatedly, skip the overhead part and move only between the “T” and your hips, or switch to the prone W pull or the prone cobra, which don’t take the arms overhead. Don’t do this during pregnancy.',
    },
    avoid: ['pregnant', 'shoulderSevere'],
    anim: {
      view: 90,
      elev: 40,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [SW_Y, SW_T, SW_HIP],
      labels: [
        { ko: 'Y로 팔 띄우기', en: 'Arms hover in a Y' },
        { ko: '옆으로 돌려 T', en: 'Sweep out to a T' },
        { ko: '엉덩이 옆까지', en: 'Down to the hips' },
      ],
      durations: [1.8, 1.8, 2.6],
      pauses: [0.6, 0.2, 0.8],
      focus: [
        { a: 'shR', b: 'backMid', side: 'back', kind: 'work', r: 2.6 },
        { a: 'shL', b: 'backMid', side: 'back', kind: 'work', r: 2.6 },
        { a: 'shR', b: 'elR', side: 'back', kind: 'work', r: 2.2, from: 0, to: 0.5 },
      ],
      trace: ['haR'],
    },
  },
];
