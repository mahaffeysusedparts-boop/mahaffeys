import { defineHandler } from 'nitro';
import { createError, readBody } from 'nitro/h3';
import { requireUser } from '../../../utils/auth';
import { auditFor, recordAudit } from '../../../utils/audit';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState, stateValue, putState } from '../../../utils/financialState';
import { toCustomer, type CustomerRow } from '../../../utils/customers';

export default defineHandler(async (event) => {
  const user = await requireUser(event);
  if (!['admin', 'yard_manager'].includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Merging seller profiles requires a manager or administrator' });
  }
  const body = await readBody<{ customerIds?: unknown }>(event);
  if (!Array.isArray(body?.customerIds) || body.customerIds.length < 2 || body.customerIds.length > 50 || body.customerIds.some(id => typeof id !== 'string') || new Set(body.customerIds).size !== body.customerIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Select between two and fifty unique customer profiles' });
  }

  const result = await withTransaction(async client => {
    await lockFinancialState(client);
    const selected = await client.query<CustomerRow>('SELECT * FROM customers WHERE id = ANY($1::text[]) FOR UPDATE', [body.customerIds]);
    if (selected.rows.length !== body.customerIds.length) {
      throw createError({ statusCode: 404, statusMessage: 'One or more selected customer profiles no longer exist' });
    }
    const completeness = (row: CustomerRow) => [row.id_number, row.phone, row.address, row.id_photo_url, row.vehicle_license_plate, row.notes, row.is_commercial && row.company_name, row.is_commercial && row.business_address].filter(Boolean).length;
    const ordered = [...selected.rows].sort((a, b) => completeness(b) - completeness(a) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const keep = ordered[0];
    const merged = {
      fullName: keep.full_name,
      phone: ordered.find(row => row.phone)?.phone ?? '',
      idType: ordered.find(row => row.id_number)?.id_type ?? keep.id_type,
      idNumber: ordered.find(row => row.id_number)?.id_number ?? '',
      idState: ordered.find(row => row.id_number)?.id_state ?? keep.id_state,
      address: ordered.find(row => row.address)?.address ?? '',
      vehicleLicensePlate: ordered.find(row => row.vehicle_license_plate)?.vehicle_license_plate ?? null,
      vehicleState: ordered.find(row => row.vehicle_state)?.vehicle_state ?? null,
      notes: ordered.find(row => row.notes)?.notes ?? null,
      idPhotoUrl: ordered.find(row => row.id_photo_url)?.id_photo_url ?? null,
      isCommercial: ordered.some(row => row.is_commercial),
      companyName: ordered.find(row => row.company_name)?.company_name ?? null,
      businessAddress: ordered.find(row => row.business_address)?.business_address ?? null,
      capturedPlates: [...new Set(ordered.flatMap(row => Array.isArray(row.captured_plates) ? row.captured_plates.filter((plate): plate is string => typeof plate === 'string') : []))],
      totalPayouts: ordered.reduce((sum, row) => sum + Number(row.total_payouts || 0), 0),
      totalWeightLbs: ordered.reduce((sum, row) => sum + Number(row.total_weight_lbs || 0), 0),
    };
    await client.query(`UPDATE customers SET
      full_name=$2, phone=$3, id_type=$4, id_number=$5, id_state=$6, address=$7,
      vehicle_license_plate=$8, vehicle_state=$9, notes=$10, id_photo_url=$11,
      captured_plates=$12::jsonb, is_commercial=$13, company_name=$14,
      business_address=$15, total_payouts=$16, total_weight_lbs=$17, updated_at=NOW()
      WHERE id=$1`, [keep.id, merged.fullName, merged.phone, merged.idType, merged.idNumber, merged.idState, merged.address,
      merged.vehicleLicensePlate, merged.vehicleState, merged.notes, merged.idPhotoUrl, JSON.stringify(merged.capturedPlates),
      merged.isCommercial, merged.companyName, merged.businessAddress, merged.totalPayouts, merged.totalWeightLbs]);

    const ids = selected.rows.map(row => row.id);
    const tickets = await stateValue<Array<Record<string, unknown>>>(client, 'mahaffeys_tickets', []);
    await putState(client, 'mahaffeys_tickets', tickets.map(ticket => ids.includes(String(ticket.customerId)) ? { ...ticket, customerId: keep.id } : ticket), user.id);
    await client.query(`UPDATE scrap_buying_tickets
      SET document=jsonb_set(document, '{customerId}', to_jsonb($1::text), true), updated_at=NOW()
      WHERE document->>'customerId'=ANY($2::text[])`, [keep.id, ids]);
    await client.query('DELETE FROM customers WHERE id = ANY($1::text[]) AND id <> $2', [ids, keep.id]);
    return client.query<CustomerRow>('SELECT * FROM customers WHERE id=$1', [keep.id]);
  });
  const customer = toCustomer(result.rows[0]);
  await recordAudit(auditFor(user, { action: 'customer.merge', entity: 'customer', entityId: customer.id,
    detail: { mergedCustomerIds: body.customerIds.filter(id => id !== customer.id) } }));
  return customer;
});
