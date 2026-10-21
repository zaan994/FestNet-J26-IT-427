import type { Config } from "tailwindcss";

/** Theme colours come from CSS variables (src/styles/index.css) so light / dark swap in one place. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // `dark:` variants follow <html data-theme="dark"> (set by useTheme), not only the OS setting.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        elevated: token("elevated"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        brand: token("brand"),
        "brand-hover": token("brand-hover"),
        "brand-2": token("brand-2"),
        accent: token("accent"),
        // Status colours — reserved for state, always paired with an icon + label.
        status: {
          normal: token("status-normal"),
          warning: token("status-warning"),
          danger: token("status-danger"),
          critical: token("status-critical"),
        },
        // Backwards-compatible aliases used by older components.
        severity: {
          none: token("status-normal"),
          warning: token("status-warning"),
          danger: token("status-danger"),
          critical: token("status-critical"),
        },
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.05), 0 6px 18px -10px rgb(var(--shadow) / 0.18)",
        glow: "0 0 0 1px rgb(var(--brand) / 0.25), 0 6px 20px -8px rgb(var(--brand) / 0.35)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-2)) 100%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
