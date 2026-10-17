/**
 * The rule that money and partners never change a result (Part 14): the
 * modules that judge a link or a headline import no settings and no storage.
 * This reads their source, so adding such an import fails the test.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const JUDGING = ['clickbait', 'source', 'security', 'extract'];
const root = join(process.cwd(), 'src/core');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the modules that judge a result take no settings and no partner input', () => {
  for (const area of JUDGING) {
    it(`${area}/ imports no settings or storage`, () => {
      for (const file of sourceFiles(join(root, area))) {
        const text = readFileSync(file, 'utf8');
        expect(text, file).not.toMatch(/from ['"][^'"]*storage[^'"]*['"]/);
        expect(text, file).not.toMatch(/chrome\.storage/);
      }
    });
  }
});
