"use client";

import { Sparkles } from "lucide-react";
import Drawer from "./Drawer";

interface ScheduleDrawerProps {
  open: boolean;
  onClose: () => void;
}

const TIMELINE = [
  { time: "09:00", label: "Deep work", tone: "from-accent-magenta to-accent-magenta2" },
  { time: "11:30", label: "Team sync", tone: "from-accent-cyan to-accent-cyan2" },
  { time: "13:00", label: "Lunch & reset", tone: "from-white/20 to-white/10" },
  { time: "14:30", label: "Design review", tone: "from-accent-magenta to-accent-cyan" },
  { time: "17:00", label: "Wind down", tone: "from-accent-cyan to-accent-magenta" },
];

/**
 * ScheduleDrawer — a calm timeline view of the suggested day shape.
 * Uses illustrative data; the look is the priority.
 */
export default function ScheduleDrawer({ open, onClose }: ScheduleDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Schedule"
      subtitle="A gentle shape for today"
      icon={<Sparkles size={18} />}
    >
      <div className="relative pl-6">
        {/* spine */}
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/10" />
        <div className="flex flex-col gap-5">
          {TIMELINE.map((item) => (
            <div key={item.time} className="relative">
              <span
                className={`absolute -left-[22px] top-1.5 h-3 w-3 rounded-full bg-gradient-to-br ${item.tone}`}
              />
              <p className="font-mono text-[11px] uppercase tracking-wider text-white/40">
                {item.time}
              </p>
              <p className="text-[15px] text-white/85">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}
