import { defineHandler } from 'nitro';
import { binUser, binCatalog } from '../../../../utils/binInspections';
export default defineHandler(async event => { await binUser(event); return binCatalog(); });
