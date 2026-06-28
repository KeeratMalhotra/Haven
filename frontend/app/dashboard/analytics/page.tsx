"use client";

import { useState, useEffect, useMemo, useId } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, TrendingUp, Target, Zap } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

// ─── Animation Variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────

type TimePeriod = "week" | "month" | "30days";

interface TaskData {
  id?: string;
  completed?: boolean;
  completedAt?: string;
  updatedAt?: string;
}

interface PomodoroStats {
  sessions?: { date: string; minutes: number }[];
  totalMinutes?: number;
}

interface HabitData {
  id?: string;
  completedDays?: string[];
  streak?: number;
  targetDays?: number;
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function getDaysInPeriod(period: TimePeriod): number {
  switch (period) {
    case "week":
      return 7;
    case "month":
      return new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        0
      ).getDate();
    case "30days":
      return 30;
  }
}

function getDateLabels(period: TimePeriod): string[] {
  const days = getDaysInPeriod(period);
  const labels: string[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (period === "week") {
      labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    } else {
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
  }
  return labels;
}

function getDateKeys(period: TimePeriod): string[] {
  const days = getDaysInPeriod(period);
  const keys: string[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().split("T")[0]);
  }
  return keys;
}

// ─── SVG Chart Components ───────────────────────────────────────────────────

