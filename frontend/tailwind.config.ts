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
        // Notion-inspired neutral warm grays
        gray: {
          50: "#fafafa",
          100: "#f5f5f4",
          150: "#eeeeec",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#44403c",
          750: "#37322f",
          800: "#292524",
          850: "#1f1c1a",
          900: "#1c1917",
          950: "#0c0a09",
        },
        // Primary accent: indigo/violet
        accent: {
          DEFAULT: "#6366f1",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Semantic colors
        success: {
          DEFAULT: "#10b981",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          DEFAULT: "#f59e0b",
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          DEFAULT: "#f43f5e",
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
        },
        // Legacy tokens for backward compatibility
        base: {
          DEFAULT: "#0c0a09",
          950: "#0c0a09",
          900: "#1c1917",
          850: "#1f1c1a",
          800: "#292524",
          700: "#44403c",
          600: "#57534e",
        },
        neon: {
          cyan: "#22d3ee",
          purple: "#6366f1",
          pink: "#f43f5e",
          blue: "#818cf8",
        },
        dark: {
          900: "#0c0a09",
          800: "#1c1917",
          700: "#292524",
          600: "#44403c",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      spacing: {
        "4.5": "1.125rem",
        "5.5": "1.375rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        // Subtle, refined shadows (Notion-style)
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        sm: "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
        // Accent glow (subtle)
        glow: "0 0 20px -4px rgba(99, 102, 241, 0.25)",
        "glow-sm": "0 0 10px -2px rgba(99, 102, 241, 0.2)",
        "glow-lg": "0 0 40px -8px rgba(99, 102, 241, 0.3)",
        // Surface shadows
        panel: "0 16px 48px -16px rgba(0, 0, 0, 0.5)",
        rim: "inset 0 1px 0 0 rgba(255, 255, 255, 0.04)",
        "inner-sm": "inset 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)",
        "accent-soft":
          "linear-gradient(135deg, rgba(99, 102, 241, 0.8) 0%, rgba(139, 92, 246, 0.8) 100%)",
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "slide-up": "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-down": "slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 6s ease-in-out infinite",
        breathe: "breathe 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin 3s linear infinite",
        "message-in": "message-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "caret-blink": "caret-blink 1s steps(1) infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(0.97)", opacity: "0.7" },
          "50%": { transform: "scale(1.03)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        "message-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
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
