import { defineHandler, useRuntimeConfig } from "nitro";
import { serverScale } from "../../../utils/scale";

export default defineHandler(async () => {
  const config = useRuntimeConfig();
  const configuredBaudRate = Number(config.scaleSerialBaudRate);

  await serverScale.start({
    path: typeof config.scaleSerialPort === "string" && config.scaleSerialPort
      ? config.scaleSerialPort
      : undefined,
    baudRate: Number.isFinite(configuredBaudRate) && configuredBaudRate > 0
      ? configuredBaudRate
      : 9600,
  });

  return serverScale.getStatus();
});
