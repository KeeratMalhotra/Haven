"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckSquare,
  Flame,
  MessageCircle,
  X,
  ArrowRight,
  Sparkles,
  Square,
  CheckSquare as CheckSquareFilled,
} from "lucide-react";
import { format } from "date-fns";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import AIChatPanel from "@/components/chat/AIChatPanel";
import CommandPalette from "@/components/CommandPalette";
import FocusMode from "@/components/FocusMode";
import {
  fetchOnboardingStatus,
  fetchTasks,
  fetchCalendarEvents,
  fetchHabits,
  type TaskItem,
  type CalendarEvent,
  type HabitItem,
} from "@/lib/api";
import Link from "next/link";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const welcomeContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

const welcomeItemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const quickActions = [
  {
    title: "Create your first task",
    description: "Organize your work with tasks and kanban boards",
    icon: CheckSquare,
    href: "/dashboard/tasks",
    iconBg: "bg-warning-500/8",
    iconColor: "text-warning-500",
  },
  {
    title: "Check your calendar",
    description: "View and create events for your day",
    icon: Calendar,
    href: "/dashboard/calendar",
    iconBg: "bg-accent-500/8",
    iconColor: "text-accent-500",
  },
  {
    title: "Start a habit",
    description: "Build routines and track your streaks",
    icon: Flame,
    href: "/dashboard/habits",
    iconBg: "bg-success-500/8",
    iconColor: "text-success-500",
  },
] as const;

