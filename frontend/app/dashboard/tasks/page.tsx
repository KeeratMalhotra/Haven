"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
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
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";

import { fetchTasks, type TaskItem } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

// Extended task type with local status
interface LocalTask extends TaskItem {
  id: string;
  status: "todo" | "inprogress" | "done";
}

type ViewMode = "board" | "list";

// Kanban column component
function KanbanColumn({
  title,
  tasks,
  color,
  onTaskClick,
}: {
  title: string;
  tasks: LocalTask[];
  color: string;
  onTaskClick: (task: LocalTask) => void;
}) {
  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">
          {title}
        </h3>
        <span className="text-xs text-[var(--text-tertiary)] bg-[var(--surface-hover)] rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-2 min-h-[120px] p-1 rounded-xl">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// Sortable task card for kanban
function SortableTaskCard({
  task,
  onClick,
}: {
  task: LocalTask;
  onClick: () => void;
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        hover
        className="cursor-grab active:cursor-grabbing"
        onClick={onClick}
      >
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1.5 line-clamp-2">
          {task.title}
        </p>
        {task.notes && (
          <p className="text-xs text-[var(--text-tertiary)] mb-2 line-clamp-1">
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
}

// Drag overlay card
function DragOverlayCard({ task }: { task: LocalTask }) {
  return (
    <div className="rotate-2 shadow-xl">
      <Card hover={false} className="border-accent-400/40">
        <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
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
function ListRow({
  task,
  onToggle,
  onTitleChange,
  onTaskClick,
}: {
  task: LocalTask;
  onToggle: () => void;
  onTitleChange: (title: string) => void;
  onTaskClick: () => void;
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

  const statusBadge = () => {
    switch (task.status) {
      case "done":
        return <Badge variant="success">Done</Badge>;
      case "inprogress":
        return <Badge variant="warning">In Progress</Badge>;
      default:
        return <Badge variant="default">To Do</Badge>;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors duration-150"
    >
      <button
        className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>
      <button
        onClick={onToggle}
        className={`flex-shrink-0 h-4.5 w-4.5 rounded border-2 transition-colors duration-150 flex items-center justify-center ${
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
            className="w-full text-sm bg-transparent text-[var(--text-primary)] border-none outline-none focus:ring-0 p-0"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            onDoubleClick={onTaskClick}
            className={`text-sm text-left truncate w-full ${
              task.status === "done"
                ? "text-[var(--text-tertiary)] line-through"
                : "text-[var(--text-primary)]"
            }`}
          >
            {task.title}
          </button>
        )}
      </div>
      {task.due && (
        <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
          {format(new Date(task.due), "MMM d")}
        </span>
      )}
      {statusBadge()}
    </div>
  );
}

// Task detail panel
function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
}: {
  task: LocalTask;
  onClose: () => void;
  onUpdate: (updated: LocalTask) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const [due, setDue] = useState(task.due || "");
  const [status, setStatus] = useState(task.status);

  const handleSave = () => {
    onUpdate({ ...task, title, notes, due: due || null, status });
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-medium text-[var(--text-secondary)]">
          Task Details
        </h3>
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 block">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            className="w-full text-lg font-semibold bg-transparent text-[var(--text-primary)] border-none outline-none focus:ring-0 p-0"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 block">
            Status
          </label>
          <div className="flex gap-2">
            {(["todo", "inprogress", "done"] as const).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatus(s);
                  onUpdate({ ...task, title, notes, due: due || null, status: s });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  status === s
                    ? "bg-accent-500/10 text-accent-500 border border-accent-500/30"
                    : "bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-transparent hover:border-[var(--border)]"
                }`}
              >
                {s === "todo"
                  ? "To Do"
                  : s === "inprogress"
                  ? "In Progress"
                  : "Done"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 block">
            Due Date
          </label>
          <input
            type="date"
            value={due ? due.split("T")[0] : ""}
            onChange={(e) => {
              const val = e.target.value;
              setDue(val);
              onUpdate({ ...task, title, notes, due: val || null, status });
            }}
            className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 block">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSave}
            rows={6}
            placeholder="Add notes..."
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 resize-none"
          />
        </div>
        {task.subtasks && task.subtasks.length > 0 && (
          <div>
            <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 block">
              Subtasks ({task.subtasks.length})
            </label>
            <div className="space-y-1.5">
              {task.subtasks.map((sub, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                >
                  <div
                    className={`h-3.5 w-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                      sub.completed
                        ? "bg-accent-500 border-accent-500"
                        : "border-[var(--border)]"
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
                  </div>
                  <span
                    className={
                      sub.completed ? "line-through text-[var(--text-tertiary)]" : ""
                    }
                  >
                    {sub.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function TasksPage() {
  const { data: session } = useSession();
  const accessToken = (session as { accessToken?: string })?.accessToken || "";

  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newDue, setNewDue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Load tasks
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const fetched = await fetchTasks(accessToken);
        const mapped: LocalTask[] = fetched.map((t, i) => ({
          ...t,
          id: t.id || `task-${i}-${Date.now()}`,
          status: t.completed ? "done" : "todo",
        }));
        setTasks(mapped);
      } catch {
        setTasks([]);
      }
      setLoading(false);
    }
    load();
  }, [accessToken]);

  // Task helpers
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "inprogress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const handleCreateTask = () => {
    if (!newTitle.trim()) return;
    const task: LocalTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: newTitle.trim(),
      notes: newNotes.trim() || undefined,
      due: newDue || null,
      completed: false,
      status: "todo",
    };
    setTasks((prev) => [task, ...prev]);
    setNewTitle("");
    setNewNotes("");
    setNewDue("");
    setShowCreateModal(false);
  };

  const handleToggleTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === "done" ? "todo" : "done",
              completed: t.status !== "done",
            }
          : t
      )
    );
  }, []);

  const handleUpdateTask = useCallback((updated: LocalTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  }, []);

  const handleTitleChange = useCallback((taskId: string, title: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, title } : t))
    );
  }, []);

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

    // Determine which column the card was dropped into
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask && overTask.status !== activeTask.status) {
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
            <CheckSquare size={20} className="text-warning-500" />
          </div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
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
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
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
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <List size={14} />
              List
            </button>
          </div>
          {/* Add task button */}
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={14} />
            Add Task
          </Button>
        </div>
      </div>

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
          icon={<CheckSquare size={28} className="text-[var(--text-tertiary)]" />}
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
                className="flex gap-4 overflow-x-auto pb-4 flex-1"
              >
                <KanbanColumn
                  title="To Do"
                  tasks={todoTasks}
                  color="bg-[var(--text-tertiary)]"
                  onTaskClick={setSelectedTask}
                />
                <KanbanColumn
                  title="In Progress"
                  tasks={inProgressTasks}
                  color="bg-warning-500"
                  onTaskClick={setSelectedTask}
                />
                <KanbanColumn
                  title="Done"
                  tasks={doneTasks}
                  color="bg-success-500"
                  onTaskClick={setSelectedTask}
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
                  items={tasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-0.5">
                    {tasks.map((task) => (
                      <ListRow
                        key={task.id}
                        task={task}
                        onToggle={() => handleToggleTask(task.id)}
                        onTitleChange={(title) =>
                          handleTitleChange(task.id, title)
                        }
                        onTaskClick={() => setSelectedTask(task)}
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
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
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
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Notes
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Add any details..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 resize-none"
              />
            </div>
            <Input
              label="Due Date"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateTask} disabled={!newTitle.trim()}>
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
            />
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
