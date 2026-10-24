import { describe, expect, it } from 'vitest';
import { findCustomerDuplicateGroups } from './customerDuplicates';
import type { CustomerRow } from './customers';

const row = (id: string, full_name: string, phone: string, id_number: string): CustomerRow => ({
  id, full_name, phone, id_type: 'Driver License', id_number, id_state: 'SC', address: '',
  vehicle_license_plate: null, vehicle_state: null, notes: null, created_at: '2026-01-01T00:00:00Z',
  total_payouts: 0, total_weight_lbs: 0, id_photo_url: null, captured_plates: [], is_commercial: false,
  company_name: null, business_address: null,
});

describe('customer duplicate suggestions', () => {
  it('flags matching IDs, phone numbers, and similar names with reasons', () => {
    const groups = findCustomerDuplicateGroups([
      row('1', 'Alex Johnson', '(555) 123-4567', 'DL-900'),
      row('2', 'Alex Jonson', '5551234567', 'DL 900'),
      row('3', 'Different Person', '5559990000', 'OTHER'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].customers.map(customer => customer.id)).toEqual(['1', '2']);
    expect(groups[0].reasons).toEqual(expect.arrayContaining(['Same ID number', 'Same phone number', 'Similar name']));
  });

  it('does not flag unrelated sellers as duplicates', () => {
    expect(findCustomerDuplicateGroups([
      row('1', 'Alex Johnson', '5551234567', 'DL-900'),
      row('2', 'Morgan Lee', '5559990000', 'DL-300'),
    ])).toEqual([]);
  });
});
