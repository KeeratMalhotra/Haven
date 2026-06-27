"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, AlertTriangle, X } from "lucide-react";
import { useAI } from "./AIContextProvider";
import type { AISuggestion } from "./AIContextProvider";

function ToastItem({
  suggestion,
  onDismiss,
}: {
  suggestion: AISuggestion;
  onDismiss: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 12000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  const Icon = suggestion.type === "warning" ? AlertTriangle : Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-4 max-w-sm w-full"
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-[var(--text-tertiary)] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {suggestion.text}
          </p>
          {suggestion.actions && suggestion.actions.length > 0 && (
            <div className="flex gap-2 mt-2">
              {suggestion.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={onDismiss}
                  className="text-xs text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
                >
                  Got it
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export default function AIToast() {
  const { suggestions, dismissSuggestion } = useAI();

  const visibleSuggestions = suggestions
    .filter((s) => !s.dismissed)
    .slice(-3);

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {visibleSuggestions.map((suggestion) => (
          <ToastItem
            key={suggestion.id}
            suggestion={suggestion}
            onDismiss={() => dismissSuggestion(suggestion.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
