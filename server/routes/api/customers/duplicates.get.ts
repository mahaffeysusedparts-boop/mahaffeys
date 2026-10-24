import { defineHandler } from 'nitro';
import { requireUser } from '../../../utils/auth';
import { findCustomerDuplicateGroups } from '../../../utils/customerDuplicates';
import { toCustomer, type CustomerRow } from '../../../utils/customers';
import { query } from '../../../utils/db';

export default defineHandler(async (event) => {
  await requireUser(event);
  const result = await query<CustomerRow>('SELECT * FROM customers ORDER BY created_at ASC');
  return findCustomerDuplicateGroups(result.rows).map(group => ({
    customers: group.customers.map(toCustomer),
    reasons: group.reasons,
    suggestedKeepId: [...group.customers].sort((a, b) => {
      const completeness = (row: CustomerRow) => [row.id_number, row.phone, row.address, row.id_photo_url, row.vehicle_license_plate, row.notes, row.is_commercial && row.company_name, row.is_commercial && row.business_address].filter(Boolean).length;
      return completeness(b) - completeness(a) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    })[0].id,
  }));
});
