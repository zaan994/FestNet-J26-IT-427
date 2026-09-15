import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Severity palette shared with the mobile app (core/theme/app_colors.dart)
        severity: {
          none: "#16a34a",
          warning: "#f59e0b",
          danger: "#ea580c",
          critical: "#dc2626",
        },
        brand: {
          50: "#eef2ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          900: "#1e1b4b",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
