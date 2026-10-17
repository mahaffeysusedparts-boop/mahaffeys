import { defineHandler } from 'nitro';
import { setResponseHeader } from 'nitro/h3';
import { publicPartsPrices } from '../../../utils/priceSheets';

export default defineHandler(async (event) => {
  setResponseHeader(event,'Cache-Control','public, no-cache, max-age=0');
  return publicPartsPrices();
});
