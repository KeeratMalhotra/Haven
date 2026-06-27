"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Sun,
  Calendar,
  CheckSquare,
  Target,
  Settings,
} from "lucide-react";

const pages = [
  { label: "Today", href: "/dashboard", icon: Sun },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Habits", href: "/dashboard/habits", icon: Target },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <Command
        className="relative w-full max-w-lg rounded-xl border border-border bg-popover shadow-2xl"
        label="Command palette"
      >
        <Command.Input
          placeholder="Search pages..."
          className="h-12 w-full border-b border-border bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-4 py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>
          <Command.Group heading="Pages">
            {pages.map((page) => {
              const Icon = page.icon;
              return (
                <Command.Item
                  key={page.href}
                  value={page.label}
                  onSelect={() => handleSelect(page.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{page.label}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
