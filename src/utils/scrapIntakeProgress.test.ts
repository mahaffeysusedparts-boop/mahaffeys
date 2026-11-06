import { describe, expect, it } from 'vitest';
import { assessScrapEvidence, scrapIntakeProgress } from './scrapIntakeProgress';
import { DEFAULT_INTAKE_REQUIREMENTS } from '../types/intakeRequirements';
import { INTAKE_PHOTO_FIELDS } from './intakeRequirements';
import type { Ticket } from '../types/scrap';
const requirements = DEFAULT_INTAKE_REQUIREMENTS;
const evidence = { customerName: 'Seller', customerPhone: '555', customerAddress: 'Street', customerIdNumber: 'ID', vehicleLicensePlate: 'ABC', complianceCaptures: Object.fromEntries(INTAKE_PHOTO_FIELDS.map(field => [field, '/saved-photo'])) };
const ticket = (fields: Partial<Ticket> = {}) => ({ ...evidence, id: 'T', createdAt: '2026-01-01T00:00:00Z', selectedWeighingType: 'VEHICLE_IN_OUT', scrapLines: [], ...fields }) as Ticket;
describe('saved evidence assessment', () => {
  it('never infers full identity from an ID number, and identifies individual photos', () => {
    const result = assessScrapEvidence({ ...evidence, complianceCaptures: { idPhotoUrl: '/registered-id', personPhotoUrl: '/person', vehiclePhotoUrl: '/vehicle' } }, requirements, { verified: true });
    expect(result.verified).toBe(false);
    expect(result.summary).toContain('2 photos');
    expect(result.attention.find(issue => issue.key === 'identity')?.unknown).toBe(true);
    expect(result.attention.filter(issue => issue.key.endsWith('PhotoUrl')).map(issue => issue.label)).toEqual(['Plate photo', 'Load photo']);
  });
  it('distinguishes optional gaps, verification failures and requirements changes', () => {
    const optional = { ...requirements, requirePhotos: false, requirePhone: false, requireAddress: false, requireVehiclePlate: false, requireSellerId: false };
    expect(assessScrapEvidence({ customerName: 'Seller' }, optional, { verified: true, identity: false, collection: true }).verified).toBe(true);
    expect(assessScrapEvidence(evidence, optional, { verified: false, identity: true }).verified).toBe(false);
    expect(assessScrapEvidence(evidence, undefined, { verified: true, identity: true }).verified).toBe(false);
    expect(assessScrapEvidence({ customerName: 'Seller' }, requirements, { verified: true, identity: false, collection: true }).attention.length).toBeGreaterThan(1);
  });
});
describe('mode-aware current cycle progress', () => {
  const base = { evidence, requirements, verified: true, identity: true, paymentVerified: true, reviewed: true };
  it('allows incomplete draft handoff and prompts mode selection', () => {
    expect(scrapIntakeProgress({ ...base, collection: true, evidence: { customerName: 'Seller' }, identity: false }).nextAction).toContain('hand off');
    expect(scrapIntakeProgress({ ...base, ticket: ticket({ selectedWeighingType: undefined }) }).nextAction).toContain('Choose weighing type');
  });
  it('inspection pending does not block OUT; missing acknowledgment is a confirmation issue', () => {
    const inProgress = scrapIntakeProgress({ ...base, ticket: ticket({ scaleGrossInWeight: 1000, buying: { version: 1, stage: 'DRAFT', revision: 1, activeCycleId: 'cycle' } }), inspection: 'pending' });
    expect(inProgress.nextAction).toContain('Capture OUT');
    expect(inProgress.blockers.some(issue => issue.label.includes('Acknowledge'))).toBe(false);
    const out = scrapIntakeProgress({ ...base, ticket: ticket({ scaleGrossInWeight: 1000, scaleTareOutWeight: 500 }), inspection: 'unverified' });
    expect(out.nextAction).toContain('confirm this load before purchase review');
    expect(out.blockers.some(issue => issue.label.includes('Acknowledge'))).toBe(true);
    expect(out.steps.find(step => step.label === 'Payment')?.state).not.toBe('current');
  });
  it('previous lines cannot complete the active repeated cycle', () => {
    const result = scrapIntakeProgress({ ...base, ticket: ticket({ scaleGrossInWeight: 1000, scrapLines: [{}] as Ticket['scrapLines'] }), inspection: 'pending' });
    expect(result.steps.find(step => step.label === 'Weigh-out')?.state).toBe('current');
    expect(result.nextAction).toContain('Capture OUT');
  });
  it('platform batches require material confirmation; split groups remain disabled', () => {
    const result = scrapIntakeProgress({ ...base, ticket: ticket({ selectedWeighingType: 'PLATFORM', pendingPlatformCapture: {} as Ticket['pendingPlatformCapture'] }) });
    expect(result.steps.map(step => step.label)).toEqual(['Seller details', 'Photos', 'Weigh batches', 'Review materials', 'Payment']);
    expect(result.nextAction).toContain('confirm this batch');
    expect(scrapIntakeProgress({ ...base, mode: 'SPLIT_GROUPS' }).blockers.some(issue => issue.label.includes('disabled'))).toBe(true);
  });
  it('saved evidence does not change for unsaved corrections and failed saves', () => {
    const result = scrapIntakeProgress({ ...base, ticket: ticket({ scrapLines: [{}] as Ticket['scrapLines'] }), unsaved: true, saveFailed: true });
    expect(result.assessment.verified).toBe(true);
    expect(result.blockers.map(issue => issue.label).join(' ')).toContain('Save not confirmed');
    expect(result.steps.find(step => step.label === 'Payment')?.state).toBe('needs attention');
  });
});
