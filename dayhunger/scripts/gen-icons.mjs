// 앱 아이콘을 SVG로 그려 PNG로 만듭니다 (헤드리스 Chromium 사용, 이미지 편집 도구 불필요).
// 출력: icons/ (PWA) + android/app/src/main/res/mipmap-*/ (안드로이드 런처 아이콘)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

// 벽돌 벽 + 초승달 + 모닥불 불빛
const svg = (size, { pad = 0, round = 0.22, circle = false } = {}) => {
  const inner = size * (1 - pad * 2), off = size * pad;
  const clip = circle ? `<clipPath id="c"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></clipPath>` : `<clipPath id="c"><rect x="0" y="0" width="${size}" height="${size}" rx="${size * round}"/></clipPath>`;
  const u = inner / 100; // 100단위 좌표계
  const bricks = [];
  for (let row = 0; row < 4; row++) for (let col = -1; col < 6; col++) {
    const x = off + (col * 20 + (row % 2 ? 10 : 0)) * u, y = off + (56 + row * 11) * u;
    bricks.push(`<rect x="${x + 1.2 * u}" y="${y + 1.2 * u}" width="${17.6 * u}" height="${8.6 * u}" rx="${1.5 * u}" fill="${row % 2 ? '#c8783a' : '#b96a30'}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${clip}
    <radialGradient id="g" cx="${off + 50 * u}" cy="${off + 60 * u}" r="${45 * u}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  </defs>
  <g clip-path="url(#c)">
    <rect width="${size}" height="${size}" fill="#101c2e"/>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
    <path d="M ${off + 74 * u} ${off + 16 * u} a ${14 * u} ${14 * u} 0 1 0 ${12 * u} ${22 * u} a ${10 * u} ${10 * u} 0 1 1 ${-12 * u} ${-22 * u} z" fill="#ffe082"/>
    <rect x="${off - 5 * u}" y="${off + 55 * u}" width="${110 * u}" height="${50 * u}" fill="#6b3f1e"/>
    ${bricks.join('')}
    <path d="M ${off + 42 * u} ${off + 54 * u} q ${8 * u} ${-24 * u} ${16 * u} 0 q ${-4 * u} ${-12 * u} ${-8 * u} ${-18 * u} q ${-4 * u} ${6 * u} ${-8 * u} ${18 * u} z" fill="#ff7a1a"/>
    <path d="M ${off + 46 * u} ${off + 54 * u} q ${4 * u} ${-12 * u} ${8 * u} 0 z" fill="#ffd54f"/>
  </g>
</svg>`;
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined });
const page = await browser.newPage();
async function render(size, opts, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, opts)}</body></html>`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
const icons = path.join(ROOT, 'icons');
await render(192, {}, path.join(icons, 'icon-192.png'));
await render(512, {}, path.join(icons, 'icon-512.png'));
await render(512, { pad: 0.1, round: 0 }, path.join(icons, 'icon-maskable-512.png'));
const res = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    await render(Math.round(48 * m), { round: 0.18 }, path.join(res, `mipmap-${d}`, 'ic_launcher.png'));
    await render(Math.round(48 * m), { circle: true }, path.join(res, `mipmap-${d}`, 'ic_launcher_round.png'));
    await render(Math.round(108 * m), { pad: 0.18, round: 0 }, path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'));
  }
  // 적응형 아이콘 배경색
  const bg = path.join(res, 'values', 'ic_launcher_background.xml');
  if (fs.existsSync(bg)) fs.writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#101C2E</color>\n</resources>\n');
  console.log('안드로이드 런처 아이콘 갱신');
}
await browser.close();
console.log('아이콘 생성 완료:', fs.readdirSync(icons).join(', '));
