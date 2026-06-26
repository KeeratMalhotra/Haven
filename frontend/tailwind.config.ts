import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep space base palette
        base: {
          DEFAULT: "#06080F",
          950: "#06080F",
          900: "#090C15",
          850: "#0B0E19",
          800: "#0D1119",
          700: "#11161F",
          600: "#161C28",
        },
        // Signature accent gradient stops
        accent: {
          magenta: "#FF2DAF",
          magenta2: "#E11D8F",
          cyan: "#22D3EE",
          cyan2: "#00E5FF",
        },
        // Legacy neon tokens kept so any stray reference still resolves
        neon: {
          cyan: "#22D3EE",
          purple: "#FF2DAF",
          pink: "#FF2DAF",
          blue: "#22D3EE",
        },
        dark: {
          900: "#06080F",
          800: "#0D1119",
          700: "#11161F",
          600: "#161C28",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(255, 45, 175, 0.35)",
        "glow-cyan": "0 0 40px -8px rgba(34, 211, 238, 0.35)",
        panel: "0 24px 80px -24px rgba(0, 0, 0, 0.8)",
        rim: "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(110deg, #FF2DAF 0%, #B83CD6 45%, #22D3EE 100%)",
        "accent-soft":
          "linear-gradient(110deg, rgba(255,45,175,0.85) 0%, rgba(34,211,238,0.85) 100%)",
      },
      animation: {
        "message-in": "message-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.6s ease-out both",
        breathe: "breathe 3.2s ease-in-out infinite",
        shimmer: "shimmer 2.6s linear infinite",
        "shimmer-slow": "shimmer 4s linear infinite",
        float: "float 8s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "caret-blink": "caret-blink 1s steps(1) infinite",
      },
      keyframes: {
        "message-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(0.96)", opacity: "0.65" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "caret-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