const aiSuggestionChips = [
  "Plan my week",
  "Suggest a routine",
  "Help me focus",
  "Organize my tasks",
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";
  const user = session?.user;

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Chat panel
  const [chatOpen, setChatOpen] = useState(false);

  // Focus mode
  const [focusActive, setFocusActive] = useState(false);
  const [focusTask, setFocusTask] = useState<string | undefined>(undefined);

  // Onboarding checklist
  const [checklistDismissed, setChecklistDismissed] = useState(false);

  // Focus mode usage tracking (hydration-safe)
  const [focusUsed, setFocusUsed] = useState(false);

  const handleFocusMode = useCallback(() => {
    setFocusTask(undefined);
    setFocusActive(true);
  }, []);

  const handleOpenChat = useCallback(() => {
    setChatOpen(true);
  }, []);

  // Onboarding gate
  useEffect(() => {
    if (status !== "authenticated" || !accessToken) return;
    fetchOnboardingStatus(accessToken).then((data) => {
      if (!data.complete) {
        router.push("/onboarding");
      } else {
        setOnboardingChecked(true);
      }
    });
  }, [status, accessToken, router]);

  // Fetch dashboard data
  useEffect(() => {
    if (!onboardingChecked || !accessToken) return;
    setDataLoading(true);
    Promise.all([
      fetchTasks(accessToken),
      fetchCalendarEvents(accessToken, 1),
      fetchHabits(accessToken),
    ]).then(([t, e, h]) => {
      setTasks(t);
      setEvents(e);
      setHabits(h);
      setDataLoading(false);
    });
  }, [onboardingChecked, accessToken]);

  // Read checklist dismissal from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem("chronai-checklist-dismissed");
      if (dismissed === "true") {
        setChecklistDismissed(true);
      }
    }
  }, []);

  // Read focus mode usage from localStorage (hydration-safe)
  useEffect(() => {
    try {
      const stats = localStorage.getItem("chronai-pomodoro-stats");
      setFocusUsed(!!stats && stats !== "null" && stats !== "{}");
    } catch {
      // silently fail
    }
  }, []);

  const handleDismissChecklist = useCallback(() => {
    setChecklistDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("chronai-checklist-dismissed", "true");
    }
  }, []);

  // Loading state
  if (
    status === "loading" ||
    (status === "authenticated" && !onboardingChecked)
  ) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-44" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="mt-8 h-52" />
        <Skeleton className="mt-4 h-44" />
      </motion.div>
    );
  }

  const firstName = user?.name?.split(" ")[0] || "there";
  const todayFormatted = format(new Date(), "EEEE, MMMM d");
  const pendingTasks = tasks.filter((t) => !t.completed);
  const totalStreak = habits.reduce((acc, h) => acc + h.streak, 0);

  const isAllEmpty =
    !dataLoading &&
    tasks.length === 0 &&
    events.length === 0 &&
    habits.length === 0;

  const checklistItems = [
    { label: "Create a task", done: tasks.length > 0 },
    { label: "Add a calendar event", done: events.length > 0 },
    { label: "Start a habit", done: habits.length > 0 },
    { label: "Try focus mode", done: focusUsed },
  ];

  const checklistProgress = checklistItems.filter((item) => item.done).length;

  const statsCards = [
    {
      icon: Calendar,
      count: events.length,
      label: "Events today",
      color: "text-accent-500",
      bgColor: "bg-accent-500/10",
    },
    {
      icon: CheckSquare,
      count: pendingTasks.length,
      label: "Pending tasks",
      color: "text-warning-500",
      bgColor: "bg-warning-500/10",
    },
    {
      icon: Flame,
      count: totalStreak,
      label: "Habit streak",
      color: "text-success-500",
      bgColor: "bg-success-500/10",
    },
  ];

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-10"
      >
        {/* Greeting */}
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl">
            {getGreeting()},{" "}
            <span className="bg-gradient-to-r from-accent-400 to-purple-400 bg-clip-text text-transparent">
              {firstName}
            </span>
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-tertiary)] font-normal">
            {todayFormatted}
          </p>
        </motion.div>

        {isAllEmpty ? (
          /* ========== Welcome / Empty State ========== */
          <motion.div
            variants={welcomeContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Warm subheading */}
            <motion.p
              variants={welcomeItemVariants}
              className="text-sm leading-relaxed text-[var(--text-secondary)]"
            >
              Let&apos;s get your day started. Here are some things you can do:
            </motion.p>

            {/* Quick Action Cards */}
            <motion.div
              variants={welcomeItemVariants}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.title} href={action.href}>
                    <Card
                      hover={false}
                      className="flex items-start gap-3.5 p-4 transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${action.iconBg}`}
                      >
                        <Icon
                          size={20}
                          strokeWidth={1.5}
                          className={action.iconColor}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {action.title}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                          {action.description}
                        </p>
                      </div>
                    </Card>
                  </Link>
                );
              })}

              {/* Talk to AI - button instead of Link */}
              <button
                onClick={() => setChatOpen(true)}
                className="text-left"
              >
                <Card
                  hover={false}
                  className="flex items-start gap-3.5 p-4 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent-500/8">
                    <MessageCircle
                      size={20}
                      strokeWidth={1.5}
                      className="text-accent-500"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      Talk to AI
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                      Ask your AI assistant for help with anything
                    </p>
                  </div>
                </Card>
              </button>
            </motion.div>

            {/* AI Suggestion Chips */}
            <motion.div
              variants={welcomeItemVariants}
              className="flex flex-wrap gap-2"
            >
              {aiSuggestionChips.map((chip, index) => (
                <button
                  key={chip}
                  onClick={() => setChatOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                >
                  {index === 0 && (
                    <Sparkles size={12} className="text-accent-500" />
                  )}
                  {chip}
                </button>
              ))}
            </motion.div>

            {/* Onboarding Checklist */}
            {!checklistDismissed && (
              <motion.div variants={welcomeItemVariants}>
                <Card hover={false} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        Getting Started
                      </h3>
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {checklistProgress}/{checklistItems.length}
                      </span>
                    </div>
                    <button
                      onClick={handleDismissChecklist}
                      className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
                      aria-label="Dismiss checklist"
                    >
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
                    <div
                      className="h-full rounded-full bg-accent-500 transition-all duration-500"
                      style={{
                        width: `${(checklistProgress / checklistItems.length) * 100}%`,
                      }}
                    />
                  </div>

                  <ul className="mt-4 space-y-2.5">
                    {checklistItems.map((item) => (
                      <li
                        key={item.label}
                        className="flex items-center gap-2.5"
                      >
                        {item.done ? (
                          <CheckSquareFilled
                            size={16}
                            strokeWidth={1.5}
                            className="flex-shrink-0 text-success-500"
                          />
                        ) : (
                          <Square
                            size={16}
                            strokeWidth={1.5}
                            className="flex-shrink-0 text-[var(--text-tertiary)]"
                          />
                        )}
                        <span
                          className={`text-sm ${
                            item.done
                              ? "text-[var(--text-tertiary)] line-through"
                              : "text-[var(--text-primary)]"
                          }`}
                        >
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* ========== Normal Data View ========== */
          <>
            {/* Quick Stats */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {statsCards.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      delay: 0.2 + index * 0.1,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Card hover={false} className="flex items-center gap-4 p-5">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bgColor}`}
                      >
                        <Icon
                          size={20}
                          strokeWidth={1.5}
                          className={stat.color}
                        />
                      </div>
                      <div>
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                          {dataLoading ? (
                            <span className="inline-block h-7 w-6 animate-pulse rounded bg-[var(--surface-hover)]" />
                          ) : (
                            stat.count
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {stat.label}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Today's Schedule */}
            <motion.section variants={itemVariants}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  Today&apos;s Schedule
                </h2>
                <Link
                  href="/dashboard/calendar"
                  className="group flex items-center gap-1 text-xs text-[var(--text-tertiary)] transition-colors hover:text-accent-500"
                >
                  View all{" "}
                  <ArrowRight
                    size={12}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>

              <div className="mt-3 space-y-2">
                {dataLoading ? (
                  <>
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </>
                ) : events.length === 0 ? (
                  <Card hover={false} className="py-8 text-center">
                    <Calendar
                      size={24}
                      strokeWidth={1.5}
                      className="mx-auto mb-2 text-[var(--text-tertiary)]"
                    />
                    <p className="text-sm text-[var(--text-tertiary)]">
                      No events scheduled for today
                    </p>
                  </Card>
                ) : (
                  events.slice(0, 5).map((event, i) => (
                    <motion.div
                      key={event.id || i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                    >
                      <Card
                        hover={false}
                        className="flex items-center gap-4 px-4 py-3 transition-all hover:border-accent-500/20"
                      >
                        <div className="h-9 w-[3px] rounded-full bg-gradient-to-b from-accent-400 to-accent-600" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                            {event.summary}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {format(new Date(event.start), "h:mm a")}
                            {event.end &&
                              ` - ${format(new Date(event.end), "h:mm a")}`}
                          </p>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.section>

            {/* Recent Tasks */}
            <motion.section variants={itemVariants}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  Recent Tasks
                </h2>
                <Link
                  href="/dashboard/tasks"
                  className="group flex items-center gap-1 text-xs text-[var(--text-tertiary)] transition-colors hover:text-accent-500"
                >
                  View all{" "}
                  <ArrowRight
                    size={12}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>

              <div className="mt-3 space-y-2">
                {dataLoading ? (
                  <>
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                  </>
                ) : tasks.length === 0 ? (
                  <Card hover={false} className="py-8 text-center">
                    <Sparkles
                      size={24}
                      strokeWidth={1.5}
                      className="mx-auto mb-2 text-[var(--text-tertiary)]"
                    />
                    <p className="text-sm text-[var(--text-tertiary)]">
                      No tasks yet. Ask the AI to create some!
                    </p>
                  </Card>
                ) : (
                  tasks.slice(0, 5).map((task, i) => (
                    <motion.div
                      key={task.id || i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                    >
                      <Card
                        hover={false}
                        className="flex items-center gap-3 px-4 py-3 transition-all hover:border-accent-500/20"
                      >
                        <div
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
                            task.completed
                              ? "border-success-500 bg-success-500/20"
                              : "border-[var(--border)] hover:border-[var(--text-tertiary)]"
                          }`}
                        >
                          {task.completed && (
                            <CheckSquare
                              size={12}
                              className="text-success-500"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`truncate text-sm ${
                              task.completed
                                ? "text-[var(--text-tertiary)] line-through"
                                : "text-[var(--text-primary)] font-medium"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.due && (
                            <p className="text-xs text-[var(--text-tertiary)]">
                              Due {format(new Date(task.due), "MMM d")}
                            </p>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.section>
          </>
        )}
      </motion.div>

      {/* AI Chat toggle button */}
      <AnimatePresence mode="wait">
        <motion.button
          key={chatOpen ? "close" : "open"}
          onClick={() => setChatOpen((o) => !o)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gradient shadow-lg shadow-accent-500/25 transition-shadow hover:shadow-xl hover:shadow-accent-500/30"
          aria-label="Toggle AI chat"
        >
          {chatOpen ? (
            <X size={22} className="text-white" />
          ) : (
            <MessageCircle size={22} className="text-white" />
          )}
        </motion.button>
      </AnimatePresence>

      {/* AI Chat side panel */}
      <AIChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        accessToken={accessToken}
        userName={user?.name ?? undefined}
      />

      {/* Command Palette */}
      <CommandPalette
        onFocusMode={handleFocusMode}
        onOpenChat={handleOpenChat}
      />

      {/* Focus Mode overlay */}
      <FocusMode
        active={focusActive}
        taskName={focusTask}
        onStop={() => setFocusActive(false)}
      />
    </>
  );
}
