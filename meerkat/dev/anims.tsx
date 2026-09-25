import { render } from 'preact';
import '../src/styles.css';
import { Figure } from '../src/figure/Figure';
import { EXERCISES } from '../src/content/exercises';
import { cycleLength } from '../src/figure/render';

const q = new URLSearchParams(location.search);
const from = +(q.get('from') ?? 0);
const count = +(q.get('n') ?? 12);
const key = +(q.get('key') ?? 1); // 0: 시작 자세, 1: 끝 자세
const list = EXERCISES.slice(from, from + count);
function G() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: 6 }}>
      {list.map((e, i) => {
        const s = e.anim;
        const t = key === 0 ? (s.pauses?.[0] ?? 0) * 0.5 : (s.pauses?.[0] ?? 0) + (s.durations?.[0] ?? 1.2) + 0.05;
        return (
          <div key={e.id} style={{ border: '1px solid #eee', borderRadius: 10 }}>
            <div style={{ font: '11px sans-serif', padding: 3 }}>{from + i}. {e.id} ({cycleLength(s).toFixed(1)}s)</div>
            <Figure spec={s} playing={false} time={t} height={200} />
          </div>
        );
      })}
    </div>
  );
}
render(<G />, document.getElementById('root')!);
setTimeout(() => ((window as any).__done = true), 800);
