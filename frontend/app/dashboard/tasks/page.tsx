"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  LayoutGrid,
  List,
  Plus,
  X,
  GripVertical,
  Calendar as CalendarIcon,
  ListChecks,
  Trash2,
  Sparkles,
  Repeat,
  CheckCircle2,
  ArrowRight,
  Tag,
  Flag,
  BookTemplate,
  Mail,
  Presentation,
  Search,
  Star,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, addDays, addWeeks, addMonths, getDay } from "date-fns";

import { fetchTasks, type TaskItem } from "@/lib/api";
import {
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  updateTask as apiUpdateTask,
  fetchAiPriorities,
} from "@/lib/api-extended";
import { useAI } from "@/components/ai/AIContextProvider";
import AISuggestionBanner from "@/components/ai/AISuggestionBanner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useLabels,
  LabelSelector,
  LabelFilterBar,
  LabelCreator,
  type TaskLabel,
} from "@/components/tasks/LabelManager";
import {
  TaskContextMenu,
  type ContextMenuPosition,
  type ContextMenuActions,
} from "@/components/tasks/TaskContextMenu";
import { TemplateLibrary } from "@/components/templates/TemplateLibrary";
import { type TemplateTask } from "@/lib/templates";
import { GmailScanModal } from "@/components/gmail/GmailScanModal";
import { SlidesGeneratorModal } from "@/components/slides/SlidesGeneratorModal";
import { type GmailActionItem, researchTask } from "@/lib/api-extended";
import TaskResearchPanel, { type ResearchResult } from "@/components/tasks/TaskResearchPanel";
import { useDebounce } from "@/hooks/useDebounce";

// Recurrence config
export interface RecurrenceConfig {
  type: "daily" | "weekly" | "monthly" | "custom";
  interval?: number;
  days?: number[];
}

// Extended task type with local status
interface LocalTask extends TaskItem {
  id: string;
  status: "todo" | "inprogress" | "done";
  priority: "high" | "medium" | "low" | "none";
  recurrence?: RecurrenceConfig | null;
  labels?: TaskLabel[];
  source?: "gmail" | "manual";
}

type ViewMode = "board" | "list";

const STORAGE_KEY = "chronai-tasks";

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

