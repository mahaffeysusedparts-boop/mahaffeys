import { defineHandler } from 'nitro';
import { assertBodySize, readBody, createError } from 'nitro/h3';
import { buyingCommandSchema, buyingUser, executeBuyingCommand } from '../../../utils/scrapBuying';

export default defineHandler(async (event) => {
  const user = await buyingUser(event);
  assertBodySize(event, 8 * 1024 * 1024);
  const parsed = buyingCommandSchema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({statusCode:400,statusMessage:parsed.error.issues[0]?.message ?? 'Invalid buying command'});
  try { return await executeBuyingCommand(parsed.data,user); }
  catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    const code = (error as { code?: string }).code;
    if (code === '23505') throw createError({statusCode:409,statusMessage:'A capture, line, check or payment reference has already been used'});
    throw createError({statusCode:400,statusMessage:error instanceof Error ? error.message : 'Buying request rejected'});
  }
});
