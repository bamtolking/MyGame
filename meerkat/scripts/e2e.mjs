// 휴대폰 화면 크기로 앱 주요 흐름을 실제 브라우저에서 돌려 보고 스크린샷을 남깁니다.
// 사용: (개발 서버 실행 후) BASE=http://localhost:5173/ node scripts/e2e.mjs
//       또는 npm run build 후 node scripts/e2e.mjs --preview
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'e2e-out');
mkdirSync(out, { recursive: true });
const samples = join(root, 'dev/samples');
const FRONT = [join(samples, 'male_full_height_hands.jpg'), join(samples, 'front.png')].find(existsSync);
const SIDE = [join(samples, 'side_fhp.png'), join(samples, 'side_normal.png')].find(existsSync);

let server = null;
let BASE = process.env.BASE ?? 'http://localhost:5180/';
if (process.argv.includes('--preview')) {
  BASE = 'http://localhost:4173/';
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
}

const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';
const browser = await chromium.launch({
  executablePath: existsSync(exe) ? exe : undefined,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const dark = process.argv.includes('--dark');
const lang = process.argv.includes('--en') ? 'en-US' : 'ko-KR';
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: lang, colorScheme: dark ? 'dark' : 'light', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|404|ERR_|WebGL|GL_INVALID/.test(m.text())) errors.push(m.text());
});
let n = 0;
const shot = async (name, full = false) => {
  n += 1;
  const file = join(out, `${String(n).padStart(2, '0')}-${name}${dark ? '-dark' : ''}.png`);
  await page.waitForTimeout(450);
  await page.screenshot({ path: file, fullPage: full });
  console.log('📸', file);
};
const click = async (text) => {
  const loc = page.getByText(text, { exact: false }).first();
  await loc.waitFor({ timeout: 15000 });
  await loc.click();
};

try {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  // 온보딩
  await shot('onboarding-welcome');
  await click(lang === 'ko-KR' ? '시작하기' : 'Get started');
  await page.fill('#nick', lang === 'ko-KR' ? '바른자세' : 'Sam');
  await page.selectOption('#year', '1994');
  await page.fill('#height', '172');
  await shot('onboarding-profile');
  await click(lang === 'ko-KR' ? '다음' : 'Next');
  await click(lang === 'ko-KR' ? '사무직' : 'Desk');
  await click(lang === 'ko-KR' ? '8시간 이상' : '8 h +');
  await click(lang === 'ko-KR' ? '4시간 이상' : '4 h +');
  await shot('onboarding-lifestyle');
  await click(lang === 'ko-KR' ? '다음' : 'Next');
  await click(lang === 'ko-KR' ? '거북목' : 'tech neck');
  await click(lang === 'ko-KR' ? '라운드숄더' : 'Rounded shoulders');
  await shot('onboarding-goals');
  await click(lang === 'ko-KR' ? '다음' : 'Next');
  await shot('onboarding-ready');
  await click(lang === 'ko-KR' ? '먼저 둘러볼게요' : 'Look around first');
  await shot('home-empty', true);

  // 스캔 (사진 불러오기)
  await page.goto(BASE + '#/scan/capture');
  await shot('scan-setup');
  await click(lang === 'ko-KR' ? '앨범에서 사진 불러오기' : 'Choose photos');
  if (FRONT && SIDE) {
    await page.setInputFiles('input[type=file]', FRONT);
    await page.waitForFunction(() => document.body.innerText.match(/인식 완료|Detected|방향이 달라요|Wrong angle|찾지 못했어요|No person/), null, { timeout: 90000 });
    await page.setInputFiles('input[type=file]', SIDE);
    await page.waitForFunction(() => (document.body.innerText.match(/인식 완료|Detected/g) ?? []).length >= 2, null, { timeout: 90000 }).catch(() => undefined);
    await shot('scan-upload');
    await click(lang === 'ko-KR' ? '분석하기' : 'Analyse');
    await page.waitForTimeout(700);
    await shot('scan-analyzing');
    await page.waitForURL(/#\/scan\/result\//, { timeout: 30000 });
    await page.waitForTimeout(1700);
    await shot('result-reveal');
    await page.waitForTimeout(1500);
    await click(lang === 'ko-KR' ? '자세한 리포트 보기' : 'See full report');
    await shot('result-top');
    await page.evaluate(() => window.scrollTo(0, 700));
    await shot('result-photo');
    await page.evaluate(() => window.scrollTo(0, 1400));
    await shot('result-metrics');
    await page.screenshot({ path: join(out, 'result-full.png'), fullPage: true });
    // 정면 탭
    await click(lang === 'ko-KR' ? '정면' : 'Front');
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 700));
    await shot('result-front');
    const scanId = page.url().split('/').pop();
    await page.goto(BASE + `#/scan/share/${scanId}`);
    await page.waitForSelector('img[alt]', { timeout: 30000 });
    await shot('share-card');
  }

  // 홈 (스캔 후)
  await page.goto(BASE + '#/');
  await shot('home', true);
  // 루틴 → 안전 체크 → 플레이어
  await page.goto(BASE + '#/routine/today');
  await shot('routine', true);
  await click(lang === 'ko-KR' ? '운동 시작' : 'Start workout');
  await page.waitForURL(/#\/safety/, { timeout: 5000 }).catch(() => undefined);
  await shot('safety', true);
  await page.locator('.option').last().click();
  await click(lang === 'ko-KR' ? '해당 없음' : 'None apply');
  await page.waitForURL(/#\/player/, { timeout: 5000 });
  await page.waitForTimeout(2500);
  await shot('player-ready');
  await page.waitForTimeout(5500);
  await shot('player-work');
  await page.getByLabel(lang === 'ko-KR' ? '다음' : 'Next').click();
  await page.waitForTimeout(800);
  await shot('player-next');
  // 운동 라이브러리 · 상세
  await page.goto(BASE + '#/exercises');
  await shot('library');
  await page.goto(BASE + '#/exercise/wall-angel');
  await page.waitForTimeout(1200);
  await shot('exercise-detail');
  // 통증 · 기록 · 마이 · 사무실
  await page.goto(BASE + '#/pain');
  await shot('pain');
  await page.goto(BASE + '#/progress');
  await shot('progress', true);
  await page.goto(BASE + '#/desk');
  await shot('desk');
  await page.goto(BASE + '#/me');
  await shot('me', true);
  await page.goto(BASE + '#/about');
  await shot('about');
  // 카메라 촬영 화면 (가짜 카메라)
  await page.goto(BASE + '#/scan/capture');
  await click(lang === 'ko-KR' ? '카메라로 촬영' : 'Use camera');
  await page.waitForTimeout(6000);
  await shot('camera');
} catch (e) {
  errors.push('E2E: ' + (e && e.message));
  await page.screenshot({ path: join(out, 'error.png') }).catch(() => undefined);
} finally {
  writeFileSync(join(out, 'errors.json'), JSON.stringify(errors, null, 1));
  console.log(errors.length ? `❌ ${errors.length} error(s):\n` + errors.join('\n') : '✅ no page errors');
  await browser.close();
  server?.kill();
  process.exit(errors.length ? 1 : 0);
}
