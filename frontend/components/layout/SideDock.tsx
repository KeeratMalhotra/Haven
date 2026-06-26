"use client";

import { motion } from "framer-motion";
import {
  CalendarDays,
  ListTodo,
  Sparkles,
  Flame,
  type LucideIcon,
} from "lucide-react";

export type PanelKey = "calendar" | "tasks" | "schedule" | "habits";

const ITEMS: { key: PanelKey; label: string; icon: LucideIcon }[] = [
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "schedule", label: "Schedule", icon: Sparkles },
  { key: "habits", label: "Habits", icon: Flame },
];

interface SideDockProps {
  active: PanelKey | null;
  onOpen: (key: PanelKey) => void;
}

/**
 * SideDock
 * A minimal floating icon rail anchored to the left edge that summons the
 * frosted side drawers. Calm by default; each icon glows on hover/active.
 */
export default function SideDock({ active, onOpen }: SideDockProps) {
  return (
    <motion.nav
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass fixed left-5 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1.5 rounded-3xl p-2"
    >
      {ITEMS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onOpen(key)}
            aria-label={label}
            title={label}
            className={`group relative grid h-11 w-11 place-items-center rounded-2xl transition-all ${
              isActive
                ? "bg-white/[0.07] text-white"
                : "text-white/50 hover:bg-white/[0.05] hover:text-white"
            }`}
          >
            {isActive && (
              <span className="absolute -left-2 h-5 w-1 rounded-full bg-accent-gradient" />
            )}
            <Icon size={20} strokeWidth={1.8} />
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-base-800 px-2.5 py-1 text-xs text-white/80 opacity-0 ring-1 ring-white/10 transition-opacity group-hover:opacity-100">
              {label}
            </span>
          </button>
        );
      })}
    </motion.nav>
  );
}
