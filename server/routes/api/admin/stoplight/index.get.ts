import { defineHandler } from "nitro";
import { requireAdmin } from "../../../../utils/auth";
import { getStoplightConfig } from "../../../../utils/stoplightConfig";
import { getStoplightStatus } from "../../../../utils/stoplight";

export default defineHandler(async (event) => {
  await requireAdmin(event);
  const config = await getStoplightConfig();

  return {
    config: config
      ? { ...config, password: undefined, hasPassword: Boolean(config.password) }
      : null,
    status: await getStoplightStatus(),
    presets: [
      { value: "tasmota", label: "Tasmota", urlExample: `http://<ip>/cm?cmnd=Power1 On` },
      { value: "shelly_gen1", label: "Shelly Gen 1", urlExample: "http://<ip>/relay/0?turn=on" },
      { value: "shelly_gen2", label: "Shelly Gen 2 / Plus", urlExample: "http://<ip>/rpc/Switch.Set?id=0&on=true" },
      { value: "custom", label: "Custom HTTP URLs", urlExample: "http://<ip>/your-relay-command?ch={ch}" },
    ],
    checkedAt: new Date().toISOString(),
  };
});
