import { describe, expect, it } from 'vitest';
import { aggregateSplitPass, normalizeWeight, platformWeights, splitCycleNet, validatedBreakdown, validateScaleReading } from './weighingContract';
import type { SplitProfile, WeightCapture, WeightPass } from '../types/scrapBuying';

const profile: SplitProfile = {
  id: 'installation-profile', version: 1, scaleId: 'truck-scale',
  components: [{ id: 'front', label: 'Front axle group' }, { id: 'rear', label: 'Rear axle group' }],
  operatingInstructions: 'Follow installation-specific positioning instructions.',
  suitabilityConfirmation: {
    confirmedBy: 'reviewer', confirmedAt: '2026-01-01T12:00:00Z',
    manufacturerReference: 'test manufacturer reference', authorityReference: 'test authority reference',
  },
};

function capture(id: string, lbs: number): WeightCapture {
  return { id, originalWeight: lbs, originalUnit: 'LBS', normalizedLbs: lbs,
    scaleId: 'truck-scale', actorId: 'operator', capturedAt: '2026-01-01T12:00:00Z', source: 'SCALE', stable: true };
}
function pass(purpose: 'LOADED' | 'TARE', ids: string[]): WeightPass {
  return { id: purpose, purpose, layout: 'COMPONENTS', profile, reviewed: true,
    components: ids.map((id, index) => ({ componentId: index === 0 ? 'front' : 'rear', captureId: id })) };
}
const captures = [capture('loaded-front', 5000), capture('loaded-rear', 8000), capture('tare-front', 3000), capture('tare-rear', 4000)];
const loaded = pass('LOADED', ['loaded-front', 'loaded-rear']);
const tare = pass('TARE', ['tare-front', 'tare-rear']);

describe('validated weighing calculation contract', () => {
  it('converts kilograms using the exact pound definition', () => {
    expect(normalizeWeight(0.45359237, 'KG')).toBeCloseTo(1, 5);
    expect(normalizeWeight(1, 'KG')).toBe(2.204623);
    expect(normalizeWeight(123.4, 'LBS')).toBe(123.4);
  });
  it.each([NaN, Infinity, -1, 1000000001])('rejects invalid readings: %s', (weight) => {
    expect(() => normalizeWeight(weight, 'LBS')).toThrow();
  });
  it('rejects invalid net and deduction instead of zero-clamping', () => {
    expect(() => validatedBreakdown(100, 101, 0, 1)).toThrow('Tare');
    expect(() => validatedBreakdown(100, -1, 0, 1)).toThrow();
    expect(() => validatedBreakdown(100, 0, 101, 1)).toThrow('Deduction');
    expect(() => validatedBreakdown(100, 0, NaN, 1)).toThrow();
    expect(() => validatedBreakdown(100, 0, 0, -1)).toThrow('Rate');
    expect(() => validatedBreakdown(1000000000, 0, 0, 1000000000)).toThrow('financial precision');
  });
  it('rounds deductions/payable pounds to tenths and money half-up to cents', () => {
    expect(validatedBreakdown(100, 10, 5, 0.125)).toEqual({ grossWeight: 100, tareWeight: 10,
      netWeight: 90, deductionPercent: 5, deductionLbs: 4.5, billableWeight: 85.5, ratePerLb: 0.125, lineTotal: 10.69 });
    expect(validatedBreakdown(1, 0, 0, 1.005).lineTotal).toBe(1.01);
    expect(validatedBreakdown(0.04, 0, 100, 1).billableWeight).toBe(0);
  });
  it('subtracts scale-applied tare exactly once regardless of display basis', () => {
    expect(platformWeights(110, 10, 'GROSS', 'SCALE_TARE')).toEqual({ grossLbs: 110, tareLbs: 10, netLbs: 100 });
    expect(platformWeights(100, 10, 'NET', 'SCALE_TARE')).toEqual({ grossLbs: 110, tareLbs: 10, netLbs: 100 });
    expect(() => platformWeights(100, 10, 'NET', 'MANUAL')).toThrow();
    expect(() => platformWeights(100, 10, 'GROSS', 'NONE')).toThrow();
  });
  it('enforces configured scale capacity and resolution', () => {
    expect(() => validateScaleReading(13000, 10000)).toThrow('capacity');
    expect(() => validateScaleReading(101, 10000, 20)).toThrow('resolution');
    expect(() => validateScaleReading(100, 10000, 0)).toThrow('resolution');
    expect(() => validateScaleReading(100, 10000, 20)).not.toThrow();
  });
});

