/** Writes test-pages/many-links.html: 1,200 links, 200 of which are headlines. */
import { writeFileSync } from 'node:fs';

const parts = [];
for (let i = 0; i < 200; i++) {
  parts.push(`<article><h3><a data-expect="icon" href="/2026/10/${String(i).padStart(3, '0')}/council-publishes-report-number-${i}-on-local-services">Council publishes report number ${i} on local services</a></h3>`);
  parts.push(`<p>By <a href="/authors/writer-${i % 7}">Writer ${i % 7}</a> · <a href="/tag/topic-${i % 9}">Topic ${i % 9}</a> · <a href="https://twitter.com/intent/tweet?u=${i}">Share</a> · <a href="/2026/10/${i}/x#comments">${i} comments</a></p></article>`);
}
const nav = Array.from({ length: 100 }, (_, i) => `<a href="/section-${i}">Section ${i}</a>`).join(' ');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>1,000 links (LinkPeek test page)</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:0 auto;max-width:900px;padding:8px}h3{margin:8px 0 2px;font-size:16px}p{margin:0}</style></head>
<body><p>LinkPeek test page: 1,200 links, 200 of them headlines. Nothing here is real.</p>
<nav>${nav}</nav>
<main>${parts.join('\n')}</main>
<footer>${nav}</footer>
</body></html>`;
writeFileSync(new URL('../test-pages/many-links.html', import.meta.url), html);
const count = (html.match(/<a /g) ?? []).length;
console.log(`many-links.html written with ${count} links`);
