// World-art preview: renders one scene per biome (parallax + ground + pit + platform + every hazard kind + every
// pickup kind) with the game's own drawing code in headless Chromium, plus a bonus-sky scene and a finish-gate
// scene, at desktop size (960×540 @2x) and portrait-phone size (0.464 scale). Also checks that every hazard's art
// covers its hitbox (alpha ≥ 0.95 on every hitbox pixel).
//   npm run build (or: npx vite build && node scripts/singlefile.mjs), then: node scripts/preview-world.mjs [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = process.argv[2] || 'e2e-out';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('file://' + resolve('play/index.html'));
await page.waitForFunction(() => { const w = window.__world; return w && w.Backdrop && w.drawSpike && w.drawPickup; });

const shots = await page.evaluate(() => {
  const W = window.__world;
  const GROUND_Y = 440, VIEW_H = 540;
  const pk = (type, x, y, extra = {}) => ({ id: 0, type, x, y, taken: false, pulled: false, ...extra });
  const hz = (kind, x0, x1, y0, y1, biome) => ({ id: 0, kind, x0, x1, y0, y1, biome, broken: false, passed: false });
  function scene(bi, o) {
    const { cssW, cssH, dpr, scale, camX, t = 1.3, sky = false, finish = false, bridged = false } = o;
    const cv = document.createElement('canvas'); cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    const c = cv.getContext('2d', { alpha: false });
    const bd = new W.Backdrop(); bd.resize(cssW, cssH, dpr, scale); if (bi) bd.prepare(bi);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (sky) bd.drawBonusSky(c, 1, camX, t); else bd.drawBiome(c, bi, 1, camX, t);
    const viewW = cssW / scale;
    c.save(); c.translate(-camX * scale, cssH - VIEW_H * scale); c.scale(scale, scale);
    const X = x => camX + x;                         // view-relative x → world x
    const solids = sky
      ? [{ x0: X(-200), x1: X(2000), top: GROUND_Y, ground: true }]
      : [{ x0: X(-200), x1: X(400), top: GROUND_Y, ground: true }, { x0: X(520), x1: X(3000), top: GROUND_Y, ground: true }, { x0: X(560), x1: X(760), top: 280, ground: false }];
    const s = { level: { solids, finishX: finish ? X(260) - 200 : Infinity }, rescue: bridged ? 1 : 0, power: { giant: 0, dash: 0, magnet: 0 } };
    bd.drawGround(c, s, bi ?? W.BIOMES[0], camX - 80, camX + viewW + 80, sky, t);
    const P = [];
    if (sky) {
      for (let i = 0; i < 16; i++) P.push(pk('bonusJelly', X(60 + i * 40), 300 - Math.sin(i / 3) * 60));
      P.push(pk('big', X(720), 180), pk('coin', X(770), 180), pk('coin', X(810), 180), pk('moonCake', X(880), 260));
      for (let i = 0; i < 10; i++) P.push(pk('bonusJelly', X(60 + i * 40), 420));
    } else if (!finish) {
      const row1 = ['jelly', 'bonusJelly', 'big', 'coin', 'potion', 'bigPotion', 'miniPotion', 'moonCake', 'pouch'];
      row1.forEach((ty, i) => P.push(pk(ty, X(60 + i * 52), 70)));
      ['giant', 'dash', 'magnet'].forEach((k, i) => P.push(pk('power', X(560 + i * 50), 70, { power: k })));
      for (let i = 0; i < 5; i++) P.push(pk('letter', X(60 + i * 52), 140, { letter: i }));
      for (let i = 0; i < 4; i++) P.push(pk('jelly', X(20 + i * 30), 420));
      for (let i = 0; i < 5; i++) P.push(pk('jelly', X(400 + i * 30), 380 - Math.sin((i / 4) * Math.PI) * 60));
      P.push(pk('coin', X(600), 250), pk('coin', X(640), 250), pk('coin', X(680), 250));
    }
    for (const p of P) W.drawPickup(c, p, p.x, p.y, t);
    const ch = W.CHAR_BY_ID.hotteok;
    if (!sky && !finish) {
      const bid = bi.id;
      W.drawSpike(c, hz('spike', X(170) - 15, X(170) + 15, GROUND_Y - 36, GROUND_Y, bid), bi.hazard.spike, false);
      W.drawTall(c, hz('tall', X(320) - 17, X(320) + 17, GROUND_Y - 176, GROUND_Y, bid), bi.hazard.tall, false, t);
      W.drawSpike(c, hz('spike', X(700) - 15, X(700) + 15, 280 - 36, 280, bid), bi.hazard.spike, false);
      W.drawHang(c, X(820), X(940), 394, bi.hazard.hang, false, t);
      W.drawHang(c, X(600), X(640), 34, bi.hazard.hang, false, t);   // a low ceiling (row 0) over the platform
    }
    if (ch) { c.save(); c.translate(X(finish ? 120 : 80), GROUND_Y); W.drawCharacter(c, ch.shape, ch.palette, { state: 'run', t, runPhase: 0.3, spin: 0, squash: 1, hurt: false, alpha: 1 }); c.restore(); }
    c.restore();
    return cv.toDataURL('image/png');
  }
  const res = {};
  for (const bi of W.BIOMES) {
    res[`world-${bi.id}`] = scene(bi, { cssW: 960, cssH: 540, dpr: 2, scale: 1, camX: 5000 });
    res[`world-${bi.id}-phone`] = scene(bi, { cssW: 390, cssH: 316, dpr: 2, scale: Math.min(390 / 840, 316 / 540), camX: 5000 });
  }
  res['world-bonus'] = scene(null, { cssW: 960, cssH: 540, dpr: 2, scale: 1, camX: 5000, sky: true });
  res['world-bonus-phone'] = scene(null, { cssW: 390, cssH: 316, dpr: 2, scale: Math.min(390 / 840, 316 / 540), camX: 5000, sky: true });
  res['world-finish'] = scene(W.BIOMES[0], { cssW: 960, cssH: 540, dpr: 2, scale: 1, camX: 5000, finish: true, bridged: true });
  // close-up sheets: every hazard skin (×2) on its own biome's sky colour, and every pickup (×3)
  {
    const RH = 420, K = 1.6; const cv = document.createElement('canvas'); cv.width = 1920; cv.height = RH * 4; const c = cv.getContext('2d');
    W.BIOMES.forEach((bi, row) => {
      const y0 = row * RH; const g = c.createLinearGradient(0, y0, 0, y0 + RH); g.addColorStop(0, bi.sky[0]); g.addColorStop(1, bi.sky[1]);
      c.fillStyle = g; c.fillRect(0, y0, 1920, RH);
      c.fillStyle = bi.near; c.fillRect(960, y0, 960, RH);
      c.save(); c.beginPath(); c.rect(0, y0, 1920, RH); c.clip();
      for (const half of [0, 1]) {
        c.save(); c.translate(half * 960, y0); c.scale(K, K);
        const gy = 240;
        c.fillStyle = bi.groundTop; c.fillRect(0, gy, 480, 7);
        W.drawSpike(c, hz('spike', 45, 75, gy - 36, gy, bi.id), bi.hazard.spike, false, bi.style);
        W.drawTall(c, hz('tall', 133, 167, gy - 176, gy, bi.id), bi.hazard.tall, false, 1, bi.style);
        W.drawHang(c, 230, 350, gy - 40, bi.hazard.hang, false, 1, bi.style);
        W.drawHang(c, 400, 440, gy - 40, bi.hazard.hang, false, 1, bi.style);
        c.restore();
      }
      c.restore();
    });
    res['world-hazards'] = cv.toDataURL('image/png');
  }
  {
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 360; const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 1920, 0); g.addColorStop(0, '#2b2d6e'); g.addColorStop(0.5, '#14284a'); g.addColorStop(1, '#473a5b');
    c.fillStyle = g; c.fillRect(0, 0, 1920, 360);
    c.save(); c.scale(3, 3);
    const items = [['jelly'], ['bonusJelly'], ['big'], ['coin'], ['potion'], ['bigPotion'], ['miniPotion'], ['moonCake'], ['pouch'], ['power', { power: 'giant' }], ['power', { power: 'dash' }], ['power', { power: 'magnet' }]];
    items.forEach(([ty, ex], i) => W.drawPickup(c, pk(ty, 30 + i * 52, 35, ex), 30 + i * 52, 35, 0.2));
    for (let i = 0; i < 5; i++) W.drawPickup(c, pk('letter', 30 + i * 52, 88, { letter: i }), 30 + i * 52, 88, 0);
    c.restore();
    res['world-pickups'] = cv.toDataURL('image/png');
  }
  return res;
});
for (const [name, url] of Object.entries(shots)) { writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', `${out}/${name}.png`); }

// ---- coverage check: every hitbox pixel must be (almost) opaque art
const cover = await page.evaluate(() => {
  const W = window.__world; const outRows = [];
  const res = 2;
  for (const bi of W.BIOMES) {
    for (const kind of ['spike', 'tall', 'hang']) {
      const cv = document.createElement('canvas'); cv.width = 200 * res; cv.height = 300 * res;
      const c = cv.getContext('2d'); c.setTransform(res, 0, 0, res, 0, 0);
      let boxes;
      if (kind === 'spike') { const h = { id: 0, kind, x0: 85, x1: 115, y0: 214, y1: 250, biome: bi.id, broken: false, passed: false }; W.drawSpike(c, h, bi.hazard.spike, false); boxes = [[85, 115, 232, 250], [94, 106, 214, 232]]; }
      else if (kind === 'tall') { const h = { id: 0, kind, x0: 83, x1: 117, y0: 74, y1: 250, biome: bi.id, broken: false, passed: false }; W.drawTall(c, h, bi.hazard.tall, false, 0); boxes = [[83, 117, 74, 250]]; }
      else { W.drawHang(c, 60, 140, 250, bi.hazard.hang, false, 0, bi.style); boxes = [[60, 140, 0, 250]]; }
      const d = c.getImageData(0, 0, cv.width, cv.height).data; let bad = 0, n = 0;
      for (const [x0, x1, y0, y1] of boxes) for (let y = Math.ceil(y0 * res); y < y1 * res; y++) for (let x = Math.ceil(x0 * res); x < x1 * res; x++) { n++; if (d[(y * cv.width + x) * 4 + 3] < 242) bad++; }
      outRows.push(`${bi.id.padEnd(10)} ${kind.padEnd(6)} ${bad === 0 ? 'COVERED' : 'GAPS ' + bad + '/' + n}`);
    }
  }
  return outRows;
});
console.log('hitbox coverage:\n  ' + cover.join('\n  '));
await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
if (cover.some(r => r.includes('GAPS')) || errors.length) process.exitCode = 1;
