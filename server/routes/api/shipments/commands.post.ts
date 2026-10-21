import { randomUUID } from 'node:crypto';
import { defineHandler } from 'nitro';
import { createError, readBody } from 'nitro/h3';
import { z } from 'zod';
import { requireUser } from '../../../utils/auth';
import { withTransaction } from '../../../utils/db';
import { lockFinancialState, stateValue, putState, stableFinancialJSON } from '../../../utils/financialState';
import type { OutboundShipment } from '../../../../src/types/scrap';
import { settlementTotals, shipmentGrades } from '../../../../src/utils/shipments';

const nonnegative = z.number().finite().nonnegative();
const settlementSchema = z.object({
  scaleTicketNumber: z.string().trim().min(1).max(200),
  actualNetWeightLbs: z.number().finite().positive(),
  amountPaid: nonnegative,
  deductions: nonnegative,
  gradeLines: z.array(z.object({
    gradeLineId: z.string().min(1).max(200), gradeName: z.string().max(200),
    actualNetWeightLbs: nonnegative, actualRatePerLb: nonnegative,
    priceUnit: z.enum(['LB', 'TON']), deductions: nonnegative,
  })).min(1).max(200).optional(),
});
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('SETTLE'), id: z.string().min(1).max(200), expectedSnapshot: z.string().min(1).max(500000), settlement: settlementSchema }),
  z.object({ action: z.literal('VOID'), id: z.string().min(1).max(200), expectedSnapshot: z.string().min(1).max(500000), reason: z.string().trim().min(1).max(500) }),
]);

export default defineHandler(async event => {
  const user = await requireUser(event);
  if (!['admin', 'yard_manager'].includes(user.role)) throw createError({ statusCode: 403, statusMessage: 'Mill settlement and voiding require a manager or administrator' });
  const parsed = schema.safeParse(await readBody(event, { limit: 1024 * 1024 }));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message ?? 'Invalid shipment command' });
  const command = parsed.data;
  return withTransaction(async client => {
    await lockFinancialState(client);
    const shipments = await stateValue<OutboundShipment[]>(client, 'mahaffeys_shipments', []);
    const latest = shipments.find(load => load.id === command.id);
    if (!latest) throw createError({ statusCode: 404, statusMessage: 'Shipment not found' });
    if (latest.status === 'VOIDED') {
      if (command.action === 'VOID') return latest;
      throw createError({ statusCode: 409, statusMessage: 'Voided shipments cannot be settled' });
    }
    if (stableFinancialJSON(latest) !== command.expectedSnapshot) throw createError({ statusCode: 409, statusMessage: 'Shipment details changed on another device. Reopen the load and review them before saving.' });
    const now = new Date().toISOString();
    let saved: OutboundShipment;
    if (command.action === 'VOID') {
      saved = { ...latest, status: 'VOIDED', voidRecord: { reason: command.reason, voidedAt: now, voidedBy: user.fullName, voidedById: user.id, previousStatus: latest.status } };
    } else {
      if (!latest.settlement && latest.status !== 'DELIVERED') throw createError({ statusCode: 409, statusMessage: 'Mark the shipment delivered before settling' });
      const submitted = command.settlement;
      if (submitted.gradeLines) {
        const grades = shipmentGrades(latest);
        const ids = new Set(submitted.gradeLines.map(line => line.gradeLineId));
        if (ids.size !== submitted.gradeLines.length || ids.size !== grades.length || grades.some(grade => !ids.has(grade.id))) throw createError({ statusCode: 400, statusMessage: 'Settlement grades must match the shipped grades' });
        if (submitted.gradeLines.some(line => line.deductions > line.actualNetWeightLbs * line.actualRatePerLb || !Number.isFinite(line.actualNetWeightLbs * line.actualRatePerLb))) throw createError({ statusCode: 400, statusMessage: 'Grade deductions cannot exceed the grade value' });
        const totals = settlementTotals(submitted.gradeLines);
        if (Math.abs(totals.weight - submitted.actualNetWeightLbs) > 0.000001 || Math.abs(totals.deductions - submitted.deductions) > 0.000001) throw createError({ statusCode: 400, statusMessage: 'Settlement totals must match the grade breakdown' });
      }
      const amountPaid = Math.round(submitted.amountPaid * 100) / 100;
      const deductions = Math.round(submitted.deductions * 100) / 100;
      const actualRatePerLb = (amountPaid + deductions) / submitted.actualNetWeightLbs;
      if (![amountPaid, deductions, actualRatePerLb].every(Number.isFinite)) throw createError({ statusCode: 400, statusMessage: 'Invalid settlement totals' });
      const settings = await stateValue<{ shipmentVarianceTolerancePct?: number }>(client, 'mahaffeys_settings', {});
      const discrepancy = Math.abs(amountPaid - latest.expectedRevenue) / Math.max(latest.expectedRevenue, 1) * 100 > (settings.shipmentVarianceTolerancePct ?? 2);
      saved = { ...latest, status: discrepancy ? 'DISCREPANCY' : 'SETTLED', deliveredAt: latest.deliveredAt || now,
        settlement: { ...submitted, amountPaid, deductions, actualRatePerLb, settledAt: now,
          ...(submitted.gradeLines ? { gradeLines: submitted.gradeLines.map(line => ({ ...line, gradeName: shipmentGrades(latest).find(grade => grade.id === line.gradeLineId)!.gradeName })) } : {}) } };
    }
    await putState(client, 'mahaffeys_shipments', shipments.map(load => load.id === saved.id ? saved : load), user.id);
    await client.query('INSERT INTO audit_log(id,user_id,user_name,action,entity,entity_id,detail,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
      [`audit-${randomUUID()}`, user.id, user.fullName, `shipment.${command.action.toLowerCase()}`, 'shipment', saved.id,
        JSON.stringify({ previousStatus: latest.status, status: saved.status, ...(command.action === 'VOID' ? { reason: command.reason } : { previousSettlement: latest.settlement ?? null, settlement: saved.settlement }) }), now]);
    return saved;
  });
});
