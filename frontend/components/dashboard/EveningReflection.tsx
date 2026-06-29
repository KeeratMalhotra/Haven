"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Check, ArrowRight, X } from "lucide-react";

interface EveningReflectionProps {
  doneCount: number;
  totalCount: number;
  /** Called when the user chooses to roll incomplete tasks to tomorrow. */
  onRollOver?: () => void;
}

/**
 * A calm evening check-in shown during evening hours.
 * "How did today go? X of Y tasks done. Roll the rest to tomorrow?"
 */
export default function EveningReflection({
  doneCount,
  totalCount,
  onRollOver,
}: EveningReflectionProps) {
  const [dismissed, setDismissed] = useState(false);
  const [rolled, setRolled] = useState(false);

  if (dismissed) return null;

  const remaining = Math.max(totalCount - doneCount, 0);
  const allDone = totalCount > 0 && remaining === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg)] p-6"
    >
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-accent-700/[0.08] blur-3xl" />

      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-4 top-4 rounded-md p-1 text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] dark:hover:text-[#a8a39c]"
      >
        <X size={15} strokeWidth={1.5} />
      </button>

      <div className="relative flex items-start gap-3.5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-500/10">
          <Moon size={20} strokeWidth={1.5} className="text-accent-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)] dark:text-[#ece9e4]">
            How did today go?
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">
            {totalCount > 0 ? (
              <>
                You completed{" "}
                <span className="font-semibold text-success-500">{doneCount}</span> of{" "}
                <span className="font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">{totalCount}</span>{" "}
                tasks.
                {allDone
                  ? " Everything done — beautifully cleared."
                  : ` ${remaining} still open.`}
              </>
            ) : (
              "A quiet day. Rest up — tomorrow's a fresh start."
            )}
          </p>
        </div>
      </div>

      {!allDone && remaining > 0 && (
        <div className="relative mt-5 flex flex-wrap gap-2">
          <AnimatePresence mode="wait">
            {rolled ? (
              <motion.div
                key="rolled"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 rounded-lg bg-success-500/10 px-4 py-2 text-sm font-medium text-success-500"
              >
                <Check size={15} strokeWidth={2} />
                Rolled to tomorrow
              </motion.div>
            ) : (
              <motion.button
                key="roll"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setRolled(true);
                  onRollOver?.();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
              >
                Roll the rest to tomorrow
                <ArrowRight size={15} strokeWidth={2} />
              </motion.button>
            )}
          </AnimatePresence>
          <button
            onClick={() => setDismissed(true)}
            className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4]"
          >
            Not now
          </button>
        </div>
      )}
    </motion.section>
  );
}
