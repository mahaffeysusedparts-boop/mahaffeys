import { defineHandler } from 'nitro';
import { setResponseHeader } from 'nitro/h3';
import { loadAlternatorCatalog } from '../../../utils/alternatorCatalog';

export default defineHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return loadAlternatorCatalog();
});
