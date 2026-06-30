"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Square, WifiOff, AlertTriangle } from "lucide-react";
import {
  startListening,
  stopListening,
  cancelListening,
  isRecordingSupported,
} from "@/lib/voice";

interface VoiceModeProps {
  active: boolean;
  onClose: () => void;
  onSpeak: (transcript: string) => void;
  /** Google OAuth token forwarded to the backend STT endpoint. */
  authToken?: string;
  /** Human-friendly status, e.g. "Checking your calendar" */
  statusLabel?: string;
  thinking?: boolean;
  /** WebSocket connection state - voice requires an active connection */
  connectionState?: "connecting" | "connected" | "disconnected";
}

type VoicePhase = "idle" | "listening" | "processing" | "error";

/**
 * VoiceMode
 * An inline voice interaction component that renders within its parent container.
 *
 * Speech-to-text runs server-side: tapping the mic records microphone audio
 * with MediaRecorder and uploads it to the backend Google Cloud Speech-to-Text
 * endpoint. Recording stops automatically after a short silence, or when the
 * user taps again. The resulting transcript is sent as a voice message, and the
 * backend replies with both text and spoken audio (the AI "talks back").
 */
export default function VoiceMode({
  active,
  onClose,
  onSpeak,
  authToken,
  statusLabel,
  thinking,
  connectionState,
}: VoiceModeProps) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [hint, setHint] = useState("Tap to speak");
  const [errorDetail, setErrorDetail] = useState("");
  const busyRef = useRef(false);

  // Reset state and cancel any in-flight recording when voice mode closes.
  useEffect(() => {
    if (!active) {
      cancelListening();
      setPhase("idle");
      setHint("Tap to speak");
      setErrorDetail("");
      busyRef.current = false;
    }
  }, [active]);

  // Cancel any active recording on unmount.
  useEffect(() => {
    return () => cancelListening();
  }, []);

  useEffect(() => {
    if (thinking && active) setPhase("processing");
  }, [thinking, active]);

  // Check recording support on mount.
  useEffect(() => {
    if (active && !isRecordingSupported()) {
      setPhase("error");
      setHint("Voice not supported");
      setErrorDetail(
        "This browser cannot record audio. Please update your browser to use voice."
      );
    }
  }, [active]);

  const handleMic = async () => {
    // If we're already recording, a tap stops it (and transcription begins).
    if (phase === "listening") {
      stopListening();
      return;
    }

    if (busyRef.current) return;

    // Check WebSocket connection before attempting voice.
    if (connectionState === "disconnected") {
      setPhase("error");
      setHint("Not connected");
      setErrorDetail(
        "Connection lost. Please wait for reconnection or refresh the page."
      );
      return;
    }

    if (connectionState === "connecting") {
      setPhase("error");
      setHint("Connecting...");
      setErrorDetail(
        "Still connecting to the server. Please wait a moment and try again."
      );
      return;
    }

    if (!isRecordingSupported()) {
      setPhase("error");
      setHint("Voice not supported");
      setErrorDetail(
        "This browser cannot record audio. Please update your browser to use voice."
      );
      return;
    }

    // getUserMedia requires a secure context (HTTPS or localhost).
    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setPhase("error");
      setHint("HTTPS required");
      setErrorDetail("Microphone access requires a secure (HTTPS) connection.");
      return;
    }

    busyRef.current = true;
    setPhase("listening");
    setHint("Listening... tap to stop");
    setErrorDetail("");
    try {
      const transcript = await startListening(authToken);
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
      } else if (message.includes("no-mic")) {
        setHint("No microphone");
        setErrorDetail(
          "No microphone was found. Please connect a microphone and try again."
        );
      } else if (message.startsWith("auth:")) {
        setHint("Session expired");
        setErrorDetail("Your session expired. Please sign in again and retry.");
      } else {
        setHint("Voice failed");
        setErrorDetail(
          "Could not transcribe your audio. Please check your connection and try again."
        );
      }
    } finally {
      busyRef.current = false;
    }
  };

  if (!active) return null;

  const isListening = phase === "listening";

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
          <span className="text-sm font-medium text-warning-500">{hint}</span>
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
        aria-label={isListening ? "Stop recording" : "Speak"}
        disabled={connectionState === "disconnected"}
      >
        {isListening && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-[var(--text-secondary)]"
            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        {phase === "error" ? (
          <AlertTriangle size={28} className="relative z-10 text-warning-500" />
        ) : connectionState === "disconnected" ? (
          <WifiOff
            size={28}
            className="relative z-10 text-[var(--text-tertiary)] dark:text-[#847e76]"
          />
        ) : isListening ? (
          <Square
            size={24}
            className="relative z-10 fill-current text-[var(--text-primary)] dark:text-[#ece9e4]"
          />
        ) : (
          <Mic
            size={28}
            className="relative z-10 text-[var(--text-secondary)] dark:text-[#a8a39c]"
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
          ? "Recording - tap to stop"
          : phase === "processing"
            ? "Processing..."
            : phase === "error"
              ? "Tap to retry"
              : "Voice mode"}
      </p>
    </motion.div>
  );
}
