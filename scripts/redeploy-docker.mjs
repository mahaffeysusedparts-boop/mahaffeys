#!/usr/bin/node
import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function run(command, args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`Deployment step failed (${signal || code}); later steps were not run.`));
    });
  });
}

try {
  if (process.argv.length !== 2) throw new Error('This helper takes no arguments; it uses the reviewed bundled management public key.');
  if (process.getuid?.() !== 0 || !process.stdin.isTTY) throw new Error('A server administrator must launch this host-side helper as root in an interactive terminal. It does not run in Docker or through the diagnostics key.');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22 or newer is required on the host.');
  const repository = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  if (repository !== '/var/www/mahaffeys') throw new Error('This helper only runs from the approved server checkout /var/www/mahaffeys.');
  await run('/usr/bin/node', [join(repository, 'scripts/install-mahaffeys-management.mjs'), join(repository, 'deploy/ssh/mahaffeys-management.pub'), '--if-needed'], repository);
  await run('/usr/bin/docker', ['compose', 'config', '--quiet'], repository);
  console.log('Running the existing Docker Compose build/start deployment. This is a manual deployment, not the guarded MCP acceptance/backup workflow. CUPS recreation can lose pending documents; preserve pending print jobs before approving this redeploy.');
  await run('/usr/bin/docker', ['compose', 'up', '--build', '-d'], repository);
  await run('/usr/bin/docker', ['compose', 'ps'], repository);
  console.log('Docker Compose completed; container status is shown above. This does not prove application readiness or physical printing. Configure the separate management identity in Dyad and reload the plugin to enable guarded remote operations.');
} catch (error) {
  console.error(error.message || 'Docker redeploy failed.');
  process.exitCode = 1;
}
