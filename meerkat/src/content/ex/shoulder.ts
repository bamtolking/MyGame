/**
 * 운동 라이브러리 · 어깨·견갑
 * 문구·용량·대상 이슈는 물리치료 임상 기준으로 작성되었으며, 전문가가 자유롭게 수정할 수 있습니다.
 * 작성 규칙: docs/CONTENT_GUIDE.md
 */
import { both, type Pose } from '../../figure/rig';
import { PRONE, STAND, WALL, merge } from '../../figure/poses';
import type { Exercise } from '../exercise-types';

// ── 이 파일에서 쓰는 자세 ─────────────────────
/** 벽에 기대 선 자세: 발뒤꿈치가 벽에서 한 뼘 앞이라 몸이 살짝 뒤로 기울어요 */
const LEAN: Pose = { root: { pitch: -3 }, knL: 6, knR: 6, hipL: { flex: 3 }, hipR: { flex: 3 } };
/** 엎드려 팔을 머리 위 Y자로 (abd 135 = 머리 선에서 약 45° 벌림, flex + = 바닥 쪽) */
const PRONE_Y = (flex: number, scap: { elev?: number; prot?: number } = {}): Pose =>
  merge(PRONE, both({ sh: { abd: 135, flex, rot: 40 }, el: 2, scap }));
/** 팔꿈치 90°로 옆구리에 붙인 자세 (rot + = 아래팔이 바깥으로) */
const ELBOWS_TUCKED = (rot: number): Pose => merge(STAND, both({ sh: { abd: 6, rot }, el: 90 }));
/** 밴드를 잡고 팔을 가슴 높이로 (hab + = 양옆으로 벌림) */
const BAND_ARMS = (hab: number): Pose => merge(STAND, both({ sh: { flex: 86, hab }, el: 6 }));

