/**
 * 운동 라이브러리 · 허리
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { HOOK, QUAD, STAND, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 이 파일에서 쓰는 자세 ─────────────────────────
/**
 * 네발 자세. 무릎은 골반 바로 아래(허벅지 수직)에 두고 손목·무릎이 함께 바닥에 닿도록 골반 기울기(pitch)와
 * 어깨 각도(sh)를 계산해 넣은 값이에요. spine 에 허리·등·목 굽힘을 줘요.
 */
const quad = (pitch: number, sh: number, wr: number, spine: Pose): Pose =>
  merge(QUAD, { root: { pitch } }, both({ hip: { flex: pitch }, sh: { flex: sh }, el: 0, wr }), spine);
/** 평평한 등(중립) — 손목은 어깨 바로 아래 */
const TABLE = quad(82.3, 84.3, 90, { lumbar: { flex: -4 }, thorax: { flex: 6 }, neck: { flex: -14 } });
/** 고양이: 꼬리뼈를 말아 넣고 등 전체를 둥글게, 바닥을 밀어 날개뼈를 벌림 */
const CAT = quad(36.7, 93.3, 85.4, { lumbar: { flex: 16 }, thorax: { flex: 36 }, neck: { flex: 26 }, head: { flex: 10 }, ...both({ scap: { prot: 4 } }) });
/** 소: 꼬리뼈를 들고 배를 내려 허리를 오목하게, 가슴은 앞으로 */
const COW = quad(121.6, 77, 88.6, { lumbar: { flex: -26 }, thorax: { flex: -20 }, neck: { flex: -10 }, head: { flex: -6 }, ...both({ scap: { prot: -2 } }) });
/** 네발에서 손을 한 뼘 앞으로 걸어 나간 자세 */
const TABLE_REACH = quad(84.3, 100.5, 75.8, { lumbar: { flex: -4 }, thorax: { flex: 6 }, neck: { flex: -14 } });
/** 아기 자세: 엉덩이를 뒤꿈치에, 이마를 바닥에, 팔은 앞으로 길게 */
const CHILD = merge(
  QUAD,
  { root: { pitch: 71.7 }, lumbar: { flex: 18 }, thorax: { flex: 12 }, neck: { flex: 6 } },
  both({ hip: { flex: 136.7 }, kn: 155, an: -72, sh: { flex: 171.1 }, el: 0, wr: 20.6 }),
);

/** 누워서 양팔을 가슴 위에 X자로 포갬(손끝은 반대쪽 어깨 앞) */
const ARMS_ON_CHEST: Pose = both({ sh: { flex: 34.5, abd: -15, rot: -78 }, el: 123, wr: -20.5 });
/**
 * 무릎 세우고 누워 양팔을 가슴 위에 포갠 자세의 골반 기울기.
 * 골반·허리만 움직이고 등 윗부분·머리·발바닥은 바닥에 붙도록 맞춘 값이에요.
 * hip 은 허벅지 기울기(골반 기울기 + hip, 키마다 거의 같음), an 은 발바닥이 평평하게 닿는 발목 각도.
 */
const hookTilt = (pitch: number, lumbar: number, thorax: number, neck: number, hip: number, an: number): Pose =>
  merge(
    HOOK,
    { root: { pitch }, lumbar: { flex: lumbar }, thorax: { flex: thorax }, neck: { flex: neck } },
    both({ hip: { flex: pitch + hip }, kn: 105, an }),
    ARMS_ON_CHEST,
  );

/** 서서 옆구리 늘리기: 오른팔을 머리 위로 */
const SB_REACH: Pose = merge(STAND, { shR: { abd: 168 }, elR: 8 });
/** 왼쪽으로 기울이며 왼손은 허벅지 바깥을 따라 내려감 */
const SB_BEND: Pose = merge(STAND, { lumbar: { side: 10 }, thorax: { side: 16 }, neck: { side: 4 }, shR: { abd: 180 }, elR: 6, shL: { abd: 14 }, elL: 10 });

