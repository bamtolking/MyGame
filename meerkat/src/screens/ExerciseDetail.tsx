import { useRef, useState } from 'preact/hooks';
import { Briefcase, Camera, EyeOff, Heart, Package, Pause, Play, Repeat, RotateCcw, Rotate3d } from 'lucide-preact';
import { ExerciseGuide } from '../components/ExerciseGuide';
import { toast, TopBar } from '../components/ui';
import type { Exercise } from '../content/exercise-types';
import { doseText } from '../content/format';
import { EQUIPMENT_LABEL, exercise, PHASE_LABEL, REGION_LABEL } from '../content/exercises';
import { Figure } from '../figure/Figure';
import { keyAt, keyTime } from '../figure/render';
import { L, LA, tr } from '../i18n';
import { nav } from '../lib/router';
import { singleRoutine } from '../routine/generator';
import { activeRoutine } from '../state/derived';
import { profile, progression } from '../state/store';

/** 시범 무대: 재생·느리게·단계 이동·360° 돌려 보기·반대쪽·근육 강조 */
function DemoStage({ ex }: { ex: Exercise }) {
  const a = ex.anim;
  const [mirror, setMirror] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const [yaw, setYaw] = useState(0);
  const [key, setKey] = useState(0);
  const [seek, setSeek] = useState<{ t: number; id: number } | undefined>(undefined);
  const drag = useRef<{ x: number; yaw: number; moved: boolean } | null>(null);
  const labels = a.labels ?? [];
  const kinds = new Set((a.focus ?? []).map((f) => f.kind));
  const onTime = (t: number) => {
    const k = keyAt(a, t).key;
    if (k !== key) setKey(k);
  };
  const jump = (k: number) => {
    setSeek({ t: keyTime(a, k), id: Date.now() });
    setKey(k);
    setPlaying(false);
  };
  return (
    <div class="demo">
      <div
        class="demo-stage"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, yaw, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 6) d.moved = true;
          if (d.moved) setYaw(Math.round((d.yaw + dx * 0.8) / 5) * 5);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <Figure spec={a} mirror={mirror} playing={playing} speed={slow ? 0.5 : 1} yaw={yaw} overlays onTime={onTime} seek={seek} height={320} label={L(ex.name)} />
        {labels.length > 0 && (
          <div class="demo-step" aria-live="polite">
            <b>
              {key + 1}/{labels.length}
            </b>{' '}
            {L(labels[key])}
          </div>
        )}
        <div class="demo-tools">
          {yaw !== 0 && (
            <button class="demo-btn" aria-label={tr('원래 각도로', 'Reset angle')} onClick={() => setYaw(0)}>
              <RotateCcw size={16} />
            </button>
          )}
          <button class="demo-btn" aria-label={tr('90도 돌려 보기', 'Rotate 90°')} onClick={() => setYaw((y) => y + 90)}>
            <Rotate3d size={16} />
          </button>
          {ex.dose.perSide && (
            <button class={`demo-btn${mirror ? ' on' : ''}`} onClick={() => setMirror(!mirror)}>
              <Repeat size={15} /> {tr('반대쪽', 'Other side')}
            </button>
          )}
        </div>
        <div class="demo-bottom">
          <button class="demo-btn" aria-label={playing ? tr('멈춤', 'Pause') : tr('재생', 'Play')} onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button class={`demo-btn${slow ? ' on' : ''}`} onClick={() => setSlow(!slow)}>
            {slow ? '0.5×' : '1×'}
          </button>
          <div class="grow" />
          {kinds.has('stretch') && (
            <span class="demo-legend">
              <i style={{ background: 'rgb(255,64,102)' }} />
              {tr('늘어나는 곳', 'Stretch')}
            </span>
          )}
          {kinds.has('work') && (
            <span class="demo-legend">
              <i style={{ background: 'rgb(41,121,255)' }} />
              {tr('힘 주는 곳', 'Working')}
            </span>
          )}
        </div>
      </div>
      {labels.length > 1 && (
        <div class="demo-keys" role="tablist" aria-label={tr('동작 단계', 'Movement steps')}>
          {labels.map((l, i) => (
            <button key={i} role="tab" aria-selected={key === i} class={key === i ? 'on' : ''} onClick={() => jump(i)}>
              <span class="n">{i + 1}</span>
              {L(l)}
            </button>
          ))}
        </div>
      )}
      <div class="caption center" style={{ marginTop: 6 }}>
        {tr('그림을 좌우로 밀면 돌려 볼 수 있어요 · 단계를 누르면 그 자세에서 멈춰요', 'Swipe the figure to rotate · tap a step to pause on it')}
      </div>
    </div>
  );
}

