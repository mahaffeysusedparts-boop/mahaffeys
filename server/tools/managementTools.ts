import { managementRequestSchema, type ManagementRequest } from './managementProtocol';

const revision = { type: 'string', minLength: 40, maxLength: 40, pattern: '^[a-f0-9]{40}$' };
const jobId = { type: 'string', minLength: 32, maxLength: 32, pattern: '^[a-f0-9]{32}$' };
const writes = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };
export const managementTools = [
  { name: 'mahaffeys_prepare_deployment', description: 'Approval required. Fetch an exact commit from the server Git origin/main, build app/CUPS images, and run isolated authorization/privacy/restart checks. Changes test resources only; does not deploy. Returns an asynchronous job ID. A failed check blocks deployment.', inputSchema: { type: 'object' as const, properties: { revision, confirmation: { type: 'string', const: 'RUN VERIFIED TESTS' } }, required: ['revision', 'confirmation'], additionalProperties: false }, annotations: writes },
  { name: 'mahaffeys_management_status', description: 'Read a bounded management-job report. Preparation and deployment run asynchronously; poll this tool for the result. Does not return environment contents, keys, or raw configuration.', inputSchema: { type: 'object' as const, properties: { jobId }, required: ['jobId'], additionalProperties: false }, annotations: { ...writes, readOnlyHint: true, destructiveHint: false, idempotentHint: true } },
  { name: 'mahaffeys_deploy_prepared', description: 'Approval required. Deploy only app and CUPS images/configuration from a successfully verified preparation job, with a fresh baseline check and stopped-service config/cache/spool backups. Brief downtime. No database deployment or volume deletion. Returns an asynchronous job ID.', inputSchema: { type: 'object' as const, properties: { jobId, confirmation: { type: 'string', const: 'DEPLOY APPROVED PLAN' } }, required: ['jobId', 'confirmation'], additionalProperties: false }, annotations: writes },
  { name: 'mahaffeys_rollback_deployment', description: 'Approval required. Restore the recorded previous app/CUPS images and Compose configuration for a deployment job, preserving current named volumes and current queued-document spool. Does not blindly overwrite saved CUPS policies or queue data. Returns an asynchronous job ID.', inputSchema: { type: 'object' as const, properties: { jobId, confirmation: { type: 'string', const: 'ROLLBACK DEPLOYMENT' } }, required: ['jobId', 'confirmation'], additionalProperties: false }, annotations: writes },
];

export function managementRequest(name: string, args: unknown): ManagementRequest {
  if (!args || typeof args !== 'object' || Array.isArray(args) || 'operation' in args || 'action' in args) throw new Error('Invalid management arguments.');
  const action = ({ mahaffeys_prepare_deployment: 'prepare', mahaffeys_management_status: 'status', mahaffeys_deploy_prepared: 'deploy', mahaffeys_rollback_deployment: 'rollback' } as Record<string, string>)[name];
  if (!action) throw new Error('Unknown management operation.');
  return managementRequestSchema.parse({ ...args, operation: 'management', action });
}
