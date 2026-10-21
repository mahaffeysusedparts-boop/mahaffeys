import { lstat, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const SERVICES = ['cups', 'mahaffeys'];
export const INSTALL = '/usr/local/lib/mahaffeys/management';
export const POLICY = '/etc/mahaffeys-management.json';
export function parseCommand(token) {
  const match = /^mgmt:(prepare|status|deploy|rollback):([a-f0-9]+)$/.exec(token);
  if (!match || match[0] !== token || match[2].length !== (match[1] === 'prepare' ? 40 : 32)) throw new Error('Unknown management request.');
  return { action: match[1], target: match[2] };
}
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function deploymentOnlyManifest(full) {
  const runtime = structuredClone(full);
  runtime.services = Object.fromEntries(SERVICES.map(service => [service, runtime.services[service]]));
  // Compose create has no --no-deps: remove dependencies so other services cannot be created/replaced.
  for (const service of SERVICES) {
    delete runtime.services[service].depends_on;
    delete runtime.services[service].links;
    delete runtime.services[service].external_links;
  }
  return runtime;
}
export async function rootOwned(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o022)) throw new Error(`Administrator must install a root-owned, non-writable ${path}.`);
}
export async function loadPolicy() {
  for (const path of ['/usr/local', '/usr/local/lib', '/usr/local/lib/mahaffeys', INSTALL, '/etc', '/var/lib']) await rootOwned(path);
  for (const name of ['runner.mjs', 'operations.mjs', 'policy.mjs']) await rootOwned(`${INSTALL}/${name}`);
  await rootOwned(POLICY);
  const value = JSON.parse(await readFile(POLICY, 'utf8'));
  if (value.enabled !== true || value.repository !== '/var/www/mahaffeys' || value.project !== 'mahaffeys' || value.branch !== 'main' || value.stateDirectory !== '/var/lib/mahaffeys-management') throw new Error('Management policy is disabled or outside the approved fixed deployment scope.');
  if (await realpath(value.repository) !== value.repository || await realpath(value.stateDirectory) !== value.stateDirectory) throw new Error('Repository/state symlinks are not allowed.');
  const state = await lstat(value.stateDirectory);
  if (state.uid !== process.getuid() || (state.mode & 0o077)) throw new Error('Management state must belong to the connecting account with mode 0700.');
  return value;
}

// Approved source still executes build/startup code: Git origin/main maintainers are trusted.
export function validateManifest(baseline, candidate) {
  const before = structuredClone(baseline);
  const after = structuredClone(candidate);
  for (const service of SERVICES) {
    const current = before.services?.[service];
    const proposed = after.services?.[service];
    if (!current || !proposed) throw new Error('Both app and CUPS services must exist.');
    if (service === 'mahaffeys' && !['node', '1000', '1000:1000'].includes(String(proposed.user || 'node'))) throw new Error('The app must remain non-root.');
    if (service === 'cups' && digest(current.user ?? null) !== digest(proposed.user ?? null)) throw new Error('CUPS runtime identity must remain unchanged.');
    for (const field of ['privileged', 'cap_add', 'cap_drop', 'devices', 'device_cgroup_rules', 'group_add', 'pid', 'ipc', 'userns_mode', 'network_mode', 'ports', 'networks', 'security_opt', 'healthcheck', 'volumes_from', 'configs', 'secrets', 'sysctls', 'cgroup', 'command', 'entrypoint']) {
      if (digest(current[field] ?? null) !== digest(proposed[field] ?? null)) throw new Error(`Unapproved ${service} privilege/network change: ${field}.`);
    }
    const oldMounts = current.volumes || [];
    const newMounts = proposed.volumes || [];
    for (const mount of oldMounts) {
      if (!newMounts.some(value => digest(value) === digest(mount))) throw new Error('Existing production mounts must remain unchanged.');
    }
    for (const mount of newMounts.filter(value => !oldMounts.some(old => digest(old) === digest(value)))) {
      if (mount.type !== 'volume' || mount.source !== 'cups-transport' || mount.target !== '/run/mahaffeys-cups' || (service === 'mahaffeys' && mount.read_only !== true)) throw new Error('Only the protected, app-read-only CUPS transport volume may be added. Never share /run/cups or a host bind mount.');
    }
    delete before.services[service];
    delete after.services[service];
  }
  const transport = after.volumes?.['cups-transport'];
  if (transport) {
    if (transport.name !== 'mahaffeys_cups-transport' || transport.external || transport.driver_opts || (transport.driver && transport.driver !== 'local')) throw new Error('Unsafe CUPS transport volume definition.');
    delete after.volumes['cups-transport'];
  }
  if (before.volumes?.['cups-transport']) delete before.volumes['cups-transport'];
  if (digest(before) !== digest(after)) throw new Error('Only app/CUPS configuration may change. Database, proxy and other services are out of scope.');
  if (candidate.services.mahaffeys.environment?.NITRO_CUPS_SERVER !== '/run/mahaffeys-cups/cups.sock') throw new Error('Verified deployment requires the protected CUPS socket address.');
  for (const name of SERVICES) {
    if (!candidate.services[name].volumes?.some(mount => mount.target === '/run/mahaffeys-cups' && mount.source === 'cups-transport')) throw new Error('Protected socket volume must be present in both services.');
  }
}
