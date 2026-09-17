import { defineHandler } from "nitro";
import { requireUser } from "../../../utils/auth";
import { checkAdcHealth } from "../../../utils/alarmComClient";

export default defineHandler(async (event) => {
  await requireUser(event);
  return checkAdcHealth();
});
