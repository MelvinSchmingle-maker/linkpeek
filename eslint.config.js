import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'dist-e2e/', 'dist-e2e-on-demand/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, chrome: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Page content is untrusted. Never build DOM from strings.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent or DOM APIs. Page data is untrusted.' },
        { property: 'outerHTML', message: 'Use DOM APIs. Page data is untrusted.' },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
);
