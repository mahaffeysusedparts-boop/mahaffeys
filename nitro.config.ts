import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  externals: { external: ['unpdf'], traceInclude: ['unpdf'] },
  runtimeConfig: {
    scaleSerialPort: "",
    scaleSerialBaudRate: 2400,
    weatherApiKey: "",
  },
});
