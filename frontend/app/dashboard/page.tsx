"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import { format } from "date-fns";

import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import ChatExperience from "@/components/chat/ChatExperience";
import CommandPalette from "@/components/CommandPalette";
import FocusMode from "@/components/FocusMode";
import type { ConnectionState } from "@/hooks/useChatSocket";
import type { PanelKey } from "@/components/layout/SideDock";
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
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const sendToChatRef = useRef<((msg: string) => void) | null>(null);

  // Focus mode
  const [focusActive, setFocusActive] = useState(false);
  const [focusTask, setFocusTask] = useState<string | undefined>(undefined);

  const handleSendReady = useCallback((sendFn: (content: string) => void) => {
    sendToChatRef.current = sendFn;
  }, []);

  const handleCommandSend = useCallback((message: string) => {
    sendToChatRef.current?.(message);
    setChatOpen(true);
  }, []);

  const handleFocusMode = useCallback(() => {
    setFocusTask(undefined);
    setFocusActive(true);
  }, []);

  const handleOpenPanel = useCallback((key: PanelKey) => {
    // Navigate to the respective full page
    const routes: Record<string, string> = {
      calendar: "/dashboard/calendar",
      tasks: "/dashboard/tasks",
      habits: "/dashboard/habits",
      schedule: "/dashboard/calendar",
    };
    router.push(routes[key] || "/dashboard");
  }, [router]);

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

  // Loading state
  if (
    status === "loading" ||
    (status === "authenticated" && !onboardingChecked)
  ) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="mt-8 h-48" />
      </div>
    );
  }

  const firstName = user?.name?.split(" ")[0] || "there";
  const todayFormatted = format(new Date(), "EEEE, MMMM d");
  const pendingTasks = tasks.filter((t) => !t.completed);
  const totalStreak = habits.reduce((acc, h) => acc + h.streak, 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-8"
      >
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {todayFormatted}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card hover={false} className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10">
              <Calendar size={20} className="text-accent-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {dataLoading ? "-" : events.length}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Events today
              </p>
            </div>
          </Card>

          <Card hover={false} className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
              <CheckSquare size={20} className="text-warning-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {dataLoading ? "-" : pendingTasks.length}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Pending tasks
              </p>
            </div>
          </Card>

          <Card hover={false} className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
              <Flame size={20} className="text-success-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {dataLoading ? "-" : totalStreak}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Habit streak
              </p>
            </div>
          </Card>
        </div>

        {/* Today's Schedule */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Today&apos;s Schedule
            </h2>
            <Link
              href="/dashboard/calendar"
              className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] transition-colors hover:text-accent-500"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {dataLoading ? (
              <>
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </>
            ) : events.length === 0 ? (
              <Card hover={false} className="py-6 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">
                  No events scheduled for today
                </p>
              </Card>
            ) : (
              events.slice(0, 5).map((event, i) => (
                <Card
                  key={event.id || i}
                  hover={false}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <div className="h-8 w-[3px] rounded-full bg-accent-500" />
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
              ))
            )}
          </div>
        </section>

        {/* Recent Tasks */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Recent Tasks
            </h2>
            <Link
              href="/dashboard/tasks"
              className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] transition-colors hover:text-accent-500"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {dataLoading ? (
              <>
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </>
            ) : tasks.length === 0 ? (
              <Card hover={false} className="py-6 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">
                  No tasks yet. Ask the AI to create some!
                </p>
              </Card>
            ) : (
              tasks.slice(0, 5).map((task, i) => (
                <Card
                  key={task.id || i}
                  hover={false}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                      task.completed
                        ? "border-success-500 bg-success-500/20"
                        : "border-[var(--border)]"
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
                          : "text-[var(--text-primary)]"
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
              ))
            )}
          </div>
        </section>
      </motion.div>

      {/* AI Chat toggle button */}
      <motion.button
        onClick={() => setChatOpen((o) => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent-gradient shadow-glow transition-shadow hover:shadow-glow-lg"
        aria-label="Toggle AI chat"
      >
        {chatOpen ? (
          <X size={22} className="text-white" />
        ) : (
          <MessageCircle size={22} className="text-white" />
        )}
      </motion.button>

      {/* AI Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-24 right-6 z-30 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                AI Assistant
              </span>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-md p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatExperience
                accessToken={accessToken}
                userName={user?.name ?? undefined}
                onConnectionChange={setConnection}
                onSendReady={handleSendReady}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <CommandPalette
        onSendChat={handleCommandSend}
        onOpenPanel={handleOpenPanel}
        onFocusMode={handleFocusMode}
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
