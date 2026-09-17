// www/ 폴더에 배포용 파일만 복사 (GitHub Pages / Capacitor 공용)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
for (const f of ['index.html', 'manifest.json', 'sw.js']) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of ['css', 'js', 'icons']) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log('www/ 생성 완료');
