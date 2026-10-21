import { z } from 'zod';

const revision = z.string().length(40).regex(/^[a-f0-9]{40}$/, 'Use an exact lowercase 40-character Git commit hash.');
const jobId = z.string().length(32).regex(/^[a-f0-9]{32}$/, 'Use a job ID returned by the server.');
export const managementRequestSchema = z.discriminatedUnion('action', [
  z.object({ operation: z.literal('management'), action: z.literal('prepare'), revision, confirmation: z.literal('RUN VERIFIED TESTS') }).strict(),
  z.object({ operation: z.literal('management'), action: z.literal('status'), jobId }).strict(),
  z.object({ operation: z.literal('management'), action: z.literal('deploy'), jobId, confirmation: z.literal('DEPLOY APPROVED PLAN') }).strict(),
  z.object({ operation: z.literal('management'), action: z.literal('rollback'), jobId, confirmation: z.literal('ROLLBACK DEPLOYMENT') }).strict(),
]);
export type ManagementRequest = z.infer<typeof managementRequestSchema>;

export function managementToken(input: ManagementRequest): string {
  const request = managementRequestSchema.parse(input);
  return `mgmt:${request.action}:${request.action === 'prepare' ? request.revision : request.jobId}`;
}
