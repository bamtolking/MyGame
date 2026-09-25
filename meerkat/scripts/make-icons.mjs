// 앱 아이콘·스플래시 이미지 생성 (헤드리스 Chromium으로 SVG → PNG)
// 사용: node scripts/make-icons.mjs
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public/icons');
const assets = join(root, 'assets');
mkdirSync(pub, { recursive: true });
mkdirSync(assets, { recursive: true });

// 미어캣 얼굴 (64 기준 좌표)
const face = `
  <ellipse cx="32" cy="38" rx="19" ry="17" fill="#f3d19f"/>
  <circle cx="14.5" cy="33" r="5" fill="#d9a15f"/>
  <circle cx="49.5" cy="33" r="5" fill="#d9a15f"/>
  <circle cx="14.5" cy="33" r="2.4" fill="#8a5a30"/>
  <circle cx="49.5" cy="33" r="2.4" fill="#8a5a30"/>
  <ellipse cx="24" cy="35" rx="6" ry="5.4" fill="#6b4a2c" transform="rotate(-18 24 35)"/>
  <ellipse cx="40" cy="35" rx="6" ry="5.4" fill="#6b4a2c" transform="rotate(18 40 35)"/>
  <circle cx="24" cy="35" r="2.8" fill="#1d140c"/>
  <circle cx="40" cy="35" r="2.8" fill="#1d140c"/>
  <circle cx="25" cy="34" r="1" fill="#fff"/>
  <circle cx="41" cy="34" r="1" fill="#fff"/>
  <ellipse cx="32" cy="46" rx="8" ry="6" fill="#fbead0"/>
  <path d="M29 43.5 Q32 41.5 35 43.5 Q32 46.5 29 43.5Z" fill="#3a2a1c"/>
  <path d="M30 49 Q32 50.4 34 49" stroke="#3a2a1c" stroke-width="1" fill="none" stroke-linecap="round"/>`;

const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#ff6b2c"/>${face}</svg>`;
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ff6b2c"/>${face}</svg>`;
// 마스커블: 안전 영역(80%) 안에 얼굴
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ff6b2c"/><g transform="translate(6.4 5.2) scale(0.8)">${face}</g></svg>`;
// 안드로이드 적응형 아이콘 전경 (투명 배경, 66% 안전 영역)
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="translate(12.2 10.6) scale(0.62)">${face}</g></svg>`;
const background = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#ff6b2c"/></svg>`;
const splash = (dark) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="${dark ? '#0e0f12' : '#ff6b2c'}"/>
  <g transform="translate(380 330) scale(3.75)"><rect width="64" height="64" rx="15" fill="${dark ? '#ff6b2c' : '#ffffff'}" opacity="${dark ? 1 : 0.18}"/>${face}</g>
  <text x="500" y="650" font-family="Pretendard, -apple-system, sans-serif" font-size="56" font-weight="800" fill="#ffffff" text-anchor="middle">미어캣</text></svg>`;

writeFileSync(join(pub, 'icon.svg'), rounded);

const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, headless: true });
const page = await browser.newPage();
async function png(svg, size, file, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('icon', file);
}
await png(rounded, 192, join(pub, 'icon-192.png'), true);
await png(rounded, 512, join(pub, 'icon-512.png'), true);
await png(maskable, 512, join(pub, 'maskable-512.png'));
await png(square, 180, join(pub, 'apple-touch-icon.png'));
await png(rounded, 32, join(pub, 'favicon-32.png'), true);
// @capacitor/assets 원본 (npx @capacitor/assets generate)
await png(square, 1024, join(assets, 'icon-only.png'));
await png(foreground, 1024, join(assets, 'icon-foreground.png'), true);
await png(background, 1024, join(assets, 'icon-background.png'));
await png(splash(false), 2732, join(assets, 'splash.png'));
await png(splash(true), 2732, join(assets, 'splash-dark.png'));
// 스토어 등록용 아이콘 (512, 모서리 없음)
await png(square, 512, join(assets, 'store-icon-512.png'));
await browser.close();
