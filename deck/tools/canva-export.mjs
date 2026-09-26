// Tách mỗi slide thành: nền PNG (ẩn chữ và ảnh) + danh sách chữ/ảnh có tọa độ, để dựng lại trên Canva
// với chữ chỉnh sửa được. Usage: node deck/tools/canva-export.mjs [slideNo ...]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'canva');
fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2).map(Number);
const files = fs.readdirSync(path.join(DIST, 'slides')).filter(f => f.endsWith('.html')).sort()
  .filter(f => !only.length || only.includes(parseInt(f, 10)));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1672, height: 941 }, deviceScaleFactor: 2 });

for (const f of files) {
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(DIST, 'slides', f));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const data = await page.evaluate(() => {
    const slide = document.querySelector('.slide');
    const S = slide.getBoundingClientRect();
    const isBlock = el => !['inline', 'inline-block', 'contents'].includes(getComputedStyle(el).display) || el === slide;
    const blockOf = n => { let e = n.parentElement; while (e && !isBlock(e)) e = e.parentElement; return e; };
    const rgb2hex = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''); };
    const texts = [];
    // mỗi "đơn vị chữ" = một phần tử khối, hoặc một inline có cỡ chữ khác cha (vd số + đơn vị nhỏ)
    const units = new Map();
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim() || n.parentElement.closest('svg,style')) continue;
      let host = n.parentElement, unit = blockOf(n);
      for (let e = host; e && e !== unit; e = e.parentElement) {
        if (getComputedStyle(e).fontSize !== getComputedStyle(unit).fontSize) { unit = e; break; }
      }
      if (!units.has(unit)) units.set(unit, []);
      units.get(unit).push(n);
    }
    for (const [el, nodes] of units) {
      const cs = getComputedStyle(el);
      const range = document.createRange();
      range.setStartBefore(nodes[0]); range.setEndAfter(nodes[nodes.length - 1]);
      const r = range.getBoundingClientRect();
      // chữ của các đơn vị con (cỡ khác) bị loại khỏi đơn vị cha
      const childUnits = [...units.keys()].filter(u => u !== el && el.contains(u));
      let text = '';
      const w2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let m;
      while ((m = w2.nextNode())) {
        if (m.nodeType === 1) {
          if (m.tagName === 'BR') text += '\n';
          continue;
        }
        if (m.parentElement.closest('svg,style')) continue;
        if (childUnits.some(u => u.contains(m))) continue;
        let t = m.textContent.replace(/\s+/g, ' ');
        const tt = getComputedStyle(m.parentElement).textTransform;
        if (tt === 'uppercase') t = t.toUpperCase();
        text += t;
      }
      text = text.replace(/ *\n */g, '\n').trim();
      if (!text) continue;
      const fsz = parseFloat(cs.fontSize);
      const lh = cs.lineHeight === 'normal' ? 1.3 : parseFloat(cs.lineHeight) / fsz;
      // hướng căn: nếu phần tử co theo chữ thì căn theo chữ thực tế
      const er = el.getBoundingClientRect();
      const align = cs.textAlign === 'center' ? 'center' : (cs.textAlign === 'right' || cs.textAlign === 'end') ? 'end' : 'start';
      const multi = r.height > fsz * lh * 1.5;
      const cw = er.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const box = align !== 'start' ? { left: er.left + parseFloat(cs.paddingLeft), width: cw }
        : multi ? { left: r.left, width: Math.max(cw - (r.left - er.left - parseFloat(cs.paddingLeft)), r.width) }
        : { left: r.left, width: r.width * 1.08 + 8 };
      texts.push({
        text, left: box.left - S.left, top: r.top - S.top, width: box.width, height: r.height,
        size: fsz, weight: parseInt(cs.fontWeight, 10) >= 600 ? 'bold' : 'normal',
        color: rgb2hex(cs.color), align, lh: Math.min(2.5, Math.max(0.5, lh)),
        italic: cs.fontStyle === 'italic',
      });
    }
    const imgs = [...slide.querySelectorAll('img')].map(img => {
      const ph = img.closest('.ph');
      const r = (ph || img).getBoundingClientRect();
      if (ph) return { src: img.getAttribute('src'), alt: img.alt, left: r.left - S.left + 3, top: r.top - S.top + 3, width: r.width - 6, height: r.height - 6, round: '50%' };
      // với object-fit: contain, lấy đúng khung ảnh hiển thị
      const cs = getComputedStyle(img);
      let { left, top, width, height } = r;
      if (cs.objectFit === 'contain' && img.naturalWidth) {
        const k = Math.min(width / img.naturalWidth, height / img.naturalHeight);
        const w = img.naturalWidth * k, h = img.naturalHeight * k;
        left += (width - w) / 2; top += (height - h) / 2; width = w; height = h;
      }
      return { src: img.getAttribute('src'), alt: img.alt, left: left - S.left, top: top - S.top, width, height, round: cs.borderRadius };
    });
    return { texts, imgs };
  });
  // nền: ẩn chữ và ảnh; giữ màu icon svg (currentColor)
  await page.evaluate(() => { for (const svg of document.querySelectorAll('.slide svg')) { const c = getComputedStyle(svg).color; for (const e of [svg, ...svg.querySelectorAll('*')]) e.style.setProperty('color', c, 'important'); } });
  await page.addStyleTag({ content: '.slide, .slide * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } .slide img { visibility: hidden !important; }' });
  await page.waitForTimeout(50);
  const no = f.replace('.html', '');
  await page.screenshot({ path: path.join(OUT, `${no}-bg.png`) });
  fs.writeFileSync(path.join(OUT, `${no}.json`), JSON.stringify(data, null, 1));
  console.log(`${no}: ${data.texts.length} texts, ${data.imgs.length} imgs`);
  await page.close();
}
await browser.close();
