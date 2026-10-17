import { defineHandler } from 'nitro';
import { buyingUser } from '../../../utils/scrapBuying';
import { query } from '../../../utils/db';
import { DEFAULT_INTAKE_REQUIREMENTS, type IntakeRequirements } from '../../../../src/types/intakeRequirements';

export default defineHandler(async (event) => {
  await buyingUser(event);
  const result = await query("SELECT value FROM app_state WHERE key='mahaffeys_intake_requirements'");
  return (result.rows[0]?.value ?? DEFAULT_INTAKE_REQUIREMENTS) as IntakeRequirements;
});
