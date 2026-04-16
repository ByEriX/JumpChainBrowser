import { defineConfig } from 'vitest/config';
import path from 'path';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'src/test/']
    }
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src/renderer/src')
    }
  }
});
