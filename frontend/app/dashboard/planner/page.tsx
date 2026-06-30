"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
} from "lucide-react";
import {
  format,
  addDays,
  isToday,
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
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";

import {
  fetchCalendarEvents,
  createCalendarEvent,
  fetchTasks,
  type CalendarEvent,
} from "@/lib/api";
import { useAI } from "@/components/ai/AIContextProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { safeParseDate, safeFormat } from "@/lib/date-utils";

// ---------- LocalTask Interface (mirrors tasks page) ----------
interface RecurrenceConfig {
  type: "daily" | "weekly" | "monthly" | "custom";
  interval?: number;
  days?: number[];
}

interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

interface LocalTask {
  id: string;
  title: string;
  notes?: string;
  due?: string | null;
  completed?: boolean;
  status: "todo" | "inprogress" | "done";
  priority: "high" | "medium" | "low" | "none";
  recurrence?: RecurrenceConfig | null;
  labels?: TaskLabel[];
  subtasks?: { title: string; completed: boolean }[];
  linkedEventId?: string;
}

const TASKS_STORAGE_KEY = "chronai-tasks";
// The planner hour grid always renders the full 24-hour day (12 AM → 11 PM)
// for consistency with the calendar day view.
const GRID_START = 0;
const GRID_END = 23;
const ROW_HEIGHT = 64;

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
];

// Priority dot color helper
function priorityDotColor(priority: LocalTask["priority"]): string {
  switch (priority) {
    case "high":
      return "#f43f5e";
    case "medium":
      return "#f59e0b";
    case "low":
      return "#6366f1";
    default:
      return "var(--text-tertiary)";
  }
}

