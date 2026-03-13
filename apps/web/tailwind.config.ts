import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        surface: "var(--surface)",
        card: "var(--card)",
        border: "var(--border2)",
        foreground: "var(--text)",
        muted: "var(--muted)",
        tertiary: "var(--subtle)",
        accent: "var(--cream)",
        cta: "var(--gold)",
        destructive: "var(--danger)",
        success: "var(--success)"
      },
      fontSize: {
        xs: ["11px", { lineHeight: "1.6" }],
        sm: ["13px", { lineHeight: "1.6" }],
        base: ["15px", { lineHeight: "1.6" }],
        xl: ["20px", { lineHeight: "1.3" }]
      },
      borderRadius: {
        lg: "8px",
        pill: "20px"
      }
    }
  },
  plugins: []
};

export default config;
