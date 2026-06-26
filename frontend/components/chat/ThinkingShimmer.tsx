"use client";

import { motion } from "framer-motion";

/**
 * ThinkingShimmer
 * The premium "processing" state. No "thinking..." text, no agent names.
 * A soft breathing orb of light flanked by a thin flowing magenta -> cyan line,
 * with an optional calm, human-friendly status label (e.g. "Checking your calendar").
 */
export default function ThinkingShimmer({ label }: { label?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 py-2"
    >
      {/* Breathing orb */}
      <div className="relative h-5 w-5 shrink-0">
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 30%, #ff2daf, #22d3ee 75%)",
            filter: "blur(1px)",
          }}
          animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,45,175,0.45), transparent 70%)",
            filter: "blur(6px)",
          }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Flowing line + label */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative h-px w-16 overflow-hidden rounded-full bg-white/5">
          <span className="thinking-shimmer absolute inset-0" />
        </div>
        {label ? (
          <span className="thinking-text truncate text-sm font-medium tracking-tight">
            {label}
          </span>
        ) : (
          <span className="thinking-text text-sm font-medium tracking-tight">
            One moment
          </span>
        )}
      </div>
    </motion.div>
  );
}
