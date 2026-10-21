import { parseArgs } from 'node:util';
import { isAbsolute } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { defaultSshFiles, runDiagnostic, SERVER_HOST, SERVICES, type DiagnosticRequest } from './sshDiagnostics';
import { managementRequest, managementTools } from './managementTools';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { 'identity-file': { type: 'string' }, 'known-hosts-file': { type: 'string' }, 'enable-management': { type: 'boolean', default: false }, 'management-identity-file': { type: 'string' } },
  strict: true,
});
const defaults = defaultSshFiles();
const files = {
  identityFile: values['identity-file'] ?? defaults.identityFile,
  knownHostsFile: values['known-hosts-file'] ?? defaults.knownHostsFile,
};
for (const path of Object.values(files)) {
  if (!isAbsolute(path) || /[\r\n\0]/.test(path)) throw new Error('SSH key and known_hosts paths must be absolute local file paths.');
}
const managementIdentity = values['management-identity-file'];
if (values['enable-management'] && (!managementIdentity || !isAbsolute(managementIdentity) || /[\r\n\0]/.test(managementIdentity) || managementIdentity === files.identityFile)) {
  throw new Error('Management requires a separate absolute private-key path. Never reuse the read-only diagnostics key.');
}
const managementFiles = managementIdentity ? { ...files, identityFile: managementIdentity } : undefined;

const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const emptySchema = { type: 'object' as const, properties: {}, additionalProperties: false };
const tools = [
  { name: 'mahaffeys_connection_check', description: 'Read server hostname and uptime over verified key-authenticated SSH. Confirms that the restricted diagnostics dispatcher is installed.', inputSchema: emptySchema, annotations },
  { name: 'mahaffeys_containers', description: 'Read Docker Compose container states and health in /var/www/mahaffeys. Does not restart or change any container.', inputSchema: emptySchema, annotations },
  { name: 'mahaffeys_project_version', description: 'Read the deployed checkout commit and working-tree status. The checkout version is not proof of the version running inside an image.', inputSchema: emptySchema, annotations },
  { name: 'mahaffeys_container_logs', description: 'Read bounded recent logs from one allowlisted service. Common secrets are redacted, but logs should still be treated as sensitive.', inputSchema: { type: 'object' as const, properties: { service: { type: 'string', enum: [...SERVICES] }, lines: { type: 'integer', minimum: 10, maximum: 200, default: 60 } }, required: ['service'], additionalProperties: false }, annotations },
  { name: 'mahaffeys_cups_diagnostics', description: 'Read active CUPS listener/hostname directives, scheduler availability from CUPS and the app, and at most 80 lines of CUPS error logs. Never modifies printing configuration or queues.', inputSchema: emptySchema, annotations },
  { name: 'mahaffeys_printer_connectivity', description: 'Check TCP reachability of the Brother printer at 192.168.1.251:631 from the app container. This is not an IPP compatibility check and sends no print job.', inputSchema: emptySchema, annotations },
];
const emptyArgs = z.object({}).strict();
const logArgs = z.object({ service: z.enum(SERVICES), lines: z.number().int().min(10).max(200).default(60) }).strict();
const server = new Server({ name: 'mahaffeys-server-connection', version: '2.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...tools, ...(values['enable-management'] ? managementTools : [])] }));
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  try {
    let diagnostic: DiagnosticRequest;
    let sshFiles = files;
    if (managementTools.some(tool => tool.name === request.params.name)) {
      if (!values['enable-management'] || !managementFiles) throw new Error('Management is disabled. Provision the separate restricted key and enable it explicitly.');
      diagnostic = managementRequest(request.params.name, request.params.arguments ?? {});
      sshFiles = managementFiles;
    } else if (request.params.name === 'mahaffeys_container_logs') {
      diagnostic = { operation: 'logs', ...logArgs.parse(request.params.arguments ?? {}) };
    } else {
      emptyArgs.parse(request.params.arguments ?? {});
      switch (request.params.name) {
        case 'mahaffeys_connection_check': diagnostic = { operation: 'connection' }; break;
        case 'mahaffeys_containers': diagnostic = { operation: 'containers' }; break;
        case 'mahaffeys_project_version': diagnostic = { operation: 'version' }; break;
        case 'mahaffeys_cups_diagnostics': diagnostic = { operation: 'cups' }; break;
        case 'mahaffeys_printer_connectivity': diagnostic = { operation: 'printer' }; break;
        default: throw new Error('Unknown tool.');
      }
    }
    const output = await runDiagnostic(diagnostic, sshFiles, extra.signal);
    return { content: [{ type: 'text' as const, text: JSON.stringify({ server: SERVER_HOST, checkedAt: new Date().toISOString(), output }, null, 2) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Diagnostics failed.' }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`Mahaffeys MCP bridge ready (${values['enable-management'] ? 'guarded management enabled with separate key' : 'read-only mode'}). SSH is attempted only when a tool is called.\n`);
process.once('SIGINT', () => { void server.close(); });
process.once('SIGTERM', () => { void server.close(); });
