"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, X } from "lucide-react";
import { startListening } from "@/lib/voice";

// The 3D particle entity is heavy and WebGL-only — load it lazily and ONLY
// when voice mode is active. It never appears on the default canvas.
const EntityCanvas = dynamic(
  () => import("@/components/entity/EntityCanvas"),
  { ssr: false }
);

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
 * A full-screen overlay that materializes the audio-reactive particle entity
 * at center stage. Tapping the mic captures speech and sends it as a voice
 * message; the entity reacts to TTS playback via the shared audio element.
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
    setHint("Listening…");
    try {
      const transcript = await startListening();
      if (transcript) {
        onSpeak(transcript);
        setPhase("processing");
        setHint("");
      } else {
        setPhase("idle");
        setHint("Didn't catch that — tap to try again");
      }
    } catch {
      setPhase("idle");
      setHint("Voice isn't available in this browser");
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
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, rgba(13,17,25,0.7), rgba(3,4,9,0.96))",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Exit voice"
            className="absolute right-6 top-6 grid h-11 w-11 place-items-center rounded-full text-white/60 ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={20} />
          </button>

          {/* The entity materializes */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-[55vh] w-full max-w-3xl"
          >
            <EntityCanvas />
          </motion.div>

          {/* Status / hint */}
          <div className="mt-2 flex h-8 items-center">
            {thinking || phase === "processing" ? (
              <span className="thinking-text text-sm font-medium tracking-tight">
                {statusLabel || "One moment"}
              </span>
            ) : (
              <span className="text-sm text-white/45">{hint}</span>
            )}
          </div>

          {/* Mic control */}
          <motion.button
            onClick={handleMic}
            whileTap={{ scale: 0.92 }}
            className="relative mt-8 grid h-20 w-20 place-items-center rounded-full"
            aria-label="Speak"
          >
            <span
              className={`absolute inset-0 rounded-full bg-accent-gradient ${
                phase === "listening" ? "animate-pulse-soft" : ""
              }`}
              style={{ filter: "blur(2px)", opacity: 0.9 }}
            />
            {phase === "listening" && (
              <motion.span
                className="absolute inset-0 rounded-full ring-2 ring-accent-cyan/50"
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
            )}
            <Mic size={28} className="relative z-10 text-white" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