export const LOWBACK: Exercise[] = [
  {
    id: 'cat-cow',
    name: { ko: '고양이-소 자세', en: 'Cat-cow' },
    phase: 'mobility',
    position: 'quadruped',
    regions: ['lowBack', 'upperBack'],
    targets: { stiffness: 0.8, lowBackPain: 0.6, kyphosis: 0.4, lordosis: 0.3, stress: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 5, rest: 10 },
    setup: {
      ko: [
        '매트에 네발로 엎드려 손목은 어깨 바로 아래, 무릎은 골반 바로 아래에 둬요. 손가락은 넓게 펴서 가운뎃손가락이 정면을 향하게 해요.',
        '무릎과 발은 골반 너비로 벌리고, 발등은 바닥에 편하게 내려놓아요.',
        '팔꿈치는 쭉 펴되 잠그지 말고, 등은 탁자처럼 평평하게 해요. 시선은 두 손 사이 바닥을 봐요.',
      ],
      en: [
        'Come onto all fours on the mat: wrists directly under shoulders, knees directly under hips. Spread your fingers with the middle fingers pointing forward.',
        'Keep knees and feet hip-width apart, with the tops of your feet resting on the floor.',
        'Arms straight but not locked, back flat like a tabletop, eyes on the floor between your hands.',
      ],
    },
    steps: {
      ko: [
        '숨을 내쉬며 꼬리뼈를 다리 사이로 말아 넣고, 배꼽을 척추 쪽으로 끌어당겨요.',
        '이어서 허리 → 등 → 목 순서로 둥글게 말아 올려요. 손으로 바닥을 밀어 날개뼈 사이를 천장 쪽으로 넓히고, 턱은 가슴 쪽으로 내려요(고양이, 2~3초).',
        '숨을 들이마시며 꼬리뼈를 천장 쪽으로 들어 올리고, 배를 바닥 쪽으로 천천히 내려 허리를 오목하게 만들어요.',
        '가슴을 앞으로 내밀고 날개뼈를 살짝 모아요. 시선은 손 앞 30~50cm 바닥으로, 목을 뒤로 꺾지는 않아요(소, 2~3초).',
        '한 번 오가는 데 약 5초, 척추 마디마디가 차례로 움직이는 느낌으로 8회 반복해요.',
      ],
      en: [
        'Exhale, tuck your tailbone between your legs and draw your belly button toward your spine.',
        'Keep rounding from low back → mid back → neck. Push the floor away so the space between your shoulder blades rises, and let your chin drop toward your chest (cat, 2–3 s).',
        'Inhale, lift your tailbone toward the ceiling and let your belly sink slowly toward the floor so your low back dips.',
        'Draw your chest forward and gently squeeze your shoulder blades. Look at the floor 30–50 cm ahead of your hands — don’t crank your neck back (cow, 2–3 s).',
        'Take about 5 seconds per round trip and repeat 8 times, feeling each segment of your spine move in turn.',
      ],
    },
    breathing: {
      ko: '내쉬면서 고양이(둥글게), 들이쉬면서 소(오목하게)로 움직여요. 숨 한 번에 한 방향씩, 숨이 짧으면 움직임도 짧게 맞춰요.',
      en: 'Exhale into cat (round), inhale into cow (arch). One breath per direction — if your breath is short, keep the movement short too.',
    },
    feel: {
      ko: '고양이에서는 등·허리 뒤쪽이 넓게 늘어나고 아랫배가 조이는 느낌, 소에서는 배와 가슴 앞이 열리고 허리 근육이 부드럽게 모이는 느낌이면 정답이에요. 허리에 찌르는 통증이나 엉덩이·다리로 저림이 내려가면 범위를 줄이거나 멈춰요.',
      en: 'In cat the whole back should widen and lengthen while your lower belly firms; in cow your belly and chest open and the low-back muscles gently gather. If you feel a sharp pinch in the low back or tingling into a buttock or leg, shrink the range or stop.',
    },
    easier: {
      ko: '손목이 불편하면 주먹을 쥐거나 손바닥 아래에 접은 수건을 받쳐요. 무릎이 아프면 무릎 밑에 수건을 깔고, 바닥이 힘들면 의자에 앉아 손을 무릎에 얹고 같은 방법으로 등을 둥글게·오목하게 해요.',
      en: 'If your wrists complain, make fists or put a folded towel under your palms. Pad sore knees with a towel, or do it seated in a chair with your hands on your knees, rounding and arching the same way.',
    },
    harder: {
      ko: '끝 자세마다 호흡 한 번(3~5초)씩 머물고, 꼬리뼈에서 시작해 머리에서 끝나도록 한 마디씩 더 느리게 나눠 움직여요. 익숙해지면 중립을 지키는 힘을 기르는 ‘버드독’으로 넘어가요.',
      en: 'Pause for one breath (3–5 s) at each end and slow the wave so it starts at the tailbone and finishes at the head. Then progress to the bird dog, which trains holding a neutral spine.',
    },
    cues: {
      ko: ['내쉬며 둥글게', '바닥을 밀어요', '들이쉬며 가슴 앞으로', '팔은 쭉 편 채로'],
      en: ['Exhale, round up', 'Push the floor away', 'Inhale, chest forward', 'Keep your arms straight'],
    },
    mistakes: {
      ko: [
        '팔꿈치를 굽혔다 펴며 몸이 오르내림 → 팔은 쭉 편 채 고정하고, 움직임은 척추에서만 만들어요.',
        '목만 크게 숙이고 젖힘 → 목은 척추 끝에서 따라가게만 하고, 소 자세에서 시선은 손 앞 바닥에 둬요.',
        '허리만 꺾이고 등은 그대로 → 소에서는 가슴을 앞으로 내밀어 등까지, 고양이에서는 날개뼈 사이를 천장으로 밀어 등 위쪽까지 움직여요.',
        '엉덩이가 뒤로 빠지거나 앞으로 쏠림 → 골반은 무릎 바로 위에 두고, 꼬리뼈만 말았다 들었다 해요.',
      ],
      en: [
        'Bending and straightening the elbows → Keep your arms straight and create all the movement in your spine.',
        'Big nods with the neck only → Let the neck simply follow as the end of the spine; in cow keep your eyes on the floor ahead of your hands.',
        'Only the low back bends while the upper back stays flat → In cow draw the chest forward; in cat push the space between your shoulder blades up so the upper back moves too.',
        'Hips drifting back or forward → Keep your hips stacked over your knees and only tuck and lift the tailbone.',
      ],
    },
    why: {
      ko: '오래 앉아 굳은 척추를 굽힘과 폄 양쪽으로 부드럽게 움직여 뻐근함을 풀고, 골반을 앞뒤로 기울이는 감각을 깨워요. 호흡에 맞춰 천천히 움직이면 긴장을 내려놓는 데도 도움이 돼요.',
      en: 'Gently takes a spine stiffened by sitting through both flexion and extension, easing stiffness and waking up your sense of tilting the pelvis. Moving slowly with the breath also helps you let go of tension.',
    },
    muscles: { ko: '척추기립근·다열근, 복직근·복횡근, 전거근(바닥 밀기)', en: 'Spinal erectors & multifidus, rectus & transversus abdominis, serratus anterior (floor push)' },
    caution: {
      ko: '허리를 오목하게 할 때 통증이 커지거나 다리로 저림이 내려가면, 소 자세는 평평한 등(중립)까지만 해요.',
      en: 'If arching increases pain or sends tingling down a leg, come back only to a flat back instead of going into cow.',
    },
    avoid: ['wristPain', 'kneePain'],
    anim: {
      view: 90,
      elev: 14,
      props: [{ kind: 'mat' }],
      anchor: ['knL', 'knR'],
      level: { a: ['wrL', 'wrR'], b: ['knL', 'knR'] },
      keys: [TABLE, CAT, COW],
      labels: [
        { ko: '네발 중립 자세', en: 'Neutral tabletop' },
        { ko: '내쉬며 둥글게(고양이)', en: 'Exhale, round (cat)' },
        { ko: '들이쉬며 오목하게(소)', en: 'Inhale, arch (cow)' },
      ],
      durations: [1.8, 3, 1.6],
      pauses: [0.5, 0.7, 0.7],
      focus: [
        { a: 'backTop', b: 'pelvis', side: 'back', kind: 'stretch', from: 0.05, to: 0.9, r: 2.6 },
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', from: 0.3, to: 0.95, r: 2.4 },
      ],
      trace: ['backMid'],
    },
  },
  {
    id: 'child-pose',
    name: { ko: '아기 자세', en: 'Child’s pose' },
    phase: 'stretch',
    position: 'kneeling',
    regions: ['lowBack', 'upperBack', 'hip'],
    targets: { lowBackPain: 0.6, stiffness: 0.6, stress: 0.5, kyphosis: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 30, rest: 5 },
    setup: {
      ko: [
        '매트에 네발로 시작해요. 무릎은 골반 너비나 매트 폭만큼 벌리고, 양 엄지발가락은 서로 맞닿게 모아요.',
        '발등을 바닥에 평평하게 대고, 손은 어깨 바로 아래에 둬요.',
        '무릎이나 발목 앞이 불편하면 무릎 뒤나 발목 아래에 접은 수건을 먼저 받쳐 두세요.',
      ],
      en: [
        'Start on all fours on the mat. Open your knees hip-width or as wide as the mat, and bring your big toes together.',
        'Rest the tops of your feet flat on the floor and place your hands directly under your shoulders.',
        'If your knees or the fronts of your ankles feel tight, tuck a folded towel behind the knees or under the ankles first.',
      ],
    },
    steps: {
      ko: [
        '양손을 한 뼘(약 15cm) 앞으로 걸어 나가 팔을 길게 만들어요.',
        '숨을 내쉬며 3초에 걸쳐 엉덩이를 발뒤꿈치 쪽으로 천천히 내려 앉아요. 손바닥은 제자리에 둬요.',
        '이마를 바닥(또는 쿠션)에 내려놓고, 목과 어깨의 힘을 툭 빼요.',
        '손끝을 앞으로 1~2cm 더 밀어 겨드랑이부터 허리까지 길게 늘인 채 30초 머물러요.',
        '손으로 바닥을 밀며 3초에 걸쳐 네발 자세로 천천히 돌아와요.',
      ],
      en: [
        'Walk your hands forward about one hand-length (≈15 cm) so your arms are long.',
        'Exhale and, over 3 seconds, sink your hips back toward your heels. Your palms stay where they are.',
        'Rest your forehead on the floor (or a cushion) and let your neck and shoulders go soft.',
        'Slide your fingertips 1–2 cm further forward to lengthen from armpits to low back, and stay for 30 seconds.',
        'Press into your hands and take 3 seconds to come back up to all fours.',
      ],
    },
    breathing: {
      ko: '코로 4초 들이마시며 허리 뒤쪽과 옆구리가 풍선처럼 부풀게 하고, 입으로 6초 길게 내쉬며 엉덩이가 뒤꿈치 쪽으로 조금 더 내려가도록 맡겨요.',
      en: 'Breathe in through your nose for 4 seconds, letting your low back and sides expand like a balloon; breathe out through your mouth for 6 seconds and let your hips sink a little closer to your heels.',
    },
    feel: {
      ko: '허리 뒤쪽, 겨드랑이 옆(광배근), 엉덩이가 은은하게 늘어나고 몸이 바닥으로 가라앉는 느낌이면 정답이에요. 무릎 앞이 찌릿하거나 허리·다리로 저림이 내려가면 범위를 줄이거나 멈춰요.',
      en: 'A gentle stretch through your low back, the sides of your armpits (lats) and your buttocks, with your body melting toward the floor. If the front of your knees zings or tingling runs into your back or legs, ease off or stop.',
    },
    easier: {
      ko: '엉덩이가 뒤꿈치에 닿지 않으면 엉덩이와 종아리 사이에 베개를 끼우고, 이마가 바닥에 닿지 않으면 쿠션이나 겹친 주먹 위에 올려요. 무릎을 꿇기 어려우면 누워서 두 무릎을 가슴 쪽으로 안아 당기는 자세로 대신해요.',
      en: 'If your hips don’t reach your heels, wedge a pillow between hips and calves; if your forehead doesn’t reach the floor, rest it on a cushion or stacked fists. If kneeling isn’t comfortable, lie on your back and hug both knees to your chest instead.',
    },
    harder: {
      ko: '자세를 유지한 채 두 손을 오른쪽으로 20cm 걸어가 왼쪽 옆구리를 20초, 반대로 20초 더 늘려요. 가운데에서 버티는 시간은 45초까지 늘려요.',
      en: 'From the pose, walk both hands about 20 cm to the right to stretch your left side for 20 seconds, then the other way. Build the centre hold up to 45 seconds.',
    },
    cues: {
      ko: ['엉덩이는 뒤꿈치로', '손끝은 멀리 앞으로', '등으로 숨 불어넣기', '어깨 힘 툭 빼요'],
      en: ['Hips toward heels', 'Fingertips reach forward', 'Breathe into your back', 'Let your shoulders melt'],
    },
    mistakes: {
      ko: [
        '무릎 통증을 참고 끝까지 앉음 → 무릎 뒤에 접은 수건이나 엉덩이 아래 베개를 받쳐 무릎 굽힘을 줄여요.',
        '어깨가 귀 쪽으로 으쓱 올라감 → 팔꿈치를 살짝 풀고 겨드랑이를 바닥 쪽으로 녹이듯 내려요.',
        '이마를 바닥에 대려다 엉덩이가 들림 → 엉덩이를 먼저 뒤꿈치 쪽으로 보내고, 이마는 쿠션 위에 올려도 괜찮아요.',
        '숨을 참고 버팀 → 길게 내쉬며 몸무게를 바닥에 맡겨요.',
      ],
      en: [
        'Forcing through knee pain → Put a folded towel behind your knees or a pillow under your hips to reduce the knee bend.',
        'Shoulders hunching toward the ears → Soften your elbows slightly and let your armpits melt toward the floor.',
        'Hips lifting so the forehead can reach the floor → Send your hips back to your heels first; resting your forehead on a cushion is fine.',
        'Holding your breath → Breathe out long and let your weight sink into the floor.',
      ],
    },
    why: {
      ko: '허리 뒤쪽과 등의 넓은 근육을 부드럽게 늘리고, 허리를 살짝 굽힌 편안한 자세에서 호흡을 느리게 만들어 긴장을 내려놓게 해요. 허리를 젖히는 동작 뒤나 루틴 사이사이 쉬어 가기 좋아요.',
      en: 'Gently lengthens your low back and the broad back muscles and, in a comfortable slightly rounded position, slows your breathing so tension can let go. A great reset after back-bending moves or between harder exercises.',
    },
    muscles: { ko: '척추기립근·요방형근, 광배근, 대둔근', en: 'Spinal erectors & quadratus lumborum, lats, gluteus maximus' },
    caution: {
      ko: '무릎이나 발목 앞이 찌릿하거나 다리로 저림이 내려가면 멈추세요. 일어날 때 어지러우면 네발 자세에서 잠시 쉬었다가 천천히 일어나요.',
      en: 'Stop if your knees or the fronts of your ankles zing, or tingling runs down a leg. If you feel light-headed coming up, pause on all fours before rising slowly.',
    },
    avoid: ['kneePain', 'kneeSevere'],
    anim: {
      view: 90,
      elev: 12,
      props: [{ kind: 'mat' }],
      anchor: ['knL', 'knR'],
      keys: [TABLE, TABLE_REACH, CHILD],
      labels: [
        { ko: '네발로 시작', en: 'Start on all fours' },
        { ko: '손을 한 뼘 앞으로', en: 'Walk hands forward' },
        { ko: '엉덩이 뒤로 30초', en: 'Hips back, hold 30 s' },
      ],
      durations: [1.2, 2.6, 2.2],
      pauses: [0.5, 0.5, 3],
      holdKey: 2,
      focus: [
        { a: 'backMid', b: 'pelvis', side: 'back', kind: 'stretch', r: 2.8 },
        { a: 'shR', b: 'waist', kind: 'stretch', from: 0.05, to: 0.85, r: 2.4 },
      ],
      trace: ['pelvis'],
    },
  },
  {
    id: 'pelvic-tilt',
    name: { ko: '누워서 골반 기울이기', en: 'Supine pelvic tilt' },
    phase: 'mobility',
    position: 'supine',
    regions: ['lowBack', 'core'],
    targets: { lordosis: 0.7, lowBackPain: 0.6, swayback: 0.4, flatBack: 0.3 },
    equipment: ['mat'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, rest: 10 },
    setup: {
      ko: [
        '매트에 바로 누워 무릎을 약 90도로 세우고, 발은 골반 너비로 벌려 발바닥 전체를 바닥에 붙여요.',
        '양팔은 가슴 위에 X자로 가볍게 포개요. 움직임을 손으로 느끼고 싶다면 양손을 골반 앞 튀어나온 뼈에 얹어도 좋아요.',
        '뒤통수와 등 윗부분은 바닥에 편하게 내려놓아요. 허리 아래에는 손바닥 하나가 겨우 들어갈 만한 자연스러운 틈이 있어요.',
      ],
      en: [
        'Lie on your back on the mat with knees bent to about 90°, feet hip-width apart and flat on the floor.',
        'Cross your arms lightly over your chest. To feel the movement with your hands, you can rest them on the bony points at the front of your pelvis instead.',
        'Let the back of your head and your upper back relax into the floor. There’s a natural gap under your low back that just fits a flat hand.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며 꼬리뼈를 바닥 쪽으로 누르듯 골반을 앞으로 기울여, 허리 아래 틈을 손가락 두 마디(약 2~3cm)만큼 살짝 띄워요. 등 윗부분과 엉덩이는 바닥에 그대로예요.',
        '숨을 내쉬며 배꼽을 척추 쪽으로 당기고, 치골(골반 앞 아래쪽 뼈)을 배꼽 쪽으로 끌어올려요.',
        '허리가 바닥에 지그시 닿고 꼬리뼈가 1~2cm 살짝 들리면 멈춰요. 엉덩이 전체를 들지는 않아요.',
        '한 방향에 약 2초씩, 가운데를 지나 두 방향을 시소처럼 천천히 오가요.',
        '10회 반복해요. 움직임은 작고 부드럽게, 발과 엉덩이 힘은 빼 둬요.',
      ],
      en: [
        'Inhale and tip your pelvis forward as if pressing your tailbone down, lifting the gap under your low back by about two finger-widths (2–3 cm). Your upper back and buttocks stay down.',
        'Exhale, draw your belly button toward your spine and scoop your pubic bone up toward your navel.',
        'Stop when your low back rests gently on the floor and your tailbone lifts 1–2 cm. Don’t lift your whole bottom.',
        'Take about 2 seconds each way and rock slowly through the middle like a seesaw.',
        'Repeat 10 times — small and smooth, with your feet and glutes relaxed.',
      ],
    },
    breathing: {
      ko: '들이쉬며 허리를 살짝 띄우고, 입으로 “후—” 길게 내쉬며 허리를 바닥에 붙여요. 배에 힘을 줄 때 숨을 참지 마세요.',
      en: 'Inhale as the low back lifts slightly; exhale a long “haaa” through your mouth as you flatten it to the floor. Don’t hold your breath while you tighten your belly.',
    },
    feel: {
      ko: '허리를 붙일 때 아랫배 깊은 곳이 납작하게 조이고 허리 뒤쪽이 부드럽게 길어지면 정답이에요. 엉덩이나 허벅지 앞에 힘이 많이 들어가면 다리로 밀고 있는 거예요. 허리에 날카로운 통증이나 다리 저림이 있으면 범위를 줄이거나 멈춰요.',
      en: 'As you flatten, your deep lower belly should draw in flat and your low back should lengthen softly. If your glutes or front thighs are working hard, you’re pushing with your legs. Shrink the range or stop if you feel sharp low-back pain or tingling in a leg.',
    },
    easier: {
      ko: '허리를 바닥에 붙이는 방향(뒤로 기울이기)만 작게 해요. 누워 있기 불편하면 의자에 앉아 골반을 앞뒤로 굴리거나, 벽에 등을 대고 서서 같은 방법으로 해요.',
      en: 'Do only the flattening half, with a small range. If lying down is uncomfortable, rock your pelvis forward and back while seated, or stand with your back against a wall and do the same.',
    },
    harder: {
      ko: '허리를 붙인 상태로 5초 버티고, 그대로 한 발씩 번갈아 5cm 들어 올려 보세요(허리가 뜨지 않게). 익숙해지면 ‘데드버그’로 넘어가요.',
      en: 'Hold the flattened position for 5 seconds, then alternate lifting one foot about 5 cm without letting your low back rise. Once that’s easy, move on to the dead bug.',
    },
    cues: {
      ko: ['들이쉬며 허리 살짝', '내쉬며 허리 꾹', '엉덩이는 바닥에', '다리 힘은 빼요'],
      en: ['Inhale, small arch', 'Exhale, press flat', 'Bottom stays down', 'Relax your legs'],
    },
    mistakes: {
      ko: [
        '엉덩이를 통째로 들어 올림 → 브리지가 아니에요. 꼬리뼈만 1~2cm 들리고 엉덩이는 바닥에 닿아 있어요.',
        '발로 바닥을 밀어 움직임 → 발과 엉덩이 힘을 빼고, 아랫배를 당기는 힘으로 골반을 굴려요.',
        '허리를 크게 꺾어 갈비뼈가 들림 → 앞으로 기울일 때는 손가락 두 마디 틈까지만, 갈비뼈와 등 윗부분은 바닥에 둬요.',
        '숨을 참고 배에만 힘을 줌 → 허리를 붙일 때 “후—” 길게 내쉬며 아랫배를 납작하게 해요.',
      ],
      en: [
        'Lifting your whole bottom → This isn’t a bridge; only the tailbone lifts 1–2 cm while your buttocks stay on the floor.',
        'Pushing through your feet → Relax your feet and glutes and roll the pelvis with your lower belly.',
        'Over-arching so the ribs pop up → Arch only to a two-finger gap, keeping your ribs and upper back on the floor.',
        'Holding your breath and bracing → Exhale a long “haaa” as you flatten and let your lower belly draw in.',
      ],
    },
    why: {
      ko: '허리 곡선이 과한 사람(골반 앞쏠림)도, 너무 평평한 사람도 골반을 앞뒤로 스스로 조절하는 감각부터 되찾는 게 먼저예요. 누운 자세라 허리 부담이 적어서 허리가 뻐근한 날 가장 먼저 해 보기 좋아요.',
      en: 'Whether your low-back curve is too deep (anterior tilt) or too flat, the first step is regaining control of tilting your pelvis forward and back. Lying down keeps the load on your back low, so it’s the ideal first move on a stiff-back day.',
    },
    muscles: {
      ko: '복횡근·복직근 아래쪽(허리 붙이기), 척추기립근·다열근(허리 띄우기)',
      en: 'Transversus abdominis & lower rectus abdominis (flattening), spinal erectors & multifidus (arching)',
    },
    caution: {
      ko: '허리에 날카로운 통증이나 다리 저림이 생기면 멈추세요. 임신 중기 이후에는 오래 바로 눕기보다 벽에 등을 대고 서서 하세요.',
      en: 'Stop if you feel sharp low-back pain or tingling in a leg. From mid-pregnancy on, do it standing with your back against a wall rather than lying flat.',
    },
    anim: {
      view: 90,
      elev: 5,
      props: [{ kind: 'mat' }],
      anchor: ['heelL', 'heelR'],
      keys: [
        hookTilt(-84, 0, -10.2, 5.3, 137.4, -32.4),
        hookTilt(-74, 0, -27.4, 14.8, 137.9, -32.9),
        hookTilt(-100, 10, -2.9, 3.6, 135.2, -30.2),
      ],
      labels: [
        { ko: '무릎 세우고 눕기', en: 'Lie with knees bent' },
        { ko: '들이쉬며 허리 살짝', en: 'Inhale, small arch' },
        { ko: '내쉬며 허리 꾹', en: 'Exhale, press flat' },
      ],
      durations: [1.4, 2.2, 1.4],
      pauses: [0.5, 0.6, 1],
      focus: [
        { a: 'chest', b: 'pelvis', side: 'front', kind: 'work', from: 0.4, to: 0.95, r: 2.6 },
        { a: 'waist', b: 'pelvis', side: 'back', kind: 'stretch', from: 0, to: 0.8, r: 2.4 },
      ],
      zoom: 1.15,
    },
  },
  {
    id: 'standing-side-bend',
    name: { ko: '서서 옆구리 늘리기', en: 'Standing side bend' },
    phase: 'stretch',
    position: 'standing',
    regions: ['lowBack', 'core'],
    targets: { pelvicTilt: 0.8, lateralShift: 0.8, lowBackPain: 0.4, stiffness: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'hold', sets: 2, value: 20, perSide: true, rest: 5 },
    desk: true,
    setup: {
      ko: [
        '발은 골반 너비로 벌리고 발끝은 정면, 무릎은 살짝 풀어 두 발에 체중을 똑같이 실어요.',
        '배꼽을 살짝 당겨 갈비뼈가 앞으로 들리지 않게 하고, 골반과 가슴은 정면을 향해요.',
        '왼팔은 몸 옆에 편하게 내려 손바닥을 왼쪽 허벅지 바깥에 대요.',
      ],
      en: [
        'Stand with feet hip-width apart, toes forward, knees soft and weight even on both feet.',
        'Draw your navel in slightly so your ribs don’t flare, with your pelvis and chest facing forward.',
        'Let your left arm hang with the palm resting on the outside of your left thigh.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며 오른팔을 옆으로 크게 돌려 머리 위로 뻗어요. 손끝을 천장 쪽으로 2~3cm 더 끌어올려 오른쪽 옆구리를 먼저 길게 만들어요.',
        '숨을 내쉬며 3초에 걸쳐 상체를 왼쪽으로 천천히 기울여요. 오른손 끝은 머리 위를 지나 왼쪽 위 대각선으로 멀리 뻗어요.',
        '왼손은 왼쪽 허벅지 바깥을 따라 무릎 쪽으로 10~15cm 미끄러져 내려가요.',
        '골반은 가운데, 가슴은 정면을 향한 채 오른쪽 겨드랑이~골반 위가 당기는 지점에서 20초 버텨요.',
        '3초에 걸쳐 가운데로 돌아와 팔을 내린 뒤, 반대쪽도 같은 방법으로 해요.',
      ],
      en: [
        'Inhale and sweep your right arm out to the side and overhead. Reach your fingertips 2–3 cm higher to lengthen your right side first.',
        'Exhale and, over 3 seconds, slowly bend your upper body to the left, reaching your right fingertips over your head toward the upper-left diagonal.',
        'Let your left hand slide 10–15 cm down the outside of your left thigh toward the knee.',
        'With your pelvis centred and chest facing forward, stop where you feel a pull from the right armpit to the top of the pelvis and hold 20 seconds.',
        'Take 3 seconds to come back to centre and lower the arm, then repeat on the other side.',
      ],
    },
    breathing: {
      ko: '들이쉬며 위로 길게 뻗고, 내쉬며 옆으로 기울여요. 버티는 동안 오른쪽 갈비뼈 사이로 숨을 불어넣듯 들이쉬고, 내쉴 때마다 1~2cm씩 더 기울여요.',
      en: 'Inhale to reach up, exhale to bend over. While holding, breathe into your right ribs, and on each exhale bend another 1–2 cm.',
    },
    feel: {
      ko: '오른쪽 겨드랑이 아래부터 옆구리, 골반 위 허리 옆까지 길게 당기면 정답이에요. 왼쪽 허리가 꽉 끼이거나 한 곳이 찌르듯 아프면 기울기를 줄이고, 다리로 저림이 내려가면 멈춰요.',
      en: 'A long pull from under your right armpit down the side of your trunk to just above the pelvis. If the left side of your low back pinches or one spot feels sharp, bend less; stop if tingling runs down a leg.',
    },
    easier: {
      ko: '어깨가 불편하면 오른손을 뒤통수나 허리에 얹고 기울여요. 균형이 불안하면 의자에 앉아서 하는 ‘앉아서 옆으로 길게 뻗기’로 대신해요.',
      en: 'If your shoulder is uncomfortable, bend with your right hand on the back of your head or on your hip. If your balance is shaky, switch to the seated side reach.',
    },
    harder: {
      ko: '오른발을 왼발 뒤로 교차해 서서 기울이면 골반 바깥까지 더 늘어나요. 또는 양팔을 머리 위로 올려 왼손으로 오른 손목을 잡고 대각선으로 당기며, 버티는 시간을 30초까지 늘려요.',
      en: 'Cross your right foot behind your left before bending to reach the outer hip as well. Or raise both arms, hold your right wrist with your left hand and pull along the diagonal, building the hold to 30 seconds.',
    },
    cues: {
      ko: ['먼저 위로 길게', '내쉬며 옆으로', '가슴은 정면 그대로', '두 발에 체중 고르게'],
      en: ['Reach up first', 'Exhale, bend over', 'Chest faces forward', 'Weight on both feet'],
    },
    mistakes: {
      ko: [
        '상체가 앞으로 숙여짐 → 등 뒤에 벽이 있다고 생각하고, 가슴과 골반이 정면을 본 채 옆으로만 기울여요.',
        '팔만 넘기고 옆구리는 그대로 → 먼저 손끝을 천장으로 2~3cm 끌어올린 뒤, 갈비뼈부터 옆으로 기울여요.',
        '골반이 한쪽으로 크게 빠지며 한 발에 체중이 쏠림 → 두 발바닥에 체중을 똑같이 싣고 골반은 가운데에 둬요.',
        '올린 팔 쪽 어깨가 귀로 으쓱 → 날개뼈를 살짝 아래로 내려 목 옆에 공간을 남겨요.',
      ],
      en: [
        'Folding forward → Imagine a wall behind you; keep chest and pelvis facing forward and bend only sideways.',
        'Flinging the arm over while the side stays short → Reach your fingertips 2–3 cm toward the ceiling first, then bend from the ribs.',
        'Hips swinging out so your weight shifts onto one foot → Keep your weight even on both feet and your pelvis centred.',
        'The raised shoulder shrugging to the ear → Draw that shoulder blade slightly down to keep space beside your neck.',
      ],
    },
    why: {
      ko: '한쪽 허리 옆(요방형근)과 옆구리가 짧아지면 그쪽 골반이 끌려 올라가고 몸통이 한쪽으로 치우치기 쉬워요. 옆구리 전체를 길게 늘려 좌우 균형을 맞추는 데 도움을 줘요. 골반이 높은 쪽 옆구리를 한 세트 더 해 주세요.',
      en: 'When the quadratus lumborum and the side of the trunk shorten on one side, that side of the pelvis gets hitched up and the trunk shifts. Lengthening the whole side helps even things out. Add an extra set on the side of the higher hip.',
    },
    muscles: { ko: '요방형근, 광배근, 내·외복사근(함께: 늑간근)', en: 'Quadratus lumborum, lats, internal & external obliques (also intercostals)' },
    caution: {
      ko: '허리 한쪽이 찌르듯 아프거나 다리로 저림이 내려가면 멈추세요. 튕기듯 반동을 주지 마세요.',
      en: 'Stop if one side of your low back feels sharp or tingling runs down a leg. Don’t bounce.',
    },
    anim: {
      view: 0,
      keys: [STAND, SB_REACH, SB_BEND],
      labels: [
        { ko: '바르게 서기', en: 'Stand tall' },
        { ko: '한 팔 위로 길게', en: 'Arm up, lengthen' },
        { ko: '반대로 기울여 20초', en: 'Bend away, hold 20 s' },
      ],
      durations: [1.4, 1.8, 1.8],
      pauses: [0.5, 0.6, 3],
      holdKey: 2,
      focus: [{ a: 'shR', b: 'hipR', side: 'out', kind: 'stretch', from: 0.08, to: 0.95, r: 3 }],
      trace: ['haR'],
    },
    coach: {
      view: 'front',
      metric: 'trunkSide',
      mode: 'hold',
      target: 10,
      dir: 1,
      hint: { ko: '정면에서 온몸이 보이게 휴대폰을 세워 주세요', en: 'Prop the phone in front so your whole body is visible' },
      more: { ko: '조금 더 옆으로', en: 'A bit further to the side' },
      good: { ko: '좋아요, 그대로', en: 'Great, stay there' },
    },
  },
];
