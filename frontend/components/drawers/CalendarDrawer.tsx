"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import Drawer from "./Drawer";
import { fetchCalendarEvents, type CalendarEvent } from "@/lib/api";

interface CalendarDrawerProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
}

function formatRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const day = s.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const t = (d: Date) =>
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `${day} · ${t(s)} – ${t(e)}`;
  } catch {
    return start;
  }
}

// Graceful placeholder so the panel always looks alive even before/without data.
const PLACEHOLDER: CalendarEvent[] = [
  {
    id: "p1",
    summary: "Morning focus block",
    start: new Date().toISOString(),
    end: new Date(Date.now() + 3600_000).toISOString(),
    location: "Deep work",
  },
  {
    id: "p2",
    summary: "Team sync",
    start: new Date(Date.now() + 7200_000).toISOString(),
    end: new Date(Date.now() + 9000_000).toISOString(),
    location: "Meet",
  },
];

export default function CalendarDrawer({
  open,
  onClose,
  accessToken,
}: CalendarDrawerProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [usedPlaceholder, setUsedPlaceholder] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchCalendarEvents(accessToken)
      .then((data) => {
        if (cancelled) return;
        if (data.length) {
          setEvents(data);
          setUsedPlaceholder(false);
        } else {
          setEvents(PLACEHOLDER);
          setUsedPlaceholder(true);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, accessToken]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Calendar"
      subtitle="The next few days"
      icon={<CalendarDays size={18} />}
    >
      {loading ? (
        <SkeletonList />
      ) : (
        <div className="flex flex-col gap-3">
          {usedPlaceholder && (
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-white/30">
              Preview
            </p>
          )}
          {events.map((ev) => (
            <div
              key={ev.id || ev.summary}
              className="group rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-accent-magenta to-accent-cyan" />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-white/90">
                    {ev.summary}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-white/45">
                    <Clock size={12} /> {formatRange(ev.start, ev.end)}
                  </p>
                  {ev.location && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/35">
                      <MapPin size={12} /> {ev.location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.05]"
        />
      ))}
    </div>
  );
}
