/**
 * Renders the placeholder icons in public/icons from an SVG, using the
 * Chromium that Playwright already has. Run: node scripts/make-icons.mjs
 *
 * These are temporary. Replace public/icons/*.png with real artwork later.
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const brand = JSON.parse(readFileSync(new URL('../src/brand.json', import.meta.url), 'utf8'));
const out = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(out, { recursive: true });

// A rounded square with a simple eye: "peek".
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="4" y="4" width="120" height="120" rx="28" fill="${brand.colors.accent}"/>
  <path d="M20 64 C40 36, 88 36, 108 64 C88 92, 40 92, 20 64 Z" fill="#fff"/>
  <circle cx="64" cy="64" r="17" fill="${brand.colors.accent}"/>
  <circle cx="70" cy="58" r="6" fill="#fff"/>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}</style>` +
      svg.replace('<svg ', `<svg width="${size}" height="${size}" `),
  );
  await page.screenshot({ path: `${out}icon-${size}.png`, omitBackground: true });
}
await browser.close();
console.log('Icons written to public/icons');
