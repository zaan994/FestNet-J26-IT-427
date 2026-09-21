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
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        brand: token("brand"),
        "brand-2": token("brand-2"),
        accent: token("accent"),
        // Status colours are fixed in both themes (never used for series) and always paired with a label.
        severity: {
          none: "#16A34A",
          warning: "#F5A524",
          danger: "#F97316",
          critical: "#E11D48",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)",
        glow: "0 0 0 1px rgb(var(--brand) / 0.25), 0 8px 32px -8px rgb(var(--brand) / 0.45)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--brand-2)) 100%)",
        "stage-glow":
          "radial-gradient(1200px 600px at 100% -10%, rgb(var(--brand-2) / 0.10), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgb(var(--brand) / 0.10), transparent 60%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
