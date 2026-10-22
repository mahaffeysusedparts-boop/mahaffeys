import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';
import { submitBinReview } from '../../../../utils/binInspections';
export default defineHandler(async event => submitBinReview(event, await readBody(event)));
