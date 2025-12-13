import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load environment variables from .env file
config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/fixtures/', 'tests/helpers/', 'tests/temp/'],
    },
    testTimeout: 0, // No timeout - Ollama models can take a while to warm up
  },
});
