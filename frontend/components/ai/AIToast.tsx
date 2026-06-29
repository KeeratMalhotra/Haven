"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, AlertTriangle, X } from "lucide-react";
import { useAI } from "./AIContextProvider";
import type { AISuggestion } from "./AIContextProvider";

/**
 * Module-level AudioContext reused across all toast notifications.
 * A single long-lived context avoids hitting browser limits (Chrome allows ~6 simultaneous contexts).
 */
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a subtle notification pop sound using Web Audio API.
 * 200ms sine wave at 800Hz with quick exponential fade-out.
 * Reuses a single AudioContext to avoid browser context limits.
 */
function playNotificationSound() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    // Resume context if suspended (e.g., before user gesture)
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.2);

    // Disconnect nodes after sound finishes to free resources
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch {
    // Silently fail if audio context is not available
  }
}

function ToastItem({
  suggestion,
  onDismiss,
}: {
  suggestion: AISuggestion;
  onDismiss: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Play notification sound on mount
    playNotificationSound();

    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 30000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  const Icon = suggestion.type === "warning" ? AlertTriangle : Sparkles;
  const borderColor =
    suggestion.type === "warning"
      ? "border-l-warning-500"
      : "border-l-accent-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className={`bg-[var(--surface)] border border-[var(--border)] border-l-[3px] ${borderColor} rounded-xl shadow-lg p-4 max-w-sm w-full`}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-[var(--text-tertiary)] dark:text-[#847e76] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] leading-relaxed">
            {suggestion.text}
          </p>
          {suggestion.actions && suggestion.actions.length > 0 && (
            <div className="flex gap-2 mt-2">
              {suggestion.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={onDismiss}
                  className="text-xs text-[var(--text-primary)] dark:text-[#ece9e4] hover:text-[var(--text-secondary)] dark:hover:text-[#a8a39c] transition-colors cursor-pointer"
                >
                  Got it
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 text-[var(--text-tertiary)] dark:text-[#847e76] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4] transition-colors shrink-0 cursor-pointer"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
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
    <div className="fixed top-20 right-6 z-[200] flex flex-col gap-3">
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
