"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  MapPin,
  Trash2,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  differenceInMinutes,
  setHours,
  setMinutes,
} from "date-fns";

import {
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from "@/lib/api";
import { useAI } from "@/components/ai/AIContextProvider";
import AISuggestionBanner from "@/components/ai/AISuggestionBanner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type CalendarView = "month" | "week" | "day";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM to 11 PM
const DURATION_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
];

// Event pill for month view
function EventPill({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-500/15 text-accent-600 dark:text-accent-300 truncate hover:bg-accent-500/25 transition-colors"
    >
      {event.summary}
    </button>
  );
}

// Time block for week/day views
function TimeBlock({
  event,
  onClick,
  dayStart,
}: {
  event: CalendarEvent;
  onClick: () => void;
  dayStart: Date;
}) {
  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);
  const startMinutes = differenceInMinutes(startDate, setHours(setMinutes(dayStart, 0), 6));
  const duration = differenceInMinutes(endDate, startDate);

  const top = Math.max(0, (startMinutes / 60) * 64); // 64px per hour
  const height = Math.max(20, (duration / 60) * 64);

  return (
    <button
      onClick={onClick}
      className="absolute left-1 right-1 rounded-lg bg-accent-500/15 border border-accent-500/30 px-2 py-1 overflow-hidden hover:bg-accent-500/25 transition-colors group"
      style={{ top: `${top}px`, height: `${height}px` }}
    >
      <p className="text-[11px] font-medium text-accent-600 dark:text-accent-300 truncate">
        {event.summary}
      </p>
      {height > 36 && (
        <p className="text-[10px] text-accent-500/70 dark:text-accent-400/70">
          {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
        </p>
      )}
    </button>
  );
}

// Event detail popover
function EventDetail({
  event,
  onClose,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: () => void;
}) {
  const start = parseISO(event.start);
  const end = parseISO(event.end);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="absolute z-50 top-full mt-2 left-0 w-72 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] pr-2">
          {event.summary}
        </h4>
        <button
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
        >
          <X size={12} />
        </button>
      </div>
      <div className="space-y-2 text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-[var(--text-tertiary)]" />
          <span>
            {format(start, "MMM d, h:mm a")} - {format(end, "h:mm a")}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-[var(--text-tertiary)]" />
            <span>{event.location}</span>
          </div>
        )}
        {event.description && (
          <p className="text-[var(--text-tertiary)] mt-2 pt-2 border-t border-[var(--border)]">
            {event.description}
          </p>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--border)]">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs text-danger-500 hover:text-danger-600 transition-colors"
        >
          <Trash2 size={12} />
          Delete Event
        </button>
      </div>
    </motion.div>
  );
}

