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
  Settings,
  Check,
  RotateCcw,
} from "lucide-react";

interface FocusModeProps {
  active: boolean;
  taskName?: string;
  onStop: () => void;
}

type AmbientOption = "rain" | "cafe" | "lofi" | "silence";
type PomodoroPhase = "focus" | "break" | "done";

interface PomodoroPreset {
  label: string;
  focus: number;
  break_: number;
}

const PRESETS: PomodoroPreset[] = [
  { label: "25 / 5", focus: 25, break_: 5 },
  { label: "50 / 10", focus: 50, break_: 10 },
];

const AMBIENT_URLS: Record<string, string> = {
  rain: "https://cdn.pixabay.com/audio/2022/10/30/audio_946ac040e3.mp3",
  cafe: "https://cdn.pixabay.com/audio/2024/11/04/audio_81417244a8.mp3",
  lofi: "https://cdn.pixabay.com/audio/2024/02/14/audio_8e64e03939.mp3",
};

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

/* ---------- Growing Plant SVG ---------- */
function GrowingPlant({ progress, phase }: { progress: number; phase: PomodoroPhase }) {
  // progress: 0 to 1 (how far through the current session)
  const p = phase === "break" ? 1 : Math.min(1, Math.max(0, progress));

  // Stem height grows from 20 to 80
  const stemHeight = 20 + p * 60;
  // Leaves appear at certain thresholds
  const leaf1 = p > 0.2 ? 1 : 0;
  const leaf2 = p > 0.45 ? 1 : 0;
  const leaf3 = p > 0.7 ? 1 : 0;
  const flower = p > 0.9 ? 1 : 0;

  return (
    <svg
      width="120"
      height="140"
      viewBox="0 0 120 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="select-none"
    >
      {/* Pot */}
      <motion.path
        d="M42 120 C42 120 44 135 60 135 C76 135 78 120 78 120 Z"
        fill="#92400e"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.path
        d="M38 118 L82 118 L80 122 L40 122 Z"
        fill="#78350f"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      {/* Soil */}
      <motion.ellipse
        cx="60"
        cy="118"
        rx="18"
        ry="4"
        fill="#451a03"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      />
      {/* Stem */}
      <motion.path
        d={`M60 118 C58 ${118 - stemHeight * 0.3} 62 ${118 - stemHeight * 0.6} 60 ${118 - stemHeight}`}
        stroke="#16a34a"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      {/* Leaf 1 - left */}
      <motion.path
        d={`M58 ${118 - stemHeight * 0.35} C48 ${118 - stemHeight * 0.35 - 8} 44 ${118 - stemHeight * 0.35 - 4} 50 ${118 - stemHeight * 0.35 + 2}`}
        fill="#4ade80"
        stroke="#16a34a"
        strokeWidth="0.5"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: leaf1, opacity: leaf1 }}
        transition={{ duration: 0.6 }}
      />
      {/* Leaf 2 - right */}
      <motion.path
        d={`M62 ${118 - stemHeight * 0.55} C72 ${118 - stemHeight * 0.55 - 10} 76 ${118 - stemHeight * 0.55 - 5} 68 ${118 - stemHeight * 0.55 + 2}`}
        fill="#4ade80"
        stroke="#16a34a"
        strokeWidth="0.5"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: leaf2, opacity: leaf2 }}
        transition={{ duration: 0.6 }}
      />
      {/* Leaf 3 - left higher */}
      <motion.path
        d={`M58 ${118 - stemHeight * 0.75} C46 ${118 - stemHeight * 0.75 - 12} 44 ${118 - stemHeight * 0.75 - 6} 52 ${118 - stemHeight * 0.75 + 1}`}
        fill="#86efac"
        stroke="#16a34a"
        strokeWidth="0.5"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: leaf3, opacity: leaf3 }}
        transition={{ duration: 0.6 }}
      />
      {/* Flower/bud at top */}
      <motion.circle
        cx="60"
        cy={118 - stemHeight - 4}
        r="6"
        fill="#f59e0b"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: flower, opacity: flower }}
        transition={{ duration: 0.8, type: "spring" }}
      />
      <motion.circle
        cx="60"
        cy={118 - stemHeight - 4}
        r="3"
        fill="#fbbf24"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: flower, opacity: flower }}
        transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
      />
    </svg>
  );
}

