import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    // PGlite boots a Postgres per test file; a cold CI runner has needed more than the
    // 10 s hook default to migrate one and seed a few rows (deploy run 28, Oct 30).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
