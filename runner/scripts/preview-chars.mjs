// Contact sheet of every runner × pose + the companions + the cosmetics, rendered by the game's own drawing code in
// headless Chromium. The sim hurtbox is drawn as a thin green rectangle over every standing/sliding pose, and
// automatic checks print where the art does not enclose the hurtbox and whether any hat paints over an eye.
// The 12 hats × 6 shapes (run + slide, plus a phone-size row) and the 8 trails are ALWAYS also written on their
// own: <out>-hats.png and <out>-trails.png. It also times drawCharacter with and without a hat (software raster).
//
//   npx vite build && node scripts/singlefile.mjs && node scripts/preview-chars.mjs [out.png] [--sections]
//
// Uses the debug globals window.__drawCharacter / __charDebug (src/render/characters.ts), window.__drawCompanion
// (src/render/companions.ts) and window.__trailFx (src/render/fx.ts). --sections also writes every other block.
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
const asrc = readFileSync('src/meta/achievements.ts', 'utf8');
const cosm = Object.fromEntries([...asrc.matchAll(/\{ id: '((?:hat|trail)_\w+)', kind: '\w+', name: '([^']+)'/g)].map(m => [m[1], m[2]]));
if (!chars.length) throw new Error('could not parse src/data/characters.ts');

const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto('file://' + resolve('play/index.html'));
await page.waitForFunction(() => !!window.__drawCharacter && !!window.__drawCompanion && !!window.__trailFx && !!window.__charDebug, null, { timeout: 10000 });

const result = await page.evaluate(({ chars, comps, cosm }) => {
  const draw = window.__drawCharacter, drawComp = window.__drawCompanion, dbg = window.__charDebug, TF = window.__trailFx;
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

  // ---- D: the 12 cosmetic hats on every shape — run + slide (big), and run at portrait-phone size (×0.46)
  {
    const hats = dbg.HAT_IDS, S = 1.05, CWc = 84, CHc = 134, PH = 0.46;
    const colW = CWc * S * 2 + 60, W = LW + chars.length * colW, H = 40 + hats.length * CHc * S;
    const cv = mk(W, H), g = cv.getContext('2d');
    g.fillStyle = '#16122a'; g.fillRect(0, 0, W, H);
    chars.forEach((ch, i) => label(g, `${ch.name} (${ch.shape})`, LW + i * colW + colW / 2, 20, 15, '#ffe9a8', 'center'));
    hats.forEach((hat, r) => {
      const y0 = 40 + r * CHc * S;
      label(g, cosm['hat_' + hat] ?? hat, 12, y0 + CHc * S / 2 - 8, 18); label(g, 'hat_' + hat, 12, y0 + CHc * S / 2 + 14, 12, '#b9b3d9');
      chars.forEach((ch, i) => {
        const x0 = LW + i * colW; bg(g, x0 + 2, y0 + 2, colW - 4, CHc * S - 4);
        [['run', { state: 'run', runPhase: 0.3 }], ['slide', { state: 'slide', runPhase: 0.2 }]].forEach(([, pp], j) => {
          g.save(); g.translate(x0 + CWc * S * (j + 0.5) + (j ? 4 : 10), y0 + (CHc - 12) * S); g.scale(S, S);
          draw(g, ch.shape, ch.palette, { ...base, ...pp }, hat); g.restore();
        });
        g.save(); g.translate(x0 + colW - 26, y0 + (CHc - 12) * S); g.scale(PH, PH); draw(g, ch.shape, ch.palette, { ...base, state: 'run', runPhase: 0.3 }, hat); g.restore();
      });
    });
    blocks.push(['hats', cv]);
  }

  // ---- E: the 8 trails — ~2.5 s of running with a jump, the runner at world scale, then the same at portrait size
  {
    const ids = TF.TRAIL_IDS, PW = 560, PHt = 170, W = LW + PW * 2 + 24, H = 12 + ids.length * PHt;
    const cv = mk(W, H), g = cv.getContext('2d');
    g.fillStyle = '#16122a'; g.fillRect(0, 0, W, H);
    ids.forEach((id, r) => {
      const ch = chars[r % chars.length], y0 = 8 + r * PHt;
      label(g, cosm['trail_' + id] ?? id, 12, y0 + PHt / 2 - 8, 18); label(g, 'trail_' + id, 12, y0 + PHt / 2 + 14, 12, '#b9b3d9');
      const fx = new TF.Fx(), tr = new TF.TrailFx(); tr.id = id;
      const v = 520, dt = 1 / 60; let x = 0, y = 0, vy = 0, t = 0, maxParts = 0, born = 0;
      for (let i = 0; i < 150; i++) {
        t += dt; x += v * dt; if (i === 60) vy = -760; vy += 2300 * dt; y = Math.min(0, y + vy * dt); if (y >= 0) vy = 0;
        const n0 = fx.parts.length; fx.update(dt); const n1 = fx.parts.length;
        tr.update(fx, dt, x, y, 1, false, v, true, { reduceMotion: false, lowFx: false }); born += fx.parts.length - n1; maxParts = Math.max(maxParts, fx.parts.length); void n0;
      }
      const fxP = new TF.Fx(), trP = new TF.TrailFx(); trP.id = id; trP.sizeK = 1.35;     // portrait: the renderer's size boost
      { let xx = 0, yy = 0, vv = 0; for (let i = 0; i < 150; i++) { xx += v * dt; if (i === 60) vv = -760; vv += 2300 * dt; yy = Math.min(0, yy + vv * dt); if (yy >= 0) vv = 0; fxP.update(dt); trP.update(fxP, dt, xx, yy, 1, false, v, true, { reduceMotion: false, lowFx: false }); } }
      for (const [k, x0] of [[1, LW], [0.46, LW + PW + 24]]) {
        const [F, T] = k === 1 ? [fx, tr] : [fxP, trP];
        g.save(); g.beginPath(); g.rect(x0, y0, PW, PHt - 8); g.clip();
        bg(g, x0, y0, PW, PHt - 8); g.fillStyle = '#5a3d2a'; g.fillRect(x0, y0 + PHt - 26, PW, 18);
        g.translate(x0 + PW - (k === 1 ? 90 : 160), y0 + PHt - 26); g.scale(k, k); g.translate(-x, 0);
        T.drawRibbon(g); F.drawParticles(g);
        g.translate(x, y); draw(g, ch.shape, ch.palette, { ...base, state: y < 0 ? 'jump' : 'run', runPhase: (x / 64) % 1, t });
        g.restore();
      }
      label(g, id === 'rainbow' ? 'ribbon (no particles)' : `${(born / (150 * dt)).toFixed(1)} particles/s · ≤ ${maxParts} alive`, LW + 8, y0 + 14, 12, '#ffe9a8');
    });
    label(g, 'world ×1', LW + PW / 2, H - 4, 11, '#b9b3d9', 'center'); label(g, 'portrait ×0.46', LW + PW * 1.5 + 24, H - 4, 11, '#b9b3d9', 'center');
    blocks.push(['trails', cv]);
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
      if (a > 200) { if (lx < x0) x0 = lx; if (lx > x1) x1 = lx; if (ly < y0) y0 = ly; if (ly > y1) y1 = ly; }   // opaque art only (no streaks / steam)
      if (lx >= hx && lx < hx + hw && ly >= hy && ly < hy + hh) { tot++; if (a > 200) cov++; }
    }
    const m = { l: hx - x0, r: x1 - (hx + hw), t: hy - y0 };
    report.push({ ch: ch.id, pose: name, art: [Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)], margin: m, cover: Math.round(cov / tot * 100) });
  }
  // ---- automatic check: no hat paints inside an eye (idle + slide, every shape × hat)
  const eyeHits = [];
  {
    const K2 = 3, N = 200, A = mk(N * K2, N * K2).getContext('2d', { willReadFrequently: true }), B = mk(N * K2, N * K2).getContext('2d', { willReadFrequently: true });
    for (const ch of chars) for (const slide of [false, true]) {
      const pose = { ...base, state: slide ? 'slide' : 'idle', t: 0, runPhase: 0.2 };
      const eyes = dbg.eyeBox(ch.shape, slide);
      const ex0 = Math.min(...eyes.map(e => e[0] - e[2])), ex1 = Math.max(...eyes.map(e => e[0] + e[2])), ey0 = Math.min(...eyes.map(e => e[1] - e[3])), ey1 = Math.max(...eyes.map(e => e[1] + e[3]));
      const px0 = Math.floor((ex0 + 100) * K2), py0 = Math.floor((ey0 + 150) * K2), pw = Math.ceil((ex1 - ex0) * K2), ph = Math.ceil((ey1 - ey0) * K2);
      const paint = (g2, hat) => { g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, N * K2, N * K2); g2.translate(100 * K2, 150 * K2); g2.scale(K2, K2); draw(g2, ch.shape, ch.palette, pose, hat); return g2.getImageData(px0, py0, pw, ph).data; };
      const a = paint(A, null);
      for (const hat of dbg.HAT_IDS) {
        const b = paint(B, hat); let n = 0;
        for (let i = 0; i < a.length; i += 4) {
          const lx = (px0 + (i / 4) % pw) / K2 - 100, ly = (py0 + Math.floor(i / 4 / pw)) / K2 - 150;
          if (!eyes.some(([cx, cy, rx, ry]) => ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 <= 1)) continue;
          if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++;
        }
        if (n) eyeHits.push(`${ch.id} ${slide ? 'slide' : 'idle'} ${hat}: ${n} px`);
      }
    }
  }

  // ---- cost: drawCharacter per call at portrait-phone scale (dpr 2 → ×0.93), static parts warm in their caches
  const perf = {};
  {
    // willReadFrequently → a CPU (software-raster) canvas, and getImageData forces the queued work to finish
    const T2 = mk(240, 240).getContext('2d', { willReadFrequently: true }); const poseR = { ...base, state: 'run' };
    const time = (hat, n = 300) => { T2.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < n; i++) { T2.setTransform(0.93, 0, 0, 0.93, 120, 200); poseR.runPhase = (i % 16) / 16; poseR.t = i / 60; draw(T2, chars[i % chars.length].shape, chars[i % chars.length].palette, poseR, hat); } T2.getImageData(0, 0, 1, 1); return (performance.now() - t0) / n; };
    time(null, 60); for (const hat of dbg.HAT_IDS) time(hat, 12);            // warm the caches
    perf.none = time(null); perf.hats = {};
    for (const hat of dbg.HAT_IDS) perf.hats[hat] = time(hat);
    const fx = new TF.Fx(), tr = new TF.TrailFx(); let tt = 0;
    for (const id of TF.TRAIL_IDS) {
      tr.id = id; tr.reset(); fx.clear();
      for (let i = 0; i < 90; i++) { fx.update(1 / 60); tr.update(fx, 1 / 60, i * 9, 0, 1, false, 540, true, { reduceMotion: false, lowFx: false }); }
      T2.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < 200; i++) { T2.setTransform(0.93, 0, 0, 0.93, 200 - 90 * 9 * 0.93, 200); tr.drawRibbon(T2); fx.drawParticles(T2); } T2.getImageData(0, 0, 1, 1); tt = Math.max(tt, (performance.now() - t0) / 200);
    }
    perf.trailDrawMax = tt;
  }
  const url = c => c.toDataURL('image/png');
  return { sheet: url(sheet), blocks: blocks.map(([n, cv]) => [n, url(cv)]), report, eyeHits, perf };
}, { chars, comps, cosm });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(result.sheet.split(',')[1], 'base64'));
console.log('wrote', out);
for (const [n, u] of result.blocks) {
  if (!sections && n !== 'hats' && n !== 'trails') continue;
  const p = out.replace(/\.png$/, `-${n}.png`); writeFileSync(p, Buffer.from(u.split(',')[1], 'base64')); console.log('wrote', p);
}
let bad = 0;
for (const r of result.report) {
  const worst = Math.min(r.margin.l, r.margin.r, r.margin.t);
  if (worst < -0.5) { if (r.pose !== 'land') bad++; console.log((r.pose === 'land' ? '  (landing squash, 0.1 s) ' : '') +`  hurtbox pokes out: ${r.ch.padEnd(8)} ${r.pose.padEnd(8)} margins l/r/top ${r.margin.l.toFixed(1)}/${r.margin.r.toFixed(1)}/${r.margin.t.toFixed(1)}  art ${r.art.join('×')}  covered ${r.cover}%`); }
}
const byChar = {};
for (const r of result.report) (byChar[r.ch] ??= []).push(r);
for (const [id, rs] of Object.entries(byChar)) {
  const st = rs.find(r => r.pose === 'idle'), sl = rs.find(r => r.pose === 'slide');
  console.log(`  ${id.padEnd(8)} idle art ${st.art[2]}×${st.art[3]} (top ${st.art[1]}) covers ${st.cover}% of hurtbox · slide art ${sl.art[2]}×${sl.art[3]} covers ${sl.cover}%`);
}
console.log(bad ? `${bad} pose(s) where the hurtbox extends past the art` : 'hurtbox inside the art in every checked pose (idle, blink, run ×4, jump, fall, slide, hurt)');
console.log(result.eyeHits.length ? `HATS OVER EYES:\n  ${result.eyeHits.join('\n  ')}` : `no hat paints over an eye (${chars.length} shapes × idle/slide × 12 hats)`);
const pf = result.perf, worst = Object.entries(pf.hats).sort((a, b) => b[1] - a[1])[0];
console.log(`drawCharacter at ×0.93, software canvas: ${pf.none.toFixed(3)} ms bare · with a hat ${Math.min(...Object.values(pf.hats)).toFixed(3)}–${worst[1].toFixed(3)} ms (worst ${worst[0]}) · trail draw ≤ ${pf.trailDrawMax.toFixed(3)} ms`);
if (process.env.PERF_DETAIL) console.log('  ' + Object.entries(pf.hats).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(' · '));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
