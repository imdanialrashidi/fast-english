import { defineConfig } from 'vitest/config';

// Mirrors the telemetry defines from vite.app.config.ts so unit tests can
// import the telemetry facade (test values — the app build injects the
// real package version + build time). `__LANDING_VERSION__` mirrors
// vite.landing.config.ts for the landing acquisition telemetry.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __LANDING_VERSION__: JSON.stringify('0.0.0-test'),
    __BUILD_TIME__: JSON.stringify(''),
  },
  test: {
    passWithNoTests: true,
    include: [
      'app/**/*.test.{ts,tsx}',
      'landing/**/*.test.{ts,tsx}',
      'shared/**/*.test.{ts,tsx}',
      'admin/**/*.test.{ts,tsx}',
      'scripts/content/**/*.test.mjs',
      'tests/**/*.test.mjs',
    ],
    coverage: {
      provider: 'v8',
      include: ['app/src/**/*.{ts,tsx}', 'shared/**/*.{ts,tsx}', 'admin/src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/dist-*', '**/build-boundary.test.ts'],
      thresholds: { statements: 25, branches: 20, functions: 15, lines: 25 },
      reporter: ['text', 'lcov', 'html'],
    },
  },
});
