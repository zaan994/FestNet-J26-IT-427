import { defineConfig } from "vitest/config";

// Unit tests only (no emulator). Emulator suites: vitest.emulator.config.ts / npm run test:emulator.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/emulator/**", "node_modules/**"],
  },
});
