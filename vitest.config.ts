import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
  test:{environment:'node',include:['src/**/*.test.ts','server/**/*.test.ts'],fileParallelism:false,testTimeout:35000,hookTimeout:35000},
});
