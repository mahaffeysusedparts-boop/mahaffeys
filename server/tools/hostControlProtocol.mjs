export const diagnosticReports = ['containers', 'version', 'storage', 'network', 'cups', 'printer'];
const confirmations = { restart: 'RESTART APP', prepare: 'RUN VERIFIED TESTS', deploy: 'DEPLOY APPROVED PLAN', rollback: 'ROLLBACK DEPLOYMENT' };
export function validateControlRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.action !== 'string') throw new Error('Invalid host-control request.');
  const allowed = {
    capabilities: ['action'], diagnostics: ['action', 'report'], restart: ['action', 'confirmation'],
    prepare: ['action', 'revision', 'confirmation'], deploy: ['action', 'jobId', 'confirmation'],
    rollback: ['action', 'jobId', 'confirmation'], status: ['action', 'jobId'],
  }[value.action];
  if (!allowed || Object.keys(value).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(value, key))) throw new Error('Unsupported action or request fields.');
  if (value.action === 'capabilities') return { type: 'capabilities' };
  if (value.action === 'diagnostics') {
    if (!diagnosticReports.includes(value.report)) throw new Error('Choose a fixed diagnostic report.');
    return { type: 'diagnostics', token: value.report };
  }
  if (confirmations[value.action] && value.confirmation !== confirmations[value.action]) throw new Error('The exact action confirmation is required.');
  if (value.action === 'restart') return { type: 'management', token: 'mgmt:restart:mahaffeys' };
  const target = value.action === 'prepare' ? value.revision : value.jobId;
  const length = value.action === 'prepare' ? 40 : 32;
  const pattern = value.action === 'prepare' ? /^[a-f0-9]{40}$/ : /^[a-f0-9]{32}$/;
  if (typeof target !== 'string' || target.length !== length || !pattern.test(target)) throw new Error('Use an exact commit or a server-generated job ID.');
  return { type: 'management', token: `mgmt:${value.action}:${target}` };
}
export function isControlWrite(value) {
  return ['restart', 'prepare', 'deploy', 'rollback'].includes(value?.action);
}
