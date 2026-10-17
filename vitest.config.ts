import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __E2E__: 'false', __LIVE__: 'false', __API_URL__: "''" },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['src/test/setup.ts'],
  },
});
