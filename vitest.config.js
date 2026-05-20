import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.{js,mjs}'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'en/**', 'de/**', 'ru/**', 'fr/**',
        '**/*.config.{js,mjs}',
      ],
    },
  },
});
