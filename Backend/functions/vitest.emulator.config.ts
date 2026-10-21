import { defineConfig } from "vitest/config";

// Emulator suites share one database: run files one after another.
export default defineConfig({
  test: {
    include: ["test/emulator/**/*.emulator.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
