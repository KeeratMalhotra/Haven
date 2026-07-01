"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { recordObservation } from "@/lib/api-extended";

interface PomodoroTimerProps {
  active: boolean;
  taskName?: string;
  onStop: () => void;
}

type PomodoroPhase = "selecting" | "focus" | "break" | "done";

const DURATION_OPTIONS = [25, 45, 60, 90] as const;

const STATS_KEY = "chronai-pomodoro-stats";

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getTodayMinutes(): number {
  if (typeof window === "undefined") return 0;
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    return data[getTodayKey()] || 0;
  } catch {
    return 0;
  }
}

function incrementTodayPomodoros(focusMinutes: number): void {
  if (typeof window === "undefined") return;
  try {
    const data = JSON.parse(localStorage.getItem(STATS_KEY) || "{}");
    const key = getTodayKey();
    data[key] = (data[key] || 0) + focusMinutes;
    localStorage.setItem(STATS_KEY, JSON.stringify(data));
  } catch {
    // silently fail
  }
}

/* ---------- Growing Plant SVG Component ---------- */
function PlantGrowth({ progress, phase }: { progress: number; phase: PomodoroPhase }) {
  // Determine growth stage based on progress
  const p = phase === "break" || phase === "selecting" ? 0 : Math.min(1, Math.max(0, progress));

  return (
    <svg
      width={200}
      height={240}
      viewBox="0 0 200 240"
      className="select-none"
      aria-label="Growing plant progress indicator"
    >
      {/* Pot */}
      <motion.g
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-amber-800 dark:text-amber-700"
      >
        {/* Pot rim */}
        <rect x="65" y="175" width="70" height="10" rx="3" fill="currentColor" />
        {/* Pot body - trapezoid */}
        <path d="M70 185 L75 225 L125 225 L130 185 Z" fill="currentColor" />
        {/* Pot base */}
        <rect x="80" y="225" width="40" height="6" rx="3" fill="currentColor" />
        {/* Soil */}
        <ellipse cx="100" cy="178" rx="30" ry="6" className="text-amber-950 dark:text-amber-900" fill="currentColor" />
      </motion.g>

      {/* Stage 1: Sprout (10-25%) */}
      <motion.g
        initial={{ opacity: 0, scaleY: 0 }}
        animate={{
          opacity: p >= 0.1 ? 1 : 0,
          scaleY: p >= 0.1 ? 1 : 0,
        }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{ originX: "100px", originY: "175px", transformOrigin: "100px 175px" }}
        className="text-green-600 dark:text-green-500"
      >
        {/* Small sprout */}
        <motion.path
          d="M100 175 Q100 165 100 160"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          animate={{ pathLength: p >= 0.1 ? 1 : 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {/* Tiny leaf on sprout */}
        <motion.ellipse
          cx="104"
          cy="162"
          rx="5"
          ry="3"
          className="text-green-500 dark:text-green-400"
          fill="currentColor"
          animate={{
            opacity: p >= 0.15 ? 1 : 0,
            scale: p >= 0.15 ? 1 : 0,
          }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
      </motion.g>

      {/* Stage 2: Stem with 2 leaves (25-50%) */}
      <motion.g
        animate={{
          opacity: p >= 0.25 ? 1 : 0,
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-green-600 dark:text-green-500"
      >
        {/* Taller stem */}
        <motion.path
          d="M100 160 Q100 145 100 135"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          animate={{ pathLength: p >= 0.25 ? 1 : 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {/* Left leaf */}
        <motion.path
          d="M100 150 Q90 145 85 148 Q88 155 100 150"
          className="text-green-500 dark:text-green-400"
          fill="currentColor"
          animate={{
            opacity: p >= 0.3 ? 1 : 0,
            scale: p >= 0.3 ? 1 : 0.3,
          }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
        {/* Right leaf */}
        <motion.path
          d="M100 142 Q110 137 115 140 Q112 147 100 142"
          className="text-green-500 dark:text-green-400"
          fill="currentColor"
          animate={{
            opacity: p >= 0.35 ? 1 : 0,
            scale: p >= 0.35 ? 1 : 0.3,
          }}
          transition={{ duration: 0.8, delay: 0.4 }}
        />
      </motion.g>

      {/* Stage 3: More growth with bud (50-75%) */}
      <motion.g
        animate={{
          opacity: p >= 0.5 ? 1 : 0,
        }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-green-600 dark:text-green-500"
      >
        {/* Even taller stem */}
        <motion.path
          d="M100 135 Q99 120 100 105"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          animate={{ pathLength: p >= 0.5 ? 1 : 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        {/* Left larger leaf */}
        <motion.path
          d="M100 125 Q85 118 80 122 Q83 132 100 125"
          className="text-green-500 dark:text-green-400"
          fill="currentColor"
          animate={{
            opacity: p >= 0.55 ? 1 : 0,
            scale: p >= 0.55 ? 1 : 0.3,
          }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
        {/* Right larger leaf */}
        <motion.path
          d="M100 115 Q115 108 120 112 Q117 122 100 115"
          className="text-green-500 dark:text-green-400"
          fill="currentColor"
          animate={{
            opacity: p >= 0.6 ? 1 : 0,
            scale: p >= 0.6 ? 1 : 0.3,
          }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />
        {/* Bud */}
        <motion.ellipse
          cx="100"
          cy="100"
          rx="6"
          ry="8"
          fill="currentColor"
          animate={{
            opacity: p >= 0.65 ? 1 : 0,
            scale: p >= 0.65 ? 1 : 0,
          }}
          transition={{ duration: 0.8, delay: 0.5 }}
        />
      </motion.g>

      {/* Stage 4: Full bloom (75-100%) */}
      <motion.g
        animate={{
          opacity: p >= 0.75 ? 1 : 0,
        }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="text-green-600 dark:text-green-500"
      >
        {/* Top stem */}
        <motion.path
          d="M100 105 Q100 95 100 85"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          animate={{ pathLength: p >= 0.75 ? 1 : 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Additional leaves */}
        <motion.path
          d="M100 95 Q88 88 83 92 Q86 100 100 95"
          className="text-green-500 dark:text-green-400"
          fill="currentColor"
          animate={{
            opacity: p >= 0.78 ? 1 : 0,
            scale: p >= 0.78 ? 1 : 0.3,
          }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <motion.path
          d="M100 90 Q112 83 117 87 Q114 95 100 90"
          className="text-green-500 dark:text-green-400"
          fill="currentColor"
          animate={{
            opacity: p >= 0.8 ? 1 : 0,
            scale: p >= 0.8 ? 1 : 0.3,
          }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
        {/* Flower petals */}
        <motion.g
          animate={{
            opacity: p >= 0.85 ? 1 : 0,
            scale: p >= 0.85 ? 1 : 0,
          }}
          transition={{ duration: 1, delay: 0.4, type: "spring", stiffness: 200 }}
          style={{ transformOrigin: "100px 70px" }}
          className="text-amber-500 dark:text-amber-400"
        >
          {/* Petals arranged around center */}
          <ellipse cx="100" cy="60" rx="7" ry="12" fill="currentColor" opacity="0.9" />
          <ellipse cx="110" cy="66" rx="7" ry="12" fill="currentColor" opacity="0.8" transform="rotate(60, 110, 66)" />
          <ellipse cx="110" cy="78" rx="7" ry="12" fill="currentColor" opacity="0.85" transform="rotate(120, 110, 78)" />
          <ellipse cx="100" cy="84" rx="7" ry="12" fill="currentColor" opacity="0.9" transform="rotate(180, 100, 84)" />
          <ellipse cx="90" cy="78" rx="7" ry="12" fill="currentColor" opacity="0.85" transform="rotate(240, 90, 78)" />
          <ellipse cx="90" cy="66" rx="7" ry="12" fill="currentColor" opacity="0.8" transform="rotate(300, 90, 66)" />
          {/* Center */}
          <circle cx="100" cy="72" r="8" className="text-amber-600 dark:text-amber-500" fill="currentColor" />
          <circle cx="100" cy="72" r="5" className="text-amber-700 dark:text-amber-600" fill="currentColor" />
        </motion.g>
      </motion.g>
    </svg>
  );
}

export default function PomodoroTimer({ active, taskName, onStop }: PomodoroTimerProps) {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string })?.accessToken || "";

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

  // Track if timer just started (for glow effect)
  const [justStarted, setJustStarted] = useState(false);

  // Hint text visibility
  const [showHint, setShowHint] = useState(false);

  // Refs for setTimeout cleanup on unmount
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load stats on mount
  useEffect(() => {
    setCompletedToday(getTodayMinutes());
  }, []);

  // Reset on activation
  useEffect(() => {
    if (active) {
      setPhase("selecting");
      setPaused(false);
      setCompletedToday(getTodayMinutes());
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
            incrementTodayPomodoros(focusMinutes);
            setCompletedToday(getTodayMinutes());
            // Learn from the completed focus session so the memory panel and
            // adaptive planning know deep work is part of the user's routine.
            recordObservation(accessToken, "focus_session", {
              hour: new Date().getHours(),
              minutes: focusMinutes,
            });
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
  }, [active, paused, phase, breakMinutes, focusMinutes]);

  // Cleanup timeouts on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
      if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    };
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const startAnotherSession = useCallback(() => {
    const total = focusMinutes * 60;
    setSecondsRemaining(total);
    setTotalSeconds(total);
    setPaused(false);
    setPhase("focus");
    setJustStarted(true);
    if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    glowTimeoutRef.current = setTimeout(() => setJustStarted(false), 1500);
    setShowHint(true);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => setShowHint(false), 15000);
  }, [focusMinutes]);

  const selectDuration = useCallback((minutes: number) => {
    setFocusMinutes(minutes);
    const total = minutes * 60;
    setSecondsRemaining(total);
    setTotalSeconds(total);
    setPaused(false);
    setPhase("focus");
    setJustStarted(true);
    if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    glowTimeoutRef.current = setTimeout(() => setJustStarted(false), 1500);
    setShowHint(true);
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = setTimeout(() => setShowHint(false), 15000);
  }, []);

  const openAIChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent("chronai-open-chat"));
  }, []);

  // Format time
  const displayMinutes = Math.floor(secondsRemaining / 60);
  const displaySeconds = secondsRemaining % 60;
  const timeDisplay = `${String(displayMinutes).padStart(2, "0")}:${String(displaySeconds).padStart(2, "0")}`;

  // Progress (0 to 1)
  const progress = totalSeconds > 0 ? 1 - secondsRemaining / totalSeconds : 0;

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
          <div className="relative z-10 flex flex-col items-center gap-6 px-4 py-8 w-full max-w-md">
            <AnimatePresence mode="wait">
              {/* Duration selection screen */}
              {isSelecting && (
                <motion.div
                  key="selecting"
                  initial={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.3, ease: "easeIn" }}
                  className="flex flex-col items-center gap-6 mt-4"
                >
                  {taskName && (
                    <p className="text-base text-[var(--text-tertiary)] dark:text-[#847e76] font-medium">{taskName}</p>
                  )}
                  <div className="text-center space-y-2">
                    <p className="text-2xl font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                      Choose Focus Duration
                    </p>
                    <p className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76]">
                      Select how long you want to focus
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                    {DURATION_OPTIONS.map((mins) => (
                      <button
                        key={mins}
                        onClick={() => selectDuration(mins)}
                        className="flex flex-col items-center justify-center gap-1 px-6 py-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)] hover:border-amber-500/40 transition-all duration-200 group"
                      >
                        <span className="text-2xl font-semibold group-hover:text-amber-500 transition-colors">
                          {mins}
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] group-hover:text-amber-500/70 transition-colors">
                          minutes
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={onStop}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-[var(--text-tertiary)] dark:text-[#847e76] hover:text-[var(--text-secondary)] dark:hover:text-[#a8a39c] hover:bg-[var(--surface-hover)] transition"
                  >
                    <StopCircle size={16} strokeWidth={1.5} />
                    Cancel
                  </button>
                </motion.div>
              )}

              {/* Active timer screen */}
              {!isSelecting && (
                <motion.div
                  key="active"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 260, damping: 24 }}
                  className="flex flex-col items-center gap-6"
                >
                  {/* Task name */}
                  {taskName && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="text-base text-[var(--text-tertiary)] dark:text-[#847e76] font-medium"
                    >
                      {taskName}
                    </motion.p>
                  )}

                  {/* Phase indicator */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        isFocus
                          ? "bg-amber-500"
                          : isBreak
                            ? "bg-teal-400"
                            : "bg-amber-400"
                      }`}
                    />
                    <span className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
                      {isFocus ? "Focus" : isBreak ? "Break" : "Session Complete"}
                    </span>
                  </motion.div>

                  {/* Plant growth hint text */}
                  <AnimatePresence>
                    {showHint && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.4 }}
                        className="text-sm text-center text-[var(--text-tertiary)] dark:text-[#847e76] italic"
                      >
                        The plant will grow as time passes - the more you focus, the more it blooms
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Plant SVG with glow effect */}
                  {!isDone && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                      className="relative"
                    >
                      {/* Glow pulse on start */}
                      {justStarted && (
                        <motion.div
                          className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.3, 1.5] }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                        />
                      )}
                      <PlantGrowth progress={progress} phase={phase} />
                    </motion.div>
                  )}

                  {/* Timer display */}
                  {!isDone && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex flex-col items-center"
                    >
                      <p className="text-6xl font-light tabular-nums tracking-wider text-[var(--text-primary)] dark:text-[#ece9e4]">
                        {timeDisplay}
                      </p>
                      <p className="mt-2 text-sm text-[var(--text-tertiary)] dark:text-[#847e76]">
                        {paused
                          ? "Paused"
                          : isFocus
                            ? "Stay focused"
                            : "Time for a break!"}
                      </p>
                    </motion.div>
                  )}

                  {/* Done state */}
                  {isDone && (
                    <div className="text-center space-y-2">
                      <p className="text-2xl font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
                        Break complete!
                      </p>
                      <p className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76]">
                        Ready for another session?
                      </p>
                    </div>
                  )}

                  {/* Session stats */}
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76]"
                  >
                    <span className="font-medium text-amber-500 dark:text-amber-400">
                      {completedToday}
                    </span>{" "}
                    {completedToday === 1 ? "minute" : "minutes"} focused today
                  </motion.p>

                  {/* Controls */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex items-center gap-4"
                  >
                    {!isDone && (
                      <>
                        <button
                          onClick={togglePause}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] dark:text-[#ece9e4] ring-1 ring-[var(--border)] transition hover:bg-[var(--surface)]"
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
                        <button
                          onClick={openAIChat}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-tertiary)] dark:text-[#847e76] ring-1 ring-[var(--border)] transition hover:text-amber-500 hover:ring-amber-500/30 hover:bg-[var(--surface)]"
                          aria-label="Ask AI"
                          title="Ask AI"
                        >
                          <Sparkles size={24} strokeWidth={1.5} />
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
                          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--surface-hover)] text-[var(--text-secondary)] dark:text-[#a8a39c] ring-1 ring-[var(--border)] transition hover:bg-[var(--surface)] text-sm font-medium"
                        >
                          <StopCircle size={16} strokeWidth={1.5} />
                          Done
                        </button>
                        <button
                          onClick={openAIChat}
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-tertiary)] dark:text-[#847e76] ring-1 ring-[var(--border)] transition hover:text-amber-500 hover:ring-amber-500/30 hover:bg-[var(--surface)]"
                          aria-label="Ask AI"
                          title="Ask AI"
                        >
                          <Sparkles size={24} strokeWidth={1.5} />
                        </button>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
