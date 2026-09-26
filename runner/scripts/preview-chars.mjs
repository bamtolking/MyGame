// Contact sheet of every runner × pose + the companions (and cosmetic hats), rendered by the game's own drawing
// code in headless Chromium. The sim hurtbox is drawn as a thin green rectangle over every standing/sliding pose,
// and an automatic check prints where the art does not enclose the hurtbox.
//
//   npx vite build && node scripts/singlefile.mjs && node scripts/preview-chars.mjs [out.png] [--sections]
//
// Uses the debug globals window.__drawCharacter / __drawHat (src/render/characters.ts) and window.__drawCompanion
// (src/render/companions.ts). --sections also writes each block of the sheet as its own PNG next to out.png.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const args = process.argv.slice(2);
const out = resolve(args.find(a => !a.startsWith('--')) || 'e2e-out/chars-sheet.png');
const sections = args.includes('--sections');

// the roster comes from the data files so the sheet always matches the game
const csrc = readFileSync('src/data/characters.ts', 'utf8');
const chars = [...csrc.matchAll(/id: '(\w+)', name: '([^']+)'[^]*?shape: '(\w+)'[^]*?palette: \{ body: '(#\w+)', shade: '(#\w+)', accent: '(#\w+)', cheek: '(#\w+)' \}/g)]
  .map(m => ({ id: m[1], name: m[2], shape: m[3], palette: { body: m[4], shade: m[5], accent: m[6], cheek: m[7] } }));
const psrc = readFileSync('src/data/companions.ts', 'utf8');
const comps = [...psrc.matchAll(/\{ id: '(\w+)', name: '([^']+)'/g)].map(m => ({ id: m[1], name: m[2] }));
if (!chars.length) throw new Error('could not parse src/data/characters.ts');

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto('file://' + resolve('play/index.html'));
await page.waitForFunction(() => !!window.__drawCharacter && !!window.__drawCompanion, null, { timeout: 10000 });

const result = await page.evaluate(({ chars, comps }) => {
  const draw = window.__drawCharacter, drawHat = window.__drawHat, drawComp = window.__drawCompanion;
  const PI = Math.PI;
  const base = { state: 'idle', t: 0.5, runPhase: 0, spin: 0, squash: 1, hurt: false, alpha: 1 };
  const POSES = [
    ['idle', { state: 'idle' }],
    ['blink', { state: 'idle', t: 2.85 }],
    ['run 0', { state: 'run', runPhase: 0 }],
    ['run ¼', { state: 'run', runPhase: 0.25 }],
    ['run ½', { state: 'run', runPhase: 0.5 }],
    ['run ¾', { state: 'run', runPhase: 0.75 }],
    ['land', { state: 'run', runPhase: 0.1, squash: 1.18 }],
    ['jump', { state: 'jump', squash: 0.9 }],
    ['air2 90°', { state: 'air2', spin: -PI / 2 }],
    ['air2 180°', { state: 'air2', spin: -PI }],
    ['fall', { state: 'fall', t: 0.3 }],
    ['slide', { state: 'slide', runPhase: 0.2 }],
    ['fly', { state: 'fly' }],
    ['hurt', { state: 'run', runPhase: 0.1, hurt: true }],
    ['dead', { state: 'dead', hurt: true }],
  ];
  const HB = { stand: [-18, -70, 36, 70], slide: [-26, -32, 52, 32] };
  const hbFor = st => (st === 'slide' ? HB.slide : HB.stand);
  const S = 1.5;                        // sheet px per logical px (big grid)
  const CW = 112, CH = 136, LW = 150;   // cell size (logical), left label column (sheet px)
  const bg = (g, x, y, w, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#2b2d6e'); gr.addColorStop(1, '#8a4f7a'); g.fillStyle = gr; g.fillRect(x, y, w, h); };
  const label = (g, text, x, y, size = 14, color = '#fff', align = 'left') => { g.font = `700 ${size}px system-ui, "Noto Sans KR", sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, x, y); };
  const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.ceil(w); cv.height = Math.ceil(h); return cv; };
  const blocks = [];

  // ---- A: every runner × every pose, with the hurtbox
  {
    const W = LW + POSES.length * CW * S, H = 40 + chars.length * CH * S;
    const cv = mk(W, H), g = cv.getContext('2d');
    g.fillStyle = '#16122a'; g.fillRect(0, 0, W, H);
    POSES.forEach(([name], i) => label(g, name, LW + (i + 0.5) * CW * S, 20, 16, '#ffe9a8', 'center'));
    chars.forEach((ch, r) => {
      const y0 = 40 + r * CH * S;
      label(g, ch.name, 12, y0 + CH * S / 2 - 10, 20); label(g, `${ch.id} · ${ch.shape}`, 12, y0 + CH * S / 2 + 14, 12, '#b9b3d9');
      POSES.forEach(([, pp], i) => {
        const x0 = LW + i * CW * S; bg(g, x0 + 2, y0 + 2, CW * S - 4, CH * S - 4);
        const fx = x0 + CW * S / 2, fy = y0 + (CH - 20) * S;
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0 + 2, fy, CW * S - 4, y0 + CH * S - 2 - fy);
        const pose = { ...base, ...pp };
        g.save(); g.translate(fx, fy); g.scale(S, S);
        if (pose.state === 'dead') g.rotate(-1.3);
        draw(g, ch.shape, ch.palette, pose);
        g.restore();
        if (pose.state !== 'dead') { const [hx, hy, hw, hh] = hbFor(pose.state); g.strokeStyle = '#00ff88'; g.lineWidth = 1; g.strokeRect(fx + hx * S + 0.5, fy + hy * S + 0.5, hw * S - 1, hh * S - 1); }
      });
    });
    blocks.push(['poses', cv]);
  }

  // ---- B: phone sizes — portrait phone (≈0.93 px per logical px at dpr 2), 40 css px tall at dpr 1, black silhouettes
  {
    const states = [['idle', {}], ['run', { state: 'run', runPhase: 0.25 }], ['jump', { state: 'jump' }], ['slide', { state: 'slide' }]];
    const colW = 330, W = LW + chars.length * colW, H = 330;
    const cv = mk(W, H), g = cv.getContext('2d');
    g.fillStyle = '#16122a'; g.fillRect(0, 0, W, H);
    label(g, 'phone ×0.93', 12, 70, 15, '#ffe9a8'); label(g, '40 px (dpr 1)', 12, 170, 15, '#ffe9a8'); label(g, 'silhouette 40 px', 12, 265, 15, '#ffe9a8');
    chars.forEach((ch, i) => {
      const x0 = LW + i * colW;
      label(g, ch.name, x0 + colW / 2, 14, 15, '#fff', 'center');
      bg(g, x0 + 4, 26, colW - 8, 290);
      states.forEach(([, pp], j) => {
        const pose = { ...base, ...pp };
        for (const [k, yy, sil] of [[0.93, 110, false], [0.476, 200, false], [0.476, 300, true]]) {
          const fx = x0 + 44 + j * 80;
          if (!sil) { g.save(); g.translate(fx, yy); g.scale(k, k); draw(g, ch.shape, ch.palette, pose); g.restore(); continue; }
          const t = mk(80, 80), tg = t.getContext('2d'); tg.translate(40, 70); tg.scale(k, k); draw(tg, ch.shape, ch.palette, pose);
          tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#0b0714'; tg.fillRect(0, 0, 80, 80);
          g.drawImage(t, fx - 40, yy - 70);
        }
      });
    });
    blocks.push(['phone', cv]);
  }

  // ---- C: companions — flap frames at 3×, and at 1× next to a runner (world scale)
  {
    const W = LW + 1500, H = 330;
    const cv = mk(W, H), g = cv.getContext('2d');
    g.fillStyle = '#16122a'; g.fillRect(0, 0, W, H);
    comps.forEach((cp, i) => {
      const x0 = LW + i * 500;
      label(g, `${cp.name} (${cp.id})`, x0 + 250, 14, 15, '#fff', 'center');
      bg(g, x0 + 4, 26, 492, 296);
      [0, 0.03, 0.07, 0.11].forEach((t, j) => drawComp(g, cp.id, t, x0 + 70 + j * 118, 105, 1.9));
      // world scale: behind/above a runner, as the renderer would place it
      const ch = chars[i % chars.length];
      g.save(); g.translate(x0 + 330, 305); g.scale(1.5, 1.5); draw(g, ch.shape, ch.palette, { ...base, state: 'run', runPhase: 0.25 }); g.restore();
      drawComp(g, cp.id, 0.4, x0 + 330 - 46 * 1.5, 305 - 100 * 1.5, 1.5);
      g.save(); g.translate(x0 + 120, 305); g.scale(0.93, 0.93); draw(g, ch.shape, ch.palette, { ...base, state: 'run', runPhase: 0.25 }); drawComp(g, cp.id, 0.4, -46, -100, 1); g.restore();
    });
    label(g, 'companions', 12, 110, 15, '#ffe9a8'); label(g, 'with runner', 12, 250, 15, '#ffe9a8');
    blocks.push(['companions', cv]);
  }

  // ---- D: cosmetic hats (drawHat) on every runner: idle ×3 hats, run + slide with 갓
  if (drawHat) {
    const hats = ['gat', 'bokgeon', 'band'];
    const cellW = 80, W = LW + chars.length * cellW * 5, H = 170;
    const cv = mk(W, H), g = cv.getContext('2d');
    g.fillStyle = '#16122a'; g.fillRect(0, 0, W, H);
    label(g, 'hats', 12, 90, 15, '#ffe9a8');
    chars.forEach((ch, i) => {
      const x0 = LW + i * cellW * 5; bg(g, x0 + 4, 8, cellW * 5 - 8, 154);
      const cells = [[hats[0], { state: 'idle' }], [hats[1], { state: 'idle' }], [hats[2], { state: 'idle' }], ['gat', { state: 'run', runPhase: 0.3 }], ['band', { state: 'slide' }]];
      cells.forEach(([hat, pp], j) => {
        const pose = { ...base, ...pp };
        g.save(); g.translate(x0 + cellW * (j + 0.5), 148); g.scale(1.1, 1.1);
        draw(g, ch.shape, ch.palette, pose); drawHat(g, hat, ch.shape, pose); g.restore();
      });
    });
    blocks.push(['hats', cv]);
  }

  // ---- stitch
  const W = Math.max(...blocks.map(b => b[1].width)), H = blocks.reduce((s, b) => s + b[1].height + 12, 0);
  const sheet = mk(W, H), sg = sheet.getContext('2d');
  sg.fillStyle = '#0d0a18'; sg.fillRect(0, 0, W, H);
  let y = 0; for (const [, cv] of blocks) { sg.drawImage(cv, 0, y); y += cv.height + 12; }

  // ---- automatic check: does the art's bounding box enclose the hurtbox? how much of the hurtbox is covered?
  const report = [];
  const K = 2, T = mk(200 * K, 200 * K), tg = T.getContext('2d', { willReadFrequently: true });
  for (const ch of chars) for (const [name, pp] of POSES) {
    const pose = { ...base, ...pp };
    if (pose.state === 'dead' || pose.state === 'fly' || pose.state === 'air2') continue;
    tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, T.width, T.height);
    tg.translate(100 * K, 150 * K); tg.scale(K, K); draw(tg, ch.shape, ch.palette, pose);
    const d = tg.getImageData(0, 0, T.width, T.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const [hx, hy, hw, hh] = hbFor(pose.state); let cov = 0, tot = 0;
    for (let py = 0; py < T.height; py++) for (let px = 0; px < T.width; px++) {
      const a = d[(py * T.width + px) * 4 + 3]; const lx = px / K - 100, ly = py / K - 150;
      if (a > 40) { if (lx < x0) x0 = lx; if (lx > x1) x1 = lx; if (ly < y0) y0 = ly; if (ly > y1) y1 = ly; }
      if (lx >= hx && lx < hx + hw && ly >= hy && ly < hy + hh) { tot++; if (a > 40) cov++; }
    }
    const m = { l: hx - x0, r: x1 - (hx + hw), t: hy - y0 };
    report.push({ ch: ch.id, pose: name, art: [Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)], margin: m, cover: Math.round(cov / tot * 100) });
  }
  const url = c => c.toDataURL('image/png');
  return { sheet: url(sheet), blocks: blocks.map(([n, cv]) => [n, url(cv)]), report };
}, { chars, comps });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(result.sheet.split(',')[1], 'base64'));
console.log('wrote', out);
if (sections) for (const [n, u] of result.blocks) { const p = out.replace(/\.png$/, `-${n}.png`); writeFileSync(p, Buffer.from(u.split(',')[1], 'base64')); console.log('wrote', p); }
let bad = 0;
for (const r of result.report) {
  const worst = Math.min(r.margin.l, r.margin.r, r.margin.t);
  if (worst < -0.5) { bad++; console.log(`  hurtbox pokes out: ${r.ch.padEnd(8)} ${r.pose.padEnd(8)} margins l/r/top ${r.margin.l.toFixed(1)}/${r.margin.r.toFixed(1)}/${r.margin.t.toFixed(1)}  art ${r.art.join('×')}  covered ${r.cover}%`); }
}
const byChar = {};
for (const r of result.report) (byChar[r.ch] ??= []).push(r);
for (const [id, rs] of Object.entries(byChar)) {
  const st = rs.find(r => r.pose === 'idle'), sl = rs.find(r => r.pose === 'slide');
  console.log(`  ${id.padEnd(8)} idle art ${st.art[2]}×${st.art[3]} (top ${st.art[1]}) covers ${st.cover}% of hurtbox · slide art ${sl.art[2]}×${sl.art[3]} covers ${sl.cover}%`);
}
console.log(bad ? `${bad} pose(s) where the hurtbox extends past the art` : 'hurtbox inside the art in every checked pose');
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
