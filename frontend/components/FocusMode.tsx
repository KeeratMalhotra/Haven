"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlayCircle,
  PauseCircle,
  StopCircle,
  Cloud,
  Coffee,
  VolumeX,
} from "lucide-react";

interface FocusModeProps {
  active: boolean;
  taskName?: string;
  onStop: () => void;
}

type AmbientOption = "rain" | "cafe" | "silence";

export default function FocusMode({ active, taskName, onStop }: FocusModeProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ambient, setAmbient] = useState<AmbientOption>("silence");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on activation
  useEffect(() => {
    if (active) {
      setElapsedSeconds(0);
      setPaused(false);
      setAmbient("silence");
    }
  }, [active]);

  // Timer tick (count up)
  useEffect(() => {
    if (!active || paused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, paused]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const timeDisplay = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const ambientOptions: { key: AmbientOption; icon: React.ReactNode; label: string }[] = [
    { key: "rain", icon: <Cloud size={18} />, label: "Rain" },
    { key: "cafe", icon: <Coffee size={18} />, label: "Cafe" },
    { key: "silence", icon: <VolumeX size={18} />, label: "Silence" },
  ];

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Background - uses CSS variable with fallback gradient overlay */}
          <div className="absolute inset-0 bg-[var(--bg)] before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_60%)]" />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 25 }}
            className="relative z-10 flex flex-col items-center gap-10"
          >
            {/* Task name */}
            {taskName && (
              <p className="text-base text-[var(--text-tertiary)] font-medium">{taskName}</p>
            )}

            {/* Timer display */}
            <div className="text-center">
              <p className="text-7xl font-light tabular-nums text-[var(--text-primary)] tracking-wider">
                {timeDisplay}
              </p>
              <p className="mt-2 text-sm text-[var(--text-tertiary)]">
                {paused ? "Paused" : "Focused time"}
              </p>
            </div>

            {/* Breathing guide */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{ scale: [0.8, 1.2, 0.8] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 border border-indigo-400/20"
              />
              <span className="text-xs text-[var(--text-tertiary)]">Breathe</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={togglePause}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-primary)] ring-1 ring-[var(--border)] transition hover:bg-[var(--bg-tertiary)]"
                aria-label={paused ? "Resume" : "Pause"}
              >
                {paused ? (
                  <PlayCircle size={24} />
                ) : (
                  <PauseCircle size={24} />
                )}
              </button>
              <button
                onClick={onStop}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-500 dark:text-red-300 ring-1 ring-red-500/30 transition hover:bg-red-500/30"
                aria-label="Stop"
              >
                <StopCircle size={24} />
              </button>
            </div>

            {/* Ambient selector */}
            <div className="flex items-center gap-3">
              {ambientOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setAmbient(opt.key)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ring-1 ${
                    ambient === opt.key
                      ? "bg-[var(--surface-hover)] text-[var(--text-primary)] ring-[var(--border)]"
                      : "text-[var(--text-tertiary)] ring-[var(--border-subtle)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
