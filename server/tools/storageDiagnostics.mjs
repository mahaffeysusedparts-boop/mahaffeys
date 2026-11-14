import { execFileSync } from 'node:child_process';
import { realpathSync, statfsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = '/var/www/mahaffeys';
const services = ['mahaffeys', 'postgres', 'cups', 'nginx', 'storage-agent', 'vision-worker'];
const dockerArgs = ['--host', 'unix:///var/run/docker.sock'];
const commandOptions = {
  cwd: project,
  encoding: 'utf8',
  timeout: 3000,
  maxBuffer: 64 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { PATH: '/usr/bin:/bin', LC_ALL: 'C', HOME: '/home/jhilliard' },
};

function execute(file, args) {
  return execFileSync(file, args, commandOptions).trim();
}

function pathValue(value) {
  return typeof value === 'string' && isAbsolute(value) && !/[\r\n\0]/.test(value);
}

export function collectStorageReport(run = execute, filesystem = statfsSync, canonicalPath = realpathSync) {
  const report = {
    checkedAt: new Date().toISOString(),
    readOnly: true,
    note: 'Detected drive sizes are not pooled capacity. Filesystem totals must not be added together when paths share a filesystem. No data has been moved.',
    blockDevices: null,
    dockerRoot: null,
    containers: [],
    filesystems: [],
    errors: [],
  };
  try {
    const inventory = JSON.parse(run('/usr/bin/lsblk', ['--json', '--bytes', '--output', 'NAME,PATH,TYPE,SIZE,FSTYPE,UUID,MOUNTPOINTS']));
    if (!Array.isArray(inventory.blockdevices)) throw new Error();
    report.blockDevices = inventory.blockdevices;
  } catch {
    report.errors.push('Block-device inventory unavailable: check host util-linux installation and access.');
  }
  try {
    const root = JSON.parse(run('/usr/bin/docker', [...dockerArgs, 'info', '--format', '{{json .DockerRootDir}}']));
    if (!pathValue(root)) throw new Error();
    report.dockerRoot = root;
  } catch {
    report.errors.push('Docker data directory unavailable: check existing local Docker access. No permissions were changed.');
  }
  try {
    const ids = run('/usr/bin/docker', [...dockerArgs, 'compose', '--project-directory', project, '--file', `${project}/compose.yaml`, '--project-name', 'mahaffeys', 'ps', '--all', '--quiet', ...services]).split(/\s+/).filter(Boolean);
    if (ids.length > 16 || ids.some(id => !/^[a-f0-9]{12,64}$/.test(id))) throw new Error();
    if (ids.length) {
      const rows = run('/usr/bin/docker', [...dockerArgs, 'inspect', '--format', '{"name":{{json .Name}},"mounts":{{json .Mounts}}}', ...ids]).split('\n');
      if (rows.length !== ids.length) throw new Error();
      report.containers = rows.map(row => {
        const value = JSON.parse(row);
        if (typeof value.name !== 'string' || !Array.isArray(value.mounts) || value.mounts.length > 32) throw new Error();
        return {
          name: value.name,
          mounts: value.mounts.map(mount => ({
            type: mount.Type,
            name: mount.Name || null,
            source: mount.Source,
            destination: mount.Destination,
            writable: mount.RW === true,
          })),
        };
      });
    }
  } catch {
    report.errors.push('App container mount inspection unavailable. No container environment or volume contents were read.');
  }
  const paths = new Map([['/', ['Ubuntu root filesystem']]]);
  function addPath(path, label) {
    if (!pathValue(path)) return;
    const labels = paths.get(path) || [];
    labels.push(label);
    paths.set(path, labels);
  }
  const devices = [...(report.blockDevices || [])];
  let count = 0;
  while (devices.length && count < 128) {
    const device = devices.shift();
    count += 1;
    if (Array.isArray(device.mountpoints)) {
      for (const mountpoint of device.mountpoints.slice(0, 16)) addPath(mountpoint, `Block device: ${device.path}`);
    }
    if (Array.isArray(device.children)) devices.push(...device.children);
  }
  if (devices.length) report.errors.push('Mounted block-device capacity inspection limited to 128 devices.');
  addPath(report.dockerRoot, 'Docker data directory');
  for (const container of report.containers) {
    for (const mount of container.mounts) {
      if (mount.type === 'volume' || mount.type === 'bind') addPath(mount.source, `${container.name}: ${mount.destination}`);
    }
  }
  for (const [path, labels] of paths) {
    try {
      const realPath = canonicalPath(path);
      const stats = filesystem(realPath, { bigint: true });
      report.filesystems.push({
        path,
        realPath,
        labels,
        totalBytes: Number(stats.blocks * stats.bsize),
        usedBytes: Number((stats.blocks - stats.bfree) * stats.bsize),
        freeBytes: Number(stats.bfree * stats.bsize),
        availableBytes: Number(stats.bavail * stats.bsize),
      });
    } catch {
      report.filesystems.push({ path, labels, error: 'Filesystem statistics inaccessible to the diagnostics account.' });
    }
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2 || process.platform !== 'linux') {
    process.stderr.write('This fixed read-only report accepts no arguments and runs on the Ubuntu host only.\n');
    process.exitCode = 2;
  } else {
    const output = JSON.stringify(collectStorageReport(), null, 2);
    if (Buffer.byteLength(output) > 192 * 1024) {
      process.stderr.write('Storage report exceeded its output limit.\n');
      process.exitCode = 1;
    } else {
      process.stdout.write(`${output}\n`);
    }
  }
}
