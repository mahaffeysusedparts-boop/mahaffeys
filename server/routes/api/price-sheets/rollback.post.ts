import { randomUUID } from 'node:crypto';
import { defineHandler } from 'nitro';
import { readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { priceSheetUser } from '../../../utils/priceSheets';
import { withTransaction } from '../../../utils/db';

export default defineHandler(async (event) => {
  const user = await priceSheetUser(event);
  const body = z.object({version:z.string().uuid(),expectedActiveVersion:z.string().uuid()}).safeParse(await readBody(event,{limit:4096}));
  if (!body.success) throw createError({statusCode:400,statusMessage:'Invalid rollback target'});
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(114682)');
    const version = await client.query('SELECT id FROM price_sheet_versions WHERE id=$1',[body.data.version]);
    if (!version.rows[0]) throw createError({statusCode:404,statusMessage:'Published version not found'});
    const update = await client.query('UPDATE price_sheet_active SET version_id=$1,updated_at=NOW() WHERE version_id=$2 RETURNING version_id',[body.data.version,body.data.expectedActiveVersion]);
    if (!update.rows.length) throw createError({statusCode:409,statusMessage:'Active prices changed; refresh history before rollback'});
    await client.query("INSERT INTO price_sheet_publication_events(id,version_id,actor_id,action) VALUES($1,$2,$3,'ROLLBACK')",[randomUUID(),body.data.version,user.id]);
    return {version:body.data.version};
  });
});
