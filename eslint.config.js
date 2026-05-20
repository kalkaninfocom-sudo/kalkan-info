// ESLint flat config — minimal recommended for browser + node mix
// Run: npx eslint . --fix
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // Project-specific globals
        plausible: 'readonly',
        Chart: 'readonly',
        L: 'readonly',
        supabase: 'readonly',
        KalkanData: 'readonly',
        SUPABASE_URL: 'readonly',
        SUPABASE_ANON_KEY: 'readonly',
        SUPABASE_CLIENT: 'readonly',
        applyI18n: 'readonly',
        plausibleEvent: 'readonly',
        kalkanQualifiedLead: 'readonly',
        openProvidersModal: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'eqeqeq': ['warn', 'smart'],
    },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: { Deno: 'readonly' },
    },
  },
  {
    // Exclude generated/external
    ignores: [
      'node_modules/**',
      'dist/**',
      'en/**', 'de/**', 'ru/**', 'fr/**',
      'temporary screenshots/**',
      'brochures/output/**',
      'assets/audio/**',
      '.vercel/**',
      'firebase-debug.log',
    ],
  },
];
