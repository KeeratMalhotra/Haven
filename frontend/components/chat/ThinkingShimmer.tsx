"use client";

import { motion } from "framer-motion";

/**
 * ThinkingShimmer
 * A simple matte "processing" state with 3 pulsing dots and a calm status label.
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
      {/* Pulsing dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-accent-500"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      {/* Status label */}
      {label ? (
        <span className="truncate text-sm font-medium tracking-tight text-[var(--text-secondary)]">
          {label}
        </span>
      ) : (
        <span className="text-sm font-medium tracking-tight text-[var(--text-secondary)]">
          One moment
        </span>
      )}
    </motion.div>
  );
}
