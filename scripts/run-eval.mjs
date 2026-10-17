/**
 * npm run eval: runs the Part 05 evaluation set and writes docs/eval/part-05.md.
 * (Sets EVAL_WRITE in a way that works on Windows too.)
 */
import { spawnSync } from 'node:child_process';

const res = spawnSync('npx', ['vitest', 'run', 'src/eval'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EVAL_WRITE: '1' },
});
process.exit(res.status ?? 1);
