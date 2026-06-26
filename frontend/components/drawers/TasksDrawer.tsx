"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import Drawer from "./Drawer";
import { fetchTasks, type TaskItem } from "@/lib/api";

interface TasksDrawerProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
}

const PLACEHOLDER: TaskItem[] = [
  { id: "t1", title: "Review quarterly goals", completed: false },
  { id: "t2", title: "Reply to design feedback", completed: false },
  { id: "t3", title: "Book dentist appointment", completed: true },
];

export default function TasksDrawer({
  open,
  onClose,
  accessToken,
}: TasksDrawerProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [usedPlaceholder, setUsedPlaceholder] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchTasks(accessToken)
      .then((data) => {
        if (cancelled) return;
        if (data.length) {
          setTasks(data);
          setUsedPlaceholder(false);
        } else {
          setTasks(PLACEHOLDER);
          setUsedPlaceholder(true);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  // Optimistic local toggle (visual only — does not mutate backend).
  const toggle = (id?: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Tasks"
      subtitle="What needs your attention"
      icon={<ListTodo size={18} />}
    >
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-white/[0.04] ring-1 ring-white/[0.05]"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {usedPlaceholder && (
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-white/30">
              Preview
            </p>
          )}
          {tasks.map((t) => (
            <button
              key={t.id || t.title}
              onClick={() => toggle(t.id)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.04]"
            >
              {t.completed ? (
                <CheckCircle2 size={19} className="shrink-0 text-accent-cyan" />
              ) : (
                <Circle size={19} className="shrink-0 text-white/30" />
              )}
              <span
                className={`text-[15px] ${
                  t.completed
                    ? "text-white/35 line-through"
                    : "text-white/85"
                }`}
              >
                {t.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
}
