// 오디오 점검: 헤드리스 Chromium에서 모든 곡·스팅어·효과음을 오프라인 렌더링해 피크/RMS/클리핑을 표로 보여 준다.
// 사용: node scripts/audio-check.mjs [html파일] [--wav]   → e2e-out/audio/report.txt (+ WAV 파일)
// 기준: 피크 ≤ 0.99(클리핑 0%), 곡 RMS -26 ~ -12 dB, 효과음은 소리가 나야 함(silentPct < 99.9).
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const args = process.argv.slice(2);
const html = resolve(args.find(a => !a.startsWith('--')) || 'play/index.html');
const wav = args.includes('--wav');
const out = 'e2e-out/audio';
mkdirSync(out, { recursive: true });
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(p => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--ignore-certificate-errors'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + html);
await page.waitForTimeout(500);
const res = await page.evaluate(w => window.__audioCheck({ seconds: 12, wav: w }), wav);
const lines = ['| 소리 | 피크 | RMS(dB) | 클리핑% | 무음% | 판정 |', '|---|---|---|---|---|---|'];
let bad = 0;
for (const [k, s] of Object.entries(res.stats)) {
  const isMusic = k.startsWith('music:');
  const ok = s.peak <= 0.995 && s.clipPct === 0 && s.silentPct < 99.9 && (!isMusic || (s.rmsDb >= -30 && s.rmsDb <= -10));
  if (!ok) bad++;
  lines.push(`| ${k} | ${s.peak} | ${s.rmsDb} | ${s.clipPct} | ${s.silentPct} | ${ok ? 'OK' : '확인'} |`);
}
if (wav) for (const [k, b64] of Object.entries(res.wavs)) writeFileSync(`${out}/${k}.wav`, Buffer.from(b64, 'base64'));
lines.push('', `오류: ${errors.length ? errors.join(' | ') : '없음'} · 확인 필요 ${bad}건`);
writeFileSync(`${out}/report.txt`, lines.join('\n'));
console.log(lines.join('\n'));
await browser.close();
