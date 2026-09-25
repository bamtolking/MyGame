import { render } from 'preact';
import '../src/styles.css';
import { Duck, Flamingo, LogoMark, Meerkat, Shrimp, Turtle } from '../src/components/animals';

function G() {
  const items = [Meerkat, Turtle, Shrimp, Duck, Flamingo];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, background: '#fff' }}>
      {items.map((C, i) => (
        <div key={i} style={{ background: '#f3f4f6', borderRadius: 20 }}>
          <C size={220} />
        </div>
      ))}
      <LogoMark size={120} />
    </div>
  );
}
render(<G />, document.getElementById('root')!);
(window as any).__done = true;
