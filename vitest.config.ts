import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    // Default to lightweight Node.js environment for pure logic, algorithms, and services.
    // Restrict heavy JSDOM browser environment to UI components (.tsx) and React hooks.
    environment: 'node',
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
      ['**/*.spec.tsx', 'jsdom'],
      ['**/use*.test.ts', 'jsdom'],
      ['**/use*.spec.ts', 'jsdom'],
      ['**/hooks/**', 'jsdom'],
    ],
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown hooks
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/e2e/**', // Exclude e2e tests (Playwright)
      '**/src/e2e/**', // Exclude e2e tests in src folder
    ],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Mirrors Next.js's own server-side alias (next/dist/build/create-compiler-aliases.js): tests
      // run server code, so `import 'server-only'` resolves to the empty module. Client bundles
      // still get the throwing module from Next, which is what enforces the boundary (Rule 52).
      'server-only': fileURLToPath(new URL('./node_modules/next/dist/compiled/server-only/empty.js', import.meta.url)),
    },
  },
});
