import { randomUUID } from 'node:crypto';
import { createError } from 'nitro/h3';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { toCustomer, type CustomerRow, CUSTOMER_ID_TYPES } from './customers';

export const intakeSellerProfileSchema = z.object({
  selectedId: z.string().min(1).max(120).optional(), confirmedProfile: z.record(z.unknown()).optional(),
  input: z.object({ fullName: z.string().trim().min(1).max(160), phone: z.string().trim().max(80),
    idType: z.enum(CUSTOMER_ID_TYPES), idNumber: z.string().trim().max(120), idState: z.string().trim().max(40),
    address: z.string().trim().max(500), vehicleLicensePlate: z.string().trim().max(80).optional(),
    vehicleState: z.string().trim().max(40).optional(), notes: z.string().max(1000).optional(),
    idPhotoUrl: z.string().max(1000000).optional(), isCommercial: z.boolean(),
    companyName: z.string().trim().max(180).optional(), businessAddress: z.string().trim().max(500).optional() }).strict(),
}).strict().superRefine(({ input }, context) => {
  if (input.idNumber && !input.idState) context.addIssue({ code: 'custom', message: 'Confirm the ID issuing jurisdiction' });
  if (input.isCommercial && !input.companyName) context.addIssue({ code: 'custom', message: 'Company name is required' });
});
export async function persistIntakeSeller(client: PoolClient, profile: z.infer<typeof intakeSellerProfileSchema>) {
  const input = profile.input;
  const id = profile.selectedId ?? `cust-${randomUUID()}`;
  let previous: CustomerRow | undefined;
  if (profile.selectedId) {
    previous = (await client.query<CustomerRow>('SELECT * FROM customers WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!previous) throw createError({ statusCode: 409, statusMessage: 'Seller profile no longer exists. Review the seller selection.' });
    const current = toCustomer(previous);
    const confirmed = profile.confirmedProfile;
    const keys = ['id', 'fullName', 'phone', 'idType', 'idNumber', 'idState', 'address', 'vehicleLicensePlate', 'vehicleState', 'notes', 'idPhotoUrl', 'isCommercial', 'companyName', 'businessAddress'] as const;
    if (!confirmed || keys.some(key => (current[key] ?? '') !== (confirmed[key] ?? ''))) {
      throw createError({ statusCode: 409, statusMessage: 'Seller profile changed on another workstation. Review the registered seller again before saving.' });
    }
  }
  const plate = input.vehicleLicensePlate?.toUpperCase() ?? '';
  const plates = new Set(Array.isArray(previous?.captured_plates) ? previous.captured_plates.filter(value => typeof value === 'string') : []);
  if (plate) plates.add(plate);
  await client.query(`INSERT INTO customers(id,full_name,phone,id_type,id_number,id_state,address,vehicle_license_plate,vehicle_state,notes,id_photo_url,captured_plates,is_commercial,company_name,business_address)
    VALUES($1,$2,$3,$4,$5,$6,$7,NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),$11,$12::jsonb,$13,NULLIF($14,''),NULLIF($15,''))
    ON CONFLICT(id) DO UPDATE SET full_name=EXCLUDED.full_name,phone=EXCLUDED.phone,id_type=EXCLUDED.id_type,id_number=EXCLUDED.id_number,id_state=EXCLUDED.id_state,address=EXCLUDED.address,
    vehicle_license_plate=EXCLUDED.vehicle_license_plate,vehicle_state=EXCLUDED.vehicle_state,notes=EXCLUDED.notes,id_photo_url=EXCLUDED.id_photo_url,captured_plates=EXCLUDED.captured_plates,
    is_commercial=EXCLUDED.is_commercial,company_name=EXCLUDED.company_name,business_address=EXCLUDED.business_address,updated_at=NOW()`,
  [id,input.fullName,input.phone,input.idType,input.idNumber,input.idState.toUpperCase(),input.address,plate,input.vehicleState ?? '',input.notes ?? '',input.idPhotoUrl ?? null,JSON.stringify([...plates]),input.isCommercial,input.companyName ?? '',input.businessAddress ?? '']);
  return { customerId: id, customerName: input.fullName, customerPhone: input.phone || undefined, customerAddress: input.address || undefined,
    customerIdNumber: input.idNumber || undefined, vehicleLicensePlate: plate || undefined };
}
