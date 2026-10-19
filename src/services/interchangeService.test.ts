import { describe, expect, it } from 'vitest';
import { interchangeService, matchesInterchangeModel, type InterchangeMapping } from './interchangeService';
import type { PullYardVehicle } from '@/types/scrap';

// Synthetic test applications only; never used as a real fitment catalogue.
const mapping: InterchangeMapping = {
  id: 'synthetic', partName: 'TEST COMPONENT', partCategory: 'TEST', interchangeCode: 'NOT-REAL-FITMENT', description: 'Synthetic fixture',
  compatibleModels: [
    { make: 'TEST MAKE', model: 'F-150', startYear: 2005, endYear: 2008, notes: 'TEST ONLY' },
    { make: 'OTHER TEST MAKE', model: 'TEST MODEL', startYear: 2004, endYear: 2009 },
  ],
};
const vehicle = (status: PullYardVehicle['status']) => ({ id: 'test-car', make: 'TEST MAKE', model: 'F-150', year: 2007, status } as PullYardVehicle);

describe('parts interchange vehicle matching', () => {
  it('retains every model in a matching group even with no yard vehicles', () => {
    const matches = interchangeService.findInterchangeForVehicle('test make', 'F150', 2007, [mapping]);
    expect(matches).toHaveLength(1);
    expect(matches[0].compatibleModels).toHaveLength(2);
    expect(interchangeService.findMatchingDonorVehicles('TEST MAKE', 'F150', 2007, [], [mapping])).toEqual([]);
  });
  it('does not turn partial model names into fitment', () => {
    expect(matchesInterchangeModel('TEST MAKE', 'F-15', 2007, mapping.compatibleModels[0])).toBe(false);
    expect(matchesInterchangeModel('TEST', 'F150', 2007, mapping.compatibleModels[0])).toBe(false);
    expect(matchesInterchangeModel('TEST MAKE', 'F150 Raptor', 2007, mapping.compatibleModels[0])).toBe(false);
  });
  it('requires a complete vehicle and an in-range year', () => {
    expect(interchangeService.findInterchangeForVehicle('', '', 2007, [mapping])).toEqual([]);
    expect(interchangeService.findInterchangeForVehicle('TEST MAKE', 'F150', 2009, [mapping])).toEqual([]);
    expect(interchangeService.findInterchangeForVehicle('TEST MAKE', 'F150', NaN, [mapping])).toEqual([]);
  });
  it('excludes crushed vehicles without hiding other compatible models', () => {
    const donors = interchangeService.findMatchingDonorVehicles('TEST MAKE', 'F150', 2007, [vehicle('CRUSHED'), { ...vehicle('AVAILABLE'), id: 'available' }], [mapping]);
    expect(donors).toHaveLength(1);
    expect(donors[0].vehicle.id).toBe('available');
    expect(donors[0].interchangeItem.compatibleModels).toHaveLength(2);
  });
  it('does not invent interchange data from the target vehicle', () => {
    expect(interchangeService.getInterchangeMappings()).toEqual([]);
    expect(interchangeService.findInterchangeForVehicle('Ford', 'F150', 2007)).toEqual([]);
  });
});
