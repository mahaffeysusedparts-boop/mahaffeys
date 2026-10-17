import { defineHandler } from 'nitro';
import { getRouterParam, readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { getDraft, draftEditSchema, priceSheetUser } from '../../../utils/priceSheets';
import { withTransaction } from '../../../utils/db';

export default defineHandler(async (event) => {
  const user = await priceSheetUser(event);
  const id = z.string().uuid().safeParse(getRouterParam(event,'id'));
  const body = draftEditSchema.safeParse(await readBody(event,{limit:2*1024*1024}));
  if (!id.success || !body.success) throw createError({statusCode:400,statusMessage:'Invalid review draft; maximum 500 rows'});
  if (new Set(body.data.rows.map((row) => row.id)).size !== body.data.rows.length) throw createError({statusCode:400,statusMessage:'Duplicate draft row IDs'});
  await withTransaction(async (client) => {
    const saved = await client.query(`UPDATE price_sheet_drafts SET rows=$3::jsonb,revision=revision+1,status='REVIEW',error=NULL,updated_at=NOW()
      WHERE id=$1 AND revision=$2 AND status<>'PROCESSING' RETURNING id`,[id.data,body.data.revision,JSON.stringify(body.data.rows)]);
    if (!saved.rows.length) throw createError({statusCode:409,statusMessage:'Draft changed or is processing. Reload explicitly before saving your review.'});
    await client.query('INSERT INTO price_sheet_draft_revisions(document_id,revision,rows,warnings,status,actor_id) SELECT id,revision,rows,warnings,status,$2 FROM price_sheet_drafts WHERE id=$1',[id.data,user.id]);
  });
  return getDraft(id.data);
});
