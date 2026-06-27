"use client";

import { motion } from "framer-motion";

interface ThinkingIndicatorProps {
  statusLabel?: string;
}

export default function ThinkingIndicator({
  statusLabel,
}: ThinkingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-primary/60"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      {statusLabel && (
        <span className="text-xs text-muted-foreground">{statusLabel}</span>
      )}
    </div>
  );
}
