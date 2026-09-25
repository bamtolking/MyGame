// 개발용: 샘플 사진으로 스캔을 돌려 ScanRecord JSON을 뽑아 예시 리포트로 저장
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://localhost:5180/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' });
const page = await ctx.newPage();
await page.goto(BASE);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mk.profile', JSON.stringify({ nickname: '예시', birthYear: 1992, heightCm: 172, onboarded: true, goals: ['neck'], pain: {}, redFlags: [] }));
});
// 저장된 프로필(나이·키)이 반영되도록 새로 불러오기
await page.reload();
await page.goto(BASE + '#/scan/capture');
await page.getByText('앨범에서 사진 불러오기').click();
await page.setInputFiles('input[type=file]', 'dev/samples/male_full_height_hands.jpg');
await page.waitForFunction(() => document.body.innerText.includes('인식 완료'), null, { timeout: 90000 });
await page.setInputFiles('input[type=file]', 'dev/samples/side_fhp.png');
await page.waitForFunction(() => (document.body.innerText.match(/인식 완료/g) ?? []).length >= 2, null, { timeout: 90000 });
await page.getByText('분석하기').click();
await page.waitForURL(/#\/scan\/result\//, { timeout: 30000 });
const scans = await page.evaluate(() => JSON.parse(localStorage.getItem('mk.scans')));
const rec = scans[scans.length - 1];
rec.id = 'demo';
rec.at = Date.UTC(2026, 8, 1, 1, 0, 0);
rec.label = undefined;
rec.hasPhoto = { front: false, side: false };
const round = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
writeFileSync('src/content/demo-scan.json', JSON.stringify(round(rec)));
console.log('saved demo scan', rec.report.score, rec.report.type);
await browser.close();
