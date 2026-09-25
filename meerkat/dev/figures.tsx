import { render } from 'preact';
import '../src/styles.css';
import { Figure } from '../src/figure/Figure';
import { both, type Pose } from '../src/figure/rig';
import type { AnimSpec } from '../src/figure/render';

const q = new URLSearchParams(location.search);
const stand: Pose = {};
const tests: [string, AnimSpec][] = [
  ['front', { view: 0, keys: [stand] }],
  ['side', { view: 90, keys: [stand] }],
  ['3/4', { view: 35, keys: [stand] }],
  ['squat side', { view: 90, keys: [{ ...both({ hip: { flex: 95 }, kn: 105, an: 25, sh: { flex: 80 } }), lumbar: { flex: 20 }, thorax: { flex: 10 }, neck: { flex: -15 } }] }],
  ['bridge', { view: 90, elev: 12, props: [{ kind: 'mat' }], anchor: ['heelL', 'heelR'], level: { a: ['backTop'], b: ['heelL', 'heelR'] }, keys: [{ root: { pitch: -112 }, ...both({ hip: { flex: 0 }, kn: 105, an: 0, sh: { flex: 10 } }) }] }],
  ['supine', { view: 90, elev: 12, props: [{ kind: 'mat' }], anchor: ['pelvis'], keys: [{ root: { pitch: -90 }, ...both({ hip: { flex: 45 }, kn: 90, sh: { flex: 0 } }) }] }],
  ['quadruped', { view: 90, elev: 10, props: [{ kind: 'mat' }], anchor: ['knL', 'knR'], keys: [{ root: { pitch: 80 }, ...both({ hip: { flex: 80 }, kn: 90, sh: { flex: 80 }, wr: 90, an: -70 }), neck: { flex: -12 } }] }],
  ['seated', { view: 90, props: [{ kind: 'chair' }], keys: [{ ...both({ hip: { flex: 90 }, kn: 90, sh: { flex: 20 }, el: 70 }) }] }],
  ['side-lying', { view: 0, elev: 20, props: [{ kind: 'mat' }], anchor: ['pelvis'], keys: [{ root: { roll: 90 }, ...both({ hip: { flex: 45 }, kn: 90 }), shR: { flex: 90 }, shL: { flex: 90 }, elL: 90 }] }],
  ['wall angel', { view: 0, props: [{ kind: 'wall', wall: 'back' }], keys: [{ ...both({ sh: { abd: 90, rot: 90 }, el: 90 }) }] }],
  ['half-kneel', { view: 90, props: [{ kind: 'mat' }], keys: [{ hipL: { flex: 90 }, knL: 90, hipR: { flex: -20 }, knR: 90, anR: -30, lumbar: { flex: -5 } }] }],
  ['side bend', { view: 0, keys: [{ lumbar: { side: -12 }, thorax: { side: -14 }, shL: { abd: 170 }, elL: 10 }] }],
];
function G() {
  const only = q.get('only');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 8 }}>
      {tests.filter(([n]) => !only || n === only).map(([name, spec]) => (
        <div key={name} style={{ border: '1px solid #eee', borderRadius: 12 }}>
          <div style={{ font: '12px sans-serif', padding: 4 }}>{name}</div>
          <Figure spec={spec} playing={false} time={0} height={220} />
        </div>
      ))}
    </div>
  );
}
render(<G />, document.getElementById('root')!);
setTimeout(() => ((window as any).__done = true), 600);
