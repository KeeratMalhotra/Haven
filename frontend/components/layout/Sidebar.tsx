"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Sun,
  Calendar,
  CheckSquare,
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Today", href: "/dashboard", icon: Sun },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Tasks", href: "/dashboard/tasks", icon: CheckSquare },
  { label: "Habits", href: "/dashboard/habits", icon: Target },
];

const bottomItems = [
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        {!collapsed && (
          <span className="text-lg font-semibold text-sidebar-foreground">
            ChronAI
          </span>
        )}
        {collapsed && (
          <span className="mx-auto text-lg font-semibold text-sidebar-foreground">
            C
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="space-y-1 border-t border-sidebar-border px-2 py-3">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* User info */}
        {session?.user && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2",
              collapsed && "justify-center px-2"
            )}
          >
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name || "User"}
                width={24}
                height={24}
                className="h-6 w-6 shrink-0 rounded-full"
              />
            ) : (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {session.user.name?.charAt(0) || "U"}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {session.user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            collapsed && "justify-center px-2"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
