import { useMemo, useState } from 'preact/hooks';
import { Briefcase, Camera, Heart, Search } from 'lucide-preact';
import { ExerciseThumb } from '../components/ExerciseThumb';
import { Chip, TopBar } from '../components/ui';
import { doseText } from '../content/format';
import { EXERCISES, NEW_IDS, PHASE_LABEL, PHASE_ORDER, REGION_LABEL, type Phase, type Region } from '../content/exercises';
import { L, tr } from '../i18n';
import { nav } from '../lib/router';
import { activeRoutine, focusRoutine } from '../state/derived';
import { progression } from '../state/store';

const REGIONS: Region[] = ['neck', 'shoulder', 'upperBack', 'chest', 'lowBack', 'core', 'hip', 'glute', 'knee', 'ankle', 'wrist'];

export function Library() {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState<Region | 'fav' | 'desk' | 'ai' | 'new' | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const favs = progression.value.favorites;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (region === 'fav' && !favs.includes(e.id)) return false;
      if (region === 'desk' && !e.desk) return false;
      if (region === 'ai' && !e.coach) return false;
      if (region === 'new' && !NEW_IDS.has(e.id)) return false;
      if (region && !['fav', 'desk', 'ai', 'new'].includes(region) && !e.regions.includes(region as Region)) return false;
      if (phase && e.phase !== phase) return false;
      if (!s) return true;
      return [e.name.ko, e.name.en, e.muscles.ko, e.muscles.en].some((t) => t.toLowerCase().includes(s));
    });
  }, [q, region, phase, favs.length]);

  return (
    <div class="screen with-tabbar">
      <TopBar plain title={tr('운동', 'Exercises')} />
      <div class="input-unit" style={{ marginBottom: 12 }}>
        <input class="input" style={{ fontSize: 16, fontWeight: 500, height: 48, paddingLeft: 42 }} placeholder={tr('동작·근육 이름 검색', 'Search moves or muscles')} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <span style={{ left: 14, right: 'auto' }}>
          <Search size={18} />
        </span>
      </div>
      <div class="row" style={{ gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px 6px' }}>
        <Chip on={region === null} onClick={() => setRegion(null)}>
          {tr('전체', 'All')}
        </Chip>
        {NEW_IDS.size > 0 && (
          <Chip on={region === 'new'} onClick={() => setRegion('new')}>
            <span class="new-dot" /> {tr('새 동작', 'New')}
          </Chip>
        )}
        <Chip on={region === 'fav'} onClick={() => setRegion('fav')}>
          <Heart size={14} /> {tr('즐겨찾기', 'Saved')}
        </Chip>
        <Chip on={region === 'desk'} onClick={() => setRegion('desk')}>
          <Briefcase size={14} /> {tr('사무실', 'Desk')}
        </Chip>
        <Chip on={region === 'ai'} onClick={() => setRegion('ai')}>
          <Camera size={14} /> {tr('AI 코칭', 'AI coached')}
        </Chip>
        {REGIONS.map((r) => (
          <Chip key={r} on={region === r} onClick={() => setRegion(r)}>
            {L(REGION_LABEL[r])}
          </Chip>
        ))}
      </div>
      <div class="row" style={{ gap: 6, overflowX: 'auto', margin: '6px -20px 0', padding: '0 20px 4px' }}>
        {PHASE_ORDER.map((p) => (
          <button key={p} class={`seg-chip${phase === p ? ' on' : ''}`} onClick={() => setPhase(phase === p ? null : p)}>
            {L(PHASE_LABEL[p])}
          </button>
        ))}
      </div>
      {region && !['fav', 'desk', 'ai', 'new'].includes(region) && (
        <button
          class="btn soft block"
          style={{ margin: '10px 0 4px' }}
          onClick={() => {
            activeRoutine.value = focusRoutine([region as Region]);
            nav(`/routine/focus?regions=${region}`);
          }}
        >
          {tr(`${L(REGION_LABEL[region as Region])} 집중 루틴 만들기`, `Build a ${L(REGION_LABEL[region as Region]).toLowerCase()} routine`)}
        </button>
      )}
      <div class="caption" style={{ margin: '10px 2px' }}>
        {tr(`${list.length}개 동작`, `${list.length} moves`)}
      </div>
      <div class="card-list">
        {list.map((e) => (
          <button key={e.id} class="list-item" onClick={() => nav(`/exercise/${e.id}`)}>
            <ExerciseThumb ex={e} size={60} still />
            <div class="grow">
              <div class="h3">
                {L(e.name)}
                {NEW_IDS.has(e.id) && <span class="badge-new">NEW</span>}
              </div>
              <div class="caption">
                {L(PHASE_LABEL[e.phase])} · {doseText(e.dose)}
              </div>
              <div class="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                <span class="badge">Lv.{e.level}</span>
                {e.desk && (
                  <span class="badge" aria-label={tr('사무실 가능', 'Desk-friendly')}>
                    <Briefcase size={11} />
                  </span>
                )}
                {e.coach && (
                  <span class="badge brand">
                    <Camera size={11} /> AI
                  </span>
                )}
                {favs.includes(e.id) && (
                  <span class="badge lv3">
                    <Heart size={11} fill="currentColor" />
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
