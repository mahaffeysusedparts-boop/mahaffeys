import { defineHandler } from 'nitro';
import { createError, getRouterParam } from 'nitro/h3';
import { requireUser } from '../../../utils/auth';
import { toCustomer, type CustomerRow } from '../../../utils/customers';
import { query } from '../../../utils/db';

export default defineHandler(async (event) => {
  await requireUser(event);
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Customer ID is required' });
  const result = await query<CustomerRow>('SELECT * FROM customers WHERE id = $1', [id]);
  if (!result.rows[0]) throw createError({ statusCode: 404, statusMessage: 'Customer not found' });
  return toCustomer(result.rows[0]);
});
