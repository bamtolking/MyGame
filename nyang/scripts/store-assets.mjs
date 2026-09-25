// 앱 아이콘(public/icons), 스토어 이미지(store/)를 헤드리스 크로미움으로 그려 저장한다.
// 사용: npm run store-assets   (vite 개발 서버를 잠깐 띄운다)
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const exe = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const server = await createServer({ server: { port: 5188, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = 'http://127.0.0.1:5188';
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--font-render-hinting=none'] });
mkdirSync('public/icons', { recursive: true });
mkdirSync('store/screenshots', { recursive: true });
mkdirSync('store/raw', { recursive: true });

async function asset(query, out, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`${base}/dev/assets.html?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  await page.locator('#c').screenshot({ path: out, omitBackground: true });
  await page.close();
  if (errs.length) throw new Error(out + ': ' + errs.join('; '));
  console.log('wrote', out);
}

// 아이콘
for (const [size, name] of [[512, 'icon-512'], [192, 'icon-192'], [180, 'icon-180']]) await asset(`asset=icon&size=${size}&opaque=${size === 180 ? 1 : 0}`, `public/icons/${name}.png`, size, size);
await asset('asset=icon&size=512&maskable=1', 'public/icons/icon-maskable-512.png', 512, 512);
await asset('asset=icon&size=1024&opaque=1', 'store/icon-1024.png', 1024, 1024);
await asset('asset=icon&size=512&opaque=1', 'store/icon-512-play.png', 512, 512);
await asset('asset=feature', 'store/feature-1024x500.png', 1024, 500);

// 게임 장면 (360x780 @3x = 1080x2340)
const scenes = [
  ['pile', '같은 고양이끼리 합체!', '떨어뜨리고, 닿으면 더 큰 고양이로'],
  ['combo', '말랑말랑 연쇄 콤보', '합체가 합체를 부르면 점수 최대 4배'],
  ['liquify', '고양이는 액체다', '액체화! 녹아내린 고양이들이 서로 끌어당겨요'],
  ['daily', '매일 새로운 상자', '오늘의 규칙, 모두 같은 고양이 순서로 대결'],
  ['dex', '11종 고양이 도감', '아깽이부터 우주뚱냥까지 모아 보세요'],
  ['results', '결과 카드로 자랑하기', '친구에게 점수와 상자를 공유'],
];
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
for (const [scene] of scenes) {
  const page = await ctx.newPage();
  await page.goto(`${base}/`);
  await page.waitForFunction(() => !!window.__nyang, null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate(s => window.__nyang.stage(s), scene);
  await page.waitForTimeout(scene === 'combo' ? 380 : scene === 'liquify' ? 1400 : 700);
  await page.screenshot({ path: `store/raw/${scene}.png` });
  await page.close();
  console.log('scene', scene);
}
// 캡션 붙인 스토어 스크린샷: 구글 플레이 1080x1920, 앱스토어 6.7" 1290x2796
for (const [w, h, tag] of [[1080, 1920, 'play'], [1290, 2796, 'ios67']]) {
  for (const [i, [scene, cap, sub]] of scenes.entries()) {
    const src = 'data:image/png;base64,' + readFileSync(`store/raw/${scene}.png`).toString('base64');
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(`${base}/dev/assets.html?asset=none`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
    await page.evaluate(a => window.__compose(a.src, a.w, a.h, a.cap, a.sub), { src, w, h, cap, sub });
    await page.locator('#c').screenshot({ path: `store/screenshots/${tag}-${i + 1}-${scene}.png` });
    await page.close();
  }
  console.log('screenshots', tag);
}
await browser.close();
await server.close();
writeFileSync('store/README.md', `# 스토어 이미지\n\n\`npm run store-assets\`로 다시 만든다.\n\n- icon-1024.png: 앱스토어 아이콘 (불투명)\n- icon-512-play.png: 구글 플레이 아이콘\n- feature-1024x500.png: 구글 플레이 그래픽 이미지\n- screenshots/play-*.png: 구글 플레이 휴대폰 스크린샷 1080×1920\n- screenshots/ios67-*.png: 앱스토어 6.7인치 스크린샷 1290×2796\n- raw/: 캡션 없는 원본 화면 1080×2340\n`);
console.log('done');
