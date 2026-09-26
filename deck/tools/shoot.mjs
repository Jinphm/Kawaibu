// Render từng slide bằng Chromium, chụp PNG và chạy kiểm tra bố cục tự động.
// Usage: node deck/tools/shoot.mjs [slideNo ...]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2).map(Number);
const files = fs.readdirSync(path.join(DIST, 'slides')).filter(f => f.endsWith('.html')).sort()
  .filter(f => !only.length || only.includes(parseInt(f, 10)));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const ctx = await browser.newContext({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: Number(process.env.DPR || 1) });
let problems = 0;

for (const f of files) {
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(DIST, 'slides', f));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const report = await page.evaluate(() => {
    const out = [];
    const slide = document.querySelector('.slide');
    const S = slide.getBoundingClientRect();
    const loaded = [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'Be Vietnam Pro' && f.status === 'loaded');
    if (loaded.length < 3) out.push('FONT not loaded (' + loaded.length + ')');
    const txt = slide.innerText;
    if (/[—–]/.test(txt)) out.push('DASH: em/en dash present');
    for (const img of slide.querySelectorAll('img')) if (!img.complete || !img.naturalWidth) out.push('IMG broken: ' + img.getAttribute('src'));
    const containers = '.card,.card-strong,.card-accent,[data-box]';
    for (const el of slide.querySelectorAll('*')) {
      if (el.closest('svg') || el.classList.contains('bg-glow') || el.hasAttribute('data-bleed')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '');
      if (r.left < S.left - 1 || r.top < S.top - 1 || r.right > S.right + 1 || r.bottom > S.bottom + 1)
        out.push(`OUT of slide: ${tag} "${(el.innerText || '').slice(0, 40)}" [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
      const cs = getComputedStyle(el);
      const tol = Math.max(2, parseFloat(cs.fontSize) * 0.08);
      {
        if (el.scrollHeight > el.clientHeight + tol && el.clientHeight > 0 && cs.display !== 'inline')
          out.push(`OVERFLOW-Y: ${tag} "${(el.innerText || '').slice(0, 40)}" ${el.scrollHeight}>${el.clientHeight}`);
        if (el.scrollWidth > el.clientWidth + tol && el.clientWidth > 0 && cs.display !== 'inline')
          out.push(`OVERFLOW-X: ${tag} "${(el.innerText || '').slice(0, 40)}" ${el.scrollWidth}>${el.clientWidth}`);
      }
      // chữ phải nằm trong hộp chứa gần nhất
      if (el.children.length === 0 && (el.innerText || '').trim()) {
        const box = el.parentElement && el.parentElement.closest(containers);
        if (box) {
          const b = box.getBoundingClientRect();
          if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1)
            out.push(`TEXT escapes box: "${el.innerText.slice(0, 40)}"`);
        }
      }
    }
    const lead = slide.querySelector('.lead');
    if (lead && lead.getBoundingClientRect().height > 40) out.push('LEAD wraps to 2+ lines');
    const body = slide.querySelector('.body');
    if (lead && body && lead.getBoundingClientRect().bottom > body.getBoundingClientRect().top - 12) out.push('LEAD too close to body');
    // chữ quá nhỏ
    for (const el of slide.querySelectorAll('*')) {
      if (el.closest('svg')) continue;
      if (el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 13) out.push(`SMALL text ${fs}px: "${el.innerText.slice(0, 30)}"`);
      }
    }
    return out;
  });
  await page.screenshot({ path: path.join(OUT, f.replace('.html', '.png')) });
  if (report.length) { problems += report.length; console.log(`\n${f}:\n  ` + report.join('\n  ')); }
  else console.log(`${f}: ok`);
  await page.close();
}
await browser.close();
console.log(problems ? `\n${problems} issue(s)` : '\nall clean');
