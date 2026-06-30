"use client";

import { motion } from "framer-motion";

/**
 * HavenLoader
 *
 * A branded, full-screen loading overlay matching Haven's warm pixel-art
 * theme. Rendered while we determine a user's auth/onboarding status so new
 * users never catch a glimpse of the dashboard chrome before being redirected
 * to /onboarding.
 */
export function HavenLoader() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-[var(--bg)]">
      {/* Warm glow blob behind the logo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warm-400/20 blur-3xl"
      />

      {/* Breathing pixel-art H logo */}
      <motion.span
        className="pixelated relative grid place-items-center bg-gradient-to-br from-warm-300 to-warm-600 shadow-pixel-sm"
        style={{ width: 64, height: 64, imageRendering: "pixelated" }}
        animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          width={64 * 0.62}
          height={64 * 0.62}
          viewBox="0 0 8 8"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          <g fill="#3a2418">
            <rect x="1" y="1" width="2" height="6" />
            <rect x="5" y="1" width="2" height="6" />
            <rect x="3" y="3" width="2" height="2" />
          </g>
        </svg>
      </motion.span>

      {/* Caption */}
      <p className="font-pixel relative text-sm tracking-wide text-warm-600 dark:text-warm-300">
        Setting up your space...
      </p>
    </div>
  );
}

export default HavenLoader;
