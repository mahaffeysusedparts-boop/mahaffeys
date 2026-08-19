import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  runtimeConfig: {
    scaleSerialPort: "",
    scaleSerialBaudRate: 9600,
  },
});
