/**
 * npm run eval:ai: Part 06 evaluation. CALLS CLAUDE AND COSTS MONEY
 * (about 25 requests; see docs/cost/part-06-estimate.md). Needs
 * ANTHROPIC_API_KEY, or LINKPEEK_ANTHROPIC_API_KEY (the name to use in a
 * Claude Code cloud environment, so Claude Code itself doesn't pick the key
 * up). SUMMARY_MODEL picks the model (default claude-opus-5-5).
 * Writes docs/eval/part-06.md.
 */
import { spawnSync } from 'node:child_process';

const key = process.env.ANTHROPIC_API_KEY || process.env.LINKPEEK_ANTHROPIC_API_KEY;
if (!key) {
  console.error('No key: set ANTHROPIC_API_KEY or LINKPEEK_ANTHROPIC_API_KEY first.');
  process.exit(1);
}

const res = spawnSync('npx', ['vitest', 'run', 'src/eval/ai.test.ts'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ANTHROPIC_API_KEY: key, EVAL_AI: '1' },
});
process.exit(res.status ?? 1);
