import { defineHandler } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";
import { serverScale } from "../../../utils/scale";
import { getScaleConfig } from "../../../utils/scaleConfig";

export default defineHandler(async () => {
  const runtimeConfig = useRuntimeConfig();
  const configuredBaudRate = Number(runtimeConfig.scaleSerialBaudRate);
  const config = await getScaleConfig({
    path: typeof runtimeConfig.scaleSerialPort === "string" ? runtimeConfig.scaleSerialPort : "",
    baudRate: Number.isFinite(configuredBaudRate) && configuredBaudRate > 0 ? configuredBaudRate : 2400,
  });

  await serverScale.start(config);
  return serverScale.getStatus();
});
