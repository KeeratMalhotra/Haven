"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckSquare, Circle } from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { fetchTasks, TaskItem } from "@/lib/api";

function isDueToday(due: string | null | undefined): boolean {
  if (!due) return false;
  const today = new Date();
  const dueDate = new Date(due);
  return dueDate.toDateString() === today.toDateString();
}

function isOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  const now = new Date();
  const dueDate = new Date(due);
  return dueDate < now && !isDueToday(due);
}

function formatDueTime(due: string): string {
  const date = new Date(due);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TodayTasks() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = (session as unknown as { accessToken?: string })
          ?.accessToken;
        if (!token) {
          setLoading(false);
          return;
        }
        const allTasks = await fetchTasks(token);
        const todayTasks = allTasks.filter(
          (t) =>
            !t.completed && (isDueToday(t.due) || isOverdue(t.due))
        );
        setTasks(todayTasks);
      } catch (err) {
        setError("Unable to load tasks");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  return (
    <Card title="Today&rsquo;s Tasks">
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      )}

      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      {!loading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No tasks due today. Nice work!
          </p>
        </div>
      )}

      {!loading && !error && tasks.length > 0 && (
        <ul className="space-y-2">
          {tasks.map((task, idx) => (
            <li
              key={task.id || idx}
              className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
            >
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {task.title}
                </p>
                {task.due && (
                  <p className="text-xs text-muted-foreground">
                    {isOverdue(task.due) ? (
                      <span className="text-destructive">Overdue</span>
                    ) : (
                      formatDueTime(task.due)
                    )}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
