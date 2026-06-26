"use client";

import { Flame } from "lucide-react";
import Drawer from "./Drawer";

interface HabitsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const HABITS = [
  { name: "Morning pages", streak: 12, days: [1, 1, 1, 0, 1, 1, 1] },
  { name: "Move 30 min", streak: 5, days: [1, 0, 1, 1, 1, 0, 1] },
  { name: "Read", streak: 23, days: [1, 1, 1, 1, 1, 1, 0] },
  { name: "No screens after 10", streak: 3, days: [0, 1, 0, 1, 1, 0, 1] },
];

/**
 * HabitsDrawer — a minimal streak overview with a 7-day dot grid.
 * Illustrative data; design-forward.
 */
export default function HabitsDrawer({ open, onClose }: HabitsDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Habits"
      subtitle="Small things, kept"
      icon={<Flame size={18} />}
    >
      <div className="flex flex-col gap-3">
        {HABITS.map((h) => (
          <div
            key={h.name}
            className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]"
          >
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-medium text-white/90">{h.name}</p>
              <span className="flex items-center gap-1 text-xs text-accent-magenta">
                <Flame size={13} /> {h.streak}
              </span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {h.days.map((d, i) => (
                <span
                  key={i}
                  className={`h-6 flex-1 rounded-md ${
                    d
                      ? "bg-gradient-to-br from-accent-magenta/70 to-accent-cyan/70"
                      : "bg-white/[0.05]"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
