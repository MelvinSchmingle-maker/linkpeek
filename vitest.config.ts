import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __E2E__: 'false' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['src/test/setup.ts'],
  },
});
