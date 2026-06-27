"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Flame, Target, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { fetchHabits, checkinHabit, HabitItem } from "@/lib/api";

function isCompletedToday(lastCompleted: string | null): boolean {
  if (!lastCompleted) return false;
  const now = new Date();
  const todayUTC = now.toISOString().slice(0, 10);
  const completedUTC = new Date(lastCompleted).toISOString().slice(0, 10);
  return completedUTC === todayUTC;
}

export default function HabitCheckins() {
  const { data: session } = useSession();
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = session?.accessToken;
        if (!token) {
          setLoading(false);
          return;
        }
        const data = await fetchHabits(token);
        setHabits(data);
      } catch (err) {
        setError("Unable to load habits");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  async function handleCheckin(habitId: string) {
    try {
      const token = session?.accessToken;
      if (!token) return;
      setCheckingIn(habitId);
      setCheckinError(null);
      const updated = await checkinHabit(token, habitId);
      setHabits((prev) =>
        prev.map((h) => (h.id === habitId ? updated : h))
      );
    } catch (err) {
      console.error("Check-in failed:", err);
      setCheckinError("Check-in failed. Please try again.");
    } finally {
      setCheckingIn(null);
    }
  }

  return (
    <Card title="Habit Check-ins">
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      {checkinError && (
        <p className="mb-2 text-sm text-destructive">{checkinError}</p>
      )}

      {!loading && !error && habits.length === 0 && (
        <div className="flex flex-col items-center py-4 text-center">
          <Target className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No habits set up yet. Add some to start tracking!
          </p>
        </div>
      )}

      {!loading && !error && habits.length > 0 && (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const doneToday = isCompletedToday(habit.last_completed);
            return (
              <li
                key={habit.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {habit.name}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Flame className="h-3 w-3 text-orange-500" />
                    {habit.streak} day streak
                  </p>
                </div>
                <button
                  onClick={() => handleCheckin(habit.id)}
                  disabled={doneToday || checkingIn === habit.id}
                  className={
                    doneToday
                      ? "flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                      : "flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  }
                  aria-label={
                    doneToday
                      ? `${habit.name} completed`
                      : `Check in ${habit.name}`
                  }
                >
                  {doneToday ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
