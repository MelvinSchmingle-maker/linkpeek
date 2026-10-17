/**
 * npm run eval:ai: Part 06 evaluation. CALLS CLAUDE AND COSTS MONEY
 * (about 25 requests; see docs/cost/part-06-estimate.md). Needs
 * ANTHROPIC_API_KEY; SUMMARY_MODEL picks the model (default claude-opus-5-5).
 * Writes docs/eval/part-06.md.
 */
import { spawnSync } from 'node:child_process';

const res = spawnSync('npx', ['vitest', 'run', 'src/eval/ai.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EVAL_AI: '1' },
});
process.exit(res.status ?? 1);
