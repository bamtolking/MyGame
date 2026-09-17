/* After `vite build`: also emit a single-file HTML (docs/linewars-single.html) for offline use. */
import fs from 'node:fs';
import path from 'node:path';
const dir = 'docs';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
let out = html;
out = out.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => `<script type="module">${fs.readFileSync(path.join(dir, src), 'utf8').replace(/<\/script>/g, '<\\/script>')}</script>`);
out = out.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => `<style>${fs.readFileSync(path.join(dir, href), 'utf8')}</style>`);
out = out.replace(/<link rel="manifest"[^>]*>/, '').replace(/<link rel="apple-touch-icon"[^>]*>/, '');
fs.writeFileSync(path.join(dir, 'linewars-single.html'), out);
fs.writeFileSync(path.join(dir, '.nojekyll'), '');
console.log('single-file build:', path.join(dir, 'linewars-single.html'), Math.round(out.length / 1024) + ' KB');
