"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
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
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  type CalendarEvent,
} from "@/lib/api";
import { updateCalendarEvent } from "@/lib/api-extended";
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

// Time block for week/day views (draggable)
function TimeBlock({
  event,
  onClick,
  dayStart,
  isDragging,
}: {
  event: CalendarEvent;
  onClick: () => void;
  dayStart: Date;
  isDragging?: boolean;
}) {
  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);
  const startMinutes = differenceInMinutes(startDate, setHours(setMinutes(dayStart, 0), 6));
  const duration = differenceInMinutes(endDate, startDate);

  const top = Math.max(0, (startMinutes / 60) * 64); // 64px per hour
  const height = Math.max(20, (duration / 60) * 64);

  const dragId = `event-${event.id || event.summary}-${event.start}`;
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: dragId,
    data: { event },
  });

  const style: React.CSSProperties = {
    top: `${top}px`,
    height: `${height}px`,
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className="absolute left-1 right-1 rounded-lg bg-accent-500/15 border border-accent-500/30 px-2 py-1 overflow-hidden hover:bg-accent-500/25 transition-colors group z-10 cursor-grab active:cursor-grabbing"
      style={style}
      {...listeners}
      {...attributes}
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

// Droppable time slot for week/day views
function DroppableTimeSlot({
  day,
  hour,
  onClick,
}: {
  day: Date;
  hour: number;
  onClick: () => void;
}) {
  const slotId = `slot:${format(day, "yyyy-MM-dd")}:${hour.toString().padStart(2, "0")}`;
  const { isOver, setNodeRef } = useDroppable({ id: slotId });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`h-16 w-full border-b border-[var(--border)]/50 transition-colors ${
        isOver
          ? "bg-accent-500/15 ring-1 ring-inset ring-accent-500/40"
          : "hover:bg-accent-500/5"
      }`}
    />
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

  // Edit event form
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSummary, setEditSummary] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("09:00");
  const [editDuration, setEditDuration] = useState(60);

  // Drag state
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Open edit modal for an event
  const openEditModal = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setEditSummary(event.summary);
    const start = parseISO(event.start);
    setEditDate(format(start, "yyyy-MM-dd"));
    setEditTime(format(start, "HH:mm"));
    const duration = differenceInMinutes(parseISO(event.end), start);
    setEditDuration(duration > 0 ? duration : 60);
    setShowEditModal(true);
  }, []);

  // Save edited event
  const handleSaveEdit = async () => {
    if (!selectedEvent || !editSummary.trim() || !editDate) return;
    const newStartTime = `${editDate}T${editTime}:00`;
    const oldTime = selectedEvent.start;

    const newStartISO = new Date(newStartTime).toISOString();
    const newEndISO = new Date(
      new Date(newStartTime).getTime() + editDuration * 60000
    ).toISOString();

    // Update local state immediately (compare by ID, fallback to reference for local events)
    setEvents((prev) =>
      prev.map((e) =>
        (selectedEvent.id ? e.id === selectedEvent.id : e === selectedEvent)
          ? { ...e, summary: editSummary.trim(), start: newStartISO, end: newEndISO }
          : e
      )
    );

    // Report to AI
    reportAction("event_edited", {
      eventId: selectedEvent.id,
      oldTime,
      newTime: newStartISO,
      summary: editSummary.trim(),
    });

    // Attempt API call
    if (selectedEvent.id) {
      try {
        await updateCalendarEvent(accessToken, selectedEvent.id, {
          summary: editSummary.trim(),
          start_time: newStartTime,
          duration_minutes: editDuration,
        });
      } catch {
        // Local state already updated as fallback
      }
    }

    setShowEditModal(false);
    setSelectedEvent(null);
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedEventId(event.active.id as string);
  };

  // Handle drag end - reschedule event
  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedEventId(null);
    const { active, over } = event;
    if (!over) return;

    const droppedId = over.id as string;
    if (!droppedId.startsWith("slot:")) return;

    // Parse the target slot: "slot:YYYY-MM-DD:HH"
    const parts = droppedId.split(":");
    const dayStr = parts[1];
    const hour = parseInt(parts[2], 10);

    const draggedEvent = (active.data.current as { event: CalendarEvent })?.event;
    if (!draggedEvent) return;

    const oldStart = parseISO(draggedEvent.start);
    const oldEnd = parseISO(draggedEvent.end);
    const duration = differenceInMinutes(oldEnd, oldStart);

    const newStart = setMinutes(setHours(new Date(`${dayStr}T00:00:00`), hour), 0);
    const newEnd = new Date(newStart.getTime() + duration * 60000);
    const newStartISO = newStart.toISOString();
    const newEndISO = newEnd.toISOString();

    // Update local state (compare by ID, fallback to reference for local events)
    setEvents((prev) =>
      prev.map((e) =>
        (draggedEvent.id ? e.id === draggedEvent.id : e === draggedEvent)
          ? { ...e, start: newStartISO, end: newEndISO }
          : e
      )
    );

    // Report to AI
    reportAction("event_edited", {
      eventId: draggedEvent.id,
      oldTime: draggedEvent.start,
      newTime: newStartISO,
      summary: draggedEvent.summary,
    });

    // Attempt API call
    if (draggedEvent.id) {
      try {
        await updateCalendarEvent(accessToken, draggedEvent.id, {
          start_time: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
          duration_minutes: duration,
        });
      } catch {
        // Local state already updated as fallback
      }
    }
  };

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
    setEvents((prev) => prev.filter((e) => (event.id ? e.id !== event.id : e !== event)));
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
                            onClick={() => openEditModal(event)}
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
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                          <DroppableTimeSlot
                            key={hour}
                            day={day}
                            hour={hour}
                            onClick={() => handleTimeSlotClick(day, hour)}
                          />
                        ))}
                        {/* Events */}
                        {getEventsForDay(day).map((event, i) => (
                          <TimeBlock
                            key={event.id || i}
                            event={event}
                            dayStart={day}
                            onClick={() => openEditModal(event)}
                            isDragging={draggedEventId === `event-${event.id || event.summary}-${event.start}`}
                          />
                        ))}
                        {/* Current time indicator */}
                        {isToday(day) && <CurrentTimeIndicator />}
                      </div>
                    ))}
                  </div>
                </div>
              </DndContext>
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
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                        <DroppableTimeSlot
                          key={hour}
                          day={currentDate}
                          hour={hour}
                          onClick={() => handleTimeSlotClick(currentDate, hour)}
                        />
                      ))}
                      {/* Events */}
                      {getEventsForDay(currentDate).map((event, i) => (
                        <TimeBlock
                          key={event.id || i}
                          event={event}
                          dayStart={currentDate}
                          onClick={() => openEditModal(event)}
                          isDragging={draggedEventId === `event-${event.id || event.summary}-${event.start}`}
                        />
                      ))}
                      {/* Current time indicator */}
                      {isToday(currentDate) && <CurrentTimeIndicator />}
                    </div>
                  </div>
                </div>
              </DndContext>
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

      {/* Edit Event Modal */}
      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setSelectedEvent(null); }}>
        <div className="p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Edit Event
          </h2>
          <div className="space-y-4">
            <Input
              label="Summary"
              placeholder="Meeting, Call, etc."
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveEdit();
              }}
            />
            <Input
              label="Date"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
            <Input
              label="Start Time"
              type="time"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setEditDuration(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      editDuration === opt.value
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
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border)]">
            <button
              onClick={() => {
                if (selectedEvent) handleDeleteEvent(selectedEvent);
                setShowEditModal(false);
              }}
              className="flex items-center gap-1.5 text-xs text-danger-500 hover:text-danger-600 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowEditModal(false); setSelectedEvent(null); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editSummary.trim() || !editDate}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </Modal>

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
