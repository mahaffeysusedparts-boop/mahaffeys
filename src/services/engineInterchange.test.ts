import { describe, expect, it } from 'vitest';
import { matchesDonorApplication, matchesPartIdentifier, type InterchangeMapping, type InterchangeYardVehicle } from './interchangeService';
import { listedEngineCodes } from '@/utils/engineIdentifiers';
import { engineSwapGuides } from '@/components/inventory/EngineCompatibilityPanel';

const item: InterchangeMapping = { id: 'test', partName: 'Engine', partCategory: 'TEST', interchangeCode: 'TEST-PART', description: 'Test only', fitmentScope: 'long-block', engineCodes: ['LM7'], specifications: { 'Block Cast #': 'TEST-CAST' }, compatibleModels: [{ make: 'TEST MAKE', model: 'TEST MODEL', startYear: 2000, endYear: 2005, engineLiters: 5.3 }] };
const donor: InterchangeYardVehicle = { id: 'test', make: 'TEST MAKE', model: 'TEST MODEL', year: 2004, section: 'GM & Chevrolet', status: 'AVAILABLE', color: '', engineSizeLiters: 5.3 };

describe('engine donor screening', () => {
  it('does not treat same displacement but a known different engine code as a replacement lead', () => {
    expect(matchesDonorApplication({ ...donor, engineModel: 'LM7' }, item.compatibleModels[0], item)).toBe(true);
    expect(matchesDonorApplication({ ...donor, engineModel: 'LC9' }, item.compatibleModels[0], item)).toBe(false);
    expect(matchesDonorApplication(donor, item.compatibleModels[0], item)).toBe(true);
    expect(matchesDonorApplication({ ...donor, engineModel: 'Not identified' }, item.compatibleModels[0], item)).toBe(true);
  });
  it('recognizes explicit codes without manufacturing codes from partial strings or displacement', () => {
    expect(listedEngineCodes('LM7 / L59')).toEqual(['LM7', 'L59']);
    expect(listedEngineCodes('5.3L L84-special')).toEqual(['L84']);
    expect(listedEngineCodes('UNKNOWNLM7 5.3L')).toEqual([]);
  });
  it('filters source identifiers without inventing missing evidence', () => {
    expect(matchesPartIdentifier(item, 'test-cast')).toBe(true);
    expect(matchesPartIdentifier(item, 'test-part')).toBe(true);
    expect(matchesPartIdentifier(item, '')).toBe(true);
    expect(matchesPartIdentifier(item, 'unrecorded-cast')).toBe(false);
  });
  it('keeps swap references separate from donor mappings and preserves the ATK legal warning', () => {
    const upgrade = engineSwapGuides.find((guide) => guide.id === 'atk-buick-305-upgrade')!;
    expect(upgrade.qualification).toContain('not legal for pollution-controlled vehicles');
    expect(upgrade.qualification).toContain('5.0L/305');
    expect(upgrade.applications.every((application) => application.make === 'Buick')).toBe(true);
    expect(engineSwapGuides.some((guide) => guide.id === item.id)).toBe(false);
  });
});
