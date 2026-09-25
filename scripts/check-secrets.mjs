#!/usr/bin/env node
// 민감정보(API 키·토큰·비밀번호·인증서·.env 등) 검사. 발견되면 종료 코드 1.
//   node scripts/check-secrets.mjs            # 현재 작업 트리 (추적 파일 + 아직 추적되지 않은 파일, .gitignore 대상 제외)
//   node scripts/check-secrets.mjs --history  # 모든 브랜치의 모든 커밋까지 검사 — push 전에 반드시 실행
//   node scripts/check-secrets.mjs --dir <폴더> # git 밖의 폴더 검사 (배포 때 원본 브랜치에서 받아 온 live 게임 소스)
// 오탐이면 .secrets-allowlist 에 한 줄에 정규식 하나를 적습니다 ("경로:내용" 문자열에 매칭되면 무시).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const history = process.argv.includes('--history');
const dirArg = process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : null;
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// 파일 이름만으로 위험한 것들
const FILE_RULES = [
  ['.env 파일', /(^|\/)\.env(\.[^/]+)?$/i, /\.env\.(example|sample|template)$/i],
  ['개인키·인증서 파일', /\.(pem|key|p12|pfx|jks|keystore|ppk|asc|gpg)$/i, null],
  ['SSH 개인키', /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/, null],
  ['서비스 계정·자격증명 파일', /(^|\/)(google-services\.json|GoogleService-Info\.plist|serviceAccount[^/]*\.json|[^/]*credentials[^/]*\.json|\.npmrc|\.netrc|\.pypirc|\.htpasswd|\.git-credentials)$/i, null],
];
// 내용 패턴
const CONTENT_RULES = [
  ['AWS Access Key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub 토큰', /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/],
  ['Slack 토큰', /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/],
  ['Google API 키', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['OpenAI/Anthropic 키', /\bsk-(ant-)?[A-Za-z0-9_-]{20,}\b/],
  ['Stripe 키', /\b[sr]k_(live|test)_[A-Za-z0-9]{20,}\b/],
  ['개인키 블록', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/],
  ['비밀번호 포함 접속 문자열', /\b(mongodb(\+srv)?|postgres(ql)?|mysql|redis|amqp|mssql):\/\/[^\s:@/]+:[^\s@/]+@/i],
  ['키/시크릿/비밀번호 값 대입', /\b(api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|password|passwd)\b\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i],
];
const SKIP_PATH = /(^|\/)(node_modules|_site|dist|dist-legacy|www|e2e-out|\.vite)(\/|$)|(^|\/)package-lock\.json$/;
const allow = existsSync(resolve(root, '.secrets-allowlist'))
  ? readFileSync(resolve(root, '.secrets-allowlist'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => new RegExp(l))
  : [];
const allowed = (s) => allow.some((re) => re.test(s));
const isBinary = (buf) => buf.subarray(0, 8192).includes(0);

const findings = [];
function scanContent(path, text, where) {
  const lines = text.split('\n');
  for (const [name, re] of CONTENT_RULES) {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const key = `${path}:${lines[i].trim().slice(0, 200)}`;
        if (!allowed(key)) findings.push(`[${name}] ${where}${path}:${i + 1}  ${lines[i].trim().slice(0, 120)}`);
      }
    }
  }
}
function scanName(path, where) {
  for (const [name, re, except] of FILE_RULES) {
    if (re.test(path) && !(except && except.test(path)) && !allowed(path)) findings.push(`[${name}] ${where}${path}`);
  }
}

if (dirArg) {
  const base = resolve(dirArg);
  if (!existsSync(base)) { console.error(`폴더가 없습니다: ${base}`); process.exit(2); }
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name);
      const rel = relative(base, abs).split('\\').join('/');
      if (e.name === '.git' || SKIP_PATH.test(rel)) continue;
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) files.push(rel);
    }
  };
  walk(base);
  for (const p of files) {
    scanName(p, '');
    const abs = join(base, p);
    if (statSync(abs).size > 4 * 1024 * 1024) continue;
    const buf = readFileSync(abs);
    if (isBinary(buf)) continue;
    scanContent(p, buf.toString('utf8'), '');
  }
  console.log(`폴더 검사: ${relative(root, base) || base} 파일 ${files.length}개`);
} else if (!history) {
  const files = git('ls-files', '-co', '--exclude-standard', '-z').split('\0').filter(Boolean).filter((p) => !SKIP_PATH.test(p));
  for (const p of files) {
    scanName(p, '');
    const abs = resolve(root, p);
    if (!existsSync(abs) || statSync(abs).size > 4 * 1024 * 1024) continue;
    const buf = readFileSync(abs);
    if (isBinary(buf)) continue;
    scanContent(p, buf.toString('utf8'), '');
  }
  console.log(`작업 트리 검사: 파일 ${files.length}개`);
} else {
  const commits = git('rev-list', '--all').split('\n').filter(Boolean);
  const seen = new Map(); // blob sha → 검사 여부 (같은 내용은 한 번만)
  let blobs = 0;
  for (const c of commits) {
    const short = c.slice(0, 7);
    const entries = git('ls-tree', '-r', '-z', c).split('\0').filter(Boolean);
    for (const e of entries) {
      const [meta, path] = e.split('\t'); const [, type, sha] = meta.split(' ');
      if (type !== 'blob' || SKIP_PATH.test(path)) continue;
      scanName(path, `${short} `);
      if (seen.has(sha)) continue;
      seen.set(sha, true); blobs++;
      const buf = execFileSync('git', ['cat-file', 'blob', sha], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
      if (buf.length > 4 * 1024 * 1024 || isBinary(buf)) continue;
      scanContent(path, buf.toString('utf8'), `${short} `);
    }
  }
  console.log(`히스토리 검사: 커밋 ${commits.length}개, 고유 파일 내용 ${blobs}개 (모든 브랜치)`);
}

const uniq = [...new Set(findings)];
if (uniq.length) {
  console.error(`\n민감정보 의심 항목 ${uniq.length}건 — push 를 중단하고 확인하세요:`);
  for (const f of uniq) console.error('  ' + f);
  console.error('\n오탐이면 .secrets-allowlist 에 정규식을 추가하세요. 과거 커밋에서 발견되면 히스토리 정리 없이는 공개 저장소에 그대로 남습니다.');
  process.exit(1);
}
console.log('민감정보 없음 ✓');
