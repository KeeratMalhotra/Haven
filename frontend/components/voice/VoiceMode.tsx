"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, X } from "lucide-react";
import { startListening } from "@/lib/voice";

interface VoiceModeProps {
  active: boolean;
  onClose: () => void;
  onSpeak: (transcript: string) => void;
  /** Human-friendly status, e.g. "Checking your calendar" */
  statusLabel?: string;
  thinking?: boolean;
}

type VoicePhase = "idle" | "listening" | "processing";

/**
 * VoiceMode
 * A full-screen matte overlay for voice interaction. Tapping the mic captures
 * speech and sends it as a voice message.
 */
export default function VoiceMode({
  active,
  onClose,
  onSpeak,
  statusLabel,
  thinking,
}: VoiceModeProps) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [hint, setHint] = useState("Tap to speak");
  const listeningRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      setHint("Tap to speak");
      listeningRef.current = false;
    }
  }, [active]);

  useEffect(() => {
    if (thinking && active) setPhase("processing");
  }, [thinking, active]);

  const handleMic = async () => {
    if (listeningRef.current) return;
    listeningRef.current = true;
    setPhase("listening");
    setHint("Listening...");
    try {
      const transcript = await startListening();
      if (transcript) {
        onSpeak(transcript);
        setPhase("processing");
        setHint("");
      } else {
        setPhase("idle");
        setHint("Didn't catch that - tap to try again");
      }
    } catch {
      setPhase("idle");
      setHint("Requires HTTPS and Chrome/Edge");
    } finally {
      listeningRef.current = false;
    }
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg)]/95 backdrop-blur-xl"
        >
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Exit voice"
            className="absolute right-6 top-6 grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>

          {/* Status / hint */}
          <div className="mb-8 flex h-8 items-center">
            {thinking || phase === "processing" ? (
              <span className="text-sm font-medium tracking-tight text-[var(--text-secondary)]">
                {statusLabel || "One moment"}
              </span>
            ) : (
              <span className="text-sm text-[var(--text-tertiary)]">
                {hint}
              </span>
            )}
          </div>

          {/* Mic control */}
          <motion.button
            onClick={handleMic}
            whileTap={{ scale: 0.92 }}
            className="relative grid h-20 w-20 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-hover)] transition-colors hover:border-[var(--text-tertiary)]"
            aria-label="Speak"
          >
            {phase === "listening" && (
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-[var(--text-secondary)]"
                animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <Mic
              size={28}
              className={
                phase === "listening"
                  ? "relative z-10 text-[var(--text-primary)]"
                  : "relative z-10 text-[var(--text-secondary)]"
              }
            />
          </motion.button>

          {/* Phase indicator */}
          <p className="mt-6 text-xs text-[var(--text-tertiary)]">
            {phase === "listening"
              ? "Speak now"
              : phase === "processing"
                ? "Processing..."
                : "Voice mode"}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
