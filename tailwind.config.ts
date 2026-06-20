import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "#2D1B69",
          border: "#3D2A7A",
          hover: "#3A2280",
          active: "#4A2D99",
        },
        main: {
          bg: "#F7F8FA",
          card: "#FFFFFF",
          border: "#E4E7EE",
        },
        brand: {
          DEFAULT: "#F5C200",
          hover: "#E0B000",
          light: "#FFFBEB",
          muted: "#FDE68A",
        },
        kla: {
          purple: "#4B2D9F",
          purpleDeep: "#2D1B69",
          purpleLight: "#EDE9FF",
          yellow: "#F5C200",
          yellowLight: "#FFFBEB",
        },
        success: { DEFAULT: "#10B981", light: "#D1FAE5" },
        danger: { DEFAULT: "#EF4444", light: "#FEE2E2" },
        warning: { DEFAULT: "#F59E0B", light: "#FEF3C7" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        "progress-pulse": "progress-pulse 1.5s ease-in-out infinite",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
      },
      keyframes: {
        "progress-pulse": { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.7" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
