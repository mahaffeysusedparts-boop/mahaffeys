import { describe, expect, it } from 'vitest';
import { DEFAULT_INTAKE_REQUIREMENTS, normalizeIntakeRequirements } from '../types/intakeRequirements';
import { intakeRequirementReview } from './intakeRequirements';

const photos = { personPhotoUrl: '/person', idPhotoUrl: '/id', vehiclePhotoUrl: '/vehicle', licensePlatePhotoUrl: '/plate', loadPhotoUrl: '/load' };
const identityEvidence = {sellerIdAvailable:true,plate:'TEST',reviewed:true};
const optional = {...DEFAULT_INTAKE_REQUIREMENTS,requirePhotos:false,requirePhone:false,requireAddress:false,requireSellerId:false,requireVehiclePlate:false,requireExplicitReview:false};

describe('administrator-configured intake requirements', () => {
  it('defaults all requirements on and preserves older false values', () => {
    expect(normalizeIntakeRequirements({requirePhotos:false,requirePhone:false,requireAddress:false})).toMatchObject({requirePhotos:false,requirePhone:false,requireAddress:false,requireSellerId:true,requireVehiclePlate:true,requireExplicitReview:true});
    expect(normalizeIntakeRequirements(optional)).toEqual(optional);
    expect(intakeRequirementReview(DEFAULT_INTAKE_REQUIREMENTS, {}).blockers).toHaveLength(6);
  });
  it.each(Array.from({length:8},(_,mask)=>mask))('independently enforces ID/plate/review combination %s',mask=>{
    const flags = {...optional,requireSellerId:!!(mask&1),requireVehiclePlate:!!(mask&2),requireExplicitReview:!!(mask&4)};
    const review = intakeRequirementReview(flags,{});
    expect(review.blockers).toEqual([
      ...(flags.requireSellerId ? ['Seller ID and issuing jurisdiction'] : []),
      ...(flags.requireVehiclePlate ? ['Vehicle plate'] : []),
      ...(flags.requireExplicitReview ? ['Explicit purchase review'] : []),
    ]);
    expect(intakeRequirementReview(flags,identityEvidence).blockers).toEqual([]);
  });
  it('allows missing evidence only when its yard requirement is optional', () => {
    expect(intakeRequirementReview(optional, {})).toEqual({blockers:[],optionalMissing:['Intake photos','Seller phone','Seller address','Seller ID and issuing jurisdiction','Vehicle plate','Explicit purchase review']});
  });
  it('keeps phone and address required independently of photos and identity', () => {
    const review = intakeRequirementReview({ ...optional, requirePhone:true,requireAddress:true }, {});
    expect(review.blockers).toEqual(['Seller phone', 'Seller address']);
  });
  it('does not claim supplied optional evidence is missing', () => {
    expect(intakeRequirementReview(optional, { captures: photos, phone: '5551234567', address: 'Test address',...identityEvidence })).toEqual({ blockers: [], optionalMissing: [] });
  });
  it('an ID photo does not establish ID details and ID details do not replace photos',()=>{
    expect(intakeRequirementReview(DEFAULT_INTAKE_REQUIREMENTS,{captures:photos,...identityEvidence,sellerIdAvailable:false}).blockers).toContain('Seller ID and issuing jurisdiction');
    expect(intakeRequirementReview(DEFAULT_INTAKE_REQUIREMENTS,identityEvidence).blockers).toContain('Intake photos');
  });
  it('treats partial photos and whitespace contact/plate values as missing', () => {
    expect(intakeRequirementReview(DEFAULT_INTAKE_REQUIREMENTS, { captures: { idPhotoUrl: '/id' }, phone: ' ', address: ' ',plate:' ',sellerIdAvailable:true,reviewed:true }).blockers).toHaveLength(4);
  });
});
