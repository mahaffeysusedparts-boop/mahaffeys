import { describe, expect, it } from 'vitest';
import { DEFAULT_INTAKE_REQUIREMENTS } from '../types/intakeRequirements';
import { intakeRequirementReview } from './intakeRequirements';

const photos = { personPhotoUrl: '/person', idPhotoUrl: '/id', vehiclePhotoUrl: '/vehicle', licensePlatePhotoUrl: '/plate', loadPhotoUrl: '/load' };

describe('administrator-configured intake requirements', () => {
  it('preserves required defaults until an administrator changes them', () => {
    expect(intakeRequirementReview(DEFAULT_INTAKE_REQUIREMENTS, {}).blockers).toEqual(['Intake photos', 'Seller phone', 'Seller address']);
  });
  it('allows missing evidence only when its yard requirement is optional', () => {
    const review = intakeRequirementReview({ requirePhotos: false, requirePhone: false, requireAddress: false }, {});
    expect(review.blockers).toEqual([]);
    expect(review.optionalMissing).toEqual(['Intake photos', 'Seller phone', 'Seller address']);
  });
  it('keeps phone and address required when only photos are disabled', () => {
    const review = intakeRequirementReview({ ...DEFAULT_INTAKE_REQUIREMENTS, requirePhotos: false }, {});
    expect(review.blockers).toEqual(['Seller phone', 'Seller address']);
    expect(review.optionalMissing).toEqual(['Intake photos']);
  });
  it('does not claim optional evidence is missing when it is present', () => {
    expect(intakeRequirementReview({ requirePhotos: false, requirePhone: false, requireAddress: false }, { captures: photos, phone: '5551234567', address: 'Test address' })).toEqual({ blockers: [], optionalMissing: [] });
  });
  it('treats partial photos and blank contact values as missing', () => {
    expect(intakeRequirementReview(DEFAULT_INTAKE_REQUIREMENTS, { captures: { idPhotoUrl: '/id' }, phone: ' ', address: ' ' }).blockers).toHaveLength(3);
  });
});
