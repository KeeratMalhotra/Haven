"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, WifiOff, AlertTriangle } from "lucide-react";
import { startListening } from "@/lib/voice";

interface VoiceModeProps {
  active: boolean;
  onClose: () => void;
  onSpeak: (transcript: string) => void;
  /** Human-friendly status, e.g. "Checking your calendar" */
  statusLabel?: string;
  thinking?: boolean;
  /** WebSocket connection state - voice requires an active connection */
  connectionState?: "connecting" | "connected" | "disconnected";
}

type VoicePhase = "idle" | "listening" | "processing" | "error";

/**
 * Check whether the browser supports the Web Speech API.
 */
function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition
  );
}

/**
 * VoiceMode
 * An inline voice interaction component that renders within its parent container.
 * Tapping the mic captures speech and sends it as a voice message.
 */
export default function VoiceMode({
  active,
  onClose,
  onSpeak,
  statusLabel,
  thinking,
  connectionState,
}: VoiceModeProps) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [hint, setHint] = useState("Tap to speak");
  const [errorDetail, setErrorDetail] = useState("");
  const listeningRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      setHint("Tap to speak");
      setErrorDetail("");
      listeningRef.current = false;
    }
  }, [active]);

  useEffect(() => {
    if (thinking && active) setPhase("processing");
  }, [thinking, active]);

  // Check browser support on mount
  useEffect(() => {
    if (active && !isSpeechRecognitionSupported()) {
      setPhase("error");
      setHint("Voice not supported");
      setErrorDetail(
        "Your browser does not support speech recognition. Please use Chrome or Edge."
      );
    }
  }, [active]);

  const handleMic = async () => {
    if (listeningRef.current) return;

    // Check WebSocket connection before attempting voice
    if (connectionState === "disconnected") {
      setPhase("error");
      setHint("Not connected");
      setErrorDetail("WebSocket is disconnected. Please wait for reconnection or refresh the page.");
      return;
    }

    if (connectionState === "connecting") {
      setPhase("error");
      setHint("Connecting...");
      setErrorDetail("Still connecting to the server. Please wait a moment and try again.");
      return;
    }

    // Check browser support
    if (!isSpeechRecognitionSupported()) {
      setPhase("error");
      setHint("Voice not supported");
      setErrorDetail(
        "Your browser does not support speech recognition. Please use Chrome or Edge."
      );
      return;
    }

    // Check HTTPS (required for SpeechRecognition in production)
    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setPhase("error");
      setHint("HTTPS required");
      setErrorDetail("Voice recognition requires a secure (HTTPS) connection.");
      return;
    }

    listeningRef.current = true;
    setPhase("listening");
    setHint("Listening...");
    setErrorDetail("");
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
    } catch (err: unknown) {
      setPhase("error");
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("not-allowed")) {
        setHint("Microphone blocked");
        setErrorDetail(
          "Microphone access was denied. Please allow microphone permission in your browser settings."
        );
      } else if (message.includes("network")) {
        setHint("Network error");
        setErrorDetail("A network error occurred. Please check your connection and try again.");
      } else {
        setHint("Voice failed");
        setErrorDetail(
          "Speech recognition failed. Make sure you are using Chrome/Edge with HTTPS."
        );
      }
    } finally {
      listeningRef.current = false;
    }
  };

  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      {/* Status / hint */}
      <div className="mb-8 flex h-8 items-center">
        {thinking || phase === "processing" ? (
          <span className="text-sm font-medium tracking-tight text-[var(--text-secondary)] dark:text-[#a8a39c]">
            {statusLabel || "One moment"}
          </span>
        ) : phase === "error" ? (
          <span className="text-sm font-medium text-warning-500">
            {hint}
          </span>
        ) : (
          <span className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76]">
            {hint}
          </span>
        )}
      </div>

      {/* Mic control */}
      <motion.button
        onClick={handleMic}
        whileTap={{ scale: 0.92 }}
        className={`relative grid h-20 w-20 place-items-center rounded-full border transition-colors ${
          phase === "error"
            ? "border-warning-500/30 bg-warning-500/5 hover:border-warning-500/50"
            : connectionState === "disconnected"
              ? "border-[var(--border)] bg-[var(--surface-hover)] opacity-50 cursor-not-allowed"
              : "border-[var(--border)] bg-[var(--surface-hover)] hover:border-[var(--text-tertiary)]"
        }`}
        aria-label="Speak"
        disabled={connectionState === "disconnected"}
      >
        {phase === "listening" && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-[var(--text-secondary)]"
            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {phase === "error" ? (
          <AlertTriangle
            size={28}
            className="relative z-10 text-warning-500"
          />
        ) : connectionState === "disconnected" ? (
          <WifiOff
            size={28}
            className="relative z-10 text-[var(--text-tertiary)] dark:text-[#847e76]"
          />
        ) : (
          <Mic
            size={28}
            className={
              phase === "listening"
                ? "relative z-10 text-[var(--text-primary)] dark:text-[#ece9e4]"
                : "relative z-10 text-[var(--text-secondary)] dark:text-[#a8a39c]"
            }
          />
        )}
      </motion.button>

      {/* Error detail */}
      {errorDetail && phase === "error" && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 max-w-xs text-center text-xs text-[var(--text-tertiary)] dark:text-[#847e76]"
        >
          {errorDetail}
        </motion.p>
      )}

      {/* Phase indicator */}
      <p className="mt-6 text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
        {phase === "listening"
          ? "Speak now"
          : phase === "processing"
            ? "Processing..."
            : phase === "error"
              ? "Tap to retry"
              : "Voice mode"}
      </p>
    </motion.div>
  );
}