// Current time indicator
function CurrentTimeIndicator() {
  const now = new Date();
  const minutesSince6AM = (now.getHours() - 6) * 60 + now.getMinutes();
  const top = (minutesSince6AM / 60) * 64;

  if (minutesSince6AM < 0 || minutesSince6AM > 18 * 60) return null;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <div className="h-2.5 w-2.5 rounded-full bg-danger-500 -ml-1" />
        <div className="flex-1 h-[2px] bg-danger-500/60" />
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string })?.accessToken || "";
  const { reportAction, suggestions, dismissSuggestion } = useAI();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [navDirection, setNavDirection] = useState(0);

  // Create event form
  const [newSummary, setNewSummary] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newDuration, setNewDuration] = useState(60);

  // Load events
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const fetched = await fetchCalendarEvents(accessToken, 60);
        setEvents(fetched);
      } catch {
        setEvents([]);
      }
      setLoading(false);
    }
    load();
  }, [accessToken]);

  // Navigation
  const navigatePrev = () => {
    setNavDirection(-1);
    if (view === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const navigateNext = () => {
    setNavDirection(1);
    if (view === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => {
    setNavDirection(0);
    setCurrentDate(new Date());
  };

  // Calendar grid for month view
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  // Week days
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Get events for a specific day
  const getEventsForDay = useCallback(
    (day: Date) => {
      return events.filter((e) => {
        try {
          return isSameDay(parseISO(e.start), day);
        } catch {
          return false;
        }
      });
    },
    [events]
  );

  // Create event
  const handleCreateEvent = async () => {
    if (!newSummary.trim() || !newDate) return;
    const startTime = `${newDate}T${newTime}:00`;

    try {
      const created = await createCalendarEvent(accessToken, {
        summary: newSummary.trim(),
        start_time: startTime,
        duration_minutes: newDuration,
      });
      setEvents((prev) => [...prev, created]);
      // Report action only after successful API call
      reportAction("event_created", {
        summary: newSummary.trim(),
        startTime: startTime,
        duration: newDuration,
      });
    } catch {
      // If API fails, add locally but do not report to AI (event may not exist)
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(
        new Date(startTime).getTime() + newDuration * 60000
      ).toISOString();
      setEvents((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          summary: newSummary.trim(),
          start: startISO,
          end: endISO,
        },
      ]);
    }
    setNewSummary("");
    setNewDate("");
    setNewTime("09:00");
    setNewDuration(60);
    setShowCreateModal(false);
  };

  // Delete event
  const handleDeleteEvent = async (event: CalendarEvent) => {
    reportAction("event_deleted", { summary: event.summary, eventId: event.id });

    if (event.id) {
      try {
        await deleteCalendarEvent(accessToken, event.id);
      } catch {
        // Continue with local removal
      }
    }
    setEvents((prev) => prev.filter((e) => e !== event));
    setSelectedEvent(null);
  };

  // Click day to go to day view
  const handleDayClick = (day: Date) => {
    setCurrentDate(day);
    setView("day");
  };

  // Click time slot to create event
  const handleTimeSlotClick = (day: Date, hour: number) => {
    reportAction("timeslot_clicked", { day: format(day, "yyyy-MM-dd"), hour });
    setNewDate(format(day, "yyyy-MM-dd"));
    setNewTime(`${hour.toString().padStart(2, "0")}:00`);
    setShowCreateModal(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10">
              <CalendarIcon size={20} strokeWidth={1.5} className="text-accent-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                {view === "month" && format(currentDate, "MMMM yyyy")}
                {view === "week" &&
                  `${format(startOfWeek(currentDate), "MMM d")} - ${format(
                    endOfWeek(currentDate),
                    "MMM d, yyyy"
                  )}`}
                {view === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
              </h1>
            </div>
          </div>
          {/* Nav arrows */}
          <div className="flex items-center gap-1">
            <button
              onClick={navigatePrev}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] transition-colors"
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <button
              onClick={goToToday}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] transition-colors"
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  view === v
                    ? "bg-accent-500/10 text-accent-500"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            New Event
          </Button>
        </div>
      </div>

      {/* AI Suggestion Banner */}
      {(() => {
        const activeSuggestion = suggestions.find((s) => !s.dismissed);
        if (!activeSuggestion) return null;
        return (
          <div className="mb-4">
            <AnimatePresence>
              <AISuggestionBanner
                suggestion={activeSuggestion.text}
                type={activeSuggestion.type}
                onDismiss={() => dismissSuggestion(activeSuggestion.id)}
              />
            </AnimatePresence>
          </div>
        );
      })()}

      {/* Content */}
      {loading ? (
        <div className="flex-1 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} height={80} className="w-full" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {/* Month View */}
          {view === "month" && (
            <motion.div
              key={`month-${format(currentDate, "yyyy-MM")}`}
              initial={{ opacity: 0, x: navDirection * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: navDirection * -30 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-[var(--text-tertiary)] py-2"
                    >
                      {day}
                    </div>
                  )
                )}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)] flex-1">
                {monthDays.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const inMonth = isSameMonth(day, currentDate);
                  const today = isToday(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDayClick(day)}
                      className={`bg-[var(--surface)] p-1.5 min-h-[80px] text-left flex flex-col hover:bg-[var(--surface-hover)] transition-colors ${
                        !inMonth ? "opacity-40" : ""
                      }`}
                    >
                      <span
                        className={`text-xs font-medium mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full ${
                          today
                            ? "bg-accent-500 text-white"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                      <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                        {dayEvents.slice(0, 3).map((event, i) => (
                          <EventPill
                            key={event.id || i}
                            event={event}
                            onClick={() => setSelectedEvent(event)}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-[var(--text-tertiary)] px-1">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Week View */}
          {view === "week" && (
            <motion.div
              key={`week-${format(currentDate, "yyyy-ww")}`}
              initial={{ opacity: 0, x: navDirection * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: navDirection * -30 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Day headers */}
              <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[var(--border)] mb-0">
                <div />
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="text-center py-2 border-l border-[var(--border)]"
                  >
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase">
                      {format(day, "EEE")}
                    </p>
                    <p
                      className={`text-sm font-semibold mt-0.5 ${
                        isToday(day) ? "text-accent-500" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>
                ))}
              </div>
              {/* Time grid */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-[56px_repeat(7,1fr)] relative">
                  {/* Time labels */}
                  <div>
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="h-16 flex items-start justify-end pr-2 -mt-2"
                      >
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {format(setHours(new Date(), hour), "h a")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Day columns */}
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className="relative border-l border-[var(--border)]"
                    >
                      {HOURS.map((hour) => (
                        <button
                          key={hour}
                          onClick={() => handleTimeSlotClick(day, hour)}
                          className="h-16 w-full border-b border-[var(--border)]/50 hover:bg-accent-500/5 transition-colors"
                        />
                      ))}
                      {/* Events */}
                      {getEventsForDay(day).map((event, i) => (
                        <TimeBlock
                          key={event.id || i}
                          event={event}
                          dayStart={day}
                          onClick={() => setSelectedEvent(event)}
                        />
                      ))}
                      {/* Current time indicator */}
                      {isToday(day) && <CurrentTimeIndicator />}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Day View */}
          {view === "day" && (
            <motion.div
              key={`day-${format(currentDate, "yyyy-MM-dd")}`}
              initial={{ opacity: 0, x: navDirection * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: navDirection * -30 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-[56px_1fr] relative">
                  {/* Time labels */}
                  <div>
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="h-16 flex items-start justify-end pr-2 -mt-2"
                      >
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {format(setHours(new Date(), hour), "h a")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Day column */}
                  <div className="relative border-l border-[var(--border)]">
                    {HOURS.map((hour) => (
                      <button
                        key={hour}
                        onClick={() =>
                          handleTimeSlotClick(currentDate, hour)
                        }
                        className="h-16 w-full border-b border-[var(--border)]/50 hover:bg-accent-500/5 transition-colors"
                      />
                    ))}
                    {/* Events */}
                    {getEventsForDay(currentDate).map((event, i) => (
                      <TimeBlock
                        key={event.id || i}
                        event={event}
                        dayStart={currentDate}
                        onClick={() => setSelectedEvent(event)}
                      />
                    ))}
                    {/* Current time indicator */}
                    {isToday(currentDate) && <CurrentTimeIndicator />}
                  </div>
                </div>
              </div>
              {/* Day events list */}
              {getEventsForDay(currentDate).length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-[var(--text-tertiary)]">
                    No events scheduled for this day
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Event Detail Popover */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setSelectedEvent(null)}
            />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
              <EventDetail
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onDelete={() => handleDeleteEvent(selectedEvent)}
              />
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Create Event Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            New Event
          </h2>
          <div className="space-y-4">
            <Input
              label="Summary"
              placeholder="Meeting, Call, etc."
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateEvent();
              }}
            />
            <Input
              label="Date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
            <Input
              label="Start Time"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNewDuration(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      newDuration === opt.value
                        ? "bg-accent-500/10 text-accent-500 border-accent-500/30"
                        : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border-transparent hover:border-[var(--border)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateEvent}
              disabled={!newSummary.trim() || !newDate}
            >
              <Plus size={14} />
              Create Event
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
