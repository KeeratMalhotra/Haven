"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Sunrise,
  Moon,
  Calendar,
  CheckSquare,
  Flag,
  AlertTriangle,
  Sparkles,
  Check,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import type { TodayBriefing } from "@/lib/api-extended";

const TIME_ICON = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

interface MorningBriefingProps {
  briefing: TodayBriefing | null;
  loading: boolean;
  fallbackGreeting: string;
  fallbackDate: string;
  onPlanDay: () => void;
  onAdjust: () => void;
}

export default function MorningBriefing({
  briefing,
  loading,
  fallbackGreeting,
  fallbackDate,
  onPlanDay,
  onAdjust,
}: MorningBriefingProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const timeOfDay = briefing?.time_of_day ?? "morning";
  const TimeIcon = TIME_ICON[timeOfDay] ?? Sunrise;
  const greeting = briefing?.greeting || fallbackGreeting;
  const date = briefing?.date || fallbackDate;

  const stats = briefing?.stats;
  const meetings = briefing?.meetings ?? [];
  const deadlines = briefing?.deadlines ?? [];
  const warnings = briefing?.warnings ?? [];

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] to-[var(--bg)] p-6 sm:p-7"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-500/[0.07] blur-3xl" />

      {/* Greeting */}
      <motion.div variants={itemVariants} className="relative flex items-start gap-3.5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent-500/10">
          <TimeIcon size={22} strokeWidth={1.5} className="text-accent-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] dark:text-[#ece9e4] md:text-3xl">
            {greeting}.
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)] dark:text-[#847e76]">
            {date} · Here&apos;s your day.
          </p>
        </div>
      </motion.div>

      {/* Narrative */}
      <motion.div variants={itemVariants} className="relative mt-5">
        {loading && !briefing ? (
          <div className="space-y-2">
            <div className="h-3.5 w-full animate-pulse rounded bg-[var(--surface-hover)]" />
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-[var(--surface-hover)]" />
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)] dark:text-[#a8a39c]">
            {briefing?.narrative ||
              "You're all set. Add a few tasks or events and I'll help you shape your day."}
          </p>
        )}
      </motion.div>

      {/* Stat chips */}
      {stats && (
        <motion.div variants={itemVariants} className="relative mt-5 flex flex-wrap gap-2">
          <StatChip icon={Calendar} color="text-accent-400" label="meetings" value={stats.meetings} />
          <StatChip icon={CheckSquare} color="text-warning-500" label="deadlines" value={stats.deadlines} />
          <StatChip icon={Sparkles} color="text-success-500" label="pending tasks" value={stats.tasks_pending} />
        </motion.div>
      )}

      {/* Top priority */}
      {briefing?.top_priority && (
        <motion.div
          variants={itemVariants}
          className="relative mt-4 flex items-center gap-2.5 rounded-xl border border-accent-500/20 bg-accent-500/[0.06] px-4 py-3"
        >
          <Flag size={15} strokeWidth={1.5} className="flex-shrink-0 text-accent-400" />
          <p className="text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">
            <span className="text-[var(--text-tertiary)] dark:text-[#847e76]">Top priority · </span>
            {briefing.top_priority}
          </p>
        </motion.div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <motion.div variants={itemVariants} className="relative mt-3 space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl border border-warning-500/20 bg-warning-500/[0.06] px-4 py-2.5"
            >
              <AlertTriangle size={14} strokeWidth={1.5} className="flex-shrink-0 text-warning-500" />
              <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">{w}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Meetings + deadlines */}
      {(meetings.length > 0 || deadlines.length > 0) && (
        <motion.div variants={itemVariants} className="relative mt-5 grid gap-4 sm:grid-cols-2">
          {meetings.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] dark:text-[#847e76]">
                Meetings
              </p>
              <div className="space-y-1.5">
                {meetings.slice(0, 4).map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="h-7 w-[3px] flex-shrink-0 rounded-full bg-gradient-to-b from-accent-400 to-accent-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">{m.summary}</p>
                      {m.start_label && (
                        <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">{m.start_label}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {deadlines.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)] dark:text-[#847e76]">
                Deadlines
              </p>
              <div className="space-y-1.5">
                {deadlines.slice(0, 4).map((d, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="h-7 w-[3px] flex-shrink-0 rounded-full bg-gradient-to-b from-warning-400 to-warning-600" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--text-primary)] dark:text-[#ece9e4]">{d.title}</p>
                      {d.due_label && (
                        <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">{d.due_label}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* One-tap actions */}
      <motion.div variants={itemVariants} className="relative mt-6 flex flex-wrap gap-2">
        <AnimatePresence mode="wait">
          {acknowledged ? (
            <motion.div
              key="ack"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 rounded-lg bg-success-500/10 px-4 py-2 text-sm font-medium text-success-500"
            >
              <Check size={15} strokeWidth={2} />
              Have a great day
            </motion.div>
          ) : (
            <motion.button
              key="looks-good"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setAcknowledged(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600"
            >
              <Check size={15} strokeWidth={2} />
              Looks good
            </motion.button>
          )}
        </AnimatePresence>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onPlanDay}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4]"
        >
          <Zap size={15} strokeWidth={1.5} className="text-accent-400" />
          Plan my day
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onAdjust}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4]"
        >
          <SlidersHorizontal size={15} strokeWidth={1.5} />
          Adjust
        </motion.button>
      </motion.div>
    </motion.section>
  );
}

function StatChip({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-1.5">
      <Icon size={14} strokeWidth={1.5} className={color} />
      <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)] dark:text-[#ece9e4]">{value}</span>
      <span className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">{label}</span>
    </div>
  );
}