export function ExerciseDetail({ id }: { id: string }) {
  const ex = exercise(id);
  if (!ex) {
    return (
      <div class="screen">
        <TopBar title="" fallback="/exercises" />
        <p class="body">{tr('운동을 찾을 수 없어요.', 'Exercise not found.')}</p>
      </div>
    );
  }
  const fav = progression.value.favorites.includes(ex.id);
  const hidden = progression.value.hidden.includes(ex.id);
  const toggleFav = () => {
    const p = progression.value;
    progression.value = { ...p, favorites: fav ? p.favorites.filter((x) => x !== ex.id) : [...p.favorites, ex.id] };
  };
  const toggleHide = () => {
    const p = progression.value;
    progression.value = { ...p, hidden: hidden ? p.hidden.filter((x) => x !== ex.id) : [...p.hidden, ex.id] };
    toast(hidden ? tr('다시 추천에 포함할게요', 'Back in your recommendations') : tr('앞으로 루틴에서 빼 둘게요', 'Won’t be recommended anymore'));
  };
  const start = () => {
    activeRoutine.value = singleRoutine(ex);
    nav(profile.value.safetyCheckedAt ? '/player' : '/safety?next=/player');
  };
  return (
    <div class="screen">
      <TopBar
        title={L(ex.name)}
        fallback="/exercises"
        right={
          <button class="icon-btn" aria-label={tr('즐겨찾기', 'Save')} onClick={toggleFav}>
            <Heart size={22} fill={fav ? 'var(--severe)' : 'none'} color={fav ? 'var(--severe)' : 'currentColor'} />
          </button>
        }
      />
      <DemoStage key={ex.id} ex={ex} />
      <h1 class="h1" style={{ marginTop: 18 }}>
        {L(ex.name)}
      </h1>
      <div class="chips" style={{ marginTop: 10 }}>
        <span class="badge brand">{L(PHASE_LABEL[ex.phase])}</span>
        <span class="badge">Lv.{ex.level}</span>
        <span class="badge">{doseText(ex.dose)}</span>
        {ex.regions.map((r) => (
          <span key={r} class="badge">
            {L(REGION_LABEL[r])}
          </span>
        ))}
        {ex.equipment.map((q) => (
          <span key={q} class="badge">
            <Package size={12} /> {L(EQUIPMENT_LABEL[q])}
          </span>
        ))}
        {ex.desk && (
          <span class="badge">
            <Briefcase size={12} /> {tr('사무실 가능', 'Desk-friendly')}
          </span>
        )}
        {ex.coach && (
          <span class="badge brand">
            <Camera size={12} /> {tr('AI 코칭', 'AI coached')}
          </span>
        )}
      </div>
      <p class="body" style={{ marginTop: 14, color: 'var(--text)' }}>
        {L(ex.why)}
      </p>
      <div class="caption" style={{ marginTop: 6 }}>
        {tr('주로 쓰는 근육', 'Target')}: {L(ex.muscles)}
      </div>
      <div style={{ marginTop: 18 }}>
        <ExerciseGuide ex={ex} />
      </div>
      <button class="btn ghost block" style={{ marginTop: 12 }} onClick={toggleHide}>
        <EyeOff size={17} /> {hidden ? tr('추천에 다시 포함하기', 'Include in recommendations') : tr('이 동작은 추천하지 않기', 'Don’t recommend this move')}
      </button>
      <div class="bottom-cta">
        <button class="btn primary block" onClick={start}>
          <Play size={18} fill="currentColor" /> {tr('이 동작만 따라 하기', 'Do this move now')}
        </button>
      </div>
    </div>
  );
}
