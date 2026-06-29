"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakBadgeProps {
  streak: number;
  longestStreak?: number;
}

/**
 * Prominent "You've planned X days straight" badge.
 * Renders nothing until there's at least a 1-day streak.
 */
export default function StreakBadge({ streak, longestStreak }: StreakBadgeProps) {
  if (!streak || streak < 1) return null;

  const isRecord = longestStreak !== undefined && streak >= longestStreak && streak > 1;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="inline-flex items-center gap-2.5 rounded-full border border-warning-500/25 bg-warning-500/[0.08] px-4 py-2"
    >
      <motion.span
        animate={{ scale: [1, 1.18, 1], rotate: [0, -6, 6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.4 }}
        className="inline-flex"
      >
        <Flame size={16} strokeWidth={1.5} className="text-warning-500" />
      </motion.span>
      <span className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
        You&apos;ve planned{" "}
        <span className="font-semibold text-warning-500">{streak}</span>{" "}
        {streak === 1 ? "day" : "days"} straight
      </span>
      {isRecord && (
        <span className="rounded-full bg-warning-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-500">
          Best
        </span>
      )}
    </motion.div>
  );
}
