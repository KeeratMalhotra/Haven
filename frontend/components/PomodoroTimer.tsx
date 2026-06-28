"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  Cloud,
  Coffee,
  Music,
  VolumeX,
  Volume2,
  RotateCcw,
} from "lucide-react";

interface PomodoroTimerProps {
  active: boolean;
  taskName?: string;
  onStop: () => void;
}

type AmbientOption = "rain" | "cafe" | "lofi" | "silence";
type PomodoroPhase = "selecting" | "focus" | "break" | "done";

const DURATION_OPTIONS = [25, 45, 60, 90] as const;

/* ---------- Web Audio API Ambient Sound Generators ---------- */

interface AmbientNodes {
  context: AudioContext;
  gainNode: GainNode;
  sources: AudioNode[];
}

function createWhiteNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * seconds;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createBrownNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * seconds;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5;
  }
  return buffer;
}

function createPinkNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * seconds;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    data[i] *= 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

function createRainAmbient(ctx: AudioContext, gainNode: GainNode): AudioNode[] {
  const buffer = createWhiteNoiseBuffer(ctx, 4);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 800;
  bandpass.Q.value = 0.5;
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 200;
  source.connect(bandpass);
  bandpass.connect(highpass);
  highpass.connect(gainNode);
  source.start();
  return [source];
}

function createCafeAmbient(ctx: AudioContext, gainNode: GainNode): AudioNode[] {
  const buffer = createBrownNoiseBuffer(ctx, 4);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 500;
  source.connect(lowpass);
  lowpass.connect(gainNode);
  source.start();
  return [source];
}

function createLofiAmbient(ctx: AudioContext, gainNode: GainNode): AudioNode[] {
  const buffer = createPinkNoiseBuffer(ctx, 4);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 600;
  bandpass.Q.value = 1.0;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.3;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 150;
  lfo.connect(lfoGain);
  lfoGain.connect(bandpass.frequency);
  lfo.start();
  source.connect(bandpass);
  bandpass.connect(gainNode);
  source.start();
  return [source, lfo];
}

function startAmbientAudio(type: AmbientOption, volume: number): AmbientNodes | null {
  if (type === "silence") return null;
  const context = new AudioContext();
  const gainNode = context.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(context.destination);
  let sources: AudioNode[];
  switch (type) {
    case "rain":
      sources = createRainAmbient(context, gainNode);
      break;
    case "cafe":
      sources = createCafeAmbient(context, gainNode);
      break;
    case "lofi":
      sources = createLofiAmbient(context, gainNode);
      break;
    default:
      sources = [];
  }
  return { context, gainNode, sources };
}

function stopAmbientAudio(nodes: AmbientNodes | null): void {
  if (!nodes) return;
  try {
    nodes.sources.forEach((source) => {
      if (source instanceof AudioBufferSourceNode) {
        source.stop();
      } else if (source instanceof OscillatorNode) {
        source.stop();
      }
    });
    nodes.context.close();
  } catch {
    // Silently handle already-closed context
  }
}

const STATS_KEY = "chronai-pomodoro-stats";

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getTodayPomodoros(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    return data[getTodayKey()] || 0;
  } catch {
    return 0;
  }
}

function incrementTodayPomodoros(): void {
  if (typeof window === "undefined") return;
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    const key = getTodayKey();
    data[key] = (data[key] || 0) + 1;
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  } catch {
    // silently fail
  }
}

