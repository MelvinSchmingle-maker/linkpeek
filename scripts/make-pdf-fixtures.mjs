/**
 * Writes the PDF fixtures in test-pages/articles/ by printing HTML with the
 * Chromium Playwright already has. Run: node scripts/make-pdf-fixtures.mjs
 *  - report.pdf: a two-page report (full text)
 *  - long-report.pdf: 20 pages (LinkPeek reads the first 15 only)
 *  - scanned.pdf: an image with no text layer, like a scanned document
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../test-pages/articles/', import.meta.url));
const para =
  'Millbrook council reviewed the condition of its footbridges over the summer and found that four of the eleven need repairs within two years. ' +
  'The worst, at Long Fen, has corroded handrails and will close for six weeks in the spring while a new deck is fitted. ';
const page = (n) => `<section style="page-break-after:always"><h2>Section ${n}</h2><p>${para.repeat(4)}</p></section>`;
const doc = (title, pages) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font:14px Georgia">` +
  `<h1>${title}</h1><p>Fictional test document for LinkPeek. Nothing here is real.</p>${Array.from({ length: pages }, (_, i) => page(i + 1)).join('')}</body></html>`;

const browser = await chromium.launch();
const p = await browser.newPage();
await p.setContent(doc('Footbridge condition report 2026', 2));
await p.pdf({ path: `${out}report.pdf`, format: 'A4' });
await p.setContent(doc('Footbridge condition report 2026: full appendix', 20));
await p.pdf({ path: `${out}long-report.pdf`, format: 'A4' });
// An image only: draw text onto a canvas, then print just the picture.
await p.setContent('<canvas id="c" width="800" height="300"></canvas>');
const png = await p.evaluate(() => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 800, 300);
  ctx.fillStyle = '#000';
  ctx.font = '28px Georgia';
  ctx.fillText('A scanned page: text as a picture, not as text.', 20, 150);
  return c.toDataURL('image/png');
});
await p.setContent(`<img src="${png}" style="width:100%">`);
await p.pdf({ path: `${out}scanned.pdf`, format: 'A4' });
await browser.close();
for (const f of ['report.pdf', 'long-report.pdf', 'scanned.pdf']) console.log(f, readFileSync(out + f).length, 'bytes');
