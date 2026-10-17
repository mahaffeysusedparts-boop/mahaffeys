import { defineHandler } from 'nitro';
import { getRouterParam, createError } from 'nitro/h3';
import { z } from 'zod';
import { query } from '../../../../utils/db';
import { priceSheetUser } from '../../../../utils/priceSheets';

export default defineHandler(async (event) => {
  await priceSheetUser(event);
  const id = z.string().uuid().safeParse(getRouterParam(event,'id'));
  if (!id.success) throw createError({statusCode:400,statusMessage:'Invalid document ID'});
  const result = await query('SELECT content FROM price_sheet_documents WHERE id=$1',[id.data]);
  if (!result.rows[0]) throw createError({statusCode:404,statusMessage:'Private original not found'});
  return new Response(new Uint8Array(result.rows[0].content),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="original-price-sheet.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; frame-ancestors 'self'"}});
});