function BarChart({
  data,
  labels,
  maxValue,
}: {
  data: number[];
  labels: string[];
  maxValue: number;
}) {
  const width = 100;
  const height = 50;
  const padding = { top: 4, bottom: 12, left: 2, right: 2 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barCount = data.length;
  const gap = barCount > 14 ? 0.3 : 0.8;
  const barWidth = Math.max(
    0.5,
    (chartWidth - gap * (barCount - 1)) / barCount
  );
  const effectiveMax = maxValue > 0 ? maxValue : 1;

  // Show a subset of labels for readability
  const labelInterval = barCount > 14 ? Math.ceil(barCount / 7) : 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Bar chart showing tasks completed per day"
    >
      {data.map((value, i) => {
        const barHeight = (value / effectiveMax) * chartHeight;
        const x = padding.left + i * (barWidth + gap);
        const y = padding.top + chartHeight - barHeight;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 0.3)}
              rx={0.4}
              className="fill-accent-500/80"
            />
            {i % labelInterval === 0 && (
              <text
                x={x + barWidth / 2}
                y={height - 1}
                textAnchor="middle"
                className="fill-[var(--text-tertiary)] text-[2.2px] font-medium"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({
  data,
  labels,
  maxValue,
}: {
  data: number[];
  labels: string[];
  maxValue: number;
}) {
  const gradientId = useId();
  const width = 100;
  const height = 50;
  const padding = { top: 6, bottom: 12, left: 4, right: 4 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const effectiveMax = maxValue > 0 ? maxValue : 1;
  const pointCount = data.length;

  const points = data.map((value, i) => {
    const x =
      padding.left +
      (pointCount > 1 ? (i / (pointCount - 1)) * chartWidth : chartWidth / 2);
    const y = padding.top + chartHeight - (value / effectiveMax) * chartHeight;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaD = `${pathD} L ${points[points.length - 1]?.x ?? padding.left} ${padding.top + chartHeight} L ${points[0]?.x ?? padding.left} ${padding.top + chartHeight} Z`;

  const labelInterval = pointCount > 14 ? Math.ceil(pointCount / 7) : 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Line chart showing focus hours over time"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent-500, #6366f1)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-accent-500, #6366f1)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      {points.length > 1 && (
        <path d={areaD} fill={`url(#${gradientId})`} />
      )}

      {/* Line */}
      {points.length > 1 && (
        <path
          d={pathD}
          fill="none"
          strokeWidth="1"
          className="stroke-accent-500"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={pointCount > 14 ? 0.6 : 1}
          className="fill-accent-500"
        />
      ))}

      {/* Labels */}
      {points.map((p, i) =>
        i % labelInterval === 0 ? (
          <text
            key={`label-${i}`}
            x={p.x}
            y={height - 1}
            textAnchor="middle"
            className="fill-[var(--text-tertiary)] text-[2.2px] font-medium"
          >
            {labels[i]}
          </text>
        ) : null
      )}
    </svg>
  );
}

function RingChart({
  percentage,
  size = 120,
}: {
  percentage: number;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillLength = (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Habit completion rate: ${Math.round(percentage)}%`}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-[var(--surface-hover)]"
        />
        {/* Filled ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="stroke-success-500"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - fillLength}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[var(--text-primary)]">
          {Math.round(percentage)}%
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          completed
        </span>
      </div>
    </div>
  );
}

function ProductivityScore({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color =
    clampedScore >= 75
      ? "text-success-500"
      : clampedScore >= 50
        ? "text-warning-500"
        : "text-[var(--text-tertiary)]";
  const bgColor =
    clampedScore >= 75
      ? "bg-success-500/10"
      : clampedScore >= 50
        ? "bg-warning-500/10"
        : "bg-[var(--surface-hover)]";

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full ${bgColor}`}
      >
        <span className={`text-4xl font-bold tabular-nums ${color}`}>
          {clampedScore}
        </span>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Productivity Score
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          {clampedScore >= 75
            ? "Excellent!"
            : clampedScore >= 50
              ? "Good progress"
              : "Keep going"}
        </p>
      </div>
    </div>
  );
}

// ─── Time Period Selector ───────────────────────────────────────────────────

function TimePeriodSelector({
  value,
  onChange,
}: {
  value: TimePeriod;
  onChange: (p: TimePeriod) => void;
}) {
  const options: { label: string; value: TimePeriod }[] = [
    { label: "This week", value: "week" },
    { label: "This month", value: "month" },
    { label: "Last 30 days", value: "30days" },
  ];

  return (
    <div className="flex gap-1 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200
            ${
              value === opt.value
                ? "bg-accent-500 text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const reducedContainerVariants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1, transition: { staggerChildren: 0, delayChildren: 0 } } }
    : containerVariants;

  const reducedItemVariants = prefersReducedMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0, transition: { duration: 0.01 } } }
    : itemVariants;

  const [period, setPeriod] = useState<TimePeriod>("week");
  const [loading, setLoading] = useState(true);
  const [tasksData, setTasksData] = useState<TaskData[]>([]);
  const [pomodoroStats, setPomodoroStats] = useState<PomodoroStats | null>(
    null
  );
  const [habitsData, setHabitsData] = useState<HabitData[]>([]);

  // Load data from localStorage
  useEffect(() => {
    document.title = "Analytics | Haven";
    try {
      const tasksRaw = localStorage.getItem("chronai-tasks");
      if (tasksRaw) {
        const parsed = JSON.parse(tasksRaw);
        setTasksData(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      // silently fail
    }

    try {
      const pomodoroRaw = localStorage.getItem("chronai-pomodoro-stats");
      if (pomodoroRaw) {
        const parsed = JSON.parse(pomodoroRaw);
        setPomodoroStats(parsed && typeof parsed === "object" ? parsed : null);
      }
    } catch {
      // silently fail
    }

    try {
      const habitsRaw = localStorage.getItem("chronai-habits");
      if (habitsRaw) {
        const parsed = JSON.parse(habitsRaw);
        setHabitsData(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      // silently fail
    }

    // Simulate brief loading for skeleton display
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Compute chart data based on period
  const dateKeys = useMemo(() => getDateKeys(period), [period]);
  const dateLabels = useMemo(() => getDateLabels(period), [period]);

  const tasksPerDay = useMemo(() => {
    const counts: Record<string, number> = {};
    dateKeys.forEach((key) => (counts[key] = 0));

    tasksData.forEach((task) => {
      if (task.completed) {
        const dateStr =
          task.completedAt?.split("T")[0] || task.updatedAt?.split("T")[0];
        if (dateStr && counts[dateStr] !== undefined) {
          counts[dateStr]++;
        }
      }
    });

    return dateKeys.map((key) => counts[key] || 0);
  }, [tasksData, dateKeys]);

  const focusHoursPerDay = useMemo(() => {
    const hours: Record<string, number> = {};
    dateKeys.forEach((key) => (hours[key] = 0));

    if (pomodoroStats?.sessions) {
      pomodoroStats.sessions.forEach((session) => {
        const dateStr = session.date?.split("T")[0];
        if (dateStr && hours[dateStr] !== undefined) {
          hours[dateStr] += session.minutes / 60;
        }
      });
    }

    return dateKeys.map((key) => Math.round((hours[key] || 0) * 10) / 10);
  }, [pomodoroStats, dateKeys]);

  const habitCompletionRate = useMemo(() => {
    if (habitsData.length === 0) return 0;
    const days = getDaysInPeriod(period);
    let totalPossible = 0;
    let totalCompleted = 0;

    habitsData.forEach((habit) => {
      const target = habit.targetDays || days;
      totalPossible += Math.min(target, days);
      const completed = (habit.completedDays || []).filter((d) =>
        dateKeys.includes(d.split("T")[0])
      ).length;
      totalCompleted += completed;
    });

    if (totalPossible === 0) return 0;
    return Math.round((totalCompleted / totalPossible) * 100);
  }, [habitsData, dateKeys, period]);

  const productivityScore = useMemo(() => {
    // Weighted score: tasks (40%), focus hours (35%), habits (25%)
    const maxTasks = getDaysInPeriod(period) * 3; // assume 3 tasks/day is great
    const taskScore = Math.min(
      1,
      tasksPerDay.reduce((a, b) => a + b, 0) / Math.max(maxTasks, 1)
    );

    const maxFocusHours = getDaysInPeriod(period) * 4; // 4 hours focus/day is great
    const focusScore = Math.min(
      1,
      focusHoursPerDay.reduce((a, b) => a + b, 0) / Math.max(maxFocusHours, 1)
    );

    const habitScore = habitCompletionRate / 100;

    return Math.round(taskScore * 40 + focusScore * 35 + habitScore * 25);
  }, [tasksPerDay, focusHoursPerDay, habitCompletionRate, period]);

  const hasAnyData =
    tasksData.length > 0 || pomodoroStats !== null || habitsData.length > 0;

  // Check if there's any data in the currently selected time period
  const periodHasActivity = useMemo(() => {
    const totalTasks = tasksPerDay.reduce((a, b) => a + b, 0);
    const totalFocus = focusHoursPerDay.reduce((a, b) => a + b, 0);
    return totalTasks > 0 || totalFocus > 0 || habitCompletionRate > 0;
  }, [tasksPerDay, focusHoursPerDay, habitCompletionRate]);

  const maxTasksPerDay = Math.max(...tasksPerDay, 1);
  const maxFocusHours = Math.max(...focusHoursPerDay, 1);

  // Auth checks
  if (status === "loading") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </motion.div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/");
    return null;
  }

  // Loading state with skeletons
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      </motion.div>
    );
  }

  // Empty state when no data exists
  if (!hasAnyData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl">
            Analytics
          </h1>
          <TimePeriodSelector value={period} onChange={setPeriod} />
        </div>
        <EmptyState
          icon={
            <BarChart3
              size={24}
              strokeWidth={1.5}
              className="text-[var(--text-tertiary)]"
            />
          }
          title="No data yet"
          description="Start completing tasks, logging focus sessions, and building habits to see your productivity analytics here."
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={reducedContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={reducedItemVariants}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl">
          Analytics
        </h1>
        <TimePeriodSelector value={period} onChange={setPeriod} />
      </motion.div>

      {/* No activity in period banner */}
      {hasAnyData && !periodHasActivity && (
        <motion.div
          variants={reducedItemVariants}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] px-4 py-3 text-center"
        >
          <p className="text-sm text-[var(--text-secondary)]">
            No activity in this period
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            Try selecting a different time range to see your data.
          </p>
        </motion.div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Bar Chart - Tasks Completed */}
        <motion.div variants={reducedItemVariants}>
          <Card hover={false} className="p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10">
                <BarChart3
                  size={16}
                  strokeWidth={1.5}
                  className="text-accent-500"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Tasks Completed
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">Per day</p>
              </div>
            </div>
            <div className="h-36">
              <BarChart
                data={tasksPerDay}
                labels={dateLabels}
                maxValue={maxTasksPerDay}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Total: {tasksPerDay.reduce((a, b) => a + b, 0)} tasks
            </p>
          </Card>
        </motion.div>

        {/* Line Chart - Focus Hours */}
        <motion.div variants={reducedItemVariants}>
          <Card hover={false} className="p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10">
                <TrendingUp
                  size={16}
                  strokeWidth={1.5}
                  className="text-accent-500"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Focus Hours
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Time in focus mode
                </p>
              </div>
            </div>
            <div className="h-36">
              <LineChart
                data={focusHoursPerDay}
                labels={dateLabels}
                maxValue={maxFocusHours}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Total:{" "}
              {Math.round(
                focusHoursPerDay.reduce((a, b) => a + b, 0) * 10
              ) / 10}{" "}
              hours
            </p>
          </Card>
        </motion.div>

        {/* Ring Chart - Habit Completion */}
        <motion.div variants={reducedItemVariants}>
          <Card hover={false} className="p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10">
                <Target
                  size={16}
                  strokeWidth={1.5}
                  className="text-success-500"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Habit Completion
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Overall rate
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <RingChart percentage={habitCompletionRate} />
            </div>
          </Card>
        </motion.div>

        {/* Productivity Score */}
        <motion.div variants={reducedItemVariants}>
          <Card hover={false} className="p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-500/10">
                <Zap
                  size={16}
                  strokeWidth={1.5}
                  className="text-warning-500"
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Productivity
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Overall score
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <ProductivityScore score={productivityScore} />
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
