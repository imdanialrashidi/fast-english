import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    include: [
      'app/**/*.test.{ts,tsx}',
      'landing/**/*.test.{ts,tsx}',
      'shared/**/*.test.{ts,tsx}',
      'admin/**/*.test.{ts,tsx}',
      'scripts/content/**/*.test.mjs',
    ],
  },
});
