/**
 * Builds the unpacked extension into dist/ (or dist-e2e/ with --e2e).
 *
 * Why three Vite builds instead of one: Chrome runs each part of an extension
 * differently. The popup and options pages are normal web pages, the service
 * worker is an ES module, and the content script must be a single classic
 * script (Chrome does not load content scripts as modules).
 *
 *   node scripts/build.mjs          production build into dist/
 *   node scripts/build.mjs --e2e    test build into dist-e2e/ (see manifest.mjs)
 *   node scripts/build.mjs --e2e-on-demand   test build into dist-e2e-on-demand/
 *   node scripts/build.mjs --live   build for scripts/live-check.mjs into dist-live/
 *   node scripts/build.mjs --watch  rebuild on change
 */
import { build } from 'vite';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildManifest } from './manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const DEPLOYED_API_URL = 'https://linkpeek-api.vercel.app/api/summarise';
const onDemand = process.argv.includes('--e2e-on-demand');
const live = process.argv.includes('--live');
const e2e = onDemand || live || process.argv.includes('--e2e');
const watch = process.argv.includes('--watch') ? {} : null;
const outDir = resolve(root, live ? 'dist-live' : onDemand ? 'dist-e2e-on-demand' : e2e ? 'dist-e2e' : 'dist');

const shared = {
  configFile: false,
  logLevel: 'warn',
  define: {
    __E2E__: JSON.stringify(e2e),
    __LIVE__: JSON.stringify(live),
    // Where LinkPeek's own summary backend lives (Part 06): the deployed one unless LINKPEEK_API_URL says
    // otherwise. LINKPEEK_API_URL= (empty) builds without one, and the option is shown greyed out.
    // Test builds use the local test server's stand-in, so no test ever reaches the real one.
    __API_URL__: JSON.stringify(e2e && !live ? 'http://127.0.0.1:4173/api/summarise' : (process.env.LINKPEEK_API_URL ?? DEPLOYED_API_URL)),
  },
};

// 1. Popup and options pages. Also copies public/ (icons).
await build({
  ...shared,
  root: resolve(root, 'src'),
  base: './',
  publicDir: resolve(root, 'public'),
  build: {
    outDir,
    emptyOutDir: true,
    watch,
    rollupOptions: {
      input: {
        popup: resolve(root, 'src/popup/index.html'),
        options: resolve(root, 'src/options/index.html'),
        offscreen: resolve(root, 'src/offscreen/index.html'),
        permission: resolve(root, 'src/permission/index.html'),
      },
    },
  },
});

// 2. Service worker (ES module).
await build({
  ...shared,
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    watch,
    lib: { entry: resolve(root, 'src/background/index.ts'), formats: ['es'], fileName: () => 'background.js' },
  },
});

// 3. Content script (one classic script, no imports at runtime).
await build({
  ...shared,
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    watch,
    lib: {
      entry: resolve(root, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'LinkPeekContent',
      fileName: () => 'content.js',
    },
  },
});

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(buildManifest({ e2e, onDemand, live }), null, 2));

// pdf.js reads PDFs in a worker; it has to be a separate file in the extension.
mkdirSync(resolve(outDir, 'offscreen'), { recursive: true });
copyFileSync(
  resolve(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
  resolve(outDir, 'offscreen/pdf.worker.min.mjs'),
);

console.log(`Built ${e2e ? 'test' : 'production'} extension into ${outDir}`);
