"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, CornerDownLeft, Loader2 } from "lucide-react";
import { parseBraindump } from "@/lib/api-extended";
import { useAI } from "@/components/ai/AIContextProvider";
import type { AISuggestion } from "@/components/ai/AIContextProvider";

/**
 * QuickCapture
 *
 * A universal, always-accessible command-style capture input. The user can
 * open it from anywhere in the dashboard (TopBar "+" button or the "n"
 * keyboard shortcut) and dump a task or thought in natural language
 * (e.g. "call dentist tomorrow 3pm"). The text is parsed and created by the
 * existing braindump backend (parseBraindump), and a subtle toast confirms
 * what was added.
 *
 * MUST be mounted inside the AIContextProvider subtree (it depends on useAI).
 * Opening is bridged from TopBar (which lives outside the provider) via the
 * "chronai-open-quick-capture" window CustomEvent, mirroring the existing
 * "chronai-open-chat" / "chronai-start-focus" pattern.
 */
export default function QuickCapture() {
  const { data: session } = useSession();
  const { addNotification } = useAI();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setValue("");
    setSubmitting(false);
  }, []);

  const pushToast = useCallback(
    (text: string, type: AISuggestion["type"] = "info") => {
      addNotification({
        id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        text,
        type,
        actions: [],
        timestamp: Date.now(),
        dismissed: false,
      });
    },
    [addNotification]
  );

  // Open via the TopBar "+" button (CustomEvent bridge across the provider).
  useEffect(() => {
    const openQuickCapture = () => setOpen(true);
    window.addEventListener("chronai-open-quick-capture", openQuickCapture);
    return () =>
      window.removeEventListener(
        "chronai-open-quick-capture",
        openQuickCapture
      );
  }, []);

  // "n" keyboard shortcut — open when not typing in an editable field and no
  // modifier keys are held (so it never conflicts with the Cmd+K palette).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "n") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (open) return;

      const target = (e.target as HTMLElement | null) ?? null;
      const active = document.activeElement as HTMLElement | null;
      const isEditable = (el: HTMLElement | null) => {
        if (!el) return false;
        const tag = el.tagName;
        return (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          el.isContentEditable
        );
      };
      if (isEditable(target) || isEditable(active)) return;

      e.preventDefault();
      setOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Auto-focus the input whenever the modal opens.
  useEffect(() => {
    if (open) {
      // Defer so the element is mounted before focusing.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || submitting) return;

    const accessToken =
      ((session as Record<string, unknown> | null)?.accessToken as string) ||
      "";

    setSubmitting(true);
    try {
      const result = await parseBraindump(accessToken, trimmed);
      const created =
        result.counts.tasks + result.counts.events + result.counts.habits;

      if (created > 0) {
        const name =
          result.tasks[0]?.title ||
          result.events[0]?.summary ||
          result.habits[0]?.name ||
          trimmed;
        pushToast(`Added '${name}'`, "info");
        close();
      } else {
        // Backend understood the request but created nothing actionable.
        pushToast(
          "Couldn't capture that - try adding a time or more detail.",
          "warning"
        );
        setSubmitting(false);
      }
    } catch {
      pushToast(
        "Something went wrong capturing that - please try again.",
        "warning"
      );
      // Keep the modal open so the user can retry without re-typing.
      setSubmitting(false);
    }
  }, [value, submitting, session, pushToast, close]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[91] flex items-start justify-center px-4 pt-[22vh]"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Quick capture"
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] text-accent-500">
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} strokeWidth={1.5} />
                  )}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  disabled={submitting}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Capture a task or event... e.g. call dentist tomorrow 3pm"
                  aria-label="Capture a task or event"
                  className="h-14 w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting || value.trim().length === 0}
                  aria-label="Capture"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CornerDownLeft size={13} strokeWidth={1.5} />
                  Add
                </button>
              </div>

              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs text-[var(--text-tertiary)]">
                  Type naturally — ChronAI figures out the rest
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  <kbd className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px]">
                    Esc
                  </kbd>{" "}
                  to close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
