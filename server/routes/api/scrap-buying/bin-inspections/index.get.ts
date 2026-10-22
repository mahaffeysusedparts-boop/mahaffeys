import { defineHandler } from 'nitro';
import { getQuery } from 'nitro/h3';
import { binUser, binQueue } from '../../../../utils/binInspections';
export default defineHandler(async event => { await binUser(event); const cycleId = getQuery(event).cycleId; return { cycles: await binQueue(typeof cycleId === 'string' ? cycleId : undefined) }; });
