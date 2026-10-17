import { randomUUID } from 'node:crypto';
import { defineHandler } from 'nitro';
import { getRouterParam, assertBodySize, readBody, createError } from 'nitro/h3';
import { z } from 'zod';
import { withTransaction } from '../../../../utils/db';
import { priceSheetUser, publishableRows } from '../../../../utils/priceSheets';
import type { ReviewedPriceRow } from '../../../../../src/types/priceSheets';

export default defineHandler(async (event) => {
  const user = await priceSheetUser(event);
  const id = z.string().uuid().safeParse(getRouterParam(event,'id'));
  assertBodySize(event, 4096);
  const body = z.object({revision:z.number().int().positive(),expectedActiveVersion:z.string().uuid().nullable(),reviewedWarnings:z.literal(true)}).safeParse(await readBody(event));
  if (!id.success || !body.success) throw createError({statusCode:400,statusMessage:'Explicit draft, preview and warning review are required'});
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(114682)');
    const active = (await client.query('SELECT version_id FROM price_sheet_active')).rows[0]?.version_id ?? null;
    const draft = (await client.query('SELECT revision,status,rows FROM price_sheet_drafts WHERE id=$1 FOR UPDATE',[id.data])).rows[0];
    if (!draft || draft.revision !== body.data.revision || draft.status !== 'REVIEW') throw createError({statusCode:409,statusMessage:'Save and review the current draft before publishing'});
    const existing = (await client.query('SELECT id FROM price_sheet_versions WHERE document_id=$1 AND source_revision=$2',[id.data,draft.revision])).rows[0]?.id;
    if (existing && active===existing) return {version:existing};
    if (active !== body.data.expectedActiveVersion) throw createError({statusCode:409,statusMessage:'Published prices changed. Refresh history and preview before publishing.'});
    let rows: ReviewedPriceRow[];
    try { rows = publishableRows(draft.rows); } catch (error) { throw createError({statusCode:400,statusMessage:error instanceof Error ? error.message : 'Review rows before publishing'}); }
    const version = existing ?? randomUUID();
    if (!existing) await client.query('INSERT INTO price_sheet_versions(id,document_id,rows,published_by,source_revision) VALUES($1,$2,$3::jsonb,$4,$5)',[version,id.data,JSON.stringify(rows),user.id,draft.revision]);
    await client.query('INSERT INTO price_sheet_active(singleton,version_id,updated_at) VALUES(TRUE,$1,NOW()) ON CONFLICT(singleton) DO UPDATE SET version_id=EXCLUDED.version_id,updated_at=NOW()',[version]);
    await client.query("INSERT INTO price_sheet_publication_events(id,version_id,actor_id,action) VALUES($1,$2,$3,'PUBLISH')",[randomUUID(),version,user.id]);
    return {version};
  });
});
