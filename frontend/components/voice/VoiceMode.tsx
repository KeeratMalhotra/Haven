"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Mic, Square, WifiOff, AlertTriangle, Volume2, Sparkles } from "lucide-react";
import {
  startListening,
  stopListening,
  cancelListening,
  isRecordingSupported,
  getVoiceAudioElement,
} from "@/lib/voice";
import { AudioAnalyzer } from "@/components/entity/AudioAnalyzer";

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
type OrbPhase = "idle" | "listening" | "processing" | "speaking" | "error";

/* -------------------------------------------------------------------------- */
/*  Output (TTS) audio analyser                                                */
/*                                                                            */
/*  A single, module-scoped analyser is reused for the lifetime of the page.  */
/*  A MediaElementAudioSourceNode can only be created once per <audio>         */
/*  element, so we must never re-create or dispose this across remounts.       */
/* -------------------------------------------------------------------------- */

let outputAnalyzer: AudioAnalyzer | null = null;
let outputAnalyzerFailed = false;

async function ensureOutputAnalyzer(): Promise<AudioAnalyzer | null> {
  if (outputAnalyzerFailed) return null;
  const el = getVoiceAudioElement();
  if (!el) return null;
  try {
    if (!outputAnalyzer) {
      const analyzer = new AudioAnalyzer();
      await analyzer.init();
      analyzer.connectAudioElement(el);
      outputAnalyzer = analyzer;
    }
    await outputAnalyzer.resume();
    return outputAnalyzer;
  } catch {
    // Web Audio wiring is best-effort; fall back to an eased speaking pulse.
    outputAnalyzerFailed = true;
    return null;
  }
}