// Priority selector component
function PrioritySelector({
  value,
  onChange,
}: {
  value: LocalTask["priority"];
  onChange: (p: LocalTask["priority"]) => void;
}) {
  const options: { label: string; value: LocalTask["priority"]; color: string }[] = [
    { label: "High", value: "high", color: "#f43f5e" },
    { label: "Medium", value: "medium", color: "#f59e0b" },
    { label: "Low", value: "low", color: "#6366f1" },
    { label: "None", value: "none", color: "var(--text-tertiary)" },
  ];

  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] dark:text-[#ece9e4]"
              : "text-[var(--text-tertiary)] dark:text-[#847e76] border border-transparent hover:border-[var(--border)]"
          }`}
        >
          <span
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: opt.color }}
          />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Recurrence selector component
function RecurrenceSelector({
  value,
  onChange,
}: {
  value: RecurrenceConfig | null | undefined;
  onChange: (r: RecurrenceConfig | null) => void;
}) {
  const currentType = value?.type || "none";
  const [customInterval, setCustomInterval] = useState(value?.interval || 1);
  const [customDays, setCustomDays] = useState<number[]>(value?.days || []);

  const options: { label: string; val: string }[] = [
    { label: "None", val: "none" },
    { label: "Daily", val: "daily" },
    { label: "Weekly", val: "weekly" },
    { label: "Monthly", val: "monthly" },
    { label: "Custom", val: "custom" },
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.val}
            onClick={() => {
              if (opt.val === "none") {
                onChange(null);
              } else if (opt.val === "custom") {
                onChange({ type: "custom", interval: customInterval, days: customDays });
              } else {
                onChange({ type: opt.val as RecurrenceConfig["type"] });
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              currentType === opt.val || (opt.val === "none" && !value)
                ? "bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] dark:text-[#ece9e4]"
                : "text-[var(--text-tertiary)] dark:text-[#847e76] border border-transparent hover:border-[var(--border)]"
            }`}
          >
            {opt.val !== "none" && <Repeat size={10} />}
            {opt.label}
          </button>
        ))}
      </div>
      {currentType === "custom" && (
        <div className="space-y-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)] dark:text-[#a8a39c]">Every</span>
            <input
              type="number"
              min={1}
              max={30}
              value={customInterval}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                setCustomInterval(val);
                onChange({ type: "custom", interval: val, days: customDays });
              }}
              className="w-14 h-7 px-2 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text-primary)] dark:text-[#ece9e4] text-center focus:outline-none focus:border-accent-400"
            />
            <span className="text-xs text-[var(--text-secondary)] dark:text-[#a8a39c]">day(s)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dayNames.map((day, idx) => (
              <button
                key={day}
                onClick={() => {
                  const newDays = customDays.includes(idx)
                    ? customDays.filter((d) => d !== idx)
                    : [...customDays, idx];
                  setCustomDays(newDays);
                  onChange({ type: "custom", interval: customInterval, days: newDays });
                }}
                className={`h-7 w-9 rounded text-xs font-medium transition-colors ${
                  customDays.includes(idx)
                    ? "bg-accent-500 text-white"
                    : "bg-[var(--surface)] text-[var(--text-tertiary)] dark:text-[#847e76] border border-[var(--border)] hover:border-accent-400"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Compute next due date for a recurring task
function getNextDueDate(currentDue: string | null | undefined, recurrence: RecurrenceConfig): string {
  const baseDate = currentDue ? new Date(currentDue) : new Date();
  switch (recurrence.type) {
    case "daily":
      return addDays(baseDate, 1).toISOString().split("T")[0];
    case "weekly":
      return addWeeks(baseDate, 1).toISOString().split("T")[0];
    case "monthly":
      return addMonths(baseDate, 1).toISOString().split("T")[0];
    case "custom": {
      const interval = recurrence.interval || 1;
      const days = recurrence.days;
      // If days array has specific weekdays, find the next matching day
      if (days && days.length > 0) {
        let candidate = addDays(baseDate, interval);
        // Search up to 7 days from the candidate to find a matching weekday
        for (let i = 0; i < 7; i++) {
          if (days.includes(getDay(candidate))) {
            return candidate.toISOString().split("T")[0];
          }
          candidate = addDays(candidate, 1);
        }
        // Fallback: if no match found within 7 days (shouldn't happen), use candidate
        return candidate.toISOString().split("T")[0];
      }
      return addDays(baseDate, interval).toISOString().split("T")[0];
    }
    default:
      return addDays(baseDate, 1).toISOString().split("T")[0];
  }
}

// Kanban column component
const KanbanColumn = memo(function KanbanColumn({
  title,
  tasks,
  color,
  columnId,
  onTaskClick,
  onContextMenu,
  isSelectMode,
  selectedTasks,
  onSelect,
}: {
  title: string;
  tasks: LocalTask[];
  color: string;
  columnId: string;
  onTaskClick: (task: LocalTask) => void;
  onContextMenu?: (e: React.MouseEvent, task: LocalTask) => void;
  isSelectMode?: boolean;
  selectedTasks?: Set<string>;
  onSelect?: (taskId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });

  return (
    <div className="flex-1 md:min-w-[280px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <h3 className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
          {title}
        </h3>
        <span className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] bg-[var(--surface-hover)] rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[120px] p-1 rounded-xl">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onContextMenu={onContextMenu ? (e) => onContextMenu(e, task) : undefined}
              isSelectMode={isSelectMode}
              isSelected={selectedTasks?.has(task.id)}
              onSelect={onSelect ? () => onSelect(task.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
});

// Sortable task card for kanban
const SortableTaskCard = memo(function SortableTaskCard({
  task,
  onClick,
  onContextMenu,
  isSelectMode,
  isSelected,
  onSelect,
}: {
  task: LocalTask;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} data-task-id={task.id} {...attributes} {...listeners}>
      <Card
        hover
        className={`cursor-grab active:cursor-grabbing ${isSelected ? "ring-2 ring-accent-500/50" : ""}`}
        onClick={isSelectMode ? onSelect : onClick}
        onContextMenu={onContextMenu}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          {isSelectMode && (
            <span
              className={`flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected
                  ? "bg-accent-500 border-accent-500"
                  : "border-[var(--border)]"
              }`}
            >
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          )}
          {task.priority && task.priority !== "none" && (
            <span
              className="inline-block h-[6px] w-[6px] rounded-full flex-shrink-0"
              style={{ backgroundColor: priorityDotColor(task.priority) }}
            />
          )}
          {task.recurrence && (
            <Repeat size={11} className="text-accent-400 flex-shrink-0" />
          )}
          <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4] line-clamp-2">
            {task.title}
          </p>
          {(task.id.startsWith("task-gmail-") || task.source === "gmail") && (
            <span className="inline-flex items-center gap-0.5 ml-1 flex-shrink-0">
              <Mail size={12} className="text-[#EA4335]" />
              <Star size={10} className="text-amber-500 fill-amber-500" />
            </span>
          )}
        </div>
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.labels.map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
              </span>
            ))}
          </div>
        )}
        {task.notes && (
          <p className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] mb-2 line-clamp-1">
            {task.notes}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {task.due && (
            <Badge variant="info">
              <CalendarIcon size={10} className="mr-1" />
              {format(new Date(task.due), "MMM d")}
            </Badge>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <Badge variant="default">
              <ListChecks size={10} className="mr-1" />
              {task.subtasks.length}
            </Badge>
          )}
        </div>
      </Card>
    </div>
  );
});

// Drag overlay card
function DragOverlayCard({ task }: { task: LocalTask }) {
  return (
    <div className="rotate-2 shadow-xl">
      <Card hover={false} className="border-accent-400/40">
        <p className="text-sm font-medium text-[var(--text-primary)] dark:text-[#ece9e4] mb-1">
          {task.title}
        </p>
        {task.due && (
          <Badge variant="info">
            <CalendarIcon size={10} className="mr-1" />
            {format(new Date(task.due), "MMM d")}
          </Badge>
        )}
      </Card>
    </div>
  );
}

// List view row
const ListRow = memo(function ListRow({
  task,
  onToggle,
  onTitleChange,
  onTaskClick,
  onDelete,
  onContextMenu,
  isSelectMode,
  isSelected,
  onSelect,
}: {
  task: LocalTask;
  onToggle: () => void;
  onTitleChange: (title: string) => void;
  onTaskClick: () => void;
  onDelete: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== task.title) {
      onTitleChange(editValue.trim());
    } else {
      setEditValue(task.title);
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-id={task.id}
      onContextMenu={onContextMenu}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors duration-150 ${
        isSelected
          ? "border-accent-500/50 bg-accent-500/5"
          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {isSelectMode && (
        <button
          onClick={onSelect}
          className={`flex-shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? "bg-accent-500 border-accent-500"
              : "border-[var(--border)] hover:border-accent-400"
          }`}
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}
      <button
        className="text-[var(--text-tertiary)] dark:text-[#847e76] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <button
        onClick={onToggle}
        className={`flex-shrink-0 h-4.5 w-4.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded border-2 transition-colors duration-150 flex items-center justify-center ${
          task.status === "done"
            ? "bg-accent-500 border-accent-500"
            : "border-[var(--border)] hover:border-accent-400"
        }`}
      >
        {task.status === "done" && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
          >
            <path
              d="M2 5L4 7L8 3"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditValue(task.title);
                setIsEditing(false);
              }
            }}
            className="w-full text-sm bg-transparent text-[var(--text-primary)] dark:text-[#ece9e4] border-none outline-none focus:ring-0 p-0"
          />
        ) : (
          <div className="flex items-center gap-1.5">
            {task.priority && task.priority !== "none" && (
              <span
                className="inline-block h-[6px] w-[6px] rounded-full flex-shrink-0"
                style={{ backgroundColor: priorityDotColor(task.priority) }}
              />
            )}
            {task.recurrence && (
              <Repeat size={11} className="text-accent-400 flex-shrink-0" />
            )}
            <button
              onClick={() => setIsEditing(true)}
              onDoubleClick={onTaskClick}
              className={`text-sm text-left truncate w-full ${
                task.status === "done"
                  ? "text-[var(--text-tertiary)] dark:text-[#847e76] line-through"
                  : "text-[var(--text-primary)] dark:text-[#ece9e4]"
              }`}
            >
              {task.title}
            </button>
            {(task.id.startsWith("task-gmail-") || task.source === "gmail") && (
              <span className="inline-flex items-center gap-0.5 ml-1 flex-shrink-0">
                <Mail size={12} className="text-[#EA4335]" />
                <Star size={10} className="text-amber-500 fill-amber-500" />
              </span>
            )}
          </div>
        )}
      </div>
      {task.labels && task.labels.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}
      {task.due && (
        <span className="text-xs text-[var(--text-tertiary)] dark:text-[#847e76] flex-shrink-0">
          {format(new Date(task.due), "MMM d")}
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] dark:text-[#847e76] hover:text-danger-500 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center md:min-h-0 md:min-w-0"
        aria-label="Delete task"
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
});

// Task detail panel
function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  onDelete,
  allLabels,
  onCreatePresentation,
  accessToken,
  slidesDisconnected,
}: {
  task: LocalTask;
  onClose: () => void;
  onUpdate: (updated: LocalTask) => void;
  onDelete: () => void;
  allLabels: TaskLabel[];
  onCreatePresentation?: () => void;
  accessToken?: string;
  slidesDisconnected?: boolean;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const [due, setDue] = useState(task.due || "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState<LocalTask["priority"]>(task.priority);
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(task.recurrence || null);
  const [taskLabels, setTaskLabels] = useState<TaskLabel[]>(task.labels || []);
  const [newSubtask, setNewSubtask] = useState("");

  // Research state
  const [researchResults, setResearchResults] = useState<ResearchResult[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchDisclaimer, setResearchDisclaimer] = useState<string | null>(null);
  const [showResearch, setShowResearch] = useState(false);

  const handleResearch = async () => {
    if (!accessToken) return;
    setShowResearch(true);
    setResearchLoading(true);
    setResearchError(null);
    try {
      const data = await researchTask(accessToken, {
        title: task.title,
        notes: task.notes || undefined,
      });
      setResearchResults(data.results || []);
      setResearchDisclaimer(data.disclaimer || null);
    } catch (err: any) {
      setResearchError(err?.message || "Failed to research task");
    } finally {
      setResearchLoading(false);
    }
  };

  const handleSave = () => {
    onUpdate({ ...task, title, notes, due: due || null, status, priority, recurrence, labels: taskLabels });
  };

  const handleNotesSave = () => {
    onUpdate({ ...task, title, notes, due: due || null, status, priority, recurrence, labels: taskLabels });
  };

  const handleToggleLabel = (label: TaskLabel) => {
    const exists = taskLabels.some((l) => l.id === label.id);
    const updated = exists
      ? taskLabels.filter((l) => l.id !== label.id)
      : [...taskLabels, label];
    setTaskLabels(updated);
    onUpdate({ ...task, title, notes, due: due || null, status, priority, recurrence, labels: updated });
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    const updatedSubtasks = [
      ...(task.subtasks || []),
      { title: newSubtask.trim(), completed: false },
    ];
    onUpdate({ ...task, title, notes, due: due || null, status, priority, recurrence, labels: taskLabels, subtasks: updatedSubtasks });
    setNewSubtask("");
  };

  const handleToggleSubtask = (index: number) => {
    const updatedSubtasks = (task.subtasks || []).map((sub, i) =>
      i === index ? { ...sub, completed: !sub.completed } : sub
    );
    onUpdate({ ...task, title, notes, due: due || null, status, priority, recurrence, labels: taskLabels, subtasks: updatedSubtasks });
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed top-14 right-0 h-[calc(100%-3.5rem)] w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
          Task Details
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-danger-500/10 text-[var(--text-tertiary)] dark:text-[#847e76] hover:text-danger-500 transition-colors"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] dark:text-[#847e76] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] uppercase tracking-wider mb-1.5 block">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full text-lg font-semibold bg-transparent text-[var(--text-primary)] dark:text-[#ece9e4] border-none outline-none focus:ring-0 p-0"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] uppercase tracking-wider mb-1.5 block">
            Priority
          </label>
          <PrioritySelector
            value={priority}
            onChange={(p) => {
              setPriority(p);
              onUpdate({ ...task, title, notes, due: due || null, status, priority: p, recurrence, labels: taskLabels });
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] uppercase tracking-wider mb-1.5 block">
            Due Date
          </label>
          <input
            type="date"
            value={due ? due.split("T")[0] : ""}
            onChange={(e) => {
              const val = e.target.value;
              setDue(val);
              onUpdate({ ...task, title, notes, due: val || null, status, priority, recurrence, labels: taskLabels });
            }}
            className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] dark:text-[#ece9e4] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] uppercase tracking-wider mb-1.5 block">
            Labels
          </label>
          <LabelSelector
            labels={allLabels}
            selectedLabels={taskLabels}
            onToggle={handleToggleLabel}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] uppercase tracking-wider mb-1.5 block">
            Repeat
          </label>
          <RecurrenceSelector
            value={recurrence}
            onChange={(r) => {
              setRecurrence(r);
              onUpdate({ ...task, title, notes, due: due || null, status, priority, recurrence: r, labels: taskLabels });
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] uppercase tracking-wider mb-1.5 block">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesSave}
            rows={6}
            placeholder="Add notes..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 resize-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] dark:text-[#847e76] uppercase tracking-wider mb-1.5 block">
            Subtasks {task.subtasks && task.subtasks.length > 0 && `(${task.subtasks.length})`}
          </label>
          <div className="space-y-1.5">
            {(task.subtasks || []).map((sub, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]"
              >
                <button
                  onClick={() => handleToggleSubtask(i)}
                  className={`h-3.5 w-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                    sub.completed
                      ? "bg-accent-500 border-accent-500"
                      : "border-[var(--border)] hover:border-accent-400"
                  }`}
                >
                  {sub.completed && (
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path
                        d="M2 5L4 7L8 3"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <span
                  className={
                    sub.completed ? "line-through text-[var(--text-tertiary)] dark:text-[#847e76]" : ""
                  }
                >
                  {sub.title}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSubtask();
                }}
                placeholder="Add subtask..."
                className="flex-1 text-sm bg-transparent text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] border-none outline-none focus:ring-0 p-0"
              />
              {newSubtask.trim() && (
                <button
                  onClick={handleAddSubtask}
                  className="text-xs text-accent-500 hover:text-accent-400 transition-colors"
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Research action */}
        <div className="pt-3 border-t border-[var(--border)]">
          <button
            onClick={handleResearch}
            disabled={researchLoading}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-accent-500 hover:bg-accent-500/5 border border-[var(--border)] hover:border-accent-500/30 transition-colors disabled:opacity-50"
          >
            <Search size={15} strokeWidth={1.5} />
            Research
          </button>
          {showResearch && (
            <div className="mt-3">
              <TaskResearchPanel
                results={researchResults}
                loading={researchLoading}
                error={researchError}
                disclaimer={researchDisclaimer}
              />
            </div>
          )}
        </div>
        {/* Create Presentation action */}
        {onCreatePresentation && (
          <div className="pt-3 border-t border-[var(--border)]">
            <div className="relative group/slides">
              <button
                onClick={slidesDisconnected ? undefined : onCreatePresentation}
                disabled={slidesDisconnected}
                className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] transition-colors ${
                  slidesDisconnected
                    ? "text-[var(--text-tertiary)] dark:text-[#847e76] opacity-50 cursor-not-allowed"
                    : "text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-accent-500 hover:bg-accent-500/5 hover:border-accent-500/30"
                }`}
              >
                <Presentation size={15} strokeWidth={1.5} />
                Create Presentation
              </button>
              {slidesDisconnected && (
                <div className="absolute bottom-full mb-1 left-0 z-50 hidden group-hover/slides:block whitespace-nowrap rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)] dark:text-[#a8a39c] shadow-lg">
                  Connect Google Slides in Settings to use this feature
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TasksPageContent() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string })?.accessToken || "";
  const { reportAction, suggestions, dismissSuggestion } = useAI();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalTask | null>(null);
  const [aiPrioritized, setAiPrioritized] = useState(false);
  const isHydrated = useRef(false);

  // Ref to track latest tasks for use in callbacks without stale closures
  const tasksRef = useRef<LocalTask[]>(tasks);
  tasksRef.current = tasks;

  // Labels system
  const { labels: allLabels, addLabel } = useLabels();
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [showLabelCreator, setShowLabelCreator] = useState(false);

  // Search state with debounce
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ position: ContextMenuPosition; task: LocalTask } | null>(null);

  // Bulk select mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<null | "move" | "priority" | "label">(null);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<LocalTask["priority"]>("none");
  const [newRecurrence, setNewRecurrence] = useState<RecurrenceConfig | null>(null);

  // Template Library state
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  // Gmail & Slides modal state
  const [showGmailScan, setShowGmailScan] = useState(false);
  const [showSlidesGenerator, setShowSlidesGenerator] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [tasksDisconnected, setTasksDisconnected] = useState(false);
  const [gmailDisconnected, setGmailDisconnected] = useState(false);
  const [slidesDisconnected, setSlidesDisconnected] = useState(false);

  // Offline queue state
  const [taskQueueCount, setTaskQueueCount] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Helper: add an operation to the offline task queue
  const enqueueTaskOperation = useCallback((operation: { type: string; data: any; timestamp: number }) => {
    try {
      const queue = JSON.parse(localStorage.getItem("chronai-task-queue") || "[]");
      queue.push(operation);
      localStorage.setItem("chronai-task-queue", JSON.stringify(queue));
      setTaskQueueCount(queue.length);
    } catch {
      // ignore storage errors
    }
  }, []);

  // Set page title
  useEffect(() => {
    document.title = "Tasks | Haven";
  }, []);

  // Check if Google Tasks is connected via cached integration status
  useEffect(() => {
    try {
      const cached = localStorage.getItem("chronai-integration-status-cache");
      if (cached) {
        const status = JSON.parse(cached);
        setTasksDisconnected(!status?.tasks?.connected);
        setGmailDisconnected(!status?.gmail?.connected);
        setSlidesDisconnected(!status?.slides?.connected);
      } else {
        setTasksDisconnected(true);
        setGmailDisconnected(true);
        setSlidesDisconnected(true);
      }
    } catch {
      setTasksDisconnected(true);
      setGmailDisconnected(true);
      setSlidesDisconnected(true);
    }

    // Also check offline task queue count
    try {
      const queue = localStorage.getItem("chronai-task-queue");
      if (queue) {
        const parsed = JSON.parse(queue);
        if (Array.isArray(parsed)) setTaskQueueCount(parsed.length);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load tasks: API is the source of truth for which tasks exist.
  // localStorage provides enrichments (status, priority, labels, recurrence).
  useEffect(() => {
    async function load() {
      setLoading(true);
      let localTasks: LocalTask[] = [];

      // Load from localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localTasks = parsed;
          }
        }
      } catch { }

      // Fetch from API
      let apiTasks: TaskItem[] = [];
      try {
        apiTasks = await fetchTasks(accessToken);
      } catch { }

      let finalTasks: LocalTask[];

      if (apiTasks.length > 0) {
        // API is the source of truth for WHICH tasks exist.
        // Merge local enrichments (status, priority, labels, recurrence) onto API tasks.

        // Build lookups from local tasks
        const localById = new Map<string, LocalTask>();
        const localByTitle = new Map<string, LocalTask>();
        for (const lt of localTasks) {
          if (lt.id) localById.set(lt.id, lt);
          // For title matching, use first occurrence only
          if (lt.title && !localByTitle.has(lt.title)) {
            localByTitle.set(lt.title, lt);
          }
        }

        // Track which local tasks got matched (so we can keep unsynced local-only tasks)
        const matchedLocalIds = new Set<string>();

        // Merge: for each API task, find local enrichment
        const mergedTasks: LocalTask[] = apiTasks.map((apiTask, i) => {
          const apiId = apiTask.id || `task-api-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;

          // Try ID match first
          let localMatch = localById.get(apiId);

          // If no ID match, try title match
          if (!localMatch && apiTask.title) {
            localMatch = localByTitle.get(apiTask.title);
          }

          if (localMatch) {
            matchedLocalIds.add(localMatch.id);
            // Preserve local enrichments, but use the API's canonical ID and title/notes/due
            return {
              ...apiTask,
              id: apiId,
              status: localMatch.status || (apiTask.completed ? "done" : "todo"),
              priority: localMatch.priority || "none",
              recurrence: localMatch.recurrence || null,
              labels: localMatch.labels || [],
              subtasks: localMatch.subtasks || apiTask.subtasks || [],
            } as LocalTask;
          }

          // Truly new task from API
          return {
            ...apiTask,
            id: apiId,
            status: apiTask.completed ? "done" : "todo",
            priority: "none" as const,
            recurrence: null,
            labels: [],
          } as LocalTask;
        });

        // Add local-only tasks that haven't been synced yet (recently created offline)
        // These have IDs starting with "task-" (locally generated) and weren't matched
        const localOnlyTasks = localTasks.filter(
          (lt) => !matchedLocalIds.has(lt.id) && lt.id.startsWith("task-")
        );

        finalTasks = [...mergedTasks, ...localOnlyTasks];
      } else if (localTasks.length > 0) {
        // API failed/empty but we have local tasks
        finalTasks = localTasks;
      } else {
        finalTasks = [];
      }

      // Deduplicate by ID (safety net)
      const seenIds = new Set<string>();
      finalTasks = finalTasks.filter((t) => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
      });

      setTasks(finalTasks);
      isHydrated.current = true;
      setLoading(false);
    }
    load();
  }, [accessToken]);

  // Persist tasks to localStorage
  useEffect(() => {
    if (isHydrated.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch {
        // Ignore storage errors
      }
    }
  }, [tasks]);

  // Open a specific task's detail panel when navigated here with ?taskId=...
  // (e.g. from the dashboard "Recent Tasks" list). Runs once after tasks load.
  const openedFromQuery = useRef(false);
  useEffect(() => {
    if (loading || openedFromQuery.current) return;
    const taskId = searchParams.get("taskId");
    if (!taskId) return;
    const match = tasks.find((t) => t.id === taskId);
    if (!match) return;
    openedFromQuery.current = true;
    setSelectedTask(match);
    // Scroll the matching task card/row into view if it is rendered.
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-task-id="${taskId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [loading, tasks, searchParams]);

  // Task helpers - apply label filter and text search
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (labelFilter) {
      result = result.filter((t) => t.labels?.some((l) => l.id === labelFilter));
    }
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          (t.notes && t.notes.toLowerCase().includes(query))
      );
    }
    return result;
  }, [tasks, labelFilter, debouncedSearch]);
  const todoTasks = useMemo(() => filteredTasks.filter((t) => t.status === "todo"), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter((t) => t.status === "inprogress"), [filteredTasks]);
  const doneTasks = useMemo(() => filteredTasks.filter((t) => t.status === "done"), [filteredTasks]);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    setCreatingTask(true);
    const task: LocalTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: newTitle.trim(),
      notes: newNotes.trim() || undefined,
      due: newDue || null,
      completed: false,
      status: "todo",
      priority: newPriority,
      recurrence: newRecurrence,
      labels: [],
    };

    // Calculate due_days_from_now from the due date
    let dueDays = 7;
    if (newDue) {
      const diffMs = new Date(newDue).getTime() - Date.now();
      dueDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Optimistically add to local state
    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    setNewNotes("");
    setNewDue("");
    setNewPriority("none");
    setNewRecurrence(null);
    setShowCreateModal(false);

    // Report action to AI context
    reportAction("task_created", { title: task.title, priority: task.priority, hasDue: !!newDue });

    // Call API (fire-and-forget with error tolerance)
    try {
      const result = await apiCreateTask(accessToken, {
        title: task.title,
        notes: task.notes || "",
        due_days_from_now: dueDays,
      });
      // If the API returns an ID, update the local task
      if (result && result.id) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, id: result.id } : t))
        );
      }
    } catch {
      // API failed - queue for later if disconnected
      if (tasksDisconnected) {
        enqueueTaskOperation({
          type: "create",
          data: { title: task.title, notes: task.notes || "", due_days_from_now: dueDays },
          timestamp: Date.now(),
        });
      }
    } finally {
      setCreatingTask(false);
    }
  };

  const handleToggleTask = useCallback((taskId: string) => {
    // Use tasksRef to access current tasks without stale closure
    const task = tasksRef.current.find((t) => t.id === taskId);
    const newCompleted = task ? task.status !== "done" : false;

    // Report action outside setTasks updater to avoid stale closure issues
    if (newCompleted && task) {
      reportAction("task_completed", { taskId, title: task.title });
    }

    // Call API to sync completion state
    if (accessToken && taskId) {
      apiUpdateTask(accessToken, taskId, { completed: newCompleted }).catch(
        () => {
          // API failed - queue if disconnected
          if (tasksDisconnected) {
            enqueueTaskOperation({
              type: "update",
              data: { taskId, completed: newCompleted },
              timestamp: Date.now(),
            });
          }
        }
      );
    }

    setTasks((prev) => {
      const currentTask = prev.find((t) => t.id === taskId);
      const updated = prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: (t.status === "done" ? "todo" : "done") as LocalTask["status"],
              completed: t.status !== "done",
              completedAt: t.status !== "done" ? new Date().toISOString() : undefined,
            }
          : t
      );

      // If marking as done and it is a recurring task, create next occurrence
      if (currentTask && currentTask.status !== "done" && currentTask.recurrence) {
        const nextDue = getNextDueDate(currentTask.due, currentTask.recurrence);
        const nextTask: LocalTask = {
          ...currentTask,
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: "todo",
          completed: false,
          due: nextDue,
        };
        return [nextTask, ...updated];
      }

      return updated;
    });
  }, [accessToken, reportAction, tasksDisconnected, enqueueTaskOperation]);

  const handleUpdateTask = useCallback((updated: LocalTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  }, []);

  const handleTitleChange = useCallback((taskId: string, title: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title } : t))
    );
  }, []);

  const handleDeleteTask = useCallback((taskId: string) => {
    // Use tasksRef to access current tasks without stale closure
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (task) {
      reportAction("task_deleted", { taskId, title: task.title });
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
    setDeleteTarget(null);

    // Call API to delete from Google Tasks
    if (accessToken && taskId) {
      apiDeleteTask(accessToken, taskId).catch(() => {
        // API failed - queue if disconnected
        if (tasksDisconnected) {
          enqueueTaskOperation({
            type: "delete",
            data: { taskId },
            timestamp: Date.now(),
          });
        }
      });
    }
  }, [accessToken, reportAction, tasksDisconnected, enqueueTaskOperation]);

  const [aiLoading, setAiLoading] = useState(false);

  // Helper: local priority sort with flash feedback
  const fallbackSort = useCallback(() => {
    const priorityOrder: Record<LocalTask["priority"], number> = {
      high: 0,
      medium: 1,
      low: 2,
      none: 3,
    };
    setTasks((prev) =>
      [...prev].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    );
    setAiPrioritized(true);
    setTimeout(() => setAiPrioritized(false), 2000);
  }, []);

  const handleAiPrioritize = async () => {
    if (!accessToken) {
      fallbackSort();
      return;
    }

    setAiLoading(true);
    try {
      const result = await fetchAiPriorities(accessToken);
      if (result.priorities && result.priorities.length > 0) {
        // Reorder tasks based on AI priority ranking
        const priorityMap = new Map<string, number>();
        result.priorities.forEach((p: any, index: number) => {
          const id = p.id || p.task_id || "";
          const title = p.title || "";
          if (id) priorityMap.set(id, index);
          if (title) priorityMap.set(title, index);
        });

        setTasks((prev) => {
          const sorted = [...prev].sort((a, b) => {
            const aRank = priorityMap.get(a.id) ?? priorityMap.get(a.title) ?? 999;
            const bRank = priorityMap.get(b.id) ?? priorityMap.get(b.title) ?? 999;
            return aRank - bRank;
          });
          return sorted;
        });
        setAiPrioritized(true);
        setTimeout(() => setAiPrioritized(false), 2000);
      } else {
        fallbackSort();
      }
    } catch {
      fallbackSort();
    } finally {
      setAiLoading(false);
    }
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Check if dropped on a column droppable (e.g., 'column-todo', 'column-inprogress', 'column-done')
    const overId = over.id as string;
    if (overId.startsWith("column-")) {
      const targetStatus = overId.replace("column-", "") as "todo" | "inprogress" | "done";
      if (targetStatus !== activeTask.status) {
        reportAction("task_dragged", {
          taskId: activeTask.id,
          title: activeTask.title,
          fromStatus: activeTask.status,
          toStatus: targetStatus,
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === activeTask.id
              ? { ...t, status: targetStatus, completed: targetStatus === "done" }
              : t
          )
        );
      }
      return;
    }

    // Determine which column the card was dropped into by checking the over task
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask && overTask.status !== activeTask.status) {
      reportAction("task_dragged", {
        taskId: activeTask.id,
        title: activeTask.title,
        fromStatus: activeTask.status,
        toStatus: overTask.status,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTask.id
            ? { ...t, status: overTask.status, completed: overTask.status === "done" }
            : t
        )
      );
    }
  };

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, task: LocalTask) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ position: { x: e.clientX, y: e.clientY }, task });
  }, []);

  const contextMenuActions: ContextMenuActions | null = contextMenu
    ? {
        onEdit: () => setSelectedTask(contextMenu.task),
        onDelete: () => setDeleteTarget(contextMenu.task),
        onDuplicate: () => {
          const original = contextMenu.task;
          const dup: LocalTask = {
            ...original,
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: `Copy of ${original.title}`,
            completed: false,
            status: "todo",
          };
          setTasks((prev) => [dup, ...prev]);
        },
        onMoveTo: (status) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === contextMenu.task.id
                ? { ...t, status, completed: status === "done" }
                : t
            )
          );
        },
        onAddLabel: (label) => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== contextMenu.task.id) return t;
              const existing = t.labels || [];
              const hasLabel = existing.some((l) => l.id === label.id);
              return {
                ...t,
                labels: hasLabel
                  ? existing.filter((l) => l.id !== label.id)
                  : [...existing, label],
              };
            })
          );
        },
        onSetPriority: (priority) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === contextMenu.task.id ? { ...t, priority } : t
            )
          );
        },
      }
    : null;

  // Bulk select handlers
  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleBulkComplete = useCallback(() => {
    setTasks((prev) =>
      prev.map((t) =>
        selectedTasks.has(t.id) ? { ...t, status: "done" as const, completed: true } : t
      )
    );
    setSelectedTasks(new Set());
    setIsSelectMode(false);
  }, [selectedTasks]);

  const handleBulkDelete = useCallback(() => {
    setTasks((prev) => prev.filter((t) => !selectedTasks.has(t.id)));
    setSelectedTasks(new Set());
    setIsSelectMode(false);
  }, [selectedTasks]);

  const handleBulkMove = useCallback((status: "todo" | "inprogress" | "done") => {
    setTasks((prev) =>
      prev.map((t) =>
        selectedTasks.has(t.id) ? { ...t, status, completed: status === "done" } : t
      )
    );
    setSelectedTasks(new Set());
    setIsSelectMode(false);
  }, [selectedTasks]);

  const handleBulkPriority = useCallback((priority: LocalTask["priority"]) => {
    setTasks((prev) =>
      prev.map((t) =>
        selectedTasks.has(t.id) ? { ...t, priority } : t
      )
    );
    setSelectedTasks(new Set());
    setIsSelectMode(false);
  }, [selectedTasks]);

  const handleBulkLabel = useCallback((label: TaskLabel) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (!selectedTasks.has(t.id)) return t;
        const existing = t.labels || [];
        const hasLabel = existing.some((l) => l.id === label.id);
        return {
          ...t,
          labels: hasLabel ? existing : [...existing, label],
        };
      })
    );
    setSelectedTasks(new Set());
    setIsSelectMode(false);
  }, [selectedTasks]);

  const handleUseTemplate = useCallback(
    async (templateTasks: TemplateTask[]) => {
      const newTasks: LocalTask[] = templateTasks.map((t) => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + t.due_days_from_now);
        return {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: t.title,
          notes: t.notes || undefined,
          due: dueDate.toISOString().split("T")[0],
          completed: false,
          status: "todo" as const,
          priority: t.priority,
          labels: [],
        };
      });

      setTasks((prev) => [...newTasks, ...prev]);

      // Fire-and-forget API calls to create tasks remotely
      for (const t of templateTasks) {
        try {
          await apiCreateTask(accessToken, {
            title: t.title,
            notes: t.notes || "",
            due_days_from_now: t.due_days_from_now,
          });
        } catch {
          // API failed - tasks remain in local state
        }
      }
    },
    [accessToken]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
            <CheckSquare size={20} strokeWidth={1.5} className="text-warning-500" />
          </div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--text-primary)] dark:text-[#ece9e4]">
            Tasks
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "board"
                  ? "bg-accent-500/10 text-accent-500"
                  : "text-[var(--text-tertiary)] dark:text-[#847e76] hover:text-[var(--text-secondary)] dark:hover:text-[#a8a39c]"
              }`}
            >
              <LayoutGrid size={14} />
              Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-accent-500/10 text-accent-500"
                  : "text-[var(--text-tertiary)] dark:text-[#847e76] hover:text-[var(--text-secondary)] dark:hover:text-[#a8a39c]"
              }`}
            >
              <List size={14} />
              List
            </button>
          </div>
          {/* Add task button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedTasks(new Set());
            }}
            className={isSelectMode ? "bg-accent-500/10 text-accent-500" : ""}
          >
            <CheckCircle2 size={14} strokeWidth={1.5} />
            {isSelectMode ? "Cancel" : "Select"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAiPrioritize}
            disabled={aiLoading}
          >
            <Sparkles size={14} strokeWidth={1.5} />
            {aiLoading ? "Analyzing..." : aiPrioritized ? "Prioritized!" : "Ask AI to Prioritize"}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={14} />
            Add Task
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplateLibrary(true)}
          >
            <BookTemplate size={14} strokeWidth={1.5} />
            Templates
          </Button>
          <div className="relative group/gmail">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGmailScan(true)}
              disabled={gmailDisconnected}
              className={gmailDisconnected ? "opacity-50 cursor-not-allowed" : ""}
            >
              <Mail size={14} strokeWidth={1.5} />
              Scan Inbox
            </Button>
            {gmailDisconnected && (
              <div className="absolute top-full mt-1 right-0 z-50 hidden group-hover/gmail:block whitespace-nowrap rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)] dark:text-[#a8a39c] shadow-lg">
                Connect Gmail in Settings
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Label Filter Bar */}
      {allLabels.length > 0 && (
        <div className="mb-4">
          <LabelFilterBar
            labels={allLabels}
            activeFilter={labelFilter}
            onFilterChange={setLabelFilter}
          />
        </div>
      )}

      {/* Search Input */}
      <div className="mb-4 relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] dark:text-[#847e76] pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 transition-colors"
        />
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

      {/* Connect Google Tasks Banner */}
      {tasksDisconnected && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c]">
            Google Tasks is not connected. Your changes are saved locally.
          </p>
          <Link
            href="/dashboard/settings"
            className="flex-shrink-0 rounded-lg bg-accent-500/10 px-3 py-1.5 text-xs font-medium text-accent-500 hover:bg-accent-500/20 transition-colors"
          >
            Connect
          </Link>
        </div>
      )}

      {/* Pending Sync Indicator */}
      {taskQueueCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning-500/20 bg-warning-500/5 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-warning-500 animate-pulse" />
          <p className="text-xs font-medium text-warning-600 dark:text-warning-400">
            {taskQueueCount} change{taskQueueCount !== 1 ? "s" : ""} pending sync
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map((col) => (
            <div key={col} className="flex-1 space-y-3">
              <Skeleton height={20} width={80} className="mb-3" />
              <Skeleton height={90} className="w-full" />
              <Skeleton height={90} className="w-full" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare size={28} strokeWidth={1.5} className="text-[var(--text-tertiary)] dark:text-[#847e76]" />}
          title="No tasks yet"
          description="Create your first task to get started. Organize them in a kanban board or list view."
          action={
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} />
              Create Task
            </Button>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <AnimatePresence mode="wait">
            {viewMode === "board" ? (
              <motion.div
                key="board"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-4 flex-1"
              >
                <KanbanColumn
                  title="To Do"
                  tasks={todoTasks}
                  color="bg-[var(--text-tertiary)]"
                  columnId="column-todo"
                  onTaskClick={setSelectedTask}
                  onContextMenu={handleContextMenu}
                  isSelectMode={isSelectMode}
                  selectedTasks={selectedTasks}
                  onSelect={handleToggleSelect}
                />
                <KanbanColumn
                  title="In Progress"
                  tasks={inProgressTasks}
                  color="bg-warning-500"
                  columnId="column-inprogress"
                  onTaskClick={setSelectedTask}
                  onContextMenu={handleContextMenu}
                  isSelectMode={isSelectMode}
                  selectedTasks={selectedTasks}
                  onSelect={handleToggleSelect}
                />
                <KanbanColumn
                  title="Done"
                  tasks={doneTasks}
                  color="bg-success-500"
                  columnId="column-done"
                  onTaskClick={setSelectedTask}
                  onContextMenu={handleContextMenu}
                  isSelectMode={isSelectMode}
                  selectedTasks={selectedTasks}
                  onSelect={handleToggleSelect}
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1"
              >
                <SortableContext
                  items={filteredTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-0.5">
                    {filteredTasks.map((task) => (
                      <ListRow
                        key={task.id}
                        task={task}
                        onToggle={() => handleToggleTask(task.id)}
                        onTitleChange={(title) =>
                          handleTitleChange(task.id, title)
                        }
                        onTaskClick={() => setSelectedTask(task)}
                        onDelete={() => setDeleteTarget(task)}
                        onContextMenu={(e) => handleContextMenu(e, task)}
                        isSelectMode={isSelectMode}
                        isSelected={selectedTasks.has(task.id)}
                        onSelect={() => handleToggleSelect(task.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </motion.div>
            )}
          </AnimatePresence>

          <DragOverlay>
            {activeTask ? <DragOverlayCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create Task Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] dark:text-[#ece9e4] mb-4">
            New Task
          </h2>
          <div className="space-y-4">
            <Input
              label="Title"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTask();
              }}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
                Notes
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Add any details..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] dark:text-[#ece9e4] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 resize-none"
              />
            </div>
            <Input
              label="Due Date"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
                Priority
              </label>
              <PrioritySelector value={newPriority} onChange={setNewPriority} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]">
                Repeat
              </label>
              <RecurrenceSelector value={newRecurrence} onChange={setNewRecurrence} />
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
            <Button size="sm" onClick={handleCreateTask} disabled={!newTitle.trim()} loading={creatingTask}>
              <Plus size={14} />
              Create Task
            </Button>
          </div>
        </div>
      </Modal>

      {/* Task Detail Panel */}
      <AnimatePresence>
        {selectedTask && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setSelectedTask(null)}
            />
            <TaskDetailPanel
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onUpdate={handleUpdateTask}
              onDelete={() => setDeleteTarget(selectedTask)}
              allLabels={allLabels}
              onCreatePresentation={() => setShowSlidesGenerator(true)}
              accessToken={accessToken}
              slidesDisconnected={slidesDisconnected}
            />
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <div className="p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] dark:text-[#ece9e4] mb-2">
            Delete Task
          </h2>
          <p className="text-sm text-[var(--text-secondary)] dark:text-[#a8a39c] mb-5">
            Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => deleteTarget && handleDeleteTask(deleteTarget.id)}
              className="bg-danger-500 hover:bg-danger-600 text-white border-0"
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Context Menu */}
      {contextMenuActions && (
        <TaskContextMenu
          position={contextMenu?.position || null}
          actions={contextMenuActions}
          labels={allLabels}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Label Creator Modal */}
      <Modal open={showLabelCreator} onClose={() => setShowLabelCreator(false)}>
        <LabelCreator
          onCreateLabel={addLabel}
          onClose={() => setShowLabelCreator(false)}
        />
      </Modal>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {isSelectMode && selectedTasks.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl"
          >
            <span className="text-xs font-medium text-[var(--text-secondary)] dark:text-[#a8a39c] mr-2">
              {selectedTasks.size} selected
            </span>
            <button
              onClick={handleBulkComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-success-500 bg-success-500/10 hover:bg-success-500/20 transition-colors"
            >
              <CheckCircle2 size={13} />
              Complete
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-danger-500 bg-danger-500/10 hover:bg-danger-500/20 transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === "move" ? null : "move")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] dark:text-[#ece9e4] bg-[var(--surface-hover)] hover:bg-[var(--border)] transition-colors"
              >
                <ArrowRight size={13} />
                Move to
              </button>
              {openMenu === "move" && (
                <div className="absolute bottom-full left-0 mb-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1 min-w-[120px]">
                  <button onClick={() => { handleBulkMove("todo"); setOpenMenu(null); }} className="px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]">To Do</button>
                  <button onClick={() => { handleBulkMove("inprogress"); setOpenMenu(null); }} className="px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]">In Progress</button>
                  <button onClick={() => { handleBulkMove("done"); setOpenMenu(null); }} className="px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]">Done</button>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === "priority" ? null : "priority")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] dark:text-[#ece9e4] bg-[var(--surface-hover)] hover:bg-[var(--border)] transition-colors"
              >
                <Flag size={13} />
                Priority
              </button>
              {openMenu === "priority" && (
                <div className="absolute bottom-full left-0 mb-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1 min-w-[100px]">
                  <button onClick={() => { handleBulkPriority("high"); setOpenMenu(null); }} className="px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]">High</button>
                  <button onClick={() => { handleBulkPriority("medium"); setOpenMenu(null); }} className="px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]">Medium</button>
                  <button onClick={() => { handleBulkPriority("low"); setOpenMenu(null); }} className="px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]">Low</button>
                  <button onClick={() => { handleBulkPriority("none"); setOpenMenu(null); }} className="px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]">None</button>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === "label" ? null : "label")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] dark:text-[#ece9e4] bg-[var(--surface-hover)] hover:bg-[var(--border)] transition-colors"
              >
                <Tag size={13} />
                Label
              </button>
              {openMenu === "label" && (
                <div className="absolute bottom-full left-0 mb-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl py-1 min-w-[120px]">
                  {allLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => { handleBulkLabel(label); setOpenMenu(null); }}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs text-left text-[var(--text-primary)] dark:text-[#ece9e4] hover:bg-[var(--surface-hover)]"
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                      {label.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template Library Modal */}
      <Modal open={showTemplateLibrary} onClose={() => setShowTemplateLibrary(false)}>
        <TemplateLibrary
          accessToken={accessToken}
          onUseTemplate={handleUseTemplate}
          onClose={() => setShowTemplateLibrary(false)}
        />
      </Modal>

      {/* Gmail Scan Modal */}
      <Modal open={showGmailScan} onClose={() => setShowGmailScan(false)}>
        <GmailScanModal
          accessToken={accessToken}
          onAccept={(item) => {
            const newTask: LocalTask = {
              id: `task-gmail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              title: item.suggested_title,
              notes: item.suggested_notes,
              completed: false,
              status: "todo",
              priority: "medium",
              due: null,
              subtasks: [],
              labels: [],
              source: "gmail",
            };
            setTasks((prev) => [newTask, ...prev]);
          }}
          onClose={() => setShowGmailScan(false)}
        />
      </Modal>

      {/* Slides Generator Modal */}
      <Modal open={showSlidesGenerator} onClose={() => setShowSlidesGenerator(false)}>
        {selectedTask && (
          <SlidesGeneratorModal
            accessToken={accessToken}
            taskTitle={selectedTask.title}
            taskNotes={selectedTask.notes || ""}
            taskSubtasks={(selectedTask.subtasks || []).map((s) => s.title)}
            onClose={() => setShowSlidesGenerator(false)}
          />
        )}
      </Modal>
    </motion.div>
  );
}


export default function TasksPage() {
  // useSearchParams requires a Suspense boundary in Next.js 15.
  return (
    <Suspense fallback={null}>
      <TasksPageContent />
    </Suspense>
  );
}