/* ---------- Circular Progress Ring ---------- */
function ProgressRing({ progress, phase }: { progress: number; phase: PomodoroPhase }) {
  const size = 200;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const p = phase === "break" || phase === "selecting" ? 1 : Math.min(1, Math.max(0, progress));
  const offset = circumference - p * circumference;

  const strokeColor =
    phase === "break" ? "stroke-teal-400" : "stroke-amber-500";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-[var(--border-subtle)]"
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={strokeColor}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

export default function PomodoroTimer({ active, taskName, onStop }: PomodoroTimerProps) {
  // Pomodoro settings
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes] = useState(5);

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<PomodoroPhase>("selecting");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session stats
  const [completedToday, setCompletedToday] = useState(0);

  // Ambient audio (Web Audio API)
  const [ambient, setAmbient] = useState<AmbientOption>("silence");
  const [volume, setVolume] = useState(0.5);
  const ambientNodesRef = useRef<AmbientNodes | null>(null);

  // Load stats on mount
  useEffect(() => {
    setCompletedToday(getTodayPomodoros());
  }, []);

  // Reset on activation
  useEffect(() => {
    if (active) {
      setPhase("selecting");
      setPaused(false);
      setCompletedToday(getTodayPomodoros());
    } else {
      stopAmbientAudio(ambientNodesRef.current);
      ambientNodesRef.current = null;
    }
  }, [active]);

  // Broadcast focus-session start/stop so the proactive engine can suppress nudges
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new Event(active ? "chronai-start-focus" : "chronai-stop-focus")
    );
  }, [active]);

  // Timer tick (countdown)
  useEffect(() => {
    if (!active || paused || phase === "done" || phase === "selecting") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (phase === "focus") {
            incrementTodayPomodoros();
            setCompletedToday(getTodayPomodoros());
            const breakTotal = breakMinutes * 60;
            setTotalSeconds(breakTotal);
            setPhase("break");
            return breakTotal;
          } else {
            setPhase("done");
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, paused, phase, breakMinutes]);

  // Audio management (Web Audio API)
  useEffect(() => {
    if (!active) return;

    if (ambient === "silence" || paused || phase === "done" || phase === "selecting") {
      stopAmbientAudio(ambientNodesRef.current);
      ambientNodesRef.current = null;
      return;
    }

    stopAmbientAudio(ambientNodesRef.current);
    ambientNodesRef.current = null;

    const nodes = startAmbientAudio(ambient, volume);
    ambientNodesRef.current = nodes;

    return () => {
      stopAmbientAudio(nodes);
      ambientNodesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ambient, paused, phase]);

  // Update volume when slider changes
  useEffect(() => {
    if (ambientNodesRef.current) {
      ambientNodesRef.current.gainNode.gain.value = volume;
    }
  }, [volume]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const startAnotherSession = useCallback(() => {
    const total = focusMinutes * 60;
    setSecondsRemaining(total);
    setTotalSeconds(total);
    setPaused(false);
    setPhase("focus");
  }, [focusMinutes]);

  const selectDuration = useCallback((minutes: number) => {
    setFocusMinutes(minutes);
    const total = minutes * 60;
    setSecondsRemaining(total);
    setTotalSeconds(total);
    setPaused(false);
    setPhase("focus");
  }, []);

  // Format time
  const displayMinutes = Math.floor(secondsRemaining / 60);
  const displaySeconds = secondsRemaining % 60;
  const timeDisplay = `${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;

  // Progress (0 to 1)
  const progress = totalSeconds > 0 ? 1 - secondsRemaining / totalSeconds : 0;

  const ambientOptions: { key: AmbientOption; icon: React.ReactNode; label: string }[] = [
    { key: "rain", icon: <Cloud size={18} strokeWidth={1.5} />, label: "Rain" },
    { key: "cafe", icon: <Coffee size={18} strokeWidth={1.5} />, label: "Cafe" },
    { key: "lofi", icon: <Music size={18} strokeWidth={1.5} />, label: "Lo-fi" },
    { key: "silence", icon: <VolumeX size={18} strokeWidth={1.5} />, label: "Silence" },
  ];

  const isFocus = phase === "focus";
  const isBreak = phase === "break";
  const isDone = phase === "done";
  const isSelecting = phase === "selecting";

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-[var(--bg)] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.04),rgba(251,191,36,0.02),transparent_70%)]" />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 flex flex-col items-center gap-6 px-4 py-8"
          >
            {/* Task name */}
            {taskName && !isSelecting && (
              <p className="text-base text-[var(--text-tertiary)] font-medium">{taskName}</p>
            )}

            {/* Duration selection screen */}
            {isSelecting && (
              <div className="flex flex-col items-center gap-6 mt-4">
                {taskName && (
                  <p className="text-base text-[var(--text-tertiary)] font-medium">{taskName}</p>
                )}
                <div className="text-center space-y-2">
                  <p className="text-2xl font-medium text-[var(--text-primary)]">
                    Choose Focus Duration
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Select how long you want to focus
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  {DURATION_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      onClick={() => selectDuration(mins)}
                      className="flex flex-col items-center justify-center gap-1 px-6 py-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-amber-500/40 transition-all duration-200 group"
                    >
                      <span className="text-2xl font-semibold group-hover:text-amber-500 transition-colors">
                        {mins}
                      </span>
                      <span className="text-xs text-[var(--text-tertiary)] group-hover:text-amber-500/70 transition-colors">
                        minutes
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={onStop}
                  className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition"
                >
                  <StopCircle size={16} strokeWidth={1.5} />
                  Cancel
                </button>
              </div>
            )}

            {/* Phase indicator */}
            {!isSelecting && (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    isFocus
                      ? "bg-amber-500"
                      : isBreak
                        ? "bg-teal-400"
                        : "bg-amber-400"
                  }`}
                />
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  {isFocus ? "Focus" : isBreak ? "Break" : "Session Complete"}
                </span>
              </div>
            )}

            {/* Timer display with progress ring */}
            {!isDone && !isSelecting && (
              <div className="relative flex items-center justify-center">
                <ProgressRing progress={progress} phase={phase} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-7xl font-light tabular-nums tracking-wider text-[var(--text-primary)]">
                    {timeDisplay}
                  </p>
                  <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                    {paused
                      ? "Paused"
                      : isFocus
                        ? "Stay focused"
                        : "Time for a break!"}
                  </p>
                </div>
              </div>
            )}

            {/* Done state */}
            {isDone && !isSelecting && (
              <div className="text-center space-y-2">
                <p className="text-2xl font-medium text-[var(--text-primary)]">
                  Break complete!
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Ready for another session?
                </p>
              </div>
            )}

            {/* Session stats */}
            {!isSelecting && (
              <p className="text-sm text-[var(--text-tertiary)]">
                You completed{" "}
                <span className="font-medium text-amber-500 dark:text-amber-400">
                  {completedToday}
                </span>{" "}
                {completedToday === 1 ? "pomodoro" : "pomodoros"} today
              </p>
            )}

            {/* Controls */}
            {!isSelecting && (
              <div className="flex items-center gap-4">
                {!isDone && (
                  <>
                    <button
                      onClick={togglePause}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] ring-1 ring-[var(--border)] transition hover:bg-[var(--surface)]"
                      aria-label={paused ? "Resume" : "Pause"}
                    >
                      {paused ? (
                        <PlayCircle size={24} strokeWidth={1.5} />
                      ) : (
                        <PauseCircle size={24} strokeWidth={1.5} />
                      )}
                    </button>
                    <button
                      onClick={onStop}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-500 dark:text-red-400 ring-1 ring-red-500/20 transition hover:bg-red-500/20"
                      aria-label="Stop"
                    >
                      <StopCircle size={24} strokeWidth={1.5} />
                    </button>
                  </>
                )}
                {isDone && (
                  <>
                    <button
                      onClick={startAnotherSession}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 transition hover:bg-amber-500/20 text-sm font-medium"
                    >
                      <RotateCcw size={16} strokeWidth={1.5} />
                      Start Another
                    </button>
                    <button
                      onClick={onStop}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--surface-hover)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] transition hover:bg-[var(--surface)] text-sm font-medium"
                    >
                      <StopCircle size={16} strokeWidth={1.5} />
                      Done
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Ambient selector */}
            {!isSelecting && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2">
                  {ambientOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setAmbient(opt.key)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ring-1 ${
                        ambient === opt.key
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/30"
                          : "text-[var(--text-tertiary)] ring-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
                {/* Volume slider */}
                {ambient !== "silence" && (
                  <div className="flex items-center gap-2 w-48">
                    <Volume2 size={14} strokeWidth={1.5} className="text-[var(--text-tertiary)]" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 rounded-full appearance-none bg-[var(--border)] accent-amber-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
