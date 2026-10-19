import { createJiti } from 'jiti';

try {
  const jiti = createJiti(import.meta.url);
  await jiti.import('./mahaffeys-mcp.ts');
} catch (error) {
  process.stderr.write(`Mahaffeys MCP startup failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  process.exitCode = 1;
}
