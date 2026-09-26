/**
 * 운동 라이브러리 · 호흡·코어
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { QUAD, SIT, SUPINE, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 이 파일에서 쓰는 자세 ─────────────────────
/**
 * 360° 호흡: 왼손은 쇄골 아래 가슴 위(손끝이 오른쪽 위를 향함),
 * 오른손은 옆구리 아래 갈비뼈를 감쌈(손목은 옆구리 옆, 손끝은 앞쪽, 팔꿈치는 옆·뒤로)
 */
const BREATH_HANDS: Pose = { shL: { flex: 35, abd: 21, rot: -48 }, elL: 132, wrL: 2, shR: { flex: -34, abd: 46, rot: -52 }, elR: 138 };
/** 데드버그 테이블 자세: 팔은 천장으로, 엉덩이·무릎 90° */
const TABLETOP: Pose = merge(SUPINE, both({ hip: { flex: 90 }, kn: 90, an: 0, sh: { flex: 90 }, el: 2 }));
/**
 * 맥길 컬업: 오른무릎 세워 발바닥을 바닥에 평평하게(엉덩이 46°·무릎 105°·발목 −31°), 왼다리는 펴기.
 * 양손은 손바닥을 아래로 허리 오목한 곳 밑에, 팔꿈치는 몸 옆 바닥에
 */
const CURL_BASE: Pose = merge(SUPINE, { hipR: { flex: 46 }, knR: 105, anR: -31 }, both({ sh: { flex: -12, abd: 39, rot: -100 }, el: 107, wr: 21 }));
/** 머리·목·어깨를 한 덩어리로 살짝 들기(흉곽만 10°) — 손·팔꿈치가 바닥에 그대로 있도록 어깨 각도 보정 */
const CURL_LIFT: Pose = merge(CURL_BASE, { thorax: { flex: 10 }, neck: { flex: 2 } }, both({ sh: { flex: -12, abd: 38, rot: -97 }, el: 104, wr: 20 }));
/** 플랭크: 몸통 기울기(pitch)와 같은 각도로 팔을 들면 위팔이 수직(팔꿈치가 어깨 바로 아래) */
const plankArms = (pitch: number): Pose => both({ sh: { flex: pitch, abd: 6 }, el: 90 });
/** 팔꿈치·무릎 대고 엎드린 자세(엉덩이가 어깨보다 높아 몸통이 20° 기울어짐, 발끝 세움) */
const FOREARM_QUAD: Pose = merge({ root: { pitch: 110 } }, plankArms(110), both({ hip: { flex: 110 }, kn: 102, an: -22 }), { neck: { flex: -6 } });
/** 무릎 사이드 플랭크(오른쪽 아래): 오른 팔꿈치는 어깨 아래(abd 는 키마다), 왼팔은 몸 옆선을 따라 내려 손은 엉덩이 옆 */
const SIDE_ARMS: Pose = { elR: 90, shL: { abd: 4 }, elL: 10 };

