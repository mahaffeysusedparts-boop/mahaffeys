import { z } from 'zod';
import type { BinDeductionCatalog, BinSelection } from '../types/binDeductions';
const positive = z.number().finite().min(0.000001).max(1000000).refine(value => Number(value.toFixed(6)) === value, 'Weights support at most six decimal places');
const base = { id: z.string().regex(/^[a-z][a-z0-9-]{0,79}$/), name: z.string().trim().min(1).max(160), enabled: z.boolean() };
export const binCatalogSchema = z.object({ revision: z.number().int().positive(), items: z.array(z.discriminatedUnion('mode', [
  z.object({ ...base, mode: z.literal('FIXED'), pounds: positive }).strict(),
  z.object({ ...base, mode: z.literal('RANGED'), minPounds: positive, maxPounds: positive }).strict(),
])).min(1).max(100) }).strict().superRefine((catalog, ctx) => {
  if (new Set(catalog.items.map(item => item.id)).size !== catalog.items.length) ctx.addIssue({ code: 'custom', message: 'Item IDs must be unique' });
  if (catalog.items.some(item => item.mode === 'RANGED' && item.minPounds > item.maxPounds)) ctx.addIssue({ code: 'custom', message: 'Minimum pounds must not exceed maximum' });
});
export const binSubmissionSchema = z.object({ cycleId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), catalogRevision: z.number().int().positive(),
  selections: z.array(z.object({ itemId: z.string().max(80), quantity: z.number().int().positive().max(10000), poundsPerUnit: positive.optional() }).strict()).max(100),
}).strict();
export function resolveBinSelections(catalog: BinDeductionCatalog, selections: BinSelection[]) {
  if (new Set(selections.map(item => item.itemId)).size !== selections.length) throw new Error('Duplicate deduction item');
  return selections.map(selection => {
    const item = catalog.items.find(item => item.id === selection.itemId && item.enabled);
    if (!item || !Number.isInteger(selection.quantity) || selection.quantity <= 0 || selection.quantity > 10000) throw new Error('Invalid item or quantity');
    const poundsPerUnit = item.mode === 'FIXED' ? item.pounds : selection.poundsPerUnit;
    if (item.mode === 'FIXED' && selection.poundsPerUnit !== undefined) throw new Error('Fixed weights cannot be supplied by employee');
    if (poundsPerUnit === undefined || !Number.isFinite(poundsPerUnit) || (item.mode === 'RANGED' && (poundsPerUnit < item.minPounds || poundsPerUnit > item.maxPounds))) throw new Error('Pounds per unit outside allowed range');
    return { itemId: item.id, name: item.name, quantity: selection.quantity, poundsPerUnit };
  });
}
