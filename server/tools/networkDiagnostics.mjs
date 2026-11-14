import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const options = { encoding: 'utf8', timeout: 3000, maxBuffer: 32 * 1024, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' } };
const execute = (file, args) => execFileSync(file, args, options).trim();
export function collectNetworkReport(run = execute, read = readFileSync) {
  const report = { checkedAt: new Date().toISOString(), readOnly: true, scope: 'Ubuntu host', interfaces: [], routes: [], resolverAddresses: [], upstreamDns: null, listeners: null, errors: [] };
  try {
    const rows = JSON.parse(run('/usr/sbin/ip', ['-json', 'address', 'show']));
    if (!Array.isArray(rows) || rows.length > 128) throw new Error();
    report.interfaces = rows.map(row => ({ name: row.ifname, state: row.operstate, addresses: (row.addr_info || []).slice(0, 32).map(address => ({ address: address.local, prefixLength: address.prefixlen, family: address.family, scope: address.scope })) }));
  } catch { report.errors.push('Network interface inspection unavailable.'); }
  try {
    const rows = JSON.parse(run('/usr/sbin/ip', ['-json', 'route', 'show']));
    if (!Array.isArray(rows) || rows.length > 256) throw new Error();
    report.routes = rows.map(row => ({ destination: row.dst, gateway: row.gateway || null, device: row.dev, metric: row.metric ?? null }));
  } catch { report.errors.push('IPv4 route inspection unavailable.'); }
  try {
    const content = read('/etc/resolv.conf', 'utf8');
    if (Buffer.byteLength(content) > 32 * 1024) throw new Error();
    report.resolverAddresses = content.split('\n').map(line => /^\s*nameserver\s+(\S+)/.exec(line)?.[1]).filter(address => address && isIP(address));
  } catch { report.errors.push('Resolver address inspection unavailable.'); }
  try { report.upstreamDns = run('/usr/bin/resolvectl', ['dns']); }
  catch { report.errors.push('Upstream DNS inspection unavailable; resolver addresses may point to a local stub.'); }
  try { report.listeners = run('/usr/bin/ss', ['--no-header', '--listening', '--tcp', '--udp', '--numeric']); }
  catch { report.errors.push('Listening TCP/UDP socket inspection unavailable.'); }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.platform !== 'linux' || process.argv.length !== 2) {
    process.stderr.write('The fixed host network report accepts no arguments and makes no network changes.\n');
    process.exitCode = 2;
  } else {
    const output = JSON.stringify(collectNetworkReport(), null, 2);
    if (Buffer.byteLength(output) > 192 * 1024) { process.stderr.write('Network report exceeded its output limit.\n'); process.exitCode = 1; }
    else process.stdout.write(`${output}\n`);
  }
}