export const CORE: Exercise[] = [
  {
    id: 'breath-360',
    name: { ko: '360° 복식 호흡', en: '360° breathing' },
    phase: 'breath',
    position: 'seated',
    regions: ['core', 'upperBack'],
    targets: { stress: 1, stiffness: 0.4, lordosis: 0.3, fhp: 0.2, roundShoulder: 0.2 },
    equipment: [],
    level: 1,
    dose: { kind: 'time', sets: 1, value: 60 },
    desk: true,
    setup: {
      ko: [
        '의자 앞쪽 1/3에 앉아 두 발을 골반 너비로 바닥에 평평하게 두고, 무릎은 90도로 둬요.',
        '엉덩이 아래 뼈(좌골) 두 개로 바르게 앉아 허리를 세우고, 정수리를 천장 쪽으로 길게 뻗어요.',
        '왼손은 쇄골 바로 아래 가슴 위에, 오른손은 옆구리 아래쪽 갈비뼈를 엄지가 등 쪽을 향하게 감싸요.',
        '어깨를 한 번 으쓱했다가 툭 떨어뜨리고, 시선은 정면 눈높이에 둬요.',
      ],
      en: [
        'Sit on the front third of the chair, feet flat and hip-width apart, knees at 90°.',
        'Sit tall on your two sit bones with your low back upright, and reach the crown of your head toward the ceiling.',
        'Rest your left hand on your upper chest just below the collarbone, and wrap your right hand around your lower ribs with the thumb pointing back.',
        'Shrug once and let your shoulders drop; keep your eyes level.',
      ],
    },
    steps: {
      ko: [
        '먼저 입으로 “후—” 편하게 한 번 내쉬어 갈비뼈를 아래로 내려놓고 시작해요.',
        '코로 4초 동안 천천히 들이마시며 배·옆구리·허리 뒤쪽을 풍선처럼 사방(360°)으로 부풀려요. 오른손이 옆으로 1~2cm 밀려나야 해요.',
        '들이마시는 동안 가슴 위 왼손과 어깨는 거의 움직이지 않게 해요.',
        '입술을 살짝 오므리고 6초 동안 길게 내쉬며, 갈비뼈가 아래·안쪽으로 모이고 아랫배가 살짝 납작해지는 걸 느껴요.',
        '한 번에 10초(4초 들숨 + 6초 날숨)씩, 시간이 끝날 때까지 반복해요(1분이면 6번).',
      ],
      en: [
        'Start with one easy “haaa” out through the mouth to let your ribs settle down.',
        'Breathe in through your nose for 4 seconds, expanding belly, sides and low back in every direction (360°) like a balloon. Your right hand should be pushed out 1–2 cm.',
        'While you breathe in, keep the left hand on your chest and your shoulders almost still.',
        'Purse your lips and breathe out slowly for 6 seconds, feeling the ribs draw down and in and the lower belly gently flatten.',
        'Each breath takes 10 seconds (4 in + 6 out) — keep repeating until the timer ends (6 breaths a minute).',
      ],
    },
    breathing: {
      ko: '코로 4초 들이마시고, 오므린 입으로 6초 내쉬어요. 날숨을 들숨보다 길게 하는 게 긴장을 푸는 핵심이에요. 숨이 차면 3초 들숨·5초 날숨으로 줄여요.',
      en: 'In through the nose for 4 seconds, out through pursed lips for 6. Making the out-breath longer than the in-breath is what helps you relax. If you feel short of air, shorten it to 3 in and 5 out.',
    },
    feel: {
      ko: '들이마실 때 오른손 아래 옆구리와 허리 뒤쪽이 넓어지고, 내쉴 때 아랫배가 안쪽으로 은은하게 조이면 정답이에요. 목·어깨가 먼저 들썩이면 숨을 조금 작게 쉬어요. 어지럽거나 손끝이 저리면 멈추고 평소처럼 숨 쉬어요.',
      en: 'Your sides and low back widen under your right hand as you breathe in, and your lower belly gently tightens as you breathe out. If your neck and shoulders lift first, take a smaller breath. If you feel dizzy or your fingertips tingle, stop and breathe normally.',
    },
    easier: {
      ko: '무릎을 세우고 바로 누워서 해 보세요. 누우면 어깨가 저절로 조용해져 배·옆구리 호흡을 느끼기 쉬워요. 3초 들숨·4초 날숨으로 짧게 해도 괜찮아요.',
      en: 'Try it lying on your back with knees bent — lying down quiets the shoulders, so belly and side breathing is easier to feel. A shorter 3-in, 4-out rhythm is fine too.',
    },
    harder: {
      ko: '날숨을 8초까지 늘리거나, 네발 자세에서 등 쪽으로 숨을 채워 보세요. 익숙해지면 서서, 또는 데드버그·버드독을 하는 동안에도 같은 호흡을 유지해요.',
      en: 'Stretch the out-breath to 8 seconds, or try breathing into your back from all fours. Once it’s easy, keep the same breathing while standing or during dead bugs and bird dogs.',
    },
    cues: { ko: ['코로 4초 들이마셔요', '옆구리를 넓게', '입으로 6초 내쉬어요', '어깨는 조용히'], en: ['In through the nose, four', 'Widen your sides', 'Out through the mouth, six', 'Shoulders stay quiet'] },
    mistakes: {
      ko: [
        '가슴·어깨가 먼저 들썩임 → 왼손이 올라가면 숨을 조금 작게 쉬고, 오른손 아래 옆구리부터 채워요.',
        '배만 앞으로 볼록 내밈 → 배·옆구리·허리 뒤쪽 세 방향이 같이 넓어지게, 오른손이 옆으로 밀려나는지 확인해요.',
        '들이마실 때 허리가 꺾이고 가슴이 들림 → 골반을 세운 채, 갈비뼈 아래쪽이 앞으로 들리지 않게 해요.',
        '날숨이 짧고 급함 → 입술을 오므려 빨대로 불듯 6초 동안 천천히 내쉬어요.',
      ],
      en: [
        'Chest and shoulders rising first → If your left hand lifts, take a smaller breath and fill your sides under the right hand first.',
        'Only pushing the belly out → Widen belly, sides and low back together; check that your right hand is pushed outward.',
        'Arching the back and lifting the chest on the in-breath → Keep your pelvis upright and don’t let your lower ribs flare forward.',
        'Short, rushed out-breath → Purse your lips and blow out slowly for 6 seconds, as if through a straw.',
      ],
    },
    why: {
      ko: '얕은 가슴 호흡은 목·어깨의 보조 호흡근(사각근·상부승모근)을 하루 종일 쓰게 해 뭉침을 키워요. 횡격막으로 360° 숨 쉬면 목·어깨 긴장이 풀리고, 배 안쪽 압력이 생겨 코어가 안쪽부터 척추를 받쳐 줘요.',
      en: 'Shallow chest breathing keeps the neck and shoulder helper muscles (scalenes, upper traps) working all day. Breathing 360° with the diaphragm eases neck and shoulder tension and builds pressure inside the trunk, so your core supports the spine from the inside.',
    },
    muscles: { ko: '횡격막, 복횡근, 늑간근, 골반저근', en: 'Diaphragm, transversus abdominis, intercostals, pelvic floor' },
    caution: { ko: '어지럽거나 손발이 저리면 멈추고 평소 호흡으로 돌아가요.', en: 'If you feel light-headed or your hands and feet tingle, stop and return to normal breathing.' },
    anim: {
      view: 30,
      props: [{ kind: 'chair' }],
      // 가슴·어깨·머리는 그대로 두고, 들숨에 옆구리가 넓어지며 오른손만 옆으로 약 2cm 밀려남
      keys: [merge(SIT, BREATH_HANDS, { thorax: { flex: 2 } }), merge(SIT, BREATH_HANDS, { thorax: { flex: 2 }, shR: { abd: 51 } })],
      labels: [
        { ko: '입으로 6초 내쉬기', en: 'Breathe out, 6 s' },
        { ko: '코로 4초 들이마시기', en: 'Breathe in, 4 s' },
      ],
      // 들숨 4초 → 날숨 6초 (한 번에 10초)
      durations: [4, 6],
      pauses: [0, 0],
      focus: [
        { a: 'pelvis', b: 'chest', side: 'front', kind: 'work', r: 3.4, from: 0.25, to: 0.6 },
        { a: 'hipR', b: 'shR', side: 'out', kind: 'work', r: 2.4, from: 0.35, to: 0.62 },
      ],
      zoom: 1.2,
    },
  },
  {
    id: 'dead-bug',
    name: { ko: '데드버그', en: 'Dead bug' },
    phase: 'activate',
    position: 'supine',
    regions: ['core', 'lowBack'],
    targets: { lordosis: 0.9, lowBackPain: 0.6, swayback: 0.5, lateralShift: 0.2 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, perSide: true, rest: 20 },
    setup: {
      ko: [
        '매트에 바로 누워 두 팔을 어깨 바로 위로 곧게 뻗어 손끝이 천장을 향하게 해요.',
        '다리를 하나씩 들어 엉덩이와 무릎을 각각 90도로 굽혀요(테이블 자세). 무릎은 골반 바로 위, 정강이는 바닥과 평행이에요.',
        '숨을 내쉬며 갈비뼈 아래쪽을 골반 쪽으로 내려, 허리와 매트 사이 틈을 손가락 한 개 정도로 줄여요.',
        '뒤통수는 매트에 두고 턱을 살짝 당겨 천장을 봐요.',
      ],
      en: [
        'Lie on your back on a mat and reach both arms straight up over your shoulders, fingertips to the ceiling.',
        'Lift your legs one at a time and bend hips and knees to 90° (tabletop): knees over hips, shins parallel to the floor.',
        'Breathe out and draw your lower ribs toward your pelvis so the gap between your low back and the mat shrinks to about one finger.',
        'Keep the back of your head on the mat, chin slightly tucked, eyes on the ceiling.',
      ],
    },
    steps: {
      ko: [
        '코로 들이마시며 준비하고, 배에 20~30% 정도 힘을 줘 허리 틈을 그대로 지켜요.',
        '입으로 내쉬며 2초에 걸쳐 오른팔은 머리 위 바닥 쪽으로, 왼다리는 뒤꿈치를 멀리 밀며 무릎을 펴서 바닥 쪽으로 내려요.',
        '팔·다리가 바닥에서 한 뼘(15~20cm) 위에 오거나, 허리가 뜨기 직전이면 멈춰요. 더 내리지 않아요.',
        '들이마시며 2초에 걸쳐 처음 테이블 자세로 돌아와요.',
        '오른팔·왼다리로 8회를 이어서 한 뒤, 반대쪽(왼팔·오른다리)으로 바꿔 8회 해요.',
      ],
      en: [
        'Breathe in through your nose to prepare, and brace your belly at about 20–30% to keep that small gap under your back.',
        'Breathe out and, over 2 seconds, reach your right arm overhead toward the floor while your left leg straightens, heel pushing away, and lowers toward the floor.',
        'Stop when your arm and leg are a hand-span (15–20 cm) above the floor, or just before your back starts to lift — no lower.',
        'Breathe in and take 2 seconds to return to tabletop.',
        'Do all 8 reps with the right arm and left leg, then switch to the left arm and right leg for 8.',
      ],
    },
    breathing: {
      ko: '뻗을 때 입으로 “후—” 길게 내쉬고, 돌아올 때 코로 들이마셔요. 내쉬는 숨이 갈비뼈를 내려 허리를 지켜 줘요.',
      en: 'Blow out a long “haaa” as you reach, and breathe in through your nose as you return. The out-breath keeps your ribs down and your back protected.',
    },
    feel: {
      ko: '배 앞쪽과 옆구리 깊은 곳이 단단하게 버티면 정답이에요. 허리가 뜨거나 허리 쪽이 뻐근하면 다리를 덜 내리고, 허리나 다리로 퍼지는 찌릿함·저림이 생기면 멈춰요.',
      en: 'Your front and side abs should work hard to keep you still. If your back lifts or your low back aches, don’t lower the leg as far; stop if you feel tingling or pain spreading into your back or legs.',
    },
    easier: {
      ko: '팔만, 또는 다리만 움직여요. 다리는 무릎을 90도로 굽힌 채 뒤꿈치로 바닥을 톡 찍고 돌아오는 ‘힐 탭’부터 시작해도 좋아요.',
      en: 'Move only the arms, or only the legs. You can also start with heel taps: keep the knee bent at 90° and just tap the heel to the floor and return.',
    },
    harder: {
      ko: '뻗은 자세에서 2~3초 멈추거나 한쪽 10~12회로 늘려요. 더 어렵게는 양손에 가벼운 물병(0.5~1kg)을 들고 해요.',
      en: 'Pause 2–3 seconds in the reach or build up to 10–12 reps per side. For more challenge, hold a light water bottle (0.5–1 kg) in each hand.',
    },
    cues: { ko: ['허리는 매트에', '내쉬며 멀리 뻗어요', '갈비뼈는 아래로', '천천히 돌아와요'], en: ['Back stays down', 'Exhale and reach long', 'Ribs stay down', 'Return slowly'] },
    mistakes: {
      ko: [
        '허리가 매트에서 뜸 → 다리를 덜 내리고(바닥에서 30cm 이상), 내쉬며 갈비뼈를 골반 쪽으로 내려요.',
        '팔다리를 빠르게 휘두름 → “하나, 둘” 세며 2초 동안 뻗고 2초 동안 돌아와요.',
        '숨을 참음 → 뻗을 때 내쉬고, 돌아올 때 들이마셔요.',
        '고개나 어깨가 들림 → 뒤통수와 어깨뼈를 매트에 무겁게 두고, 팔은 어깨에서만 움직여요.',
      ],
      en: [
        'Low back lifting off the mat → Lower the leg less (stay 30 cm or more above the floor) and exhale to draw your ribs toward your pelvis.',
        'Swinging the limbs fast → Count “one, two” to reach over 2 seconds, and take 2 seconds to return.',
        'Holding your breath → Exhale as you reach, inhale as you return.',
        'Head or shoulders lifting → Keep the back of your head and your shoulder blades heavy on the mat; move the arm only from the shoulder.',
      ],
    },
    why: {
      ko: '팔다리가 움직이는 동안 허리를 중립으로 지키는 깊은 코어 조절력을 길러요. 허리가 과하게 꺾이는 자세(허리 과전만)와, 걷거나 물건을 들 때 허리가 흔들리는 습관을 줄이는 데 좋아요.',
      en: 'Builds deep-core control to keep your spine neutral while your arms and legs move. Great for reducing an over-arched low back and the habit of your back wobbling when you walk or lift.',
    },
    muscles: { ko: '복횡근, 복직근, 내·외복사근', en: 'Transversus abdominis, rectus abdominis, internal & external obliques' },
    caution: { ko: '허리 통증이 심해지거나 다리로 저림이 퍼지면 멈춰요.', en: 'Stop if your back pain increases or tingling spreads down a leg.' },
    avoid: ['pregnant', 'lowBackSevere'],
    anim: {
      view: 90,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [TABLETOP, merge(TABLETOP, { hipL: { flex: 10 }, knL: 4, shR: { flex: 172 } })],
      labels: [
        { ko: '테이블 자세, 허리 붙이기', en: 'Tabletop, back down' },
        { ko: '팔과 반대쪽 다리 뻗기', en: 'Reach arm and opposite leg' },
      ],
      durations: [2, 2],
      pauses: [0.3, 0.5],
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 3 },
        { a: 'shR', b: 'hipL', side: 'front', kind: 'work', r: 2.2, from: 0.3, to: 0.85 },
      ],
      trace: ['haR', 'heelL'],
    },
  },
  {
    id: 'bird-dog',
    name: { ko: '버드독', en: 'Bird dog' },
    phase: 'activate',
    position: 'quadruped',
    regions: ['core', 'lowBack', 'glute'],
    targets: { lowBackPain: 0.8, lordosis: 0.5, lateralShift: 0.4, pelvicTilt: 0.3, swayback: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4, holdSec: 3, perSide: true, rest: 15 },
    setup: {
      ko: [
        '매트에 네발로 엎드려 손목은 어깨 바로 아래, 무릎은 골반 바로 아래에 두고, 두 무릎 사이는 주먹 하나만큼 벌려요.',
        '손가락을 넓게 펴고 바닥을 가볍게 밀어, 어깨가 귀에서 멀어지고 등 윗부분이 꺼지지 않게 해요.',
        '허리는 처지지도 둥글지도 않은 자연스러운 곡선으로 두고, 시선은 두 손 사이 바닥에 둬 목을 등과 일직선으로 해요.',
      ],
      en: [
        'Kneel on all fours on a mat: wrists under shoulders, knees under hips, knees a fist-width apart.',
        'Spread your fingers and push the floor away lightly so your shoulders move away from your ears and your upper back doesn’t sag.',
        'Keep your low back in its natural curve — neither sagging nor rounded — and look at the floor between your hands so your neck lines up with your back.',
      ],
    },
    steps: {
      ko: [
        '배꼽을 살짝 당겨 배에 20% 정도 힘을 주고, 입으로 내쉬기 시작해요.',
        '왼발 끝을 바닥에 끌듯이 뒤로 밀어 무릎을 쭉 펴요.',
        '이어서 왼다리를 골반 높이까지 들고, 동시에 오른팔을 어깨 높이로 앞으로 뻗어요. 손끝과 뒤꿈치가 서로 반대 방향으로 멀어지게 해요.',
        '그 자세로 3초 버텨요. 등 위에 물컵이 있다고 생각하고 골반과 어깨를 수평으로 지켜요.',
        '2초에 걸쳐 손과 무릎을 처음 자리로 내려놓아요. 오른팔·왼다리로 8회를 마친 뒤, 반대쪽(왼팔·오른다리)으로 바꿔 8회 해요.',
      ],
      en: [
        'Draw your belly button in slightly to brace at about 20%, and start breathing out through your mouth.',
        'Slide your left toes back along the floor until the knee is straight.',
        'Then lift the left leg to hip height while reaching the right arm forward to shoulder height. Fingertips and heel reach away from each other.',
        'Hold for 3 seconds. Imagine a glass of water on your back — keep your hips and shoulders level.',
        'Take 2 seconds to bring the hand and knee back down. Finish all 8 reps with the right arm and left leg, then switch to the left arm and right leg for 8.',
      ],
    },
    breathing: {
      ko: '뻗으면서 입으로 내쉬고, 3초 버티는 동안은 코로 짧게 숨 쉬고, 돌아오면서 들이마셔요.',
      en: 'Exhale through your mouth as you reach, take small breaths through your nose during the 3-second hold, and inhale as you return.',
    },
    feel: {
      ko: '뻗은 다리 쪽 엉덩이, 등 근육, 배가 함께 단단해지면 정답이에요. 허리가 조이거나 뻐근하면 다리를 조금 낮추고, 손목·무릎이 아프면 주먹을 쥐거나 무릎 밑에 수건을 깔아요. 찌릿하거나 저린 통증이면 멈춰요.',
      en: 'The glute of the lifted leg, your back muscles and your abs should all firm up together. If your low back pinches or aches, lower the leg a little; if your wrists or knees hurt, make fists or pad your knees with a towel. Stop for any sharp or tingling pain.',
    },
    easier: {
      ko: '다리만(발끝을 뒤로 미는 데까지), 또는 팔만 뻗어요. 손목이 불편하면 주먹을 쥐거나 팔꿈치를 대고 해요.',
      en: 'Move only the leg (just sliding the toes back) or only the arm. If your wrists complain, make fists or rest on your forearms.',
    },
    harder: {
      ko: '버티는 시간을 8~10초로 늘리거나, 매 회 손과 무릎을 바닥에 내려놓지 않고 바닥 위 1cm까지만 스치듯 돌아왔다가 다시 뻗어요. 뻗은 채로 손과 발로 작은 네모(10cm)를 그려도 좋아요. 몸통이 흔들리지 않게 하는 게 핵심이에요.',
      en: 'Build the hold up to 8–10 seconds, or between reps don’t rest the hand and knee — just sweep them to 1 cm above the floor and reach out again. You can also draw small 10 cm squares with your hand and foot while extended. The key is keeping your trunk still.',
    },
    cues: { ko: ['골반은 수평', '뒤꿈치로 뒷벽 밀기', '손끝은 멀리 앞으로', '허리는 그대로'], en: ['Hips level', 'Push your heel back', 'Reach long in front', 'Back stays still'] },
    mistakes: {
      ko: [
        '다리를 너무 높이 들어 허리가 꺾임 → 다리는 골반 높이까지만, 뒤꿈치를 위가 아니라 뒤로 멀리 밀어요.',
        '다리 쪽 골반이 들리거나 돌아감 → 발끝이 바닥을 향하게 두고, 양쪽 골반 높이를 같게 지켜요.',
        '몸이 받치는 손 쪽으로 쏠림 → 무게를 손과 무릎 가운데에 두고, 흔들리면 팔만·다리만 먼저 연습해요.',
        '고개를 들어 앞을 봄 → 시선은 손 사이 바닥에 두고, 뒤통수부터 꼬리뼈까지 일직선으로 해요.',
      ],
      en: [
        'Lifting the leg too high and arching → Lift only to hip height and push the heel back, not up.',
        'Hip on the leg side hiking or rotating → Point your toes to the floor and keep both sides of the pelvis at the same height.',
        'Shifting onto the supporting hand → Keep your weight centred between hand and knee; if you wobble, practise arm-only or leg-only first.',
        'Lifting the head to look forward → Look at the floor between your hands and keep a straight line from the back of your head to your tailbone.',
      ],
    },
    why: {
      ko: '허리를 거의 움직이지 않은 채 등·엉덩이·배 근육을 함께 켜서 척추를 버티는 힘을 길러요. 허리 부담이 적어 요통이 있는 분들도 많이 하는 기본 운동이에요(맥길 Big 3).',
      en: 'Switches on your back, glutes and abs together while the spine barely moves, building the strength that holds your spine steady. Its low spinal load makes it a go-to for people with back pain (one of McGill’s Big 3).',
    },
    muscles: { ko: '척추기립근, 다열근, 대둔근, 복횡근·복사근, 전거근', en: 'Erector spinae, multifidus, gluteus maximus, transversus abdominis & obliques, serratus anterior' },
    caution: { ko: '허리나 다리로 찌릿하게 퍼지는 통증이 생기면 멈춰요.', en: 'Stop if you feel sharp pain spreading into your back or legs.' },
    avoid: ['wristPain', 'kneePain'],
    anim: {
      view: 90,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['haL', 'knR'],
      keys: [
        QUAD,
        merge(QUAD, { hipL: { flex: 14 }, knL: 4, anL: -40 }),
        merge(QUAD, { shR: { flex: 168 }, elR: 2, wrR: 0, hipL: { flex: -8 }, knL: 4, anL: -20, neck: { flex: -8 } }),
      ],
      labels: [
        { ko: '네발, 배에 살짝 힘', en: 'All fours, light brace' },
        { ko: '다리 뒤로 밀어 펴기', en: 'Slide the leg back' },
        { ko: '팔·반대 다리 뻗어 3초', en: 'Reach long, hold 3 s' },
      ],
      durations: [1.1, 1, 1.8],
      pauses: [0.3, 0.2, 3],
      holdKey: 2,
      focus: [
        { a: 'pelvis', b: 'hipL', side: 'back', kind: 'work', r: 3.8 },
        { a: 'backMid', b: 'pelvis', side: 'back', kind: 'work', r: 2.6 },
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 2.2, from: 0.3, to: 0.8 },
      ],
      trace: ['heelL', 'haR'],
    },
  },
  {
    id: 'mcgill-curlup',
    name: { ko: '맥길 컬업', en: 'McGill curl-up' },
    phase: 'activate',
    position: 'supine',
    regions: ['core', 'lowBack'],
    targets: { lowBackPain: 0.8, lordosis: 0.4, swayback: 0.3 },
    equipment: ['mat'],
    level: 2,
    // 1회 12초 = 쉬기 1.5 + 들기 1 + 버티기 8 + 내리기 1.5
    dose: { kind: 'reps', sets: 2, value: 6, tempo: 4, holdSec: 8, rest: 20 },
    setup: {
      ko: [
        '매트에 바로 누워 오른쪽 무릎은 세워 발바닥을 바닥에 두고, 왼다리는 쭉 펴서 내려놓아요.',
        '두 손바닥을 바닥 쪽으로 겹쳐 허리 아래 오목한 곳(배꼽 뒤)에 넣어요. 허리를 손 위로 누르지도, 더 띄우지도 않아요.',
        '팔꿈치는 바닥에 편하게 두고, 턱을 살짝 당겨 목 뒤를 길게 한 뒤 혀끝을 윗니 뒤 입천장에 대요.',
      ],
      en: [
        'Lie on your back on a mat with the right knee bent, foot flat, and the left leg straight on the floor.',
        'Stack your hands palms-down under the hollow of your low back (behind your belly button). Don’t press your back into them or arch it higher.',
        'Rest your elbows on the floor, tuck your chin slightly to lengthen the back of your neck, and rest the tip of your tongue on the roof of your mouth behind your front teeth.',
      ],
    },
    steps: {
      ko: [
        '누가 배를 툭 칠 것처럼 배에 단단히(20~30%) 힘을 주고, 숨은 멈추지 않아요.',
        '숨을 내쉬며 머리·목·어깨를 한 덩어리로 바닥에서 살짝 들어요. 어깨뼈 윗부분이 막 떨어질 정도(3~5cm)면 충분해요.',
        '고개를 끄덕이거나 턱을 가슴으로 당기지 말고, 시선은 천장의 한 점에 둬요. 저울 위에 올린 머리의 무게만 살짝 빼는 느낌이에요.',
        '그 높이에서 8초 버티며 코로 짧게 숨 쉬어요.',
        '1~2초에 걸쳐 천천히 내려와 1~2초 쉬고, 6회 반복해요. 두 번째 세트는 세운 무릎을 바꿔요.',
      ],
      en: [
        'Brace your belly firmly (20–30%), as if someone were about to poke it — but keep breathing.',
        'Breathe out and lift your head, neck and shoulders as one unit just off the floor — only until the tops of your shoulder blades clear it (3–5 cm).',
        'Don’t nod or pull your chin to your chest; keep your eyes on one spot on the ceiling. Think of your head resting on a scale and just taking some weight off it.',
        'Hold that height for 8 seconds, taking short breaths through your nose.',
        'Lower slowly over 1–2 seconds, rest 1–2 seconds and repeat 6 times. Switch the bent knee for the second set.',
      ],
    },
    breathing: {
      ko: '들어 올리며 입으로 “후—” 내쉬고, 8초 버티는 동안은 배의 단단함을 유지한 채 코로 짧고 가볍게 숨 쉬어요. 숨을 참으면 목과 얼굴에 힘이 몰려요.',
      en: 'Exhale through your mouth as you lift, then keep the brace and take short, light breaths through your nose during the 8-second hold. Holding your breath sends tension into your neck and face.',
    },
    feel: {
      ko: '배 앞쪽(명치 아래~배꼽 위)이 단단하게 버티고 살짝 떨릴 수 있어요. 목 앞이 먼저 당기면 머리를 덜 들고, 허리 통증이나 다리로 퍼지는 저림이 생기면 멈춰요.',
      en: 'The front of your belly (from below the breastbone to above the navel) should work hard and may shake a little. If the front of your neck strains first, lift less; stop if you get back pain or tingling down a leg.',
    },
    easier: {
      ko: '머리는 바닥에 둔 채 배에만 힘을 줘 8초 버텨요. 버티는 시간을 5초로 줄여도 좋아요.',
      en: 'Keep your head on the floor and just brace your belly for 8 seconds. You can also shorten the hold to 5 seconds.',
    },
    harder: {
      ko: '버티는 동안 팔꿈치를 바닥에서 1~2cm 띄우거나, 버티는 시간을 10초로 늘려요. 그다음엔 6-4-2회처럼 세트마다 횟수를 줄이는 3세트로 해요.',
      en: 'Lift your elbows 1–2 cm off the floor during the hold, or extend it to 10 seconds. Then try 3 sets with falling reps, such as 6-4-2.',
    },
    cues: { ko: ['머리·어깨 한 덩어리', '살짝만 들어요', '턱은 그대로', '8초 버텨요'], en: ['Head and shoulders as one', 'Just a little', 'Chin stays put', 'Hold for eight'] },
    mistakes: {
      ko: [
        '윗몸일으키기처럼 크게 들어 올림 → 어깨뼈 윗부분이 막 떨어질 정도(3~5cm)면 충분해요.',
        '턱을 가슴에 붙이며 목만 굽힘 → 턱 밑에 달걀 하나 공간을 두고, 머리·목·어깨를 한 덩어리로 들어요.',
        '허리를 손 위로 꾹 누름 → 허리의 자연스러운 곡선을 손 위에 그대로 올려 두기만 해요.',
        '숨을 참음 → 들 때 내쉬고, 버티는 동안 코로 짧게 계속 숨 쉬어요.',
      ],
      en: [
        'Crunching up high → Lifting just until the tops of your shoulder blades clear the floor (3–5 cm) is enough.',
        'Tucking the chin to the chest and bending only the neck → Keep an egg-sized space under your chin and lift head, neck and shoulders as one.',
        'Pressing the low back down into your hands → Just let the natural curve of your back rest on your hands.',
        'Holding your breath → Exhale as you lift and keep taking short nose breaths while you hold.',
      ],
    },
    why: {
      ko: '허리를 반복해서 굽히지 않고도 배 앞쪽 근육을 단련하는, 허리에 부담이 적은 복근 운동이에요. 허리의 자연스러운 곡선을 지킨 채 버티는 힘을 길러 줘요(맥길 Big 3).',
      en: 'A spine-sparing ab exercise that trains the front of your core without repeated bending, building the strength to hold your low back’s natural curve (one of McGill’s Big 3).',
    },
    muscles: { ko: '복직근, 내·외복사근', en: 'Rectus abdominis, internal & external obliques' },
    caution: { ko: '목이 아프거나 어지러우면 머리는 바닥에 둔 채 배에만 힘을 줘요.', en: 'If your neck hurts or you feel dizzy, leave your head on the floor and just brace your belly.' },
    avoid: ['pregnant', 'neckSevere'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [CURL_BASE, CURL_LIFT],
      labels: [
        { ko: '한 무릎 세우고 눕기', en: 'Lie with one knee bent' },
        { ko: '머리·어깨 살짝 들어 8초', en: 'Lift slightly, hold 8 s' },
      ],
      // 12초 = 쉬기 1.5 → 들기 1 → 버티기 8 → 내리기 1.5 (dose tempo 4 + holdSec 8 과 같음)
      durations: [1, 1.5],
      pauses: [1.5, 8],
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 3, from: 0.1, to: 0.75 },
        { a: 'shR', b: 'hipR', side: 'out', kind: 'work', r: 2.2, from: 0.35, to: 0.85 },
      ],
      zoom: 1.2,
    },
  },
  {
    id: 'forearm-plank',
    name: { ko: '플랭크', en: 'Forearm plank' },
    phase: 'integrate',
    position: 'prone',
    regions: ['core'],
    targets: { lordosis: 0.5, lowBackPain: 0.3, swayback: 0.3 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'hold', sets: 2, value: 25, rest: 25 },
    setup: {
      ko: [
        '매트에 팔꿈치와 무릎을 대고 엎드려요. 팔꿈치는 어깨 바로 아래, 무릎은 골반 바로 아래예요.',
        '아래팔은 앞으로 나란히(11자) 두거나 두 손을 가볍게 모으고, 팔꿈치로 바닥을 밀어 어깨뼈 사이가 꺼지지 않게 해요.',
        '발가락을 세워 발끝으로 바닥을 딛고, 시선은 두 손 앞 바닥 10~20cm 지점에 둬요.',
      ],
      en: [
        'Get onto your forearms and knees on a mat: elbows directly under your shoulders, knees under your hips.',
        'Keep your forearms parallel (or hands lightly together) and push the floor away with your elbows so you don’t sink between your shoulder blades.',
        'Tuck your toes under and look at the floor 10–20 cm in front of your hands.',
      ],
    },
    steps: {
      ko: [
        '배꼽을 살짝 당기고 엉덩이를 조여 꼬리뼈를 살짝 말아요.',
        '오른다리를 뒤로 쭉 뻗어 발끝으로 딛고, 이어서 왼다리도 뒤로 뻗어 두 발을 골반 너비로 둬요.',
        '옆에서 봤을 때 머리·어깨·골반·뒤꿈치가 일직선이 되게 골반 높이를 맞춰요.',
        '팔꿈치로 바닥을 밀고 뒤꿈치는 뒤로 밀어, 몸을 앞뒤로 길게 늘이는 느낌으로 25초 버텨요.',
        '무릎을 한쪽씩 바닥에 내려놓고 쉬어요. 25초 쉬고 한 세트 더 해요.',
      ],
      en: [
        'Draw your belly button in slightly and squeeze your glutes to tuck your tailbone a little.',
        'Step your right leg straight back onto your toes, then the left, feet hip-width apart.',
        'Adjust your hip height so that, seen from the side, head, shoulders, hips and heels form one straight line.',
        'Push the floor away with your elbows and press your heels back, as if lengthening your body front to back. Hold for 25 seconds.',
        'Lower one knee at a time to rest. Rest 25 seconds, then do one more set.',
      ],
    },
    breathing: {
      ko: '버티는 동안 배의 단단함은 유지한 채 코로 들이마시고 입으로 짧게 내쉬어요. 숫자를 소리 내어 세면 숨을 참지 않게 돼요.',
      en: 'Keep your brace while you breathe in through your nose and out in short breaths through your mouth. Counting out loud stops you from holding your breath.',
    },
    feel: {
      ko: '배 전체, 엉덩이, 허벅지 앞, 어깨 주변이 고르게 일하면 정답이에요. 허리가 뻐근하거나 조이면 허리가 처진 신호예요 — 엉덩이를 더 조이거나 무릎을 대요. 어깨·허리에 날카로운 통증이 생기면 멈춰요.',
      en: 'Your whole belly, glutes, front thighs and shoulders should share the work. An aching or pinching low back means your hips are sagging — squeeze your glutes harder or drop to your knees. Stop for any sharp pain in your shoulders or back.',
    },
    easier: {
      ko: '무릎을 대고(머리~무릎 일직선) 버티거나, 책상이나 벽에 팔꿈치를 대고 비스듬히 서서 해요. 10~15초씩 나눠서 해도 좋아요.',
      en: 'Hold with your knees down (head to knees in a straight line), or lean your forearms on a desk or wall. Splitting it into 10–15-second holds is fine too.',
    },
    harder: {
      ko: '40~60초까지 늘리거나, 버티는 동안 한 발씩 바닥에서 5cm 들었다 내리기(교대로 3초씩)를 해요. 골반이 흔들리지 않는 게 핵심이에요.',
      en: 'Build up to 40–60 seconds, or lift one foot 5 cm off the floor at a time (3 seconds each, alternating) while you hold. The key is keeping your hips still.',
    },
    cues: { ko: ['몸은 일직선', '엉덩이 꽉 조여요', '팔꿈치로 바닥 밀기', '숨은 계속 쉬어요'], en: ['Straight line', 'Squeeze your glutes', 'Push the floor away', 'Keep breathing'] },
    mistakes: {
      ko: [
        '허리가 처져 배가 바닥 쪽으로 내려감 → 엉덩이를 조이고 꼬리뼈를 살짝 말아, 배꼽을 척추 쪽으로 당겨요.',
        '엉덩이가 천장으로 솟음 → 옆에서 봤을 때 어깨·골반·뒤꿈치가 한 줄이 되게 골반을 내려요. 휴대폰으로 찍어 확인해 보세요.',
        '어깨 사이가 꺼지고 고개가 떨어짐 → 팔꿈치로 바닥을 밀어 등 윗부분을 채우고, 시선은 손 앞 바닥에 둬요.',
        '숨을 참음 → 숫자를 소리 내어 세며 버텨요.',
      ],
      en: [
        'Hips sagging toward the floor → Squeeze your glutes, tuck your tailbone slightly and draw your belly button toward your spine.',
        'Hips piking up → From the side, shoulders, hips and heels should form one line; lower your hips. Film yourself to check.',
        'Sinking between the shoulder blades, head dropping → Push the floor away with your elbows to fill your upper back, and look at the floor ahead of your hands.',
        'Holding your breath → Count out loud while you hold.',
      ],
    },
    why: {
      ko: '교정된 자세를 오래 버티는 전신 코어 지구력을 길러요. 배·엉덩이·어깨가 함께 몸통을 곧게 지키게 해서, 허리가 앞으로 꺾이거나 처지는 자세를 줄여 줘요.',
      en: 'Builds whole-body core endurance so you can hold your improved posture for longer. Abs, glutes and shoulders learn to keep your trunk straight together, reducing an over-arched or sagging low back.',
    },
    muscles: { ko: '복횡근, 복직근, 내·외복사근, 대둔근, 대퇴사두근, 전거근', en: 'Transversus abdominis, rectus abdominis, obliques, gluteus maximus, quadriceps, serratus anterior' },
    caution: {
      ko: '허리·어깨에 통증이 생기면 무릎을 대고 하거나 멈춰요. 혈압이 높다면 숨을 참지 않도록 특히 조심해요.',
      en: 'If your back or shoulders hurt, drop to your knees or stop. If you have high blood pressure, be especially careful not to hold your breath.',
    },
    avoid: ['pregnant', 'shoulderSevere', 'lowBackSevere'],
    anim: {
      view: 90,
      elev: 10,
      props: [{ kind: 'mat' }],
      anchor: ['elL', 'elR'],
      keys: [
        FOREARM_QUAD,
        merge(FOREARM_QUAD, { hipR: { flex: 38 }, knR: 0, anR: -8 }),
        merge({ root: { pitch: 85 } }, plankArms(85), both({ hip: { flex: 0 }, kn: 0, an: -8 }), { neck: { flex: -6 } }),
      ],
      labels: [
        { ko: '팔꿈치·무릎 대고 엎드리기', en: 'Forearms and knees down' },
        { ko: '한 다리씩 뒤로 뻗기', en: 'Step the legs back' },
        { ko: '일직선으로 25초', en: 'Straight line, hold 25 s' },
      ],
      durations: [1.2, 1.2, 1.4],
      pauses: [0.6, 0.5, 3],
      holdKey: 2,
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', r: 3 },
        { a: 'pelvis', b: 'hipR', side: 'back', kind: 'work', r: 3.6 },
        { a: 'hipR', b: 'knR', side: 'front', kind: 'work', r: 2.2, from: 0.2, to: 0.8 },
      ],
      trace: ['anR'],
    },
  },
  {
    id: 'side-plank-knee',
    name: { ko: '무릎 사이드 플랭크', en: 'Side plank from knees' },
    phase: 'activate',
    position: 'sideLying',
    regions: ['core', 'hip'],
    targets: { lateralShift: 0.8, pelvicTilt: 0.7, lowBackPain: 0.4 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'hold', sets: 2, value: 20, perSide: true, rest: 20 },
    setup: {
      ko: [
        '매트에 오른쪽으로 누워 오른 팔꿈치를 오른 어깨 바로 아래에 두고, 아래팔은 몸 앞쪽으로 뻗어요.',
        '두 무릎을 90도로 굽혀 포개고, 어깨·골반·무릎이 한 줄이 되게(엉덩이가 뒤로 빠지지 않게) 해요.',
        '왼팔은 몸 옆선을 따라 내려 손을 왼쪽 엉덩이 옆에 얹거나 오른쪽 어깨 위에 얹고, 시선은 정면에 둬요.',
      ],
      en: [
        'Lie on your right side on a mat with your right elbow directly under your right shoulder, forearm pointing forward.',
        'Stack your knees bent at 90°, with shoulders, hips and knees in one line (don’t let your hips drift back).',
        'Rest your left arm along your side with the hand on your left hip (or place it on your right shoulder), and look straight ahead.',
      ],
    },
    steps: {
      ko: [
        '배에 20~30% 힘을 주고, 오른 팔꿈치로 바닥을 밀어 어깨가 귀에서 멀어지게 해요.',
        '숨을 내쉬며 2초에 걸쳐 골반을 바닥에서 들어, 머리·어깨·골반·무릎이 일직선이 되게 해요.',
        '골반을 살짝 앞으로 밀어 엉덩이가 뒤로 빠지지 않게 하고, 위쪽 골반이 앞이나 뒤로 돌아가지 않게 해요.',
        '그 자세로 20초 버티며 숨은 계속 쉬어요.',
        '2초에 걸쳐 골반을 내려놓고 쉬었다가, 왼쪽으로 돌아누워 반대쪽도 해요.',
      ],
      en: [
        'Brace your belly at 20–30% and push down through your right elbow so your shoulder moves away from your ear.',
        'Breathe out and take 2 seconds to lift your hips off the floor until head, shoulders, hips and knees form a straight line.',
        'Press your hips slightly forward so your bottom doesn’t stick out, and don’t let the top hip roll forward or back.',
        'Hold for 20 seconds and keep breathing.',
        'Take 2 seconds to lower your hips, rest, then roll onto your left side and repeat.',
      ],
    },
    breathing: {
      ko: '골반을 들며 내쉬고, 버티는 동안은 배의 단단함을 유지한 채 코로 짧고 규칙적으로 숨 쉬어요. 숨을 참지 않아요.',
      en: 'Exhale as you lift, then keep the brace and take short, steady breaths through your nose while you hold. Don’t hold your breath.',
    },
    feel: {
      ko: '바닥 쪽 옆구리(골반 위~갈비뼈 아래)와 바닥 쪽 엉덩이 옆이 단단하게 일하면 정답이에요. 바닥 쪽 어깨가 아프거나 허리가 조이면 골반 높이를 낮추거나 시간을 줄이고, 찌릿하거나 저린 통증이면 멈춰요.',
      en: 'The side of your waist nearest the floor (from hip to lower ribs) and the side of that hip should be working hard. If your bottom shoulder hurts or your back pinches, lift less or shorten the hold; stop for any sharp or tingling pain.',
    },
    easier: {
      ko: '10초씩 2~3번 나눠 버티거나, 벽 옆에 서서 아래팔을 벽에 대고 몸을 곧게 편 채 벽 쪽으로 기대는 ‘서서 사이드 플랭크’로 해요.',
      en: 'Split it into 2–3 holds of 10 seconds, or do a standing version: stand side-on to a wall, forearm on the wall, and lean in with your body straight.',
    },
    harder: {
      ko: '30~45초까지 늘린 뒤, 무릎 대신 다리를 펴고 두 발을 앞뒤로 딛는 풀 사이드 플랭크로 넘어가요.',
      en: 'Build up to 30–45 seconds, then progress to a full side plank with straight legs and your feet staggered.',
    },
    cues: { ko: ['골반을 높이', '머리~무릎 일직선', '팔꿈치로 바닥 밀기', '숨은 계속'], en: ['Hips high', 'Head to knees in line', 'Push through the elbow', 'Keep breathing'] },
    mistakes: {
      ko: [
        '골반이 처짐 → 바닥 쪽 옆구리 힘으로 골반을 천장 쪽으로 밀어 올리고, 버티기 어려우면 시간을 줄여요.',
        '엉덩이가 뒤로 빠져 몸이 ㄱ자로 꺾임 → 골반을 앞으로 밀어 어깨·골반·무릎을 한 줄로 맞춰요.',
        '어깨가 귀 쪽으로 올라가 어깨에 매달림 → 팔꿈치로 바닥을 밀어 어깨를 귀에서 멀리 내려요.',
        '몸통이 앞이나 뒤로 돌아감 → 가슴과 골반이 정면을 향하게, 위쪽 어깨를 아래쪽 어깨 바로 위에 포개요.',
      ],
      en: [
        'Hips sagging → Drive your hips up toward the ceiling with the side of your waist nearest the floor; shorten the hold if you can’t keep them up.',
        'Bottom sticking out so you fold at the hips → Push your hips forward to line up shoulders, hips and knees.',
        'Shoulder creeping up to the ear, hanging on the joint → Push down through the elbow and draw the shoulder away from your ear.',
        'Trunk rolling forward or back → Keep chest and pelvis facing forward, with the top shoulder stacked over the bottom one.',
      ],
    },
    why: {
      ko: '몸통 옆 근육(요방형근·복사근)과 엉덩이 옆 근육을 강화해, 몸이 한쪽으로 치우치거나 골반이 기우는 자세를 바로잡고 허리를 옆에서 받쳐 줘요(맥길 Big 3).',
      en: 'Strengthens the side of your trunk (quadratus lumborum, obliques) and the side of your hip to correct side shifts and pelvic tilt, bracing your low back from the side (one of McGill’s Big 3).',
    },
    muscles: { ko: '요방형근, 내·외복사근, 중둔근, 어깨 안정근(전거근·회전근개)', en: 'Quadratus lumborum, internal & external obliques, gluteus medius, shoulder stabilisers (serratus anterior, rotator cuff)' },
    caution: { ko: '바닥 쪽 어깨에 통증이 있으면 하지 말고, 버티는 동안 어깨가 아프면 바로 내려와요.', en: 'Skip it if your bottom shoulder is painful, and come down right away if it hurts during the hold.' },
    avoid: ['shoulderSevere', 'lowBackSevere', 'pregnant'],
    anim: {
      view: 0,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['knR'],
      keys: [
        // 골반은 바닥에, 몸통만 옆으로 세워 팔꿈치로 받침 (몸통이 옆으로 휘어 있어 위팔은 조금 더 벌려야 몸 옆선에 얹힘 → 손은 허벅지 바깥)
        merge({ root: { roll: -86 } }, both({ hip: { flex: 10 }, kn: 90, an: -30 }), SIDE_ARMS, { shR: { abd: 50 }, shL: { abd: 24 }, elL: 15, lumbar: { side: 24 }, thorax: { side: 18 } }),
        // 팔꿈치·무릎을 바닥에 둔 채 골반을 들어 머리~무릎 일직선
        merge({ root: { roll: -66 } }, both({ hip: { flex: 0 }, kn: 90, an: -30 }), SIDE_ARMS, { shR: { abd: 68 } }),
      ],
      labels: [
        { ko: '팔꿈치 세워 옆으로 눕기', en: 'On your side, elbow down' },
        { ko: '골반 들어 일직선 20초', en: 'Lift hips, hold 20 s' },
      ],
      durations: [1.6, 1.4],
      pauses: [0.6, 3],
      focus: [
        { a: 'shR', b: 'hipR', side: 'out', kind: 'work', r: 2.8, from: 0.35, to: 0.95 },
        { a: 'hipR', b: 'knR', side: 'out', kind: 'work', r: 2.4, from: 0, to: 0.35 },
      ],
      trace: ['pelvis'],
    },
  },
];
