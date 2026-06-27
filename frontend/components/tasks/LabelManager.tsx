"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
}

const DEFAULT_LABELS: TaskLabel[] = [
  { id: "label-work", name: "Work", color: "#3b82f6" },
  { id: "label-personal", name: "Personal", color: "#8b5cf6" },
  { id: "label-urgent", name: "Urgent", color: "#ef4444" },
  { id: "label-health", name: "Health", color: "#10b981" },
  { id: "label-learning", name: "Learning", color: "#f59e0b" },
];

const LABELS_STORAGE_KEY = "chronai-labels";

const PRESET_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#6366f1",
];

export function useLabels() {
  const [labels, setLabels] = useState<TaskLabel[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LABELS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TaskLabel[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLabels(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setLabels(DEFAULT_LABELS);
    localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(DEFAULT_LABELS));
  }, []);

  const saveLabels = useCallback((updated: TaskLabel[]) => {
    setLabels(updated);
    try {
      localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }, []);

  const addLabel = useCallback(
    (name: string, color: string) => {
      const newLabel: TaskLabel = {
        id: `label-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        color,
      };
      saveLabels([...labels, newLabel]);
      return newLabel;
    },
    [labels, saveLabels]
  );

  const removeLabel = useCallback(
    (id: string) => {
      saveLabels(labels.filter((l) => l.id !== id));
    },
    [labels, saveLabels]
  );

  return { labels, addLabel, removeLabel };
}

// Label selector chips for task detail panel
export function LabelSelector({
  labels,
  selectedLabels,
  onToggle,
}: {
  labels: TaskLabel[];
  selectedLabels: TaskLabel[];
  onToggle: (label: TaskLabel) => void;
}) {
  const selectedIds = new Set(selectedLabels.map((l) => l.id));

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => {
        const isSelected = selectedIds.has(label.id);
        return (
          <button
            key={label.id}
            onClick={() => onToggle(label)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              isSelected
                ? "ring-2 ring-offset-1 ring-offset-[var(--surface)]"
                : "opacity-60 hover:opacity-100"
            }`}
            style={{
              backgroundColor: `${label.color}20`,
              color: label.color,
              borderColor: label.color,
              ...(isSelected ? { ringColor: label.color } : {}),
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: label.color }}
            />
            {label.name}
          </button>
        );
      })}
    </div>
  );
}

// Label filter bar for task list
export function LabelFilterBar({
  labels,
  activeFilter,
  onFilterChange,
}: {
  labels: TaskLabel[];
  activeFilter: string | null;
  onFilterChange: (labelId: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      <button
        onClick={() => onFilterChange(null)}
        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          activeFilter === null
            ? "bg-accent-500/10 text-accent-500 border border-accent-500/30"
            : "text-[var(--text-tertiary)] border border-[var(--border)] hover:border-[var(--text-tertiary)]"
        }`}
      >
        All
      </button>
      {labels.map((label) => (
        <button
          key={label.id}
          onClick={() =>
            onFilterChange(activeFilter === label.id ? null : label.id)
          }
          className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeFilter === label.id
              ? "ring-1 ring-offset-1 ring-offset-[var(--surface)]"
              : "opacity-70 hover:opacity-100"
          }`}
          style={{
            backgroundColor: `${label.color}15`,
            color: label.color,
            border: `1px solid ${label.color}40`,
            ...(activeFilter === label.id
              ? { ringColor: label.color, opacity: 1 }
              : {}),
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: label.color }}
          />
          {label.name}
        </button>
      ))}
    </div>
  );
}

// Label creation modal content
export function LabelCreator({
  onCreateLabel,
  onClose,
}: {
  onCreateLabel: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateLabel(name.trim(), color);
    setName("");
    setColor(PRESET_COLORS[0]);
    onClose();
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Create Label
        </h2>
        <button
          onClick={onClose}
          className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
        >
          <X size={16} />
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
            placeholder="Label name..."
            className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text-secondary)] block mb-1.5">
            Color
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  color === c ? "scale-125 ring-2 ring-offset-2 ring-offset-[var(--surface)]" : "hover:scale-110"
                }`}
                style={{
                  backgroundColor: c,
                  ...(color === c ? { ringColor: c } : {}),
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-[var(--text-secondary)]">Preview:</span>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            {name || "Label"}
          </span>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[var(--border)]">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} />
          Create
        </button>
      </div>
    </div>
  );
}
