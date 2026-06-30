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
        // Notion-inspired warm neutrals
        gray: {
          50: "#fafafa",
          100: "#f4f4f5",
          150: "#efefef",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          750: "#2e2e33",
          800: "#27272a",
          850: "#232326",
          900: "#18181b",
          950: "#0f0f10",
        },
        // Primary accent: warm terracotta/amber spectrum (cozy "digital living room")
        accent: {
          DEFAULT: "#dd8a5a",
          50: "#fdf6f0",
          100: "#fae9da",
          200: "#f3d2b6",
          300: "#ecb98e",
          400: "#e8a87c",
          500: "#dd8a5a",
          600: "#c96f3e",
          700: "#a8572f",
          800: "#854629",
          900: "#6b3a25",
          950: "#4a2818",
        },
        // Warm cozy spectrum — peach / amber / ember for the "digital living room"
        warm: {
          50: "#fdf6f0",
          100: "#fae9da",
          200: "#f3d2b6",
          300: "#ecb98e",
          400: "#e8a87c",
          500: "#dd8a5a",
          600: "#c96f3e",
          700: "#a8572f",
          800: "#854629",
          900: "#6b3a25",
        },
        // Soft mauve/clay accents for gentle depth in the cozy scene
        clay: {
          200: "#e7d3d8",
          300: "#d4b3bf",
          400: "#c89bd4",
          500: "#b27fae",
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
          DEFAULT: "#0f0f10",
          950: "#0f0f10",
          900: "#18181b",
          850: "#232326",
          800: "#27272a",
          700: "#3f3f46",
          600: "#52525b",
        },
        neon: {
          cyan: "#22d3ee",
          purple: "#6366f1",
          pink: "#f43f5e",
          blue: "#818cf8",
        },
        dark: {
          900: "#0f0f10",
          800: "#18181b",
          700: "#232326",
          600: "#27272a",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Helvetica",
          '"Apple Color Emoji"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          '"SF Mono"',
          "Menlo",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
        // Pixel display face for headings + wordmark (cozy 16-bit feel)
        pixel: ['var(--font-pixel)', '"Pixelify Sans"', "monospace"],
        // Terminal pixel face for HUD / eyebrow labels
        terminal: ['var(--font-terminal)', '"VT323"', "monospace"],
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
        // Notion-style minimal shadows
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.02)",
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 2px -1px rgba(0, 0, 0, 0.02)",
        md: "0 2px 4px -1px rgba(0, 0, 0, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.02)",
        lg: "0 4px 8px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.02)",
        xl: "0 8px 16px -4px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.02)",
        "2xl": "0 16px 32px -8px rgba(0, 0, 0, 0.1)",
        // Subtle accent glow (reduced)
        glow: "0 0 12px -4px rgba(221, 138, 90, 0.12)",
        "glow-sm": "0 0 6px -2px rgba(221, 138, 90, 0.1)",
        "glow-lg": "0 0 20px -6px rgba(221, 138, 90, 0.15)",
        "glow-accent": "0 0 12px -4px rgba(221, 138, 90, 0.15)",
        // Surface shadows
        panel:
          "0 8px 24px -8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.02)",
        rim: "inset 0 1px 0 0 rgba(255, 255, 255, 0.02)",
        "inner-sm": "inset 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
        // Card hover shadow (subtle)
        "card-hover":
          "0 2px 8px -2px rgba(0, 0, 0, 0.06), 0 1px 3px -1px rgba(0, 0, 0, 0.03)",
        // Pixel-art hard offset shadows (no blur — NES/SNES style)
        pixel: "4px 4px 0 0 rgba(20, 14, 10, 0.55)",
        "pixel-sm": "3px 3px 0 0 rgba(20, 14, 10, 0.5)",
        "pixel-lg": "6px 6px 0 0 rgba(20, 14, 10, 0.6)",
        "pixel-warm": "4px 4px 0 0 rgba(168, 87, 47, 0.55)",
        "pixel-accent": "4px 4px 0 0 rgba(67, 56, 202, 0.5)",
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(135deg, #e8a87c 0%, #dd8a5a 50%, #c96f3e 100%)",
        "accent-soft":
          "linear-gradient(135deg, rgba(232,168,124,0.8) 0%, rgba(221,138,90,0.8) 100%)",
        "surface-gradient":
          "linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%)",
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out both",
        "fade-in-up": "fade-in-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-up": "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-down": "slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-right":
          "slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 14s ease-in-out infinite",
        breathe: "breathe 3s ease-in-out infinite",
        "breathe-slow": "breathe-slow 9s ease-in-out infinite",
        drift: "drift 26s ease-in-out infinite",
        aurora: "aurora 24s ease-in-out infinite",
        ember: "ember 4.5s ease-in-out infinite",
        "glow-pulse": "glow-pulse 6s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "spin-slow": "spin 3s linear infinite",
        "message-in": "message-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "caret-blink": "caret-blink 1s steps(1) infinite",
        "spin-in": "spin-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        // Pixel-art stepped motion (snappy, frame-by-frame feel)
        "pixel-bob": "pixel-bob 2.4s steps(4) infinite",
        "pixel-bob-slow": "pixel-bob 3.6s steps(6) infinite",
        "pixel-blink": "pixel-blink 4.5s steps(1) infinite",
        "pixel-flicker": "pixel-flicker 3s steps(3) infinite",
        "pixel-smoke": "pixel-smoke 4s steps(8) infinite",
        "pixel-twinkle": "pixel-twinkle 2.2s steps(2) infinite",
        "pixel-firefly": "pixel-firefly 7s steps(10) infinite",
        "pixel-fire": "pixel-fire 0.45s steps(2) infinite",
        "pixel-fire-slow": "pixel-fire 0.65s steps(2) infinite",
        "pixel-ember": "pixel-ember 2.6s steps(7) infinite",
        "pixel-zzz": "pixel-zzz 4s steps(8) infinite",
        "pixel-glow": "pixel-glow 1.2s steps(3) infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(8px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px) translateX(0px)" },
          "50%": { transform: "translateY(-14px) translateX(6px)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(0.97)", opacity: "0.7" },
          "50%": { transform: "scale(1.03)", opacity: "1" },
        },
        "breathe-slow": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(3%, -2.5%) scale(1.03)" },
          "66%": { transform: "translate(-2.5%, 2%) scale(0.98)" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.5" },
          "50%": { transform: "translate(-3%, 2%) scale(1.06)", opacity: "0.8" },
        },
        ember: {
          "0%, 100%": { transform: "scaleY(1) scaleX(1)", opacity: "0.85" },
          "25%": { transform: "scaleY(1.08) scaleX(0.96)", opacity: "1" },
          "50%": { transform: "scaleY(0.94) scaleX(1.04)", opacity: "0.9" },
          "75%": { transform: "scaleY(1.05) scaleX(0.98)", opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.08)" },
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
        "spin-in": {
          "0%": { opacity: "0", transform: "rotate(-90deg) scale(0.8)" },
          "100%": { opacity: "1", transform: "rotate(0deg) scale(1)" },
        },
        "pixel-bob": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pixel-blink": {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "95%": { transform: "scaleY(0.1)" },
        },
        "pixel-flicker": {
          "0%, 100%": { opacity: "0.92" },
          "33%": { opacity: "1" },
          "66%": { opacity: "0.8" },
        },
        "pixel-smoke": {
          "0%": { transform: "translateY(0) translateX(0)", opacity: "0" },
          "20%": { opacity: "0.8" },
          "100%": {
            transform: "translateY(-26px) translateX(6px)",
            opacity: "0",
          },
        },
        "pixel-twinkle": {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        "pixel-firefly": {
          "0%, 100%": { transform: "translate(0, 0)", opacity: "0.2" },
          "25%": { transform: "translate(10px, -8px)", opacity: "1" },
          "50%": { transform: "translate(18px, 4px)", opacity: "0.6" },
          "75%": { transform: "translate(6px, 10px)", opacity: "0.9" },
        },
        "pixel-fire": {
          "0%, 100%": { transform: "scaleY(1) scaleX(1)", opacity: "1" },
          "50%": { transform: "scaleY(0.8) scaleX(1.12)", opacity: "0.85" },
        },
        "pixel-ember": {
          "0%": { transform: "translate(0, 0)", opacity: "0" },
          "25%": { opacity: "1" },
          "100%": { transform: "translate(4px, -26px)", opacity: "0" },
        },
        "pixel-zzz": {
          "0%": { transform: "translate(0, 0)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translate(9px, -22px)", opacity: "0" },
        },
        "pixel-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "0.9" },
        },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.22, 1, 0.36, 1)",
        "spring-bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
