import { useState } from 'preact/hooks';
import { Briefcase, Camera, CircleCheck, EyeOff, Heart, Package, Play, Repeat, TriangleAlert } from 'lucide-preact';
import { Notice, toast, TopBar } from '../components/ui';
import { doseText } from '../content/format';
import { EQUIPMENT_LABEL, exercise, PHASE_LABEL, REGION_LABEL } from '../content/exercises';
import { Figure } from '../figure/Figure';
import { L, LA, tr } from '../i18n';
import { nav } from '../lib/router';
import { singleRoutine } from '../routine/generator';
import { activeRoutine } from '../state/derived';
import { profile, progression } from '../state/store';

export function ExerciseDetail({ id }: { id: string }) {
  const ex = exercise(id);
  const [mirror, setMirror] = useState(false);
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
      <div class="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        <Figure spec={ex.anim} mirror={mirror} height={300} label={L(ex.name)} />
        {ex.dose.perSide && (
          <button class="btn sm secondary" style={{ position: 'absolute', right: 10, top: 10 }} onClick={() => setMirror(!mirror)}>
            <Repeat size={15} /> {tr('반대쪽', 'Other side')}
          </button>
        )}
      </div>
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

      <div class="section-title">
        <h2 class="h2">{tr('이렇게 해요', 'How to')}</h2>
      </div>
      <div class="card">
        <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.75 }}>
          {LA(ex.steps).map((s, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <div class="grid-2" style={{ marginTop: 12 }}>
        <div class="card tight">
          <div class="h3 row" style={{ color: 'var(--good)', gap: 6 }}>
            <CircleCheck size={17} /> {tr('코칭 포인트', 'Cues')}
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--text-2)' }}>
            {LA(ex.cues).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div class="card tight">
          <div class="h3 row" style={{ color: 'var(--severe)', gap: 6 }}>
            <TriangleAlert size={17} /> {tr('흔한 실수', 'Common mistakes')}
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--text-2)' }}>
            {LA(ex.mistakes).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
      {ex.caution && (
        <Notice kind="warn" style={{ marginTop: 12 }}>
          {L(ex.caution)}
        </Notice>
      )}
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
