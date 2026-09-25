// MediaPipe WASM 런타임을 public/mediapipe/wasm 으로 복사합니다 (오프라인·앱 패키징용).
// 모델 파일(public/models/*.task)은 저장소에 포함되어 있습니다.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = join(root, 'public/mediapipe/wasm');
mkdirSync(dst, { recursive: true });
const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];
for (const f of files) {
  const from = join(src, f);
  const to = join(dst, f);
  if (!existsSync(from)) throw new Error(`missing ${from} — run npm install`);
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  copyFileSync(from, to);
}
for (const m of ['pose_landmarker_lite.task', 'pose_landmarker_full.task']) {
  if (!existsSync(join(root, 'public/models', m))) {
    throw new Error(`missing public/models/${m}`);
  }
}
console.log('[prepare-assets] MediaPipe wasm ready');