export const SHOULDER: Exercise[] = [
  {
    id: 'shoulder-rolls',
    name: { ko: '어깨 뒤로 돌리기', en: 'Backward shoulder rolls' },
    phase: 'mobility',
    position: 'standing',
    regions: ['shoulder', 'neck'],
    targets: { stiffness: 0.8, neckPain: 0.4, roundShoulder: 0.3, stress: 0.3 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 3, rest: 10 },
    desk: true,
    setup: {
      ko: [
        '발을 골반 너비로 벌리고 서서 무릎을 살짝 풀어요. 의자 앞쪽에 앉아서 해도 좋아요.',
        '팔은 몸통 옆에 힘을 빼고 늘어뜨려, 손바닥이 허벅지 옆을 향하게 해요.',
        '턱을 살짝 당기고 정수리를 천장으로 길게 뽑아요. 시선은 정면 눈높이예요.',
      ],
      en: [
        'Stand with feet hip-width apart and knees soft. You can also sit on the front of a chair.',
        'Let your arms hang loosely at your sides, palms facing your thighs.',
        'Tuck your chin slightly and lengthen the crown of your head toward the ceiling, eyes level.',
      ],
    },
    steps: {
      ko: [
        '숨을 들이마시며 1초 동안 양어깨를 귀 쪽으로 최대한 끌어올려요.',
        '올린 높이 그대로 어깨를 뒤로 당겨, 양 날개뼈가 등 가운데로 모이게 해요.',
        '숨을 내쉬며 1~2초 동안 어깨를 뒤·아래로 쭉 끌어내려요. 귀와 어깨 사이가 최대한 멀어져요.',
        '힘을 풀어 어깨가 처음 자리로 돌아오면 1회예요. 한 바퀴에 약 3초씩 큰 원을 그려요.',
        '10회 반복해요. 머리와 목은 움직이지 않고 어깨만 돌려요.',
      ],
      en: [
        'Breathe in and lift both shoulders up toward your ears as high as you can, taking 1 second.',
        'Keeping them up, pull your shoulders back so your shoulder blades draw toward the middle of your back.',
        'Breathe out and slide your shoulders back and down over 1–2 seconds, making your neck as long as possible.',
        'Relax and let your shoulders return to the start — that’s one rep. Each big circle takes about 3 seconds.',
        'Repeat 10 times, moving only your shoulders while your head and neck stay still.',
      ],
    },
    breathing: {
      ko: '어깨를 올릴 때 코로 들이마시고, 뒤로 돌려 내릴 때 입으로 “후—” 길게 내쉬어요. 내쉴 때 어깨 힘이 더 잘 빠져요.',
      en: 'Breathe in through your nose as you lift, then breathe out slowly through your mouth as you roll back and down — the exhale helps your shoulders let go.',
    },
    feel: {
      ko: '목과 어깨 사이, 날개뼈 사이가 따뜻해지면서 시원하게 풀리는 느낌이면 정답이에요. 아프지 않은 ‘뚝’ 소리는 괜찮지만, 어깨 앞이 찌릿하거나 팔·손이 저리면 멈추세요.',
      en: 'You should feel warmth and easing between your neck and shoulders and between your shoulder blades. A painless click is fine, but stop if the front of your shoulder feels sharp or your arm or hand tingles.',
    },
    easier: {
      ko: '원을 작게 그리거나, 먼저 ‘으쓱 올렸다 툭 떨어뜨리기’만 5회 해 보세요. 한쪽 어깨씩 번갈아 돌려도 좋아요.',
      en: 'Make smaller circles, or start with 5 simple shrug-and-drops. You can also roll one shoulder at a time.',
    },
    harder: {
      ko: '양손에 물병(0.5kg)을 들고 돌리거나, 마지막 회에 어깨를 뒤·아래로 내린 채 5초 버텨요. 다음 단계는 ‘날개뼈 모으며 팔 벌리기’예요.',
      en: 'Hold a small water bottle (0.5 kg) in each hand, or finish the last rep by holding your shoulders back and down for 5 seconds. Next step: scapular squeeze & external rotation.',
    },
    cues: { ko: ['귀까지 올리고', '뒤로 크게 모아요', '아래로 쭉 내려요', '목은 그대로'], en: ['Up to your ears', 'Roll back wide', 'Slide down long', 'Neck stays still'] },
    mistakes: {
      ko: [
        '너무 빨리 빙빙 돌림 → 올리기·뒤로·내리기를 나눠 한 바퀴에 3초씩 천천히 그려요.',
        '고개가 앞뒤로 따라 움직임 → 턱을 살짝 당겨 머리를 고정하고 어깨만 돌려요.',
        '위아래로만 움직여 원이 납작함 → 올린 상태에서 ‘뒤로’를 크게, 날개뼈끼리 닿을 듯 모아요.',
        '허리를 젖혀 가슴을 내밂 → 배에 살짝 힘을 줘 갈비뼈를 내린 채 어깨만 움직여요.',
      ],
      en: [
        'Spinning too fast → Break it into up, back and down, about 3 seconds per circle.',
        'Head bobbing along → Tuck your chin slightly to keep your head still and move only your shoulders.',
        'Only moving up and down (a flat circle) → At the top, pull back wide as if your shoulder blades could touch.',
        'Arching the low back to push the chest out → Lightly brace your belly, keep your ribs down and move only your shoulders.',
      ],
    },
    why: {
      ko: '오래 앉아 있으면 어깨가 앞·위로 말린 채 굳어요. 어깨를 뒤로 크게 돌리면 주변 근육에 혈류가 돌고, 어깨를 ‘뒤·아래’ 제자리로 되돌리는 감각을 깨워 다음 운동을 준비해요.',
      en: 'Long sitting leaves your shoulders stuck forward and up. Big backward rolls get blood flowing to the surrounding muscles and remind your shoulders where “back and down” is — a good warm-up before other exercises.',
    },
    muscles: { ko: '상부·중부·하부 승모근, 능형근, 견갑거근', en: 'Upper, middle & lower trapezius, rhomboids, levator scapulae' },
    caution: { ko: '어깨를 올릴 때 어깨 앞이 찌르듯 아프면 원을 작게 줄이세요.', en: 'If the front of your shoulder pinches as you lift, make the circles smaller.' },
    anim: {
      view: 90,
      keys: [
        merge(STAND, both({ scap: { elev: 0, prot: 1.5 } })),
        merge(STAND, both({ scap: { elev: 6.5, prot: 1.8 } })),
        merge(STAND, both({ scap: { elev: 4, prot: -4.2 } }), { thorax: { flex: -3 } }),
        merge(STAND, both({ scap: { elev: -1.5, prot: -3 } }), { thorax: { flex: -2 } }),
      ],
      labels: [
        { ko: '팔 힘 빼고 서기', en: 'Stand, arms loose' },
        { ko: '귀 쪽으로 으쓱', en: 'Shrug up to your ears' },
        { ko: '뒤로 날개뼈 모으기', en: 'Roll back, blades in' },
        { ko: '아래로 쭉 내리기', en: 'Slide down, long neck' },
      ],
      durations: [0.7, 0.7, 0.8, 0.6],
      pauses: [0.3, 0.15, 0.15, 0.35],
      focus: [
        { a: 'neckTop', b: 'shR', side: 'back', kind: 'work', r: 2.2, from: 0.25, to: 0.75 },
        { a: 'backMid', b: 'backTop', side: 'back', kind: 'work', r: 2.4, from: 0, to: 1 },
      ],
      trace: ['wrR'],
      zoom: 1.25,
    },
  },
  {
    id: 'wall-angel',
    name: { ko: '벽 천사', en: 'Wall angel' },
    phase: 'activate',
    position: 'wall',
    regions: ['shoulder', 'upperBack'],
    targets: { roundShoulder: 0.9, kyphosis: 0.7, fhp: 0.5, upperBackPain: 0.4 },
    equipment: ['wall'],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 10, tempo: 4, holdSec: 1, rest: 20 },
    setup: {
      ko: [
        '벽에서 발뒤꿈치를 10~15cm(손바닥 길이) 떼고, 발은 골반 너비로 서요. 무릎은 살짝 굽혀요.',
        '엉덩이·날개뼈를 벽에 대요. 갈비뼈를 아래로 내려 허리와 벽 사이에 손바닥 한 장만 들어가게 해요.',
        '턱을 살짝 당긴 채 뒤통수를 벽에 대요. 뒤통수가 벽에 닿지 않으면 억지로 젖히지 말고, 턱을 당긴 채 닿는 만큼만 대요(접은 수건을 뒤통수 뒤에 받쳐도 좋아요).',
        '팔을 옆으로 들어 팔꿈치를 90°로 굽히고, 팔꿈치가 어깨보다 조금 낮은 W 모양으로 팔꿈치·손등을 벽에 대요.',
      ],
      en: [
        'Stand with your heels 10–15 cm (a palm’s length) from the wall, feet hip-width apart and knees slightly bent.',
        'Rest your glutes and shoulder blades on the wall. Drop your ribs so only a flat hand fits behind your low back.',
        'Tuck your chin slightly and rest the back of your head on the wall. If it doesn’t reach, don’t tip your chin up to get there; keep your chin tucked and use a folded towel behind your head.',
        'Lift your arms out to the side, bend your elbows to 90° and rest elbows and backs of the hands on the wall in a “W”, elbows a little below shoulder height.',
      ],
    },
    steps: {
      ko: [
        '배에 가볍게 힘을 줘 허리가 벽에 닿아 있는 상태를 먼저 만들어요.',
        '숨을 내쉬며 2초에 걸쳐 팔을 벽을 따라 위로 밀어 올려요. 팔꿈치와 손등은 벽에서 떨어지지 않아요.',
        '손이 머리 위에서 Y 모양이 되면 멈춰요. 허리나 손등이 벽에서 떨어지기 직전이 내 끝 범위예요.',
        '숨을 들이마시며 2초에 걸쳐 팔꿈치를 옆구리 쪽으로 끌어내려 W로 돌아와요.',
        'W 자리에서 날개뼈를 아래·안쪽으로 1초 조인 뒤 다시 올려요. 10회 반복해요.',
      ],
      en: [
        'Lightly brace your belly so your low back rests on the wall before you start.',
        'Breathe out and slide your arms up the wall over 2 seconds, keeping your elbows and the backs of your hands on the wall.',
        'Stop when your arms make a “Y” overhead — just before your low back or hands start to leave the wall. That’s your range.',
        'Breathe in and pull your elbows down toward your ribs over 2 seconds, back into the “W”.',
        'At the “W”, squeeze your shoulder blades down and in for 1 second, then go again. Repeat 10 times.',
      ],
    },
    breathing: {
      ko: '팔을 올리는 동안 입으로 길게 내쉬면 갈비뼈가 들리지 않아 허리가 벽에 잘 붙어요. 팔을 끌어내리며 코로 들이마셔요.',
      en: 'Breathe out slowly as your arms go up — it keeps your ribs down and your low back on the wall. Breathe in through your nose as you pull down.',
    },
    feel: {
      ko: '날개뼈 사이와 아래쪽(등 가운데)에 힘이 들어가고, 가슴 앞과 겨드랑이가 늘어나는 느낌이면 정답이에요. 어깨 앞이 찝히거나 손이 저리면 올리는 높이를 낮추세요.',
      en: 'You should feel work between and below your shoulder blades and a stretch across your chest and armpits. If the front of your shoulder pinches or your hands tingle, don’t go as high.',
    },
    easier: {
      ko: '발을 벽에서 한 걸음 더 떼고, 손등이 떨어져도 괜찮으니 팔꿈치만 벽에 대고 해요. 바닥에 무릎 세우고 누워서 같은 동작을 하는 ‘누워서 바닥 천사’가 더 쉬워요.',
      en: 'Step your feet further from the wall and let your hands come off if needed — just keep the elbows on. The same move lying on your back with knees bent (floor angel) is easier still.',
    },
    harder: {
      ko: '발뒤꿈치를 벽에 더 가깝게(5cm) 두고, Y 자리에서 3초 버텨요. 쉬워지면 ‘엎드려 Y 들기’로 넘어가세요.',
      en: 'Bring your heels closer to the wall (about 5 cm) and hold the “Y” for 3 seconds. When that’s easy, move on to the prone Y raise.',
    },
    cues: { ko: ['허리는 벽에 붙여요', '내쉬며 밀어 올려요', '손등도 벽에', '팔꿈치를 끌어내려요'], en: ['Low back on the wall', 'Exhale and slide up', 'Hands stay on the wall', 'Pull your elbows down'] },
    mistakes: {
      ko: [
        '팔을 올릴 때 허리가 벽에서 뜸 → 올리는 높이를 줄이고, 내쉬며 갈비뼈를 내려 허리를 벽에 붙여요.',
        '턱이 들리거나 머리가 앞으로 나옴 → 턱을 살짝 당겨 뒤통수를 벽(또는 받친 수건)에 가볍게 대요.',
        '어깨가 귀 쪽으로 으쓱 올라감 → 올릴 때도 어깨는 귀에서 멀게, 내릴 때 팔꿈치를 옆구리로 끌어내려요.',
        '손등을 벽에 붙이려고 억지로 비틂 → 통증 없는 범위까지만 해요. 손등이 떨어지면 팔꿈치만 벽에 대도 괜찮아요.',
      ],
      en: [
        'Low back peeling off as the arms rise → Go less high, exhale and drop your ribs to keep your low back on the wall.',
        'Chin poking up or head drifting forward → Tuck your chin slightly and rest the back of your head lightly on the wall (or the folded towel).',
        'Shrugging toward your ears → Keep your shoulders away from your ears on the way up and pull your elbows toward your ribs on the way down.',
        'Forcing your hands back onto the wall → Stay pain-free. If your hands lift off, keeping just the elbows on the wall is fine.',
      ],
    },
    why: {
      ko: '말린 어깨를 뒤·아래로 잡아 주는 중·하부 승모근과 전거근을 깨우면서, 짧아진 가슴 앞 근육과 광배근을 함께 늘려요. 라운드숄더와 굽은 등 교정의 대표 운동이에요.',
      en: 'Wakes up the middle/lower traps and serratus that hold your shoulders back and down, while lengthening tight chest muscles and lats — the classic move for rounded shoulders and a rounded upper back.',
    },
    muscles: { ko: '중·하부 승모근, 전거근, 극하근 (늘어나는 곳: 대흉근·소흉근·광배근)', en: 'Middle & lower trapezius, serratus anterior, infraspinatus (stretching: pecs, lats)' },
    caution: {
      ko: '팔이 벽에 다 닿지 않아도 괜찮아요. 어깨 앞이 찝히거나 손이 저리면 통증 없는 높이까지만 해요.',
      en: 'It’s fine if your arms don’t touch the wall fully. If the front of your shoulder pinches or your hands tingle, only go as high as is pain-free.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 0,
      elev: 6,
      props: [{ kind: 'wall', wall: 'back' }],
      keys: [
        merge(WALL, LEAN, both({ sh: { abd: 72, rot: 88, hab: 16 }, el: 104, scap: { elev: -1, prot: -1.5 } })),
        merge(WALL, LEAN, both({ sh: { abd: 106, rot: 88, hab: 16 }, el: 72 })),
        merge(WALL, LEAN, both({ sh: { abd: 150, rot: 88, hab: 14 }, el: 20, scap: { elev: 1 } })),
      ],
      labels: [
        { ko: 'W: 팔꿈치 내려 모으기', en: 'W: elbows down, blades in' },
        { ko: '벽 따라 밀어 올리기', en: 'Slide up the wall' },
        { ko: 'Y: 머리 위에서 멈춤', en: 'Y: pause overhead' },
      ],
      durations: [1, 0.9, 1.9],
      pauses: [1, 0, 0.2],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'shL', side: 'front', kind: 'stretch', r: 2.6 },
        { a: 'shR', b: 'hipR', side: 'out', kind: 'work', r: 2.2, from: 0.12, to: 0.5 },
        { a: 'shL', b: 'hipL', side: 'out', kind: 'work', r: 2.2, from: 0.12, to: 0.5 },
      ],
      trace: ['haR'],
    },
    coach: {
      view: 'front',
      metric: 'armRaise',
      mode: 'reps',
      rest: 0.45,
      peak: 0.7,
      dir: 1,
      hint: { ko: '정면에서 팔 끝까지 보이게 2m 거리에 휴대폰을 세워 주세요', en: 'Place the phone about 2 m in front of you so your arms are visible' },
      more: { ko: '팔을 조금 더 위로', en: 'Reach a little higher' },
      good: { ko: '좋아요!', en: 'Nice!' },
    },
  },
  {
    id: 'prone-y-raise',
    name: { ko: '엎드려 Y 들기', en: 'Prone Y raise' },
    phase: 'activate',
    position: 'prone',
    regions: ['upperBack', 'shoulder'],
    targets: { roundShoulder: 1, kyphosis: 0.7, upperBackPain: 0.5, fhp: 0.3 },
    equipment: ['mat'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 8, tempo: 4.5, holdSec: 2, rest: 20 },
    setup: {
      ko: [
        '매트에 엎드려 이마 아래에 접은 수건을 받쳐요. 코는 바닥에서 떨어지고 시선은 바닥을 봐요.',
        '두 팔을 머리 위로 뻗어 몸과 Y자가 되게 벌려요(머리 선에서 양쪽으로 약 45°). 주먹을 가볍게 쥐고 엄지를 천장 쪽으로 세워요.',
        '다리는 골반 너비로 펴 발등을 바닥에 대고, 배꼽을 살짝 끌어당겨 허리가 꺼지지 않게 해요.',
      ],
      en: [
        'Lie face down on a mat with a folded towel under your forehead, nose off the floor, eyes down.',
        'Reach your arms overhead into a “Y” (about 45° out from the line of your head). Make loose fists with your thumbs pointing to the ceiling.',
        'Legs straight and hip-width apart, tops of the feet on the floor. Draw your belly button in gently so your low back doesn’t sag.',
      ],
    },
    steps: {
      ko: [
        '팔은 바닥에 둔 채, 먼저 날개뼈를 바지 뒷주머니 쪽으로 아래·안쪽으로 끌어내려요. 어깨가 귀에서 멀어져요.',
        '날개뼈를 잡은 채 숨을 내쉬며 2초 동안 양팔을 바닥에서 5~10cm 들어요. 팔이 몸통과 일직선이 되는 높이까지만, 팔꿈치는 펴고 엄지는 천장을 향해요.',
        '가장 높은 곳에서 2초 버텨요. 이마와 가슴은 바닥에 그대로 둬요.',
        '숨을 들이마시며 2초에 걸쳐 팔을 내려놓고 날개뼈 힘을 풀어요.',
        '8회 반복해요. 익숙해지면 팔을 옆으로 벌린 ‘엎드려 T 들기’, 팔꿈치를 굽힌 ‘엎드려 W 당기기’도 같은 방법으로 해요.',
      ],
      en: [
        'With your arms still on the floor, first draw your shoulder blades down and in toward your back pockets, shoulders away from your ears.',
        'Keeping that, breathe out and lift both arms 5–10 cm off the floor over 2 seconds — no higher than in line with your body — elbows straight and thumbs up.',
        'Hold at the top for 2 seconds, forehead and chest staying on the floor.',
        'Breathe in and lower your arms over 2 seconds, then let your shoulder blades relax.',
        'Repeat 8 times. Once it’s easy, use the same method for the prone T raise (arms straight out to the side) and prone W pull (elbows bent).',
      ],
    },
    breathing: {
      ko: '팔을 들어 올릴 때 입으로 내쉬고, 2초 버티는 동안은 코로 편하게 숨 쉬고, 내리면서 들이마셔요.',
      en: 'Breathe out as you lift, breathe easily through your nose during the 2-second hold, and breathe in as you lower.',
    },
    feel: {
      ko: '날개뼈 아래쪽 안쪽(등 한가운데)이 뻐근하게 일하면 정답이에요. 목이나 어깨 위가 먼저 당기면 날개뼈를 다시 아래로 내리고 팔을 낮게 들어요. 어깨 앞이 찌르듯 아프면 멈춰요.',
      en: 'You should feel the lower, inner edges of your shoulder blades working, in the middle of your back. If your neck or the tops of your shoulders take over, pull the blades down again and lift lower. Stop if the front of your shoulder feels sharp.',
    },
    easier: {
      ko: '‘엎드려 W 당기기’처럼 팔꿈치를 90°로 굽히면 지렛대가 짧아져 쉬워요. 한 팔씩 번갈아 들어도 좋고, 엎드리기 힘들면 ‘벽 천사’로 대신하세요.',
      en: 'Bend your elbows to 90° (a “W”) to shorten the lever, or lift one arm at a time. If lying face down is uncomfortable, do wall angels instead.',
    },
    harder: {
      ko: '꼭대기에서 5초 버티거나, 양손에 0.5kg 물병을 쥐고 해요. Y·T·W를 쉬지 않고 8회씩 이어서 해도 좋아요.',
      en: 'Hold the top for 5 seconds or hold a 0.5 kg water bottle in each hand. You can also chain Y, T and W for 8 reps each without resting.',
    },
    cues: { ko: ['날개뼈 먼저 내려요', '엄지는 천장으로', '이마는 수건에', '천천히 내려요'], en: ['Blades down first', 'Thumbs to the ceiling', 'Forehead stays down', 'Lower slowly'] },
    mistakes: {
      ko: [
        '고개를 들어 올림 → 이마를 수건에 둔 채 시선은 바닥, 뒷목을 길게 유지해요.',
        '허리를 젖혀 가슴까지 들림 → 배꼽을 살짝 당기고 가슴은 바닥에 둔 채 팔만 5~10cm 들어요.',
        '어깨가 귀 쪽으로 으쓱 올라감 → 팔을 들기 전에 날개뼈를 뒷주머니 쪽으로 끌어내리고 그 상태로 들어요.',
        '팔꿈치가 굽거나 반동으로 휘두름 → 팔꿈치를 편 채 낮게, 2초 올리고 2초 내려요.',
      ],
      en: [
        'Lifting your head → Keep your forehead on the towel, eyes down and the back of your neck long.',
        'Arching the back so the chest lifts → Draw your belly button in, keep your chest down and lift only your arms 5–10 cm.',
        'Shrugging toward your ears → Pull your shoulder blades toward your back pockets before you lift, and keep them there.',
        'Bending the elbows or swinging the arms → Keep your elbows straight and the lift low: 2 seconds up, 2 seconds down.',
      ],
    },
    why: {
      ko: '가장 약해지기 쉬운 하부 승모근을 정확히 겨냥해요. 날개뼈를 뒤·아래로 잡아 두는 힘이 생기면 말린 어깨와 굽은 등을 바로 세우기 쉬워지고, 팔을 머리 위로 올릴 때도 어깨가 편해져요.',
      en: 'Targets the lower trapezius — usually the weakest link. Once you can hold your shoulder blades back and down, rounded shoulders and a rounded upper back are easier to straighten, and reaching overhead feels easier on the shoulder.',
    },
    muscles: { ko: '하부·중부 승모근, 능형근, 후면 삼각근, 극하근', en: 'Lower & middle trapezius, rhomboids, rear deltoid, infraspinatus' },
    caution: {
      ko: '어깨 앞이 찌르듯 아프거나 팔이 저리면 멈추세요. 허리가 불편하면 배 아래에 얇은 베개를 받쳐요.',
      en: 'Stop if the front of your shoulder hurts sharply or your arm tingles. If your low back is uncomfortable, put a thin pillow under your belly.',
    },
    avoid: ['pregnant', 'shoulderSevere'],
    anim: {
      view: 100,
      elev: 45,
      props: [{ kind: 'mat' }],
      anchor: ['pelvis'],
      keys: [PRONE_Y(11), PRONE_Y(14, { elev: -1.5, prot: -2 }), PRONE_Y(7, { elev: -1.5, prot: -2.5 })],
      labels: [
        { ko: '엎드려 팔을 Y자로', en: 'Face down, arms in a Y' },
        { ko: '날개뼈 아래로 모으기', en: 'Blades down & in' },
        { ko: '팔 들어 2초 버티기', en: 'Lift, hold 2 s' },
      ],
      durations: [0.6, 1.8, 1.9],
      pauses: [0.1, 0.1, 2],
      holdKey: 2,
      focus: [
        { a: 'backMid', b: 'shR', kind: 'work', r: 2.6 },
        { a: 'backMid', b: 'shL', kind: 'work', r: 2.6 },
      ],
      trace: ['haR'],
    },
  },
  {
    id: 'scap-squeeze',
    name: { ko: '날개뼈 모으며 팔 벌리기', en: 'Scapular squeeze & external rotation' },
    phase: 'activate',
    position: 'standing',
    regions: ['upperBack', 'shoulder'],
    targets: { roundShoulder: 0.8, upperBackPain: 0.6, kyphosis: 0.4, fhp: 0.2 },
    equipment: [],
    level: 1,
    dose: { kind: 'reps', sets: 2, value: 12, tempo: 4, holdSec: 3, rest: 15 },
    desk: true,
    setup: {
      ko: [
        '발을 골반 너비로 서거나 의자 앞쪽에 앉아, 골반을 세우고 허리를 곧게 펴요.',
        '팔꿈치를 90°로 굽혀 옆구리에 붙이고, 아래팔은 앞으로 나란히, 손바닥은 천장을 향해요.',
        '턱을 살짝 당기고, 어깨를 한 번 으쓱했다가 툭 떨어뜨려 힘을 빼요.',
      ],
      en: [
        'Stand with feet hip-width apart, or sit on the front of a chair with your pelvis upright and back tall.',
        'Bend your elbows to 90° and tuck them against your sides, forearms pointing forward, palms up.',
        'Tuck your chin slightly, then shrug once and let your shoulders drop.',
      ],
    },
    steps: {
      ko: [
        '팔꿈치를 옆구리에 붙인 채, 숨을 내쉬며 2초 동안 손을 바깥으로 벌려요. 아래팔이 문 열리듯 45~60° 돌아가요.',
        '손이 벌어진 끝에서 양 날개뼈를 뒤·아래로 모아 가슴을 살짝 열어요.',
        '그 자세로 3초 버텨요. 팔꿈치는 옆구리에서 떨어지지 않아요.',
        '숨을 들이마시며 2초에 걸쳐 손을 앞으로 모아 처음 자리로 돌아와요.',
        '12회 반복해요. 매 회 어깨 높이는 그대로, 목은 길게 유지해요.',
      ],
      en: [
        'Keeping your elbows pinned to your sides, breathe out and rotate your hands outward over 2 seconds — your forearms swing open like a door, about 45–60°.',
        'At the end of the range, draw both shoulder blades back and down and gently open your chest.',
        'Hold for 3 seconds without letting your elbows leave your sides.',
        'Breathe in and bring your hands back to the front over 2 seconds.',
        'Repeat 12 times, keeping your shoulders level and your neck long.',
      ],
    },
    breathing: {
      ko: '손을 벌리고 날개뼈를 모을 때 입으로 내쉬고, 3초 버티는 동안 편하게 숨 쉬고, 돌아오며 코로 들이마셔요.',
      en: 'Breathe out as you rotate out and squeeze, breathe easily during the 3-second hold, and breathe in through your nose on the way back.',
    },
    feel: {
      ko: '어깨 뒤쪽(날개뼈 바깥 위)과 날개뼈 사이에 힘이 들어가고 가슴 앞이 살짝 펴지면 정답이에요. 목 옆이 뻐근하면 으쓱한 거예요. 어깨 앞이 찌르듯 아프면 벌리는 범위를 줄이세요.',
      en: 'You should feel the back of your shoulders and the area between your shoulder blades working, with a gentle opening across your chest. Tightness at the side of your neck means you’re shrugging. If the front of your shoulder feels sharp, rotate less.',
    },
    easier: {
      ko: '팔꿈치와 옆구리 사이에 돌돌 만 수건을 끼우면 팔꿈치 위치를 잡기 쉬워요. 벌리는 범위는 30°부터, 한 팔씩 해도 괜찮아요.',
      en: 'Squeeze a rolled towel between each elbow and your side to hold the position. Start with about 30° of rotation, or do one arm at a time.',
    },
    harder: {
      ko: '가벼운 밴드를 양손에 잡고 같은 동작을 하거나(‘밴드로 팔 바깥으로 돌리기’), 버티기를 5초로 늘려요. 다음 단계는 ‘밴드 당겨 벌리기’예요.',
      en: 'Hold a light band between your hands for the same move (band external rotation), or extend the hold to 5 seconds. Next step: band pull-aparts.',
    },
    cues: { ko: ['팔꿈치는 옆구리에', '문 열듯 바깥으로', '날개뼈 뒤로 아래로', '3초 버텨요'], en: ['Elbows pinned to your sides', 'Open like a door', 'Blades back and down', 'Hold for three'] },
    mistakes: {
      ko: [
        '팔꿈치가 옆구리에서 떨어져 옆으로 벌어짐 → 팔꿈치 밑에 수건을 끼웠다고 생각하고 붙인 채 아래팔만 돌려요.',
        '허리를 젖혀 가슴을 내밂 → 갈비뼈를 아래로 내리고 배에 살짝 힘을 준 채 날개뼈만 모아요.',
        '어깨가 귀 쪽으로 올라감 → 모을 때 ‘뒤로’보다 ‘아래로’를 먼저 생각해요.',
        '손목만 꺾어 벌어진 척함 → 손목은 곧게, 아래팔 전체가 바깥으로 돌아가게 해요.',
      ],
      en: [
        'Elbows drifting away from your sides → Imagine a towel pinned under each elbow and rotate only your forearms.',
        'Arching the back to puff the chest → Keep your ribs down and belly lightly braced; move only your shoulder blades.',
        'Shoulders creeping toward your ears → Think “down” before “back” as you squeeze.',
        'Bending only the wrists to fake the range → Keep your wrists straight and turn the whole forearm outward.',
      ],
    },
    why: {
      ko: '말린 어깨는 팔이 안쪽으로 돌아간 채 굳어 있어요. 팔을 바깥으로 돌리는 회전근개(극하근·소원근)와 날개뼈를 모으는 근육을 함께 깨워 어깨를 뒤로 되돌려요. 책상에서도 틈틈이 하기 좋아요.',
      en: 'Rounded shoulders get stuck turned inward. This wakes up the rotator cuff muscles that turn the arm out (infraspinatus, teres minor) together with the shoulder-blade squeezers to bring your shoulders back. Easy to do at your desk.',
    },
    muscles: { ko: '극하근·소원근, 중부·하부 승모근, 능형근', en: 'Infraspinatus, teres minor, middle & lower trapezius, rhomboids' },
    caution: {
      ko: '어깨 앞이 찌르듯 아프거나 팔·손이 저리면 멈추고, 벌리는 범위를 30° 정도로 줄여요.',
      en: 'Stop if the front of your shoulder feels sharp or your arm or hand tingles, and reduce the rotation to about 30°.',
    },
    anim: {
      view: 28,
      elev: 30,
      keys: [
        ELBOWS_TUCKED(-4),
        ELBOWS_TUCKED(50),
        merge(ELBOWS_TUCKED(58), both({ sh: { flex: -5 }, scap: { prot: -3, elev: -1 } }), { thorax: { flex: -3 } }),
      ],
      labels: [
        { ko: '팔꿈치 90° 옆구리에', en: 'Elbows 90° at your sides' },
        { ko: '문 열듯 바깥으로', en: 'Rotate your hands out' },
        { ko: '날개뼈 모아 3초', en: 'Squeeze blades, 3 s' },
      ],
      durations: [1.4, 0.7, 1.9],
      pauses: [0.2, 0, 2.8],
      holdKey: 2,
      focus: [
        { a: 'backMid', b: 'backTop', side: 'back', kind: 'work', r: 2.4 },
        { a: 'backMid', b: 'shR', kind: 'work', r: 2.4, from: 0.45, to: 0.95 },
        { a: 'backMid', b: 'shL', kind: 'work', r: 2.4, from: 0.45, to: 0.95 },
      ],
      trace: ['haR'],
      zoom: 1.1,
    },
  },
  {
    id: 'band-pull-apart',
    name: { ko: '밴드 당겨 벌리기', en: 'Band pull-apart' },
    phase: 'activate',
    position: 'standing',
    regions: ['upperBack', 'shoulder'],
    targets: { roundShoulder: 0.9, kyphosis: 0.5, upperBackPain: 0.4 },
    equipment: ['band'],
    level: 2,
    dose: { kind: 'reps', sets: 2, value: 15, tempo: 4, holdSec: 1, rest: 20 },
    setup: {
      ko: [
        '발을 골반 너비로 서서 무릎을 살짝 풀고, 배에 가볍게 힘을 줘 갈비뼈를 내려요.',
        '가벼운 밴드를 손바닥이 바닥을 향하게 어깨너비로 잡고, 팔을 가슴 높이로 앞으로 뻗어요. 밴드는 살짝 팽팽한 정도예요.',
        '팔꿈치는 아주 살짝만 굽히고(쭉 잠그지 않기), 턱은 당겨 목을 길게 해요.',
      ],
      en: [
        'Stand with feet hip-width apart and knees soft; lightly brace your belly and drop your ribs.',
        'Hold a light band shoulder-width apart, palms down, arms straight out in front at chest height. The band should be just taut.',
        'Keep a tiny bend in the elbows (don’t lock them) and tuck your chin to lengthen your neck.',
      ],
    },
    steps: {
      ko: [
        '팔은 그대로 둔 채 날개뼈를 먼저 뒤·아래로 살짝(1~2cm) 모아요.',
        '숨을 내쉬며 2초에 걸쳐 양팔을 옆으로 벌려, 밴드가 가슴에 닿을 듯 T자를 만들어요.',
        '끝에서 1초 멈추고 날개뼈 사이를 조여요. 손은 어깨 높이를 유지해요.',
        '숨을 들이마시며 2초에 걸쳐 밴드 힘을 버티면서 천천히 앞으로 돌아와요. 밴드가 완전히 느슨해지지 않게요.',
        '15회 반복해요.',
      ],
      en: [
        'Without moving your arms, first draw your shoulder blades slightly (1–2 cm) back and down.',
        'Breathe out and spread your arms out to the sides over 2 seconds into a “T”, bringing the band toward your chest.',
        'Pause 1 second at the end and squeeze between your shoulder blades, hands at shoulder height.',
        'Breathe in and return slowly over 2 seconds, resisting the band so it never goes fully slack.',
        'Repeat 15 times.',
      ],
    },
    breathing: {
      ko: '벌릴 때 입으로 내쉬고, 돌아올 때 코로 들이마셔요. 숨을 참고 힘주지 마세요.',
      en: 'Breathe out as you pull apart and breathe in through your nose on the way back. Don’t hold your breath to force it.',
    },
    feel: {
      ko: '어깨 뒤쪽(후면 삼각근)과 날개뼈 사이가 뜨거워지면 정답이에요. 목 옆·어깨 위가 먼저 뻐근하면 으쓱하는 거니 더 가벼운 밴드로 바꾸세요. 어깨 앞이 찝히거나 손이 저리면 멈춰요.',
      en: 'The backs of your shoulders (rear delts) and the area between your shoulder blades should burn. If the side of your neck or the tops of your shoulders take over, you’re shrugging — switch to a lighter band. Stop if the front of your shoulder pinches or your hands tingle.',
    },
    easier: {
      ko: '밴드를 더 넓게 잡거나 더 가벼운 밴드를 써요. 벌리는 범위를 절반으로 줄여도 좋고, 밴드가 없으면 ‘날개뼈 모으며 팔 벌리기’로 대신하세요.',
      en: 'Hold the band wider or use a lighter one. You can also open only halfway, or do the scapular squeeze & external rotation if you have no band.',
    },
    harder: {
      ko: '밴드를 더 좁게 잡거나 한 단계 강한 밴드를 쓰고, 끝에서 3초 버텨요. 손바닥을 위로 향하게 잡거나, 한 손은 위·한 손은 아래로 대각선으로 벌려도 좋아요.',
      en: 'Hold the band narrower or use a stronger band and pause 3 seconds at the end. Try it palms up, or pull diagonally with one hand going up and the other down.',
    },
    cues: { ko: ['날개뼈 먼저 모아요', '가슴 쪽으로 벌려요', '어깨는 아래로', '천천히 돌아와요'], en: ['Blades first', 'Pull to your chest', 'Shoulders stay down', 'Slow on the way back'] },
    mistakes: {
      ko: [
        '어깨가 귀 쪽으로 올라감 → 더 가벼운 밴드로 바꾸고, 벌리기 전에 날개뼈를 아래로 먼저 내려요.',
        '허리를 젖히고 가슴을 내밂 → 갈비뼈를 내리고 엉덩이에 살짝 힘을 줘 몸통을 고정해요.',
        '팔꿈치를 굽혀 당김 → 살짝 굽힌 팔꿈치 각도를 끝까지 그대로 두고 팔 전체를 옆으로 벌려요.',
        '돌아올 때 밴드에 끌려가듯 빨라짐 → 2초를 세며 밴드 힘을 버티면서 천천히 돌아와요.',
      ],
      en: [
        'Shrugging toward your ears → Use a lighter band and draw your shoulder blades down before you pull.',
        'Arching the back and puffing the chest → Drop your ribs and lightly squeeze your glutes to keep your trunk still.',
        'Bending the elbows to pull → Keep the same slight elbow bend throughout and open with the whole arm.',
        'Letting the band snap you back → Count 2 seconds and resist the band all the way in.',
      ],
    },
    why: {
      ko: '말린 어깨에서 늘어나 약해진 어깨 뒤쪽(후면 삼각근)과 날개뼈를 모으는 근육(능형근·중부 승모근)을 저항으로 확실히 강화해요. 벽 천사가 쉬워졌다면 다음 단계예요.',
      en: 'Strengthens the over-stretched, weak back of the shoulders (rear delts) and the shoulder-blade squeezers (rhomboids, middle traps) against resistance — the next step once wall angels feel easy.',
    },
    muscles: { ko: '후면 삼각근, 능형근, 중부 승모근, 극하근', en: 'Rear deltoids, rhomboids, middle trapezius, infraspinatus' },
    caution: {
      ko: '쓰기 전에 밴드가 찢어진 곳이 없는지 확인하고, 얼굴 쪽으로 튕기지 않게 천천히 돌아와요. 어깨가 심하게 아플 때는 쉬어요.',
      en: 'Check the band for tears before use and return slowly so it can’t snap toward your face. Skip it when your shoulder is very painful.',
    },
    avoid: ['shoulderSevere'],
    anim: {
      view: 30,
      elev: 9,
      props: [{ kind: 'band', at: 'wrL', to: 'wrR' }],
      keys: [BAND_ARMS(-4), merge(BAND_ARMS(-4), both({ scap: { prot: -2.5, elev: -0.6 } })), merge(BAND_ARMS(64), both({ scap: { prot: -3.5, elev: -0.6 } }))],
      labels: [
        { ko: '팔 앞으로, 밴드 잡기', en: 'Arms forward, band set' },
        { ko: '날개뼈 먼저 모으기', en: 'Set your blades first' },
        { ko: '옆으로 벌려 1초', en: 'Pull apart, pause 1 s' },
      ],
      durations: [0.5, 1.5, 1.8],
      pauses: [0.1, 0.1, 1],
      holdKey: 2,
      focus: [
        { a: 'shR', b: 'elR', side: 'back', kind: 'work', r: 2.4, from: 0, to: 0.45 },
        { a: 'shL', b: 'elL', side: 'back', kind: 'work', r: 2.4, from: 0, to: 0.45 },
        { a: 'backMid', b: 'backTop', side: 'back', kind: 'work', r: 2.4 },
      ],
      trace: ['wrR'],
    },
  },
];
