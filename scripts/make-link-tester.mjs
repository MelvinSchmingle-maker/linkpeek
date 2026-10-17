/**
 * Builds the link tester as a zip to download: the test script, its README and
 * sample list, the "what to look for" guide, and LinkPeek's live-check build.
 *
 *   node scripts/build.mjs --live && node scripts/make-link-tester.mjs
 *
 * Output: dist-tools/linkpeek-link-tester.zip
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'tools/link-tester');
const extension = resolve(root, 'dist-live');
const outDir = resolve(root, 'dist-tools');
const folderName = 'linkpeek-link-tester';
const staging = resolve(outDir, folderName);

if (!existsSync(resolve(extension, 'manifest.json'))) {
  throw new Error('dist-live is missing. Run: node scripts/build.mjs --live');
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
for (const file of ['package.json', 'link-test.mjs', 'links.txt', 'README.md']) {
  copyFileSync(resolve(source, file), resolve(staging, file));
}
copyFileSync(resolve(root, 'docs/link-testing/what-to-look-for.md'), resolve(staging, 'WHAT-TO-LOOK-FOR.md'));
cpSync(extension, resolve(staging, 'extension'), { recursive: true });

const zip = resolve(outDir, `${folderName}.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-rq', zip, folderName], { cwd: outDir });
console.log(`Wrote ${zip}`);
