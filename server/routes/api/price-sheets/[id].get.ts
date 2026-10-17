import { defineHandler } from 'nitro';
import { getRouterParam, createError } from 'nitro/h3';
import { z } from 'zod';
import { getDraft, priceSheetUser } from '../../../utils/priceSheets';

export default defineHandler(async (event) => {
  await priceSheetUser(event);
  const id = z.string().uuid().safeParse(getRouterParam(event,'id'));
  if (!id.success) throw createError({statusCode:400,statusMessage:'Invalid document ID'});
  return getDraft(id.data);
});
