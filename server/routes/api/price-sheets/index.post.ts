import { defineHandler } from 'nitro';
import { readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { importPriceSheet, priceSheetUser, MAX_PDF_BYTES } from '../../../utils/priceSheets';

export default defineHandler(async (event) => {
  const user = await priceSheetUser(event);
  const parsed = z.object({fileName:z.string().min(1).max(200),base64:z.string().max(Math.ceil(MAX_PDF_BYTES/3)*4).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict().safeParse(await readBody(event,{limit:7*1024*1024}));
  if (!parsed.success) throw createError({statusCode:400,statusMessage:'Upload a PDF of at most 5 MB'});
  return importPriceSheet(parsed.data.fileName,Buffer.from(parsed.data.base64,'base64'),user.id);
});
