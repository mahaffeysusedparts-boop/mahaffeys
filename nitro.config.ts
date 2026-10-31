import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  externals: { external: ['unpdf', '@electric-sql/pglite'], traceInclude: ['unpdf', '@electric-sql/pglite'] },
  runtimeConfig: {
    scaleSerialPort: "",
    scaleSerialBaudRate: 2400,
    weatherApiKey: "",
  },
});
