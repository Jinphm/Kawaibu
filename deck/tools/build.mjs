// Build: src/slides/*.html -> dist/slides/NN.html (mỗi slide một trang web riêng)
//        + dist/canva.html (tất cả trang, data-document-role="page" để import Canva)
//        + dist/index.html (xem nhanh toàn bộ)
// Usage: node deck/tools/build.mjs [--base https://cdn.example/deck/]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const ICONS = process.env.PHOSPHOR_DIR;

const argBase = process.argv.indexOf('--base');
const BASE = argBase > -1 ? process.argv[argBase + 1] : '';

const SECTIONS = ['Bối cảnh', 'Sản phẩm', 'Kế hoạch chi tiết', 'IMC Plan', 'Tài chính', 'Tính khả thi'];
const FONT_LINK =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">';

const fontFaces = fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'fonts.css'), 'utf8').replace(/\.\.\/fonts\//g, 'assets/fonts/');
const css = fontFaces + fs.readFileSync(path.join(SRC, 'theme.css'), 'utf8');

function icon(name, weight = 'regular') {
  const file = path.join(ICONS, weight, weight === 'regular' ? `${name}.svg` : `${name}-${weight}.svg`);
  if (!fs.existsSync(file)) throw new Error(`icon missing: ${weight}/${name}`);
  return fs.readFileSync(file, 'utf8')
    .replace('<svg ', '<svg aria-hidden="true" ')
    .replace(/fill="currentColor"/, 'fill="currentColor"');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const files = fs.readdirSync(path.join(SRC, 'slides')).filter(f => f.endsWith('.html')).sort();
const slides = files.map(f => {
  const raw = fs.readFileSync(path.join(SRC, 'slides', f), 'utf8');
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) throw new Error(`missing meta in ${f}`);
  const meta = JSON.parse(m[1]);
  let body = raw.slice(m[0].length).trim();
  body = body.replace(/\{\{i:([a-z0-9-]+)(?::([a-z]+))?\}\}/g, (_, n, w) => icon(n, w));
  return { file: f, no: parseInt(f, 10), meta, body };
});

function chrome(s) {
  if (s.meta.bare) return '';
  const sec = s.meta.section;
  const prog = SECTIONS.map((_, i) => `<span class="${i + 1 === sec ? 'on' : ''}"></span>`).join('');
  return `
  <div class="bg-glow"></div>
  <div class="chrome-top">
    <div class="brand"><img src="assets/img/logo-white.png" alt="Logo Làm Tổ"><span>Làm Tổ</span><span class="sep"></span><span class="sec-no">0${sec}</span><span>${SECTIONS[sec - 1]}</span></div>
    <div class="progress" aria-label="Phần ${sec} trên 6">${prog}</div>
  </div>
  <div class="page-no">${String(s.no).padStart(2, '0')}</div>`;
}

function section(s) {
  const cls = ['slide', s.meta.cls || ''].join(' ').trim();
  return `<section class="${cls}" data-document-role="page" data-label="${esc(s.meta.title)}"${s.meta.notes ? ` data-speaker-notes="${esc(s.meta.notes)}"` : ''}>${chrome(s)}
${s.body}
</section>`;
}

function page(title, inner, extraCss = '') {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1672">
<title>${esc(title)}</title>
${BASE ? `<base href="${BASE}">` : ''}
${FONT_LINK}
<style>
${css}
${extraCss}
</style>
</head>
<body>
${inner}
</body>
</html>
`;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'slides'), { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'slides', 'assets'), { recursive: true });

for (const s of slides) {
  const name = `${String(s.no).padStart(2, '0')}.html`;
  fs.writeFileSync(path.join(DIST, 'slides', name), page(`${s.no}. ${s.meta.title}`, section(s), 'body{width:1672px;height:941px;overflow:hidden}'));
}

fs.writeFileSync(
  path.join(DIST, 'canva.html'),
  page('Làm Tổ · Pitch deck', slides.map(section).join('\n'), 'body{display:flex;flex-direction:column;gap:0}')
);

fs.writeFileSync(
  path.join(DIST, 'index.html'),
  page('Làm Tổ · Xem nhanh', slides.map(section).join('\n'), 'body{display:flex;flex-direction:column;gap:40px;padding:40px;align-items:center}')
);

console.log(`built ${slides.length} slides -> ${DIST}`);
