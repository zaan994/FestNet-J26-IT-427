import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const sharedDir = fileURLToPath(new URL("../Backend/functions/src/shared", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Shared data contract (schema types, DB paths, thresholds, geo helpers)
      "@shared": sharedDir,
    },
  },
  server: {
    port: 5173,
    // allow importing @shared from outside the Dashboard folder
    fs: { allow: [".", sharedDir] },
  },
});
