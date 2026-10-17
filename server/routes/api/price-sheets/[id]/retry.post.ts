import { defineHandler } from 'nitro';
import { getRouterParam, readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { retryPriceSheet, priceSheetUser } from '../../../../utils/priceSheets';

export default defineHandler(async (event) => {
  await priceSheetUser(event);
  const id = z.string().uuid().safeParse(getRouterParam(event,'id'));
  const body = z.object({revision:z.number().int().positive(),discardDraft:z.literal(true)}).safeParse(await readBody(event,{limit:4096}));
  if (!id.success || !body.success) throw createError({statusCode:400,statusMessage:'Explicitly confirm replacement of the extraction draft'});
  return retryPriceSheet(id.data,body.data.revision);
});
