import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// the same "@/" shortcut as tsconfig.json, so tests can import the way the app does
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
