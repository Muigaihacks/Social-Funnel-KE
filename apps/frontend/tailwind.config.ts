import type { Config } from "tailwindcss";

/** Mirrors tokens used across the dashboard; keep in sync with `globals.css` where relevant. */
export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/config/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sf: {
          teal: "#00d1c1",
          "navy-deep": "#0d1b2a",
          sky: "#38bdf8",
          brand: "#6d8cff",
          off: "#e2e8f0",
        },
        semantic: {
          info: "#3b82f6",
          success: "#22c55e",
          hot: "#f97316",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
