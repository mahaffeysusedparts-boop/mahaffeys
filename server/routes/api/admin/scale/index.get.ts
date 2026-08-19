import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";
import { requireAdmin } from "../../../../utils/auth";
import { listSerialPorts, serverScale } from "../../../../utils/scale";
import { getScaleConfig } from "../../../../utils/scaleConfig";

export default defineHandler(async (event) => {
  await requireAdmin(event);
  const runtimeConfig = useRuntimeConfig();
  const runtimeBaudRate = Number(runtimeConfig.scaleSerialBaudRate);
  const config = await getScaleConfig({
    path: typeof runtimeConfig.scaleSerialPort === "string" ? runtimeConfig.scaleSerialPort : "",
    baudRate: Number.isFinite(runtimeBaudRate) && runtimeBaudRate > 0 ? runtimeBaudRate : 2400,
  });

  await serverScale.start(config);
  return {
    ports: await listSerialPorts(),
    supportedBaudRates: [2400, 9600, 4800, 19200],
    config,
    status: serverScale.getStatus(),
    checkedAt: new Date().toISOString(),
  };
});
