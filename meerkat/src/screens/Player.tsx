import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Camera, CameraOff, ListChecks, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-preact';
import { CoachCam } from '../coach/CoachCam';
import type { CoachState } from '../coach/tracker';
import { Animal } from '../components/animals';
import { ask, Sheet, toast } from '../components/ui';
import { estimateSeconds, PHASE_LABEL, type Dose } from '../content/exercises';
import { Figure } from '../figure/Figure';
import { arriveTime, cycleLength, holdKeyOf, keyAt } from '../figure/render';
import { ExerciseGuide } from '../components/ExerciseGuide';
import { L, LA, tr } from '../i18n';
import { haptic } from '../lib/haptics';
import { replace } from '../lib/router';
import { sfx } from '../lib/sound';
import { countWord, speak, stopSpeaking } from '../lib/voice';
import type { Routine } from '../routine/generator';
import { activeRoutine, todayRoutine } from '../state/derived';
import { doneToday, logSession, painLogs, profile, progression, settings, streak, uid, type PainArea } from '../state/store';

interface StepPlan {
  item: number;
  set: number;
  sets: number;
  side: 0 | 1;
  sides: number;
}

type Phase = 'ready' | 'work' | 'rest' | 'done';

function expand(r: Routine): StepPlan[] {
  const out: StepPlan[] = [];
  r.items.forEach((it, i) => {
    const sides = it.dose.perSide ? 2 : 1;
    const sets = it.dose.kind === 'time' ? 1 : it.dose.sets;
    for (let s = 1; s <= sets; s++) for (let side = 0; side < sides; side++) out.push({ item: i, set: s, sets, side: side as 0 | 1, sides });
  });
  return out;
}

function workSeconds(d: Dose): number {
  if (d.kind === 'reps') return d.value * ((d.tempo ?? 3) + (d.holdSec ?? 0));
  return d.value;
}

const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

function useWakeLock() {
  useEffect(() => {
    let lock: any = null;
    const req = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request('screen');
      } catch {
        /* 지원 안 함 */
      }
    };
    req();
    const onVis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.().catch?.(() => undefined);
    };
  }, []);
}

