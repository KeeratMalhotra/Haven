"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit3,
  Trash2,
  Copy,
  ArrowRight,
  Tag,
  Flag,
  ChevronRight,
} from "lucide-react";
import type { TaskLabel } from "./LabelManager";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ContextMenuActions {
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveTo: (status: "todo" | "inprogress" | "done") => void;
  onAddLabel: (label: TaskLabel) => void;
  onSetPriority: (priority: "high" | "medium" | "low" | "none") => void;
}

interface TaskContextMenuProps {
  position: ContextMenuPosition | null;
  actions: ContextMenuActions;
  labels: TaskLabel[];
  onClose: () => void;
}

type SubMenu = "move" | "label" | "priority" | null;

export function TaskContextMenu({
  position,
  actions,
  labels,
  onClose,
}: TaskContextMenuProps) {
  const [subMenu, setSubMenu] = useState<SubMenu>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Reset submenu when menu opens/closes
  useEffect(() => {
    setSubMenu(null);
  }, [position]);

  // Close on click outside
  useEffect(() => {
    if (!position) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [position, onClose]);

  // Adjust position to keep menu in viewport
  const getAdjustedPosition = useCallback(() => {
    if (!position) return { top: 0, left: 0 };
    const menuWidth = 220;
    const menuHeight = 280;
    let { x, y } = position;
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8;
    }
    return { top: y, left: x };
  }, [position]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {position && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          className="fixed z-[9999] min-w-[200px] bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl py-1.5 overflow-hidden"
          style={getAdjustedPosition()}
        >
          {subMenu === null && (
            <>
              <MenuItem
                icon={<Edit3 size={14} />}
                label="Edit"
                onClick={() => {
                  actions.onEdit();
                  onClose();
                }}
              />
              <MenuItem
                icon={<Copy size={14} />}
                label="Duplicate"
                onClick={() => {
                  actions.onDuplicate();
                  onClose();
                }}
              />
              <MenuDivider />
              <MenuItem
                icon={<ArrowRight size={14} />}
                label="Move to..."
                hasSubmenu
                onClick={() => setSubMenu("move")}
              />
              <MenuItem
                icon={<Tag size={14} />}
                label="Add Label"
                hasSubmenu
                onClick={() => setSubMenu("label")}
              />
              <MenuItem
                icon={<Flag size={14} />}
                label="Set Priority"
                hasSubmenu
                onClick={() => setSubMenu("priority")}
              />
              <MenuDivider />
              <MenuItem
                icon={<Trash2 size={14} />}
                label="Delete"
                danger
                onClick={() => {
                  actions.onDelete();
                  onClose();
                }}
              />
            </>
          )}
          {subMenu === "move" && (
            <>
              <SubMenuHeader
                label="Move to..."
                onBack={() => setSubMenu(null)}
              />
              <MenuItem
                label="To Do"
                onClick={() => {
                  actions.onMoveTo("todo");
                  onClose();
                }}
              />
              <MenuItem
                label="In Progress"
                onClick={() => {
                  actions.onMoveTo("inprogress");
                  onClose();
                }}
              />
              <MenuItem
                label="Done"
                onClick={() => {
                  actions.onMoveTo("done");
                  onClose();
                }}
              />
            </>
          )}
          {subMenu === "label" && (
            <>
              <SubMenuHeader
                label="Add Label"
                onBack={() => setSubMenu(null)}
              />
              {labels.map((label) => (
                <MenuItem
                  key={label.id}
                  label={label.name}
                  icon={
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                  }
                  onClick={() => {
                    actions.onAddLabel(label);
                    onClose();
                  }}
                />
              ))}
            </>
          )}
          {subMenu === "priority" && (
            <>
              <SubMenuHeader
                label="Set Priority"
                onBack={() => setSubMenu(null)}
              />
              <MenuItem
                label="High"
                icon={
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" />
                }
                onClick={() => {
                  actions.onSetPriority("high");
                  onClose();
                }}
              />
              <MenuItem
                label="Medium"
                icon={
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                }
                onClick={() => {
                  actions.onSetPriority("medium");
                  onClose();
                }}
              />
              <MenuItem
                label="Low"
                icon={
                  <span className="h-2.5 w-2.5 rounded-full bg-[#6366f1]" />
                }
                onClick={() => {
                  actions.onSetPriority("low");
                  onClose();
                }}
              />
              <MenuItem
                label="None"
                icon={
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-tertiary)]" />
                }
                onClick={() => {
                  actions.onSetPriority("none");
                  onClose();
                }}
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  hasSubmenu,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  hasSubmenu?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
        danger
          ? "text-danger-500 hover:bg-danger-500/10"
          : "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      {icon && <span className="flex-shrink-0 flex items-center">{icon}</span>}
      <span className="flex-1 text-left">{label}</span>
      {hasSubmenu && (
        <ChevronRight size={12} className="text-[var(--text-tertiary)]" />
      )}
    </button>
  );
}

function MenuDivider() {
  return <div className="my-1 border-t border-[var(--border)]" />;
}

function SubMenuHeader({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <button
      onClick={onBack}
      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)] mb-1"
    >
      <ChevronRight size={10} className="rotate-180" />
      {label}
    </button>
  );
}

export default TaskContextMenu;
