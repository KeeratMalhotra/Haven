"use client";

import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";

interface BannerAction {
  label: string;
  onClick: () => void;
}

interface AISuggestionBannerProps {
  suggestion: string;
  type: "info" | "action" | "warning";
  onDismiss: () => void;
  actions?: BannerAction[];
}

export default function AISuggestionBanner({
  suggestion,
  onDismiss,
  actions,
}: AISuggestionBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 px-4"
    >
      <div className="flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
        <p className="flex-1 text-sm text-[var(--text-secondary)]">
          {suggestion}
        </p>
        {actions && actions.length > 0 && (
          <div className="flex gap-2 shrink-0">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="text-xs text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onDismiss}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