describe('split weighing validation (not commercial activation)', () => {
  it('sums the loaded/tare components once and returns 6000 lb net', () => {
    expect(aggregateSplitPass(loaded, captures, 'truck-scale').subtotalLbs).toBe(13000);
    expect(aggregateSplitPass(tare, captures, 'truck-scale').subtotalLbs).toBe(7000);
    expect(splitCycleNet(loaded, tare, captures, 'truck-scale', true)).toBe(6000);
  });
  it('labels a running subtotal incomplete until all components exist', () => {
    const incomplete = { ...loaded, components: loaded.components.slice(0, 1) };
    expect(aggregateSplitPass(incomplete, captures, 'truck-scale')).toMatchObject({ subtotalLbs: 5000, complete: false, reviewed: false });
    expect(() => splitCycleNet(incomplete, tare, captures, 'truck-scale', true)).toThrow('complete');
  });
  it('blocks unreviewed passes', () => {
    expect(() => splitCycleNet({ ...loaded, reviewed: false }, tare, captures, 'truck-scale', true)).toThrow('reviewed');
  });
  it('rejects duplicate components, reused captures and unknown components', () => {
    const duplicate = { ...loaded, components: [loaded.components[0], loaded.components[0]] };
    expect(() => aggregateSplitPass(duplicate, captures, 'truck-scale')).toThrow('Duplicate');
    expect(() => aggregateSplitPass({ ...loaded, components: [{ componentId: 'front', captureId: 'loaded-front' }, { componentId: 'rear', captureId: 'loaded-front' }] }, captures, 'truck-scale')).toThrow();
    expect(() => aggregateSplitPass({ ...loaded, components: [{ componentId: 'whole-total', captureId: 'loaded-front' }] }, captures, 'truck-scale')).toThrow();
    expect(() => splitCycleNet(loaded, pass('TARE', ['loaded-front', 'loaded-rear']), captures, 'truck-scale', true)).toThrow('reused');
  });
  it('rejects mismatched profiles and whole-total/component double counting', () => {
    expect(() => splitCycleNet(loaded, { ...tare, profile: { ...profile, version: 2 } }, captures, 'truck-scale', true)).toThrow('matching');
    expect(() => aggregateSplitPass({ ...loaded, layout: 'WHOLE_VEHICLE' }, captures, 'truck-scale')).toThrow('incompatible');
    expect(() => aggregateSplitPass(loaded, captures, 'other-scale')).toThrow('incompatible');
  });
  it('rejects missing, non-finite, negative, conflicting and unstable captures', () => {
    expect(() => aggregateSplitPass(loaded, captures.slice(1), 'truck-scale')).toThrow('Missing');
    for (const lbs of [NaN, -1, Infinity]) {
      expect(() => aggregateSplitPass(loaded, [capture('loaded-front', lbs), ...captures.slice(1)], 'truck-scale')).toThrow();
    }
    expect(() => aggregateSplitPass(loaded, [{ ...captures[0], normalizedLbs: 5001 }, ...captures.slice(1)], 'truck-scale')).toThrow('normalization');
    expect(() => aggregateSplitPass(loaded, [{ ...captures[0], stable: false }, ...captures.slice(1)], 'truck-scale')).toThrow('unstable');
    expect(() => aggregateSplitPass(loaded, [...captures, captures[0]], 'truck-scale')).toThrow('Duplicate capture');
  });
  it('uses a linked reweigh in place of the original capture', () => {
    const revision = { ...capture('loaded-front-reweigh', 5100), replacesCaptureId: 'loaded-front' };
    const history = [...captures, revision];
    expect(() => aggregateSplitPass(loaded, history, 'truck-scale')).toThrow('superseded');
    const revised = { ...loaded, components: [{ componentId: 'front', captureId: revision.id }, loaded.components[1]] };
    expect(aggregateSplitPass(revised, history, 'truck-scale').subtotalLbs).toBe(13100);
    expect(history).toHaveLength(5);
  });
  it('rejects a negative cycle net and component capacity violations', () => {
    expect(() => splitCycleNet(pass('LOADED', ['tare-front', 'tare-rear']), pass('TARE', ['loaded-front', 'loaded-rear']), captures, 'truck-scale', true)).toThrow('Tare');
    expect(() => aggregateSplitPass(loaded, captures, 'truck-scale', 6000)).toThrow('capacity');
  });
  it('blocks unapproved commercial completion but allows a non-payable test calculation', () => {
    const unapproved = { ...profile, suitabilityConfirmation: undefined };
    const testLoaded = { ...loaded, profile: unapproved };
    const testTare = { ...tare, profile: unapproved };
    expect(() => splitCycleNet(testLoaded, testTare, captures, 'truck-scale', true)).toThrow('suitability');
    expect(splitCycleNet(testLoaded, testTare, captures, 'truck-scale', false)).toBe(6000);
  });
});
