import { describe, expect, it } from 'vitest';
import { interchangeService, matchesDonorApplication, matchesInterchangeModel, type InterchangeMapping } from './interchangeService';
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
  it('excludes known engine and fuel mismatches but retains unknown-engine candidates', () => {
    const application = { ...mapping.compatibleModels[0], engineLiters: 5.4, engineCylinders: 8, fuelType: 'gas' as const };
    const donor = vehicle('AVAILABLE');
    expect(matchesDonorApplication(donor, application)).toBe(true);
    expect(matchesDonorApplication({ ...donor, engineSizeLiters: 4.6 }, application)).toBe(false);
    expect(matchesDonorApplication({ ...donor, engineSizeLiters: 5.4, engineCylinders: 6 }, application)).toBe(false);
    expect(matchesDonorApplication({ ...donor, fuelType: 'Diesel' }, application)).toBe(false);
    expect(matchesDonorApplication({ ...donor, engineSizeLiters: 5.4, engineCylinders: 8, fuelType: 'Gasoline' }, application)).toBe(true);
    expect(matchesDonorApplication({ ...donor, fuelType: 'Gasoline' }, { ...application, fuelType: 'diesel' })).toBe(false);
    expect(matchesDonorApplication(vehicle('CRUSHED'), application)).toBe(false);
  });
  it('filters the customer engine without hiding applications on other makes', () => {
    const catalog = [{ ...mapping, compatibleModels: [{ ...mapping.compatibleModels[0], engineLiters: 5.4 }, mapping.compatibleModels[1]] }];
    expect(interchangeService.findInterchangeForVehicle('TEST MAKE', 'F150', 2007, catalog, 4.6)).toEqual([]);
    expect(interchangeService.findInterchangeForVehicle('TEST MAKE', 'F150', 2007, catalog, 5.4)[0].compatibleModels).toHaveLength(2);
    expect(interchangeService.findInterchangeForVehicle('TEST MAKE', 'F150', 2007, catalog)).toHaveLength(1);
  });
  it('does not invent interchange data from the target vehicle', () => {
    expect(interchangeService.getInterchangeMappings()).toEqual([]);
    expect(interchangeService.findInterchangeForVehicle('Ford', 'F150', 2007)).toEqual([]);
  });
});
