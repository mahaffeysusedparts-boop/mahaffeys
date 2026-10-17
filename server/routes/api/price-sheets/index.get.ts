import { defineHandler } from 'nitro';
import { query } from '../../../utils/db';
import { priceSheetUser } from '../../../utils/priceSheets';

export default defineHandler(async (event) => {
  await priceSheetUser(event);
  const drafts = await query(`SELECT d.id,d.file_name AS "fileName",s.status,s.revision,d.created_at AS "createdAt" FROM price_sheet_documents d JOIN price_sheet_drafts s ON s.id=d.id ORDER BY d.created_at DESC LIMIT 50`);
  const history = await query(`SELECT id,document_id AS "documentId",published_at AS "publishedAt",jsonb_array_length(rows) AS "rowCount" FROM price_sheet_versions ORDER BY published_at DESC LIMIT 100`);
  const active = await query('SELECT version_id FROM price_sheet_active');
  return {drafts:drafts.rows,history:history.rows,activeVersion:active.rows[0]?.version_id ?? null};
});