// ---------- Draggable Task Item ----------
function DraggableTask({ task }: { task: LocalTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 ring-2 ring-accent-500/30" : ""
      }`}
    >
      <GripVertical size={14} className="text-[var(--text-tertiary)] dark:text-[#847e76] flex-shrink-0" />
      {task.priority && task.priority !== "none" && (
        <span
          className="inline-block h-[7px] w-[7px] rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityDotColor(task.priority) }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4] truncate">
          {task.title}
        </p>
        {task.due && (
          <p className="text-[11px] text-[var(--text-tertiary)] dark:text-[#847e76] mt-0.5">
            Due: {format(new Date(task.due), "MMM d")}
          </p>
        )}
      </div>
      {task.linkedEventId && (
        <CheckSquare size={12} className="text-accent-500 flex-shrink-0" />
      )}
    </div>
  );
}

// ---------- Drag Overlay ----------
function TaskDragOverlay({ task }: { task: LocalTask }) {
  return (
    <div className="rotate-2 shadow-xl px-3 py-2.5 rounded-xl border border-accent-500/30 bg-[var(--surface)] max-w-[260px]">
      <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4] truncate">
        {task.title}
      </p>
    </div>
  );
}

// ---------- Droppable Time Slot ----------
function DroppableTimeSlot({
  day,
  hour,
}: {
  day: Date;
  hour: number;
}) {
  const slotId = `slot:${format(day, "yyyy-MM-dd")}:${hour.toString().padStart(2, "0")}`;
  const { isOver, setNodeRef } = useDroppable({ id: slotId });

  return (
    <div
      ref={setNodeRef}
      className={`h-16 w-full border-b border-[var(--border)]/50 transition-colors ${
        isOver
          ? "bg-accent-500/15 ring-1 ring-inset ring-accent-500/40"
          : "hover:bg-accent-500/5"
      }`}
    />
  );
}

// ---------- Calendar Event Block ----------
function EventBlock({
  event,
  dayStart,
  gridStart,
  gridEnd,
}: {
  event: CalendarEvent;
  dayStart: Date;
  gridStart: number;
  gridEnd: number;
}) {
  const startDate = safeParseDate(event.start);
  const parsedEnd = safeParseDate(event.end);
  const endDate =
    parsedEnd && startDate && parsedEnd.getTime() > startDate.getTime()
      ? parsedEnd
      : startDate
        ? new Date(startDate.getTime() + 60 * 60 * 1000)
        : null;

  if (!startDate || !endDate) return null;

  const startHour = startDate.getHours();
  const startMinuteOfDay = startDate.getMinutes();
  const duration = Math.max(0, (endDate.getTime() - startDate.getTime()) / 60000);

  const minutesFromStart = (startHour - gridStart) * 60 + startMinuteOfDay;
  const top = Math.max(0, (minutesFromStart / 60) * ROW_HEIGHT);
  const height = Math.max(28, (duration / 60) * ROW_HEIGHT);
  const gridHeight = (gridEnd - gridStart + 1) * ROW_HEIGHT;
  const clampedHeight = Math.min(height, Math.max(28, gridHeight - top));

  const isLinkedTask = event.description?.includes("[task-linked]");

  return (
    <div
      className={`absolute left-1 right-1 rounded-md overflow-hidden border-l-2 py-1 px-2 ${
        isLinkedTask
          ? "bg-success-500/10 border-l-success-500"
          : "bg-accent-500/15 border-l-accent-500"
      }`}
      style={{
        top: `${top}px`,
        height: `${clampedHeight}px`,
        maxHeight: `${clampedHeight}px`,
      }}
    >
      <div className="flex items-center gap-1 overflow-hidden">
        {isLinkedTask && <CheckSquare size={10} className="text-success-500 flex-shrink-0" />}
        <p className={`text-[11px] font-medium truncate ${
          isLinkedTask ? "text-success-600 dark:text-success-300" : "text-accent-600 dark:text-accent-300"
        }`}>
          {event.summary}
        </p>
      </div>
      {clampedHeight > 40 && (
        <p className={`text-[10px] truncate ${
          isLinkedTask ? "text-success-500/70" : "text-accent-500/70"
        }`}>
          {safeFormat(startDate, "h:mm a")} - {safeFormat(endDate, "h:mm a")}
        </p>
      )}
    </div>
  );
}

// ---------- Current Time Indicator (hydration-safe) ----------
function CurrentTimeIndicator({
  gridStart,
  gridEnd,
}: {
  gridStart: number;
  gridEnd: number;
}) {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = (now.getHours() - gridStart) * 60 + now.getMinutes();
      const gridMinutes = (gridEnd - gridStart + 1) * 60;
      setTop(mins >= 0 && mins <= gridMinutes ? (mins / 60) * ROW_HEIGHT : null);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [gridStart, gridEnd]);

  if (top === null) return null;

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

// ---------- Main Planner Page ----------
export default function PlannerPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string })?.accessToken || "";
  const { reportAction } = useAI();

  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // The hour grid always spans the full day (12 AM → 11 PM) so every AM/PM hour
  // is visible and events land on the correct row (gridStart=0, no off-by-one).
  const gridStart = GRID_START;
  const gridEnd = GRID_END;
  const HOURS = useMemo(
    () => Array.from({ length: gridEnd - gridStart + 1 }, (_, i) => i + gridStart),
    [gridStart, gridEnd]
  );

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<{
    task: LocalTask;
    date: string;
    hour: number;
  } | null>(null);
  const [scheduleDuration, setScheduleDuration] = useState(60);
  const [scheduling, setScheduling] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Drag state
  const [activeTask, setActiveTask] = useState<LocalTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Set page title
  useEffect(() => {
    document.title = "Planner | Haven";
  }, []);

  // Load tasks from the real API, merging localStorage enrichment for linkedEventId
  useEffect(() => {
    async function loadTasks() {
      // Read localStorage tasks for enrichment / fallback
      let localTasks: LocalTask[] = [];
      try {
        const stored = localStorage.getItem(TASKS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as LocalTask[];
          if (Array.isArray(parsed)) {
            localTasks = parsed;
          }
        }
      } catch {
        localTasks = [];
      }

      try {
        const apiTasks = await fetchTasks(accessToken);

        // Build a lookup of localStorage tasks by id for linkedEventId enrichment
        const localById = new Map<string, LocalTask>();
        for (const lt of localTasks) {
          if (lt.id) localById.set(lt.id, lt);
        }

        const mapped: LocalTask[] = apiTasks.map((task, i) => {
          const id =
            task.id ||
            `task-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
          const localMatch = localById.get(id);
          return {
            id,
            title: task.title,
            notes: task.notes,
            due: task.due ?? null,
            completed: task.completed ?? false,
            status: task.completed ? "done" : "todo",
            priority: "none",
            labels: [],
            ...(localMatch?.linkedEventId
              ? { linkedEventId: localMatch.linkedEventId }
              : {}),
          };
        });

        setTasks(mapped);
      } catch {
        // API failed - fall back to localStorage tasks (previous behavior)
        setTasks(localTasks);
      }
    }
    loadTasks();
  }, [accessToken]);

  // Load calendar events
  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      try {
        const fetched = await fetchCalendarEvents(accessToken, 1);
        setEvents(fetched);
      } catch {
        setEvents([]);
      }
      setLoading(false);
    }
    loadEvents();
  }, [accessToken, currentDate]);

  // Filter: show only incomplete tasks
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done"),
    [tasks]
  );

  // Get events for current day
  const dayEvents = useMemo(() => {
    return events.filter((e) => {
      const start = safeParseDate(e.start);
      if (!start) return false;
      return (
        start.getFullYear() === currentDate.getFullYear() &&
        start.getMonth() === currentDate.getMonth() &&
        start.getDate() === currentDate.getDate()
      );
    });
  }, [events, currentDate]);

  // Navigation
  const navigatePrev = () => setCurrentDate((d) => addDays(d, -1));
  const navigateNext = () => setCurrentDate((d) => addDays(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Format time for display
  const formatSlotTime = (date: string, hour: number) => {
    const d = new Date(`${date}T${hour.toString().padStart(2, "0")}:00:00`);
    return format(d, "h:mm a, EEEE MMM d");
  };

  // Drag handlers
  const handleDragStart = (event: any) => {
    const taskData = event.active.data.current?.task;
    if (taskData) {
      setActiveTask(taskData);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const droppedId = over.id as string;
    if (!droppedId.startsWith("slot:")) return;

    // Parse the target slot: "slot:YYYY-MM-DD:HH"
    const parts = droppedId.split(":");
    const dayStr = parts[1];
    const hour = parseInt(parts[2], 10);

    const draggedTask = (active.data.current as { task: LocalTask })?.task;
    if (!draggedTask) return;

    // Show confirmation modal
    setPendingSchedule({ task: draggedTask, date: dayStr, hour });
    setScheduleDuration(60);
    setShowConfirmModal(true);
  };

  // Handle schedule confirmation
  const handleConfirmSchedule = async () => {
    if (!pendingSchedule) return;
    setScheduling(true);

    const { task, date, hour } = pendingSchedule;
    const startTime = `${date}T${hour.toString().padStart(2, "0")}:00:00`;

    try {
      const created = await createCalendarEvent(accessToken, {
        summary: task.title,
        start_time: startTime,
        duration_minutes: scheduleDuration,
      });

      // Update local task to store linkedEventId
      const updatedTasks = tasks.map((t) =>
        t.id === task.id ? { ...t, linkedEventId: created.id || `local-${Date.now()}` } : t
      );
      setTasks(updatedTasks);
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updatedTasks));

      // Add the event to local state
      setEvents((prev) => [...prev, created]);

      // Report action
      reportAction("task_scheduled_to_calendar", {
        taskTitle: task.title,
        time: startTime,
        eventId: created.id,
      });

      // Show success
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    } catch {
      // If API fails, add event locally
      const startISO = new Date(startTime).toISOString();
      const endISO = new Date(
        new Date(startTime).getTime() + scheduleDuration * 60000
      ).toISOString();
      const localEvent: CalendarEvent = {
        id: `local-${Date.now()}`,
        summary: task.title,
        start: startISO,
        end: endISO,
        description: "[task-linked]",
      };
      setEvents((prev) => [...prev, localEvent]);

      // Update local task
      const updatedTasks = tasks.map((t) =>
        t.id === task.id ? { ...t, linkedEventId: localEvent.id } : t
      );
      setTasks(updatedTasks);
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updatedTasks));

      reportAction("task_scheduled_to_calendar", {
        taskTitle: task.title,
        time: startTime,
        eventId: localEvent.id,
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    } finally {
      setScheduling(false);
      setShowConfirmModal(false);
      setPendingSchedule(null);
    }
  };

  const handleCancelSchedule = () => {
    setShowConfirmModal(false);
    setPendingSchedule(null);
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10">
            <CalendarClock size={20} strokeWidth={1.5} className="text-accent-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--text-primary)] dark:text-[#ece9e4]">
              Planner
            </h1>
            <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
              Drag tasks onto the calendar to schedule them
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={navigatePrev}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={goToToday}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:bg-[var(--surface-hover)] transition-colors"
          >
            Today
          </button>
          <button
            onClick={navigateNext}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
          <span className="ml-2 text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4]">
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </span>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-success-500/10 border border-success-500/20 text-success-600 dark:text-success-300"
          >
            <CheckSquare size={16} />
            <span className="text-sm font-medium">Task scheduled successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split View */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Left Panel: Task List */}
          <div className="w-[320px] flex-shrink-0 flex flex-col overflow-hidden border border-[var(--border)] rounded-xl bg-[var(--surface)]">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] dark:text-[#ece9e4] flex items-center gap-2">
                <CheckSquare size={14} className="text-warning-500" />
                Tasks
                <span className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] font-normal">
                  ({activeTasks.length})
                </span>
              </h2>
              <p className="text-[11px] text-[var(--text-tertiary)] dark:text-[#847e76] mt-0.5">
                Drag a task onto a time slot
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {activeTasks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-tertiary)] dark:text-[#847e76]">
                    No pending tasks
                  </p>
                </div>
              ) : (
                activeTasks.map((task) => (
                  <DraggableTask key={task.id} task={task} />
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Day Calendar */}
          <div className="flex-1 flex flex-col overflow-hidden border border-[var(--border)] rounded-xl bg-[var(--surface)]">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] dark:text-[#ece9e4] flex items-center gap-2">
                <Clock size={14} className="text-accent-500" />
                {format(currentDate, "EEEE, MMMM d")}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} height={64} className="w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[56px_1fr] relative">
                  {/* Time labels */}
                  <div>
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="h-16 flex items-start justify-end pr-2"
                      >
                        <span className="text-[10px] text-[var(--text-tertiary)] dark:text-[#847e76] -translate-y-[7px]">
                          {format(setHours(new Date(), hour), "h a")}
                        </span>
                      </div>
                    ))}
                  </div>
                  {/* Day column with droppable slots */}
                  <div className="relative border-l border-[var(--border)]">
                    {HOURS.map((hour) => (
                      <DroppableTimeSlot
                        key={hour}
                        day={currentDate}
                        hour={hour}
                      />
                    ))}
                    {/* Existing events */}
                    {dayEvents.map((event, i) => (
                      <EventBlock
                        key={event.id || i}
                        event={event}
                        dayStart={currentDate}
                        gridStart={gridStart}
                        gridEnd={gridEnd}
                      />
                    ))}
                    {/* Current time indicator */}
                    {isToday(currentDate) && <CurrentTimeIndicator gridStart={gridStart} gridEnd={gridEnd} />}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? <TaskDragOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Schedule Confirmation Modal */}
      <Modal open={showConfirmModal} onClose={handleCancelSchedule}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10">
              <CalendarClock size={20} className="text-accent-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
                Schedule Task
              </h2>
              <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76]">
                AI confirmation
              </p>
            </div>
          </div>

          {pendingSchedule && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)]">
                <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] mb-1">
                  Schedule
                </p>
                <p className="text-base font-semibold text-[var(--text-primary)] dark:text-[#ece9e4]">
                  &ldquo;{pendingSchedule.task.title}&rdquo;
                </p>
                <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] mt-2">
                  for{" "}
                  <span className="font-medium text-accent-500">
                    {formatSlotTime(pendingSchedule.date, pendingSchedule.hour)}
                  </span>
                  ?
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setScheduleDuration(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        scheduleDuration === opt.value
                          ? "bg-accent-500/10 text-accent-500 border-accent-500/30"
                          : "bg-[var(--surface-hover)] text-[var(--text-secondary)] dark:text-[#a8a39c] border-transparent hover:border-[var(--border)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelSchedule}
              disabled={scheduling}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSchedule}
              disabled={scheduling}
            >
              {scheduling ? "Scheduling..." : "Schedule"}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
