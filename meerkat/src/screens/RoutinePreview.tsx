import { useEffect } from 'preact/hooks';
import { Camera, ChevronRight, Play, RefreshCw } from 'lucide-preact';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Seg, TopBar } from '../components/ui';
import { doseText } from '../content/format';
import { NEW_IDS, PHASE_LABEL, type Region } from '../content/exercises';
import { L, tr } from '../i18n';
import { nav, replace, route } from '../lib/router';
import { DESK_PRESETS, deskRoutine, ISSUE_THEME } from '../routine/generator';
import { activeRoutine, focusRoutine, program, shuffle, todayRoutine } from '../state/derived';
import { latestScan, profile, settings } from '../state/store';

export function RoutinePreview() {
  const { parts, query } = route.value;
  const kind = parts[1] ?? 'today';

  // 경로에 맞는 루틴 준비
  let routine = activeRoutine.value;
  if (kind === 'today') routine = todayRoutine.value;
  else if (kind === 'desk' && query.preset) {
    const p = DESK_PRESETS.find((x) => x.id === query.preset);
    if (p && (!routine || routine.key !== `desk:${p.id}`)) routine = deskRoutine(p);
  } else if (kind === 'focus' && query.regions) {
    if (!routine || routine.kind !== 'focus') routine = focusRoutine(query.regions.split(',') as Region[]);
  }
  useEffect(() => {
    if (routine) activeRoutine.value = routine;
  }, [routine?.key, routine?.items.length]);

  if (!routine) {
    replace('/');
    return null;
  }
  const start = () => {
    activeRoutine.value = routine;
    if (!profile.value.safetyCheckedAt) nav(`/safety?next=/player`);
    else nav('/player');
  };
  const p = program.value;
  const hasCoach = routine.items.some((it) => it.exercise.coach);
  return (
    <div class="screen">
      <TopBar title={L(routine.title)} />
      <div class="card">
        <div class="row between">
          <div>
            <h1 class="h2">{L(routine.title)}</h1>
            <div class="caption" style={{ marginTop: 2 }}>
              {L(routine.subtitle)}
            </div>
          </div>
          {kind === 'today' && (
            <button class="icon-btn" aria-label={tr('다른 조합', 'Shuffle')} onClick={() => (shuffle.value += 1)}>
              <RefreshCw size={20} />
            </button>
          )}
        </div>
        {kind === 'today' && (
          <>
            <div style={{ marginTop: 14 }}>
              <Seg
                value={settings.value.sessionMinutes}
                onChange={(v) => (settings.value = { ...settings.value, sessionMinutes: v })}
                options={[
                  { value: 5, label: tr('5분', '5 min') },
                  { value: 10, label: tr('10분', '10 min') },
                  { value: 15, label: tr('15분', '15 min') },
                ]}
              />
            </div>
            <div class="chips" style={{ marginTop: 12 }}>
              {latestScan.value && <span class="badge brand">{tr(`${p.week}주차 프로그램`, `Program week ${p.week}`)}</span>}
              {routine.focus.map((f) => (
                <span key={f} class="badge">
                  #{L(ISSUE_THEME[f] ?? { ko: f, en: f })}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div class="section-title">
        <h2 class="h2">{tr('오늘 할 동작', 'Moves')}</h2>
        <span class="caption">{tr('풀기 → 늘리기 → 깨우기 → 통합 순서', 'Release → stretch → activate → integrate')}</span>
      </div>
      <div class="card-list">
        {routine.items.map((it, i) => (
          <button key={it.exercise.id + i} class="list-item" onClick={() => nav(`/exercise/${it.exercise.id}`)}>
            <ExerciseThumb ex={it.exercise} size={56} still />
            <div class="grow">
              <div class="row" style={{ gap: 6 }}>
                <span class="badge">{L(PHASE_LABEL[it.exercise.phase])}</span>
                {it.exercise.coach && (
                  <span class="badge brand">
                    <Camera size={12} /> AI
                  </span>
                )}
              </div>
              <div class="h3" style={{ marginTop: 4 }}>
                {L(it.exercise.name)}
                {NEW_IDS.has(it.exercise.id) && <span class="badge-new">NEW</span>}
              </div>
              <div class="caption">{doseText(it.dose)}</div>
              {it.note && (
                <div class="caption" style={{ color: 'var(--brand-ink)', marginTop: 2 }}>
                  ✦ {L(it.note)}
                </div>
              )}
            </div>
            <ChevronRight size={18} class="chev" />
          </button>
        ))}
      </div>
      {hasCoach && (
        <p class="caption" style={{ marginTop: 12 }}>
          <Camera size={13} /> {tr('AI 표시 동작은 운동 중 “AI 코치”를 켜면 카메라가 횟수와 자세를 봐 줘요.', 'For moves marked AI, turn on “AI coach” to have the camera count reps and check form.')}
        </p>
      )}
      <div class="bottom-cta">
        <button class="btn primary block" onClick={start}>
          <Play size={18} fill="currentColor" /> {tr('운동 시작', 'Start workout')}
        </button>
      </div>
    </div>
  );
}
