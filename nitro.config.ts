import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  routeRules: {
    "/api/state/**": { bodyLimit: { maxSize: 25 * 1024 * 1024 } },
    "/api/state/import": { bodyLimit: { maxSize: 25 * 1024 * 1024 } },
  },
});