export function Player() {
  const routine = useMemo(() => activeRoutine.value ?? todayRoutine.value, []);
  const steps = useMemo(() => expand(routine), [routine]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [coachOn, setCoachOn] = useState(false);
  const [coach, setCoach] = useState<CoachState | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [voiceOn, setVoiceOn] = useState(settings.value.voice);
  const doneItems = useRef(new Set<number>());
  const startedAt = useRef(Date.now());
  const activeSec = useRef(0);
  const spoken = useRef(new Set<string>());
  const lastCueAt = useRef(0);
  useWakeLock();

  const step = steps[Math.min(idx, steps.length - 1)];
  const item = routine.items[step.item];
  const ex = item.exercise;
  const dose = item.dose;
  const firstOfItem = idx === 0 || steps[idx - 1].item !== step.item;
  const readyLen = firstOfItem ? 8 : 4;
  const nextStep = steps[idx + 1];
  const restLen = !nextStep ? 0 : nextStep.item === step.item ? dose.rest ?? 10 : 7;
  const coachable = !!ex.coach && settings.value.coachCamera;
  const useCoach = coachOn && coachable;
  const period = (dose.tempo ?? 3) + (dose.holdSec ?? 0);
  const workLen = workSeconds(dose);

  const say = (key: string, text: string, interrupt = false) => {
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    if (voiceOn) speak(text, { interrupt, force: true });
  };

  // 진행 규칙
  const reps = useCoach ? coach?.reps ?? 0 : dose.kind === 'reps' ? Math.min(dose.value, Math.floor(elapsed / period)) : 0;
  const held = useCoach ? coach?.holdSec ?? 0 : elapsed;
  const workDone = phase === 'work' && (dose.kind === 'reps' ? reps >= dose.value : held >= dose.value);

  const goto = (i: number, ph: Phase = 'ready') => {
    stopSpeaking();
    spoken.current.clear();
    setCoach(null);
    setElapsed(0);
    if (i >= steps.length) {
      setPhase('done');
      return;
    }
    setIdx(Math.max(0, i));
    setPhase(ph);
  };

  // 타이머 (개발 모드에서는 ?speed=N 으로 빨리 감기 가능)
  const speedup = import.meta.env.DEV ? Math.max(1, +(new URLSearchParams(location.hash.split('?')[1] ?? '').get('speed') ?? 1)) : 1;
  useEffect(() => {
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000) * speedup;
      last = now;
      if (paused || phase === 'done') return;
      activeSec.current += dt;
      setElapsed((e) => e + dt);
    }, 100);
    return () => clearInterval(t);
  }, [paused, phase]);

  // 단계 전환 · 음성
  useEffect(() => {
    if (paused) return;
    if (phase === 'ready') {
      if (firstOfItem) say(`r${idx}`, `${L(ex.name)}. ${(ex.setup ? LA(ex.setup)[0] : LA(ex.steps)[0]) ?? ''}`, true);
      else if (step.side === 1) say(`r${idx}`, tr('반대쪽으로 바꿔 주세요', 'Switch sides'), true);
      else say(`r${idx}`, tr(`${step.set}세트 시작할게요`, `Set ${step.set}`), true);
      const left = Math.ceil(readyLen - elapsed);
      if (left <= 3 && left >= 1 && !spoken.current.has(`t${idx}:${left}`)) {
        spoken.current.add(`t${idx}:${left}`);
        sfx.tick();
      }
      if (elapsed >= readyLen) {
        sfx.go();
        haptic.light();
        setElapsed(0);
        setPhase('work');
      }
    } else if (phase === 'work') {
      const cues = LA(ex.cues);
      // 단계 안내: 자세가 바뀔 때 자막을 읽어 줌 (호흡 운동은 매 주기, 나머지는 첫 회만)
      const labels = ex.anim.labels ?? [];
      if (labels.length > 1 && !useCoach) {
        const cyc = cycleLength(ex.anim);
        const at = dose.kind === 'hold' ? Math.min(elapsed, arriveTime(ex.anim, holdKeyOf(ex.anim))) : dose.kind === 'reps' ? ((elapsed % period) / period) * cyc : elapsed;
        const k = keyAt(ex.anim, at).key;
        const every = ex.phase === 'breath' && dose.kind === 'time';
        const firstPass = dose.kind === 'reps' ? elapsed < period : dose.kind === 'hold' || at < cyc;
        if (every || firstPass) say(every ? `k${idx}:${Math.floor(at / cyc)}:${k}` : `k${idx}:${k}`, L(labels[k]));
      }
      if (dose.kind === 'reps' && !useCoach) {
        const n = Math.floor(elapsed / period);
        if (n >= 1 && n <= dose.value && !spoken.current.has(`c${idx}:${n}`)) {
          spoken.current.add(`c${idx}:${n}`);
          sfx.rep();
          if (voiceOn) speak(countWord(n), { interrupt: true, force: true });
        }
      } else if (dose.kind !== 'reps') {
        const t = useCoach ? held : elapsed;
        if (cues.length && t > workLen * 0.3) say(`q1${idx}`, cues[0]);
        if (cues.length > 1 && t > workLen * 0.62) say(`q2${idx}`, cues[1]);
        const left = Math.ceil(workLen - t);
        if (left <= 3 && left >= 1 && !spoken.current.has(`e${idx}:${left}`)) {
          spoken.current.add(`e${idx}:${left}`);
          sfx.tick();
          if (voiceOn) speak(countWord(left), { interrupt: true, force: true });
        }
      }
      if (workDone) {
        haptic.success();
        doneItems.current.add(step.item);
        if (!nextStep) {
          sfx.done();
          if (voiceOn) speak(tr('오늘 루틴 완료! 정말 잘했어요', 'Routine complete! Great job'), { interrupt: true, force: true });
          goto(steps.length);
        } else {
          setElapsed(0);
          setPhase('rest');
          const nextEx = routine.items[nextStep.item].exercise;
          if (voiceOn)
            speak(nextStep.item === step.item ? tr(`좋아요. ${restLen}초 쉬어요`, `Nice. Rest ${restLen} seconds`) : tr(`좋아요! 다음은 ${L(nextEx.name)}`, `Nice! Next up: ${L(nextEx.name)}`), { interrupt: true, force: true });
        }
      }
    } else if (phase === 'rest') {
      if (elapsed >= restLen) goto(idx + 1);
    }
  }, [elapsed, phase, paused, coach]);

  // 코치 피드백
  const onCoach = (s: CoachState) => {
    setCoach(s);
    if (phase !== 'work') return;
    const now = performance.now();
    if (s.repJustCounted) {
      sfx.rep();
      haptic.light();
      if (voiceOn) speak(countWord(s.reps), { interrupt: true, force: true });
      lastCueAt.current = now;
    } else if (s.cue === 'more' && now - lastCueAt.current > 4500 && ex.coach) {
      lastCueAt.current = now;
      if (voiceOn) speak(L(ex.coach.more), { interrupt: true, force: true });
    }
  };

  const exit = async () => {
    if (phase !== 'done' && doneItems.current.size === 0) {
      setPaused(true);
      if (!(await ask(tr('운동을 그만할까요?', 'Stop this workout?'), { ok: tr('그만하기', 'Stop') }))) return setPaused(false);
    } else if (phase !== 'done') {
      setPaused(true);
      if (!(await ask(tr('여기까지 기록하고 그만할까요?', 'Save progress so far and stop?'), { ok: tr('기록하고 그만하기', 'Save & stop') }))) return setPaused(false);
      finish(null, null);
      return;
    }
    stopSpeaking();
    replace('/');
  };

  const finish = (feel: 'easy' | 'ok' | 'hard' | null, painAfter: number | null) => {
    const now = Date.now();
    const exercises = routine.items.map((it, i) => ({ id: it.exercise.id, done: doneItems.current.has(i) }));
    logSession({
      id: uid(),
      at: now,
      kind: routine.kind === 'daily' ? 'daily' : routine.kind === 'desk' ? 'desk' : routine.items.length === 1 ? 'single' : 'focus',
      title: L(routine.title),
      exercises,
      durationSec: Math.round(activeSec.current),
      painBefore: maxPain(),
      painAfter,
      feel,
    });
    const pr = { ...progression.value, lastDone: { ...progression.value.lastDone } };
    for (const e of exercises) if (e.done) pr.lastDone[e.id] = now;
    if (feel === 'easy') {
      pr.easyStreak += 1;
      pr.hardStreak = 0;
      if (pr.easyStreak >= 2 && pr.level < 3) {
        pr.level = (pr.level + 1) as 1 | 2 | 3;
        pr.easyStreak = 0;
        toast(tr('레벨 업! 다음 루틴부터 한 단계 어려운 동작이 나와요 💪', 'Level up! Harder moves unlocked 💪'), 3200);
      }
    } else if (feel === 'hard') {
      pr.hardStreak += 1;
      pr.easyStreak = 0;
      if (pr.hardStreak >= 2 && pr.level > 1) {
        pr.level = (pr.level - 1) as 1 | 2 | 3;
        pr.hardStreak = 0;
        toast(tr('다음 루틴은 조금 더 쉽게 조절할게요', 'We’ll make the next routine a little easier'), 3200);
      }
    } else if (feel === 'ok') {
      pr.easyStreak = 0;
      pr.hardStreak = 0;
    }
    progression.value = pr;
    if (painAfter !== null) {
      const areas = Object.keys(profile.value.pain) as PainArea[];
      if (areas.length) painLogs.value = [...painLogs.value, { at: now, entries: Object.fromEntries(areas.map((a) => [a, painAfter])) }];
    }
    stopSpeaking();
    replace('/');
  };

  if (phase === 'done') return <Done routine={routine} seconds={activeSec.current} onFinish={finish} count={doneItems.current.size} />;

  // 애니메이션 시간
  const anim = ex.anim;
  const into = arriveTime(anim, holdKeyOf(anim));
  let figTime: number | undefined;
  let figSpeed = 1;
  if (phase === 'work') {
    if (dose.kind === 'hold') figTime = Math.min(elapsed, into);
    else if (dose.kind === 'reps' && !useCoach) figTime = ((elapsed % period) / period) * cycleLength(anim);
    else if (dose.kind === 'time') figTime = elapsed;
  } else if (phase === 'rest') figTime = 0;
  if (dose.kind === 'reps' && useCoach) figSpeed = cycleLength(anim) / period;

  const labels = anim.labels ?? [];
  const curKey = figTime !== undefined ? keyAt(anim, figTime).key : phase === 'ready' || phase === 'rest' ? 0 : -1;
  const stepLabel = labels.length > 1 && curKey >= 0 && !useCoach ? `${curKey + 1}/${labels.length} · ${L(labels[curKey])}` : '';
  const progressFrac = (idx + (phase === 'work' ? Math.min(1, dose.kind === 'reps' ? reps / dose.value : held / dose.value) : phase === 'rest' ? 1 : 0)) / steps.length;
  const nextEx = nextStep ? routine.items[nextStep.item].exercise : null;

  let big: string;
  let label: string;
  if (phase === 'ready') {
    big = String(Math.max(1, Math.ceil(readyLen - elapsed)));
    label = firstOfItem ? tr('준비', 'Get ready') : step.side === 1 ? tr('반대쪽 준비', 'Other side') : tr('다음 세트 준비', 'Next set');
  } else if (phase === 'rest') {
    big = mmss(restLen - elapsed);
    label = nextStep?.item === step.item ? tr('휴식', 'Rest') : tr('다음 운동까지', 'Next exercise in');
  } else if (dose.kind === 'reps') {
    big = `${reps}/${dose.value}`;
    label = tr('횟수', 'Reps');
  } else {
    big = mmss(workLen - held);
    label = useCoach && !coach?.inPose ? tr('자세를 잡으면 시간이 흘러요', 'Timer runs while you hold the pose') : tr('남은 시간', 'Time left');
  }
  const setLabel = `${step.sets > 1 ? tr(`${step.set}/${step.sets}세트`, `Set ${step.set}/${step.sets}`) : ''}${step.sides > 1 ? ` · ${step.side === 0 ? tr('첫 번째 쪽', 'First side') : tr('반대쪽', 'Other side')}` : ''}`;
  const cueText =
    phase === 'work' && useCoach && coach
      ? coach.phase === 'lost'
        ? tr('몸 전체가 화면에 보이게 해 주세요', 'Make sure your body is in view')
        : coach.cue === 'more'
          ? L(ex.coach!.more)
          : coach.cue === 'good'
            ? L(ex.coach!.good)
            : ''
      : phase === 'work'
        ? LA(ex.cues)[Math.floor(elapsed / 6) % Math.max(1, LA(ex.cues).length)] ?? ''
        : phase === 'rest' && nextEx
          ? tr(`다음: ${L(nextEx.name)}`, `Next: ${L(nextEx.name)}`)
          : L(PHASE_LABEL[ex.phase]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', maxWidth: 'var(--maxw)', margin: '0 auto' }}>
      <div class="row" style={{ padding: 'calc(var(--safe-top) + 8px) 12px 4px', gap: 6 }}>
        <button class="icon-btn" aria-label={tr('닫기', 'Close')} onClick={exit}>
          <X size={26} />
        </button>
        <div class="grow progress" style={{ height: 6 }}>
          <i style={{ width: `${progressFrac * 100}%` }} />
        </div>
        <button class="icon-btn" aria-label={tr('음성 안내', 'Voice')} onClick={() => setVoiceOn(!voiceOn)}>
          {voiceOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
      </div>
      <div style={{ position: 'relative', height: '44dvh', minHeight: 250, margin: '4px 16px 0', borderRadius: 24, background: 'var(--surface-2)' }}>
        {useCoach ? (
          <>
            <CoachCam spec={ex.coach!} resetKey={`${idx}`} running={phase === 'work' && !paused} onState={onCoach} />
            <div style={{ position: 'absolute', right: 10, top: 10, width: 110, height: 110, borderRadius: 18, background: 'var(--surface)', boxShadow: 'var(--shadow-2)', overflow: 'hidden' }}>
              <Figure spec={anim} mirror={step.side === 1} playing={!paused} speed={figSpeed} height={110} />
            </div>
          </>
        ) : (
          <Figure spec={anim} mirror={step.side === 1} playing={!paused} time={figTime} height="100%" label={L(ex.name)} overlays />
        )}
        {stepLabel && phase === 'work' && (
          <div class="demo-step" style={{ maxWidth: 'calc(100% - 24px)' }} aria-live="polite">
            {stepLabel}
          </div>
        )}
        {phase === 'rest' && nextEx && nextStep!.item !== step.item && (
          <div class="card fade-up" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, flex: 'none' }}>
              <Figure spec={nextEx.anim} height={64} />
            </div>
            <div>
              <div class="caption">{tr('다음 운동', 'Up next')}</div>
              <div class="h3">{L(nextEx.name)}</div>
            </div>
          </div>
        )}
      </div>
      <div class="center" style={{ padding: '14px 20px 4px' }}>
        <div class="caption">
          {tr(`${step.item + 1}/${routine.items.length}번째 운동`, `Exercise ${step.item + 1} of ${routine.items.length}`)}
          {setLabel ? ` · ${setLabel}` : ''}
        </div>
        <h1 class="h1" style={{ marginTop: 4 }}>
          {L(ex.name)}
        </h1>
        <div class="micro" style={{ marginTop: 10, fontWeight: 700, letterSpacing: '0.02em' }}>
          {label}
        </div>
        <div class="num" style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.05, color: phase === 'work' ? 'var(--brand)' : 'var(--text)' }} aria-live="polite">
          {big}
        </div>
        <div class="body" style={{ minHeight: 24, marginTop: 4, fontWeight: 600, color: coach?.cue === 'good' ? 'var(--good)' : 'var(--text-2)' }}>
          {cueText}
        </div>
        {phase === 'ready' && firstOfItem && ex.setup && (
          <ul class="player-setup fade-up">
            {LA(ex.setup)
              .slice(0, 3)
              .map((s, i) => (
                <li key={i}>{s}</li>
              ))}
          </ul>
        )}
        {item.note && phase !== 'rest' && (
          <div class="notice brand" style={{ marginTop: 10, textAlign: 'left', fontSize: 13.5 }}>
            {L(item.note)}
          </div>
        )}
      </div>
      <div class="grow" />
      <div style={{ padding: '8px 20px calc(var(--safe-bottom) + 18px)' }}>
        <div class="row" style={{ justifyContent: 'center', gap: 28 }}>
          <button class="icon-btn" style={{ width: 56, height: 56 }} aria-label={tr('이전', 'Previous')} onClick={() => goto(Math.max(0, idx - 1))}>
            <SkipBack size={26} />
          </button>
          <button
            aria-label={paused ? tr('재개', 'Resume') : tr('일시정지', 'Pause')}
            onClick={() => {
              setPaused(!paused);
              if (!paused) stopSpeaking();
            }}
            style={{ width: 76, height: 76, borderRadius: 38, background: 'var(--brand)', color: '#fff', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-brand)' }}
          >
            {paused ? <Play size={32} fill="currentColor" /> : <Pause size={32} fill="currentColor" />}
          </button>
          <button
            class="icon-btn"
            style={{ width: 56, height: 56 }}
            aria-label={tr('다음', 'Next')}
            onClick={() => {
              if (phase === 'ready') {
                setElapsed(readyLen);
              } else {
                if (phase === 'work') doneItems.current.add(step.item);
                goto(idx + 1);
              }
            }}
          >
            <SkipForward size={26} />
          </button>
        </div>
        <div class="row" style={{ justifyContent: 'center', gap: 10, marginTop: 14 }}>
          <button class="btn sm secondary" onClick={() => setShowSteps(true)}>
            <ListChecks size={16} /> {tr('동작 방법', 'How to')}
          </button>
          {coachable && (
            <button class={`btn sm ${useCoach ? 'soft' : 'secondary'}`} onClick={() => setCoachOn(!coachOn)}>
              {useCoach ? <CameraOff size={16} /> : <Camera size={16} />} {useCoach ? tr('AI 코치 끄기', 'AI coach off') : tr('AI 코치 켜기', 'AI coach on')}
            </button>
          )}
        </div>
        <div class="micro center" style={{ marginTop: 10 }}>
          {tr(`남은 예상 시간 약 ${Math.max(1, Math.round((routine.items.slice(step.item).reduce((s, it) => s + estimateSeconds({ ...it.exercise, dose: it.dose }), 0)) / 60))}분`, `About ${Math.max(1, Math.round(routine.items.slice(step.item).reduce((s, it) => s + estimateSeconds({ ...it.exercise, dose: it.dose }), 0) / 60))} min left`)}
        </div>
      </div>
      <Sheet open={showSteps} onClose={() => setShowSteps(false)} label={L(ex.name)}>
        <h2 class="h2" style={{ marginBottom: 12 }}>
          {L(ex.name)}
        </h2>
        <ExerciseGuide ex={ex} compact />
        <button class="btn primary block" style={{ marginTop: 16 }} onClick={() => setShowSteps(false)}>
          {tr('확인', 'Got it')}
        </button>
      </Sheet>
    </div>
  );
}

