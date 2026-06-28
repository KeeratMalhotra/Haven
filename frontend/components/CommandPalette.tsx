"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ListTodo,
  Flame,
  Sparkles,
  Timer,
  Search,
  LayoutDashboard,
  Settings,
  Sun,
  Moon,
  MessageSquare,
  Plus,
} from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";

interface CommandPaletteProps {
  onFocusMode?: () => void;
  onOpenChat?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  action: () => void;
  keywords?: string;
}

export default function CommandPalette({
  onFocusMode,
  onOpenChat,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = (path: string) => {
    if (pathname !== path) {
      router.push(path);
    }
    setOpen(false);
  };

  const items: CommandItem[] = [
    // Navigation
    {
      id: "go-dashboard",
      label: "Go to Dashboard",
      icon: <LayoutDashboard size={16} />,
      group: "Navigation",
      action: () => navigate("/dashboard"),
      keywords: "home main overview",
    },
    {
      id: "go-tasks",
      label: "Go to Tasks",
      icon: <ListTodo size={16} />,
      group: "Navigation",
      action: () => navigate("/dashboard/tasks"),
      keywords: "todo list kanban",
    },
    {
      id: "go-calendar",
      label: "Go to Calendar",
      icon: <CalendarDays size={16} />,
      group: "Navigation",
      action: () => navigate("/dashboard/calendar"),
      keywords: "events schedule",
    },
    {
      id: "go-habits",
      label: "Go to Habits",
      icon: <Flame size={16} />,
      group: "Navigation",
      action: () => navigate("/dashboard/habits"),
      keywords: "streak routine",
    },
    {
      id: "go-settings",
      label: "Go to Settings",
      icon: <Settings size={16} />,
      group: "Navigation",
      action: () => navigate("/dashboard/settings"),
      keywords: "preferences config",
    },
    // Actions
    {
      id: "create-task",
      label: "Create Task",
      icon: <Plus size={16} />,
      group: "Actions",
      action: () => {
        navigate("/dashboard/tasks");
      },
      keywords: "new add todo",
    },
    {
      id: "create-event",
      label: "Create Event",
      icon: <CalendarDays size={16} />,
      group: "Actions",
      action: () => {
        navigate("/dashboard/calendar");
      },
      keywords: "new add schedule meeting",
    },
    {
      id: "start-focus",
      label: "Start Pomodoro",
      icon: <Timer size={16} />,
      group: "Actions",
      action: () => {
        onFocusMode?.();
        setOpen(false);
      },
      keywords: "pomodoro timer concentrate focus",
    },
    {
      id: "toggle-theme",
      label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      icon: theme === "dark" ? <Sun size={16} /> : <Moon size={16} />,
      group: "Actions",
      action: () => {
        toggleTheme();
        setOpen(false);
      },
      keywords: "dark light appearance",
    },
    // AI
    {
      id: "ask-ai",
      label: "Ask AI...",
      icon: <Sparkles size={16} />,
      group: "AI",
      action: () => {
        onOpenChat?.();
        setOpen(false);
      },
      keywords: "chat assistant help",
    },
    {
      id: "open-chat",
      label: "Open AI Chat Panel",
      icon: <MessageSquare size={16} />,
      group: "AI",
      action: () => {
        onOpenChat?.();
        setOpen(false);
      },
      keywords: "message conversation",
    },
  ];

  const groups = Array.from(new Set(items.map((a) => a.group)));

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[91] flex items-start justify-center pt-[20vh]"
          >
            <Command
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
              loop
            >
              {/* Search input */}
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4">
                <Search size={16} className="text-[var(--text-tertiary)]" />
                <Command.Input
                  placeholder="Type a command or search..."
                  className="h-12 w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                />
              </div>

              {/* Results list */}
              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                  No results found.
                </Command.Empty>

                {groups.map((group) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--text-tertiary)]"
                  >
                    {items
                      .filter((a) => a.group === group)
                      .map((item) => (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.keywords || ""}`}
                          onSelect={item.action}
                          className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-secondary)] transition data-[selected=true]:bg-[var(--surface-hover)] data-[selected=true]:text-[var(--text-primary)]"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                            {item.icon}
                          </span>
                          {item.label}
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
              </Command.List>

              {/* Footer hint */}
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-2">
                <span className="text-xs text-[var(--text-tertiary)]">
                  Navigate with arrow keys
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  <kbd className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px]">
                    Esc
                  </kbd>{" "}
                  to close
                </span>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
