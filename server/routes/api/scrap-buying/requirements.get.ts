import { defineHandler } from 'nitro';
import { buyingUser } from '../../../utils/scrapBuying';
import { query } from '../../../utils/db';
import { normalizeIntakeRequirements } from '../../../../src/types/intakeRequirements';

export default defineHandler(async (event) => {
  await buyingUser(event);
  const result = await query("SELECT value FROM app_state WHERE key='mahaffeys_intake_requirements'");
  return normalizeIntakeRequirements(result.rows[0]?.value ?? {});
});
