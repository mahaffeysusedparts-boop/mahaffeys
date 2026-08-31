import { defineHandler } from "nitro";
import { requireUser } from "../../../utils/auth";
import { getStoplightStatus } from "../../../utils/stoplight";

export default defineHandler(async (event) => {
  await requireUser(event);
  return getStoplightStatus();
});
