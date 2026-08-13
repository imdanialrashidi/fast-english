import { defineConfig } from 'vitest/config';

// Mirrors the telemetry defines from vite.app.config.ts so unit tests can
// import the telemetry facade (test values — the app build injects the
// real package version + build time).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
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
    ],
  },
});
