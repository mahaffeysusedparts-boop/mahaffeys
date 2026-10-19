import { defineHandler } from 'nitro';
import { setResponseHeader } from 'nitro/h3';
import { loadComponentCatalog } from '../../../utils/componentCatalog';

export default defineHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return loadComponentCatalog('additional');
});
