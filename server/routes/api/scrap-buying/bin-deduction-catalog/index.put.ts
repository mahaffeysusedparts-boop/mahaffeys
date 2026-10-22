import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';
import { saveBinCatalog } from '../../../../utils/binInspections';
export default defineHandler(async event => saveBinCatalog(event, await readBody(event)));