function maxPain(): number | null {
  const v = Object.values(profile.value.pain);
  return v.length ? Math.max(...(v as number[])) : null;
}

function Done({ routine, seconds, count, onFinish }: { routine: Routine; seconds: number; count: number; onFinish: (feel: 'easy' | 'ok' | 'hard' | null, pain: number | null) => void }) {
  const [feel, setFeel] = useState<'easy' | 'ok' | 'hard' | null>(null);
  const hasPain = Object.keys(profile.value.pain).length > 0;
  const before = maxPain();
  const [pain, setPain] = useState<number>(before ?? 0);
  return (
    <div class="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <div class="center" style={{ marginTop: 24 }}>
        <div class="pop-in" style={{ display: 'inline-block' }}>
          <Animal id="meerkat" size={150} />
        </div>
        <h1 class="display" style={{ marginTop: 8 }}>
          {tr('루틴 완료!', 'Routine complete!')}
        </h1>
        <p class="body" style={{ marginTop: 6 }}>
          {L(routine.title)}
        </p>
      </div>
      <div class="grid-3" style={{ marginTop: 24 }}>
        {[
          [mmss(seconds), tr('운동 시간', 'Time')],
          [`${count}`, tr('완료한 동작', 'Moves done')],
          [`${doneToday.value ? streak.value : streak.value + 1}`, tr('연속 일수', 'Day streak')],
        ].map(([v, l]) => (
          <div key={l} class="card tight center">
            <div class="num" style={{ fontSize: 24, fontWeight: 900 }}>
              {v}
            </div>
            <div class="caption">{l}</div>
          </div>
        ))}
      </div>
      <h2 class="h3" style={{ margin: '24px 0 10px' }}>
        {tr('오늘 운동 강도는 어땠나요?', 'How did that feel?')}
      </h2>
      <div class="grid-3">
        {(
          [
            ['easy', '😌', tr('쉬웠어요', 'Easy')],
            ['ok', '🙂', tr('적당해요', 'Just right')],
            ['hard', '😮‍💨', tr('힘들었어요', 'Hard')],
          ] as const
        ).map(([k, e, l]) => (
          <button key={k} class={`option ${feel === k ? 'on' : ''}`} style={{ flexDirection: 'column', gap: 4, padding: 14 }} onClick={() => setFeel(k)}>
            <span style={{ fontSize: 28 }}>{e}</span>
            <span style={{ fontSize: 14 }}>{l}</span>
          </button>
        ))}
      </div>
      {hasPain && (
        <>
          <h2 class="h3" style={{ margin: '22px 0 6px' }}>
            {tr('지금 통증은 몇 점인가요? (0~10)', 'Pain right now? (0–10)')}
          </h2>
          <div class="row">
            <input class="slider grow" type="range" min={0} max={10} value={pain} onInput={(e) => setPain(+(e.target as HTMLInputElement).value)} />
            <span class="num" style={{ fontWeight: 900, fontSize: 22, width: 32, textAlign: 'right' }}>
              {pain}
            </span>
          </div>
          {before !== null && pain >= before + 2 && (
            <div class="notice warn" style={{ marginTop: 8 }}>
              {tr('운동 후 통증이 2점 이상 늘었어요. 다음엔 강도를 낮추고, 계속되면 전문가와 상담하세요.', 'Pain rose by 2+ points. Go easier next time and see a professional if it persists.')}
            </div>
          )}
        </>
      )}
      <div class="grow" />
      <div class="bottom-cta">
        <button class="btn primary block" onClick={() => onFinish(feel, hasPain ? pain : null)}>
          {tr('기록 저장하기', 'Save & finish')}
        </button>
      </div>
    </div>
  );
}
