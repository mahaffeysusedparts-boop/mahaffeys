import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
  // Keep isolated tests sequential while avoiding child-process worker startup stalls.
  test:{pool:'threads',environment:'node',include:['src/**/*.test.ts','server/**/*.test.ts'],fileParallelism:false,testTimeout:35000,hookTimeout:35000},
});
