"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Plus,
  Check,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchHabits,
  checkinHabit,
  createHabit,
  deleteHabit,
  type HabitItem,
} from "@/lib/api";

// ---------- Heat Map Component ----------

function HeatMap({ history }: { history: { completed_at: string }[] }) {
  // Generate last 12 weeks (84 days) of data
  const today = new Date();
  const days: { date: string; completed: boolean }[] = [];

  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const completed = history.some(
      (h) => h.completed_at.split("T")[0] === dateStr
    );
    days.push({ date: dateStr, completed });
  }

  // Arrange into columns (weeks): 7 rows x 12 columns
  const weeks: { date: string; completed: boolean }[][] = [];
  for (let col = 0; col < 12; col++) {
    const week: { date: string; completed: boolean }[] = [];
    for (let row = 0; row < 7; row++) {
      const idx = col * 7 + row;
      if (idx < days.length) {
        week.push(days[idx]);
      }
    }
    weeks.push(week);
  }

  return (
    <div className="flex gap-[3px]">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((day, di) => (
            <div
              key={di}
              title={`${day.date}: ${day.completed ? "Completed" : "Missed"}`}
              className={`h-[10px] w-[10px] rounded-[2px] transition-colors ${
                day.completed
                  ? "bg-emerald-400"
                  : "bg-[var(--bg-tertiary)]"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- Confetti Effect ----------

function ConfettiParticles({ show }: { show: boolean }) {
  if (!show) return null;

  // Use deterministic positions based on index to avoid hydration mismatch
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i / 12) * 360,
    distance: 40 + ((i * 7 + 3) % 30),
    color: ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0"][i % 4],
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            scale: 0,
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

// ---------- Habit Card ----------

function HabitCard({
  habit,
  accessToken,
  onUpdate,
  onDelete,
}: {
  habit: HabitItem;
  accessToken: string;
  onUpdate: (updated: HabitItem) => void;
  onDelete: (id: string) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [streakDisplay, setStreakDisplay] = useState(habit.streak);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCheckin = async () => {
    if (checking) return;
    setChecking(true);
    setShowConfetti(true);

    try {
      const updated = await checkinHabit(accessToken, habit.id);
      // Animate streak increment
      const target = updated.streak;
      const start = streakDisplay;
      if (target > start) {
        let current = start;
        const step = () => {
          current++;
          setStreakDisplay(current);
          if (current < target) {
            setTimeout(step, 80);
          }
        };
        step();
      }
      onUpdate(updated);
    } catch {
      // silently fail
    } finally {
      setTimeout(() => {
        setChecking(false);
        setShowConfetti(false);
      }, 700);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteHabit(accessToken, habit.id);
      onDelete(habit.id);
    } catch {
      // silently fail
    }
    setConfirmDelete(false);
    setMenuOpen(false);
  };

  return (
    <>
      <Card hover className="relative flex flex-col gap-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[var(--text-primary)] truncate">
              {habit.name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={habit.frequency === "daily" ? "info" : "default"}>
                {habit.frequency}
              </Badge>
              {habit.last_completed && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  {formatDistanceToNow(new Date(habit.last_completed), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Menu button */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              <MoreHorizontal size={16} strokeWidth={1.5} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 z-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
                >
                  <button
                    onClick={() => {
                      setConfirmDelete(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger-400 transition-colors hover:bg-danger-500/10"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Streak display */}
        <div className="flex items-center gap-2">
          <Flame size={18} strokeWidth={1.5} className="text-orange-400" />
          <span className="text-xl font-bold text-[var(--text-primary)] tabular-nums">
            {streakDisplay}
          </span>
          <span className="text-sm text-[var(--text-tertiary)]">day streak</span>
        </div>

        {/* Heat Map */}
        <div className="mt-1">
          <HeatMap history={habit.history} />
        </div>

        {/* Check-in button */}
        <div className="relative flex justify-center pt-2">
          <motion.button
            onClick={handleCheckin}
            disabled={checking}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            animate={
              checking
                ? {
                    scale: [1, 1.3, 1],
                    backgroundColor: [
                      "rgba(16, 185, 129, 0.1)",
                      "rgba(16, 185, 129, 0.4)",
                      "rgba(16, 185, 129, 0.1)",
                    ],
                  }
                : {}
            }
            transition={checking ? { type: "tween", duration: 0.5 } : { type: "spring", stiffness: 400, damping: 15 }}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-500 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Check size={22} strokeWidth={2.5} />
          </motion.button>
          <ConfettiParticles show={showConfetti} />
        </div>
      </Card>

      {/* Delete confirmation modal */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Delete Habit
          </h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Are you sure you want to delete &quot;{habit.name}&quot;? This action
            cannot be undone.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ---------- Main Habits Page ----------

export default function HabitsPage() {
  const { data: session } = useSession();
  const accessToken =
    ((session as Record<string, unknown> | null)?.accessToken as string) || "";

  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState<"daily" | "weekly">("daily");
  const [newTargetDays, setNewTargetDays] = useState(7);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    fetchHabits(accessToken)
      .then(setHabits)
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Set page title
  useEffect(() => {
    document.title = "Habits | Haven";
  }, []);

  const handleUpdate = useCallback((updated: HabitItem) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === updated.id ? updated : h))
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createHabit(
        accessToken,
        newName.trim(),
        newFrequency,
        newTargetDays
      );
      setHabits((prev) => [...prev, created]);
      setCreateOpen(false);
      setNewName("");
      setNewFrequency("daily");
      setNewTargetDays(7);
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-500/10">
              <Flame size={20} strokeWidth={1.5} className="text-success-500" />
            </div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              Habits
            </h1>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus size={16} />
            New Habit
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-[var(--border)] p-5">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-[76px] w-full" />
                <Skeleton className="mx-auto h-12 w-12" rounded="full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && habits.length === 0 && (
          <Card hover={false} className="flex flex-col items-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Flame size={28} strokeWidth={1.5} className="text-emerald-500" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
              No habits yet
            </h3>
            <p className="mt-1 max-w-sm text-sm font-normal leading-relaxed text-[var(--text-tertiary)]">
              Start building positive routines. Create your first habit and track
              your streaks over time.
            </p>
            <Button
              className="mt-6"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} />
              Create Habit
            </Button>
          </Card>
        )}

        {/* Habit cards grid */}
        {!loading && habits.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {habits.map((habit) => (
                <motion.div
                  key={habit.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <HabitCard
                    habit={habit}
                    accessToken={accessToken}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Create Habit Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            New Habit
          </h3>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            Create a new habit to track consistently.
          </p>

          <div className="mt-6 space-y-4">
            <Input
              label="Habit Name"
              placeholder="e.g., Morning meditation"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Frequency
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewFrequency("daily")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    newFrequency === "daily"
                      ? "bg-accent-500 text-white"
                      : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setNewFrequency("weekly")}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    newFrequency === "weekly"
                      ? "bg-accent-500 text-white"
                      : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            <Input
              label="Target Days"
              type="number"
              min={1}
              max={365}
              value={newTargetDays.toString()}
              onChange={(e) => setNewTargetDays(Number(e.target.value) || 1)}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              loading={creating}
              disabled={!newName.trim()}
            >
              Create Habit
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