export default function FocusMode({ active, taskName, onStop }: FocusModeProps) {
  // Pomodoro settings
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [showSettings, setShowSettings] = useState(false);
  const [customFocus, setCustomFocus] = useState("25");
  const [customBreak, setCustomBreak] = useState("5");

  // Timer state
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [paused, setPaused] = useState(false);
  const [phase, setPhase] = useState<PomodoroPhase>("focus");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session stats
  const [completedToday, setCompletedToday] = useState(0);

  // Ambient audio
  const [ambient, setAmbient] = useState<AmbientOption>("silence");
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load stats on mount
  useEffect(() => {
    setCompletedToday(getTodayPomodoros());
  }, []);

  // Reset on activation
  useEffect(() => {
    if (active) {
      const total = focusMinutes * 60;
      setSecondsRemaining(total);
      setTotalSeconds(total);
      setPaused(false);
      setPhase("focus");
      setShowSettings(false);
      setCompletedToday(getTodayPomodoros());
    } else {
      // Stop audio when deactivated
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    }
  }, [active, focusMinutes]);

  // Timer tick (countdown)
  useEffect(() => {
    if (!active || paused || phase === "done") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Timer reached 0
          if (phase === "focus") {
            // Focus complete - increment stats and switch to break
            incrementTodayPomodoros();
            setCompletedToday(getTodayPomodoros());
            const breakTotal = breakMinutes * 60;
            setTotalSeconds(breakTotal);
            setPhase("break");
            return breakTotal;
          } else {
            // Break complete
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

  // Audio management
  useEffect(() => {
    if (!active) return;

    if (ambient === "silence") {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      return;
    }

    const url = AMBIENT_URLS[ambient];
    if (!url) return;

    // Create or update audio element
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }

    if (audioRef.current.src !== url) {
      audioRef.current.src = url;
    }
    audioRef.current.volume = volume;

    if (!paused && phase !== "done") {
      audioRef.current.play().catch(() => {
        // Browser autoplay restriction - silently handle
      });
    } else {
      audioRef.current.pause();
    }

    return () => {
      // Cleanup handled by deactivation effect
    };
  }, [active, ambient, paused, phase, volume]);

  // Update volume when slider changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
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

  const applyPreset = (preset: PomodoroPreset) => {
    setFocusMinutes(preset.focus);
    setBreakMinutes(preset.break_);
    setCustomFocus(String(preset.focus));
    setCustomBreak(String(preset.break_));
  };

  const applyCustom = () => {
    const f = parseInt(customFocus, 10);
    const b = parseInt(customBreak, 10);
    if (f > 0 && f <= 120 && b > 0 && b <= 60) {
      setFocusMinutes(f);
      setBreakMinutes(b);
    }
  };

  // Format time
  const displayMinutes = Math.floor(secondsRemaining / 60);
  const displaySeconds = secondsRemaining % 60;
  const timeDisplay = `${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;

  // Progress for plant growth (0 to 1)
  const progress = totalSeconds > 0 ? 1 - secondsRemaining / totalSeconds : 0;

  const ambientOptions: { key: AmbientOption; icon: React.ReactNode; label: string }[] = [
    { key: "rain", icon: <Cloud size={18} strokeWidth={1.5} />, label: "Rain" },
    { key: "cafe", icon: <Coffee size={18} strokeWidth={1.5} />, label: "Cafe" },
    { key: "lofi", icon: <Music size={18} strokeWidth={1.5} />, label: "Lo-fi" },
    { key: "silence", icon: <VolumeX size={18} strokeWidth={1.5} />, label: "Silence" },
  ];

  // Phase-dependent colors
  const isFocus = phase === "focus";
  const isBreak = phase === "break";
  const isDone = phase === "done";

  const gradientOverlay = isFocus
    ? "before:bg-[radial-gradient(ellipse_at_center,rgba(74,222,128,0.06),rgba(245,158,11,0.03),transparent_70%)]"
    : "before:bg-[radial-gradient(ellipse_at_center,rgba(94,234,212,0.06),rgba(34,197,94,0.03),transparent_70%)]";

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
          <div
            className={`absolute inset-0 bg-[var(--bg)] before:absolute before:inset-0 ${gradientOverlay}`}
          />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 flex flex-col items-center gap-6 px-4 py-8"
          >
            {/* Settings toggle */}
            {phase === "focus" && secondsRemaining === totalSeconds && !paused && (
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="absolute top-4 right-4 p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition"
                aria-label="Settings"
              >
                <Settings size={20} strokeWidth={1.5} />
              </button>
            )}

            {/* Settings panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full max-w-xs overflow-hidden"
                >
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      Timer Presets
                    </p>
                    <div className="flex gap-2">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          onClick={() => applyPreset(preset)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                            focusMinutes === preset.focus && breakMinutes === preset.break_
                              ? "border-green-600 bg-green-600/10 text-green-600 dark:text-green-400"
                              : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={customFocus}
                        onChange={(e) => setCustomFocus(e.target.value)}
                        className="w-16 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-green-500"
                        placeholder="Focus"
                      />
                      <span className="text-xs text-[var(--text-tertiary)]">min focus /</span>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={customBreak}
                        onChange={(e) => setCustomBreak(e.target.value)}
                        className="w-16 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-green-500"
                        placeholder="Break"
                      />
                      <span className="text-xs text-[var(--text-tertiary)]">min break</span>
                      <button
                        onClick={() => {
                          applyCustom();
                          setShowSettings(false);
                        }}
                        className="ml-auto p-1.5 rounded-lg bg-green-600/10 text-green-600 dark:text-green-400 hover:bg-green-600/20 transition"
                        aria-label="Apply"
                      >
                        <Check size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Task name */}
            {taskName && (
              <p className="text-base text-[var(--text-tertiary)] font-medium">{taskName}</p>
            )}

            {/* Phase indicator */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isFocus
                    ? "bg-green-500"
                    : isBreak
                      ? "bg-teal-400"
                      : "bg-amber-400"
                }`}
              />
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                {isFocus ? "Focus" : isBreak ? "Break" : "Session Complete"}
              </span>
            </div>

            {/* Timer display */}
            {!isDone && (
              <div className="text-center">
                <p className="text-7xl font-light tabular-nums tracking-wider text-[#fef3c7] dark:text-[#fef3c7]">
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
            )}

            {/* Done state */}
            {isDone && (
              <div className="text-center space-y-2">
                <p className="text-2xl font-medium text-[#fef3c7]">
                  Break complete!
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Ready for another session?
                </p>
              </div>
            )}

            {/* Growing plant illustration */}
            <div className="flex flex-col items-center">
              <GrowingPlant progress={progress} phase={phase} />
            </div>

            {/* Session stats */}
            <p className="text-sm text-[var(--text-tertiary)]">
              You completed{" "}
              <span className="font-medium text-amber-500 dark:text-amber-400">
                {completedToday}
              </span>{" "}
              {completedToday === 1 ? "pomodoro" : "pomodoros"} today
            </p>

            {/* Controls */}
            <div className="flex items-center gap-4">
              {!isDone && (
                <>
                  <button
                    onClick={togglePause}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] ring-1 ring-[var(--border)] transition hover:bg-[var(--bg-tertiary)]"
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
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-600/10 text-green-600 dark:text-green-400 ring-1 ring-green-600/20 transition hover:bg-green-600/20 text-sm font-medium"
                  >
                    <RotateCcw size={16} strokeWidth={1.5} />
                    Start Another
                  </button>
                  <button
                    onClick={onStop}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--surface-hover)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] transition hover:bg-[var(--bg-tertiary)] text-sm font-medium"
                  >
                    <StopCircle size={16} strokeWidth={1.5} />
                    Done
                  </button>
                </>
              )}
            </div>

            {/* Ambient selector */}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