/**
 * VoiceMode
 * An inline voice interaction component that renders within its parent container.
 *
 * Speech-to-text runs server-side: tapping the orb records microphone audio
 * with MediaRecorder and uploads it to the backend Google Cloud Speech-to-Text
 * endpoint. Recording stops automatically after a short silence, or when the
 * user taps again. The resulting transcript is sent as a voice message, and the
 * backend replies with both text and spoken audio (the AI "talks back").
 *
 * The centerpiece is a single soft, glowing, ambient orb that reacts in real
 * time: it swells/brightens with the live microphone amplitude while listening,
 * and pulses with the TTS output level while the AI speaks. Phase changes
 * crossfade with spring easing, and prefers-reduced-motion falls back to a
 * gentle static glow.
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
  const [speaking, setSpeaking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const busyRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const wasSpeakingRef = useRef(false);
  const wasThinkingRef = useRef(false);

  // --- Audio-reactive motion plumbing --------------------------------------
  // `level` is the raw 0..1 target (driven by mic input or TTS output); the
  // spring smooths it so the orb breathes organically rather than jittering.
  const level = useMotionValue(0);
  const smooth = useSpring(level, { stiffness: 140, damping: 20, mass: 0.5 });
  const orbScale = useTransform(smooth, [0, 1], [1, 1.22]);
  const glowScale = useTransform(smooth, [0, 1], [1, 1.55]);
  const glowOpacity = useTransform(smooth, [0, 1], [0.35, 0.9]);
  const ringOpacity = useTransform(smooth, [0, 1], [0.25, 0.7]);

  // Track prefers-reduced-motion.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = (matches: boolean) => {
      setReducedMotion(matches);
      reducedMotionRef.current = matches;
      if (matches) level.set(0);
    };
    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [level]);

  // Reset state and cancel any in-flight recording when voice mode closes.
  useEffect(() => {
    if (!active) {
      cancelListening();
      setPhase("idle");
      setHint("Tap to speak");
      setErrorDetail("");
      setSpeaking(false);
      busyRef.current = false;
      wasSpeakingRef.current = false;
      wasThinkingRef.current = false;
      level.set(0);
    }
  }, [active, level]);

  // Cancel any active recording on unmount.
  useEffect(() => {
    return () => cancelListening();
  }, []);

  useEffect(() => {
    if (thinking && active) setPhase("processing");
  }, [thinking, active]);

  // Detect when the AI is talking back by observing the shared playback
  // <audio> element directly (TTS playback is triggered elsewhere).
  useEffect(() => {
    const el = getVoiceAudioElement();
    if (!el) return;
    const onPlay = () => setSpeaking(true);
    const onStop = () => setSpeaking(false);
    el.addEventListener("playing", onPlay);
    el.addEventListener("play", onPlay);
    el.addEventListener("ended", onStop);
    el.addEventListener("pause", onStop);
    el.addEventListener("emptied", onStop);
    return () => {
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("ended", onStop);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("emptied", onStop);
    };
  }, []);

  // Once the AI finishes talking, settle the orb back to idle.
  useEffect(() => {
    if (speaking) {
      wasSpeakingRef.current = true;
    } else if (wasSpeakingRef.current) {
      wasSpeakingRef.current = false;
      setPhase("idle");
      setHint("Tap to speak");
    }
  }, [speaking]);

  // If the reply was text-only (no TTS audio), still settle back to idle when
  // the "thinking" phase ends.
  useEffect(() => {
    if (thinking) {
      wasThinkingRef.current = true;
    } else if (wasThinkingRef.current && !speaking) {
      wasThinkingRef.current = false;
      setPhase((p) => (p === "processing" ? "idle" : p));
    }
  }, [thinking, speaking]);

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

  // Resolve the current high-level orb phase from the various signals.
  const orbPhase: OrbPhase =
    phase === "error"
      ? "error"
      : phase === "listening"
        ? "listening"
        : speaking
          ? "speaking"
          : thinking || phase === "processing"
            ? "processing"
            : "idle";

  // Drive the orb level for non-listening phases. (Listening is driven live by
  // the onLevel callback from startListening.)
  useEffect(() => {
    if (reducedMotion) {
      level.set(0);
      return;
    }

    let raf = 0;
    let cancelled = false;
    let analyzer: AudioAnalyzer | null = null;

    if (orbPhase === "speaking") {
      ensureOutputAnalyzer().then((a) => {
        if (!cancelled) analyzer = a;
      });
      const loop = () => {
        if (cancelled) return;
        if (analyzer) {
          // Real output reactivity from the TTS audio element.
          const avg = analyzer.getAverageFrequency();
          level.set(Math.min(1, avg * 1.9));
        } else {
          // Eased fallback "speaking" pulse until/if the analyser is ready.
          const t = performance.now() / 1000;
          level.set(0.42 + 0.22 * (0.5 + 0.5 * Math.sin(t * 4.2)));
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else if (orbPhase === "processing") {
      // A calm, slow "thinking" swell.
      const loop = () => {
        if (cancelled) return;
        const t = performance.now() / 1000;
        level.set(0.28 + 0.16 * (0.5 + 0.5 * Math.sin(t * 2.2)));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else if (orbPhase !== "listening") {
      // idle / error — rest (idle "breathing" is a separate gentle transform).
      level.set(0);
    }

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [orbPhase, reducedMotion, level]);

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

    // Instant feedback: show the listening/orb-active state the moment the
    // user taps, before getUserMedia resolves.
    busyRef.current = true;
    setPhase("listening");
    setHint("Listening... tap to stop");
    setErrorDetail("");
    try {
      const transcript = await startListening(authToken, {
        onLevel: (lvl) => {
          if (!reducedMotionRef.current) level.set(lvl);
        },
      });
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
      if (!reducedMotionRef.current) level.set(0);
    }
  };

  if (!active) return null;

  const isDisconnected = connectionState === "disconnected";
  const isListening = orbPhase === "listening";
  const idleBreathing =
    orbPhase === "idle" && !reducedMotion && !isDisconnected;

  // Soft, warm radial-gradient fills for the orb core per state.
  const coreBackground =
    orbPhase === "error"
      ? "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.25) 0%, var(--surface-hover) 42%, var(--border) 100%)"
      : isDisconnected
        ? "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.18) 0%, var(--surface-hover) 45%, var(--border) 100%)"
        : "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.55) 0%, var(--warm) 32%, var(--accent) 68%, var(--accent-hover) 100%)";

  // One calm status line that crossfades between states.
  const statusText =
    orbPhase === "error"
      ? hint
      : orbPhase === "speaking"
        ? "Speaking"
        : orbPhase === "processing"
          ? statusLabel || "One moment"
          : orbPhase === "listening"
            ? "Listening - tap to stop"
            : isDisconnected
              ? "Reconnecting"
              : hint;

  const statusClass =
    orbPhase === "error"
      ? "text-warning-500"
      : orbPhase === "processing" || orbPhase === "speaking"
        ? "text-[var(--text-secondary)] dark:text-[#a8a39c]"
        : "text-[var(--text-tertiary)] dark:text-[#847e76]";

  const orbIcon =
    orbPhase === "error" ? (
      <AlertTriangle size={26} className="text-warning-500" />
    ) : isDisconnected ? (
      <WifiOff size={26} className="text-[var(--text-tertiary)] dark:text-[#847e76]" />
    ) : isListening ? (
      <Square size={22} className="fill-current text-[#3a2418]" />
    ) : orbPhase === "speaking" ? (
      <Volume2 size={26} className="text-[#3a2418]" />
    ) : orbPhase === "processing" ? (
      <Sparkles size={24} className="text-[#3a2418]" />
    ) : (
      <Mic size={26} className="text-[#3a2418]" />
    );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full w-full flex-col items-center justify-center"
    >
      {/* Soft glowing orb */}
      <motion.button
        type="button"
        onClick={handleMic}
        whileTap={reducedMotion ? undefined : { scale: 0.94 }}
        disabled={isDisconnected}
        aria-label={
          isListening
            ? "Stop recording"
            : isDisconnected
              ? "Voice unavailable - disconnected"
              : "Speak"
        }
        className={`relative grid place-items-center rounded-full focus-ring ${
          isDisconnected ? "cursor-not-allowed opacity-60" : ""
        }`}
        style={{ width: 220, height: 220, background: "transparent" }}
      >
        <motion.div
          className="relative grid place-items-center"
          style={{ width: 220, height: 220 }}
          animate={idleBreathing ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={
            idleBreathing
              ? { duration: 5.5, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.5, ease: "easeOut" }
          }
        >
          {/* Outer blurred halo */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: 220,
              height: 220,
              scale: reducedMotion ? 1 : glowScale,
              opacity: reducedMotion ? 0.35 : glowOpacity,
              background:
                "radial-gradient(circle, var(--warm-glow) 0%, rgba(0,0,0,0) 70%)",
              filter: "blur(30px)",
            }}
          />

          {/* Mid ambient ring */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: 156,
              height: 156,
              scale: reducedMotion ? 1 : orbScale,
              opacity: reducedMotion ? 0.3 : ringOpacity,
              background:
                "radial-gradient(circle, var(--accent-muted) 0%, rgba(0,0,0,0) 72%)",
              filter: "blur(12px)",
            }}
          />

          {/* Core orb */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              width: 124,
              height: 124,
              scale: reducedMotion ? 1 : orbScale,
              background: coreBackground,
              boxShadow:
                orbPhase === "error" || isDisconnected
                  ? "inset 0 1px 6px rgba(255,255,255,0.15)"
                  : "0 0 44px -6px var(--warm-glow), inset 0 2px 14px rgba(255,255,255,0.3)",
            }}
          />

          {/* Center icon */}
          <span className="relative z-10 grid h-[124px] w-[124px] place-items-center">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={orbPhase}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="grid place-items-center"
              >
                {orbIcon}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.div>
      </motion.button>

      {/* One calm status line that crossfades between states */}
      <div className="mt-10 flex h-6 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`${orbPhase}-${statusText}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`text-sm font-medium tracking-tight ${statusClass}`}
          >
            {statusText}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Error detail */}
      <AnimatePresence>
        {errorDetail && orbPhase === "error" && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
            className="mt-3 max-w-xs text-center text-xs text-[var(--text-tertiary)] dark:text-[#847e76]"
          >
            {errorDetail}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
