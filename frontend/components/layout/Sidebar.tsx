"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  CalendarClock,
  Flame,
  BarChart3,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  Moon,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";

const STORAGE_KEY = "chronai-sidebar-collapsed";
const MORE_STORAGE_KEY = "chronai-sidebar-more-open";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

// Primary group — the calm, core destinations shown first.
const PRIMARY_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Tasks", icon: CheckSquare, path: "/dashboard/tasks" },
  { label: "Calendar", icon: Calendar, path: "/dashboard/calendar" },
];

// Secondary group — de-emphasized, lives under the collapsible "More" section.
// Order follows the Sprint 13 brief: Habits, Analytics, Planner.
const SECONDARY_ITEMS: NavItem[] = [
  { label: "Habits", icon: Flame, path: "/dashboard/habits" },
  { label: "Analytics", icon: BarChart3, path: "/dashboard/analytics" },
  { label: "Planner", icon: CalendarClock, path: "/dashboard/planner" },
];

// Settings — pinned utility at the bottom.
const SETTINGS_ITEM: NavItem = {
  label: "Settings",
  icon: Settings,
  path: "/dashboard/settings",
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedCollapsed = localStorage.getItem(STORAGE_KEY);
    if (storedCollapsed === "true") setCollapsed(true);

    // Auto-expand "More" on first load when the active route lives in the
    // secondary group, so a user deep-linking to e.g. /dashboard/analytics
    // never finds it hidden. Otherwise honour the persisted choice (collapsed
    // by default for new users). After mount, `moreOpen` is the single source
    // of truth driving the disclosure, so an explicit manual collapse always
    // wins over the auto-expand (no dead toggle on secondary routes).
    const storedMore = localStorage.getItem(MORE_STORAGE_KEY);
    const onSecondaryRoute = SECONDARY_ITEMS.some((item) =>
      item.path === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.path)
    );
    if (storedMore === "true" || onSecondaryRoute) {
      setMoreOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    }
  }, [collapsed, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(MORE_STORAGE_KEY, String(moreOpen));
    }
  }, [moreOpen, mounted]);

  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(path);
  };

  // `moreOpen` is the single source of truth for the disclosure. It is
  // auto-expanded once on mount when landing on a secondary route (see the
  // mount effect) and otherwise reflects the persisted manual choice, so the
  // toggle button always has a visible effect.
  const moreExpanded = moreOpen;

  const sidebarWidth = collapsed ? 68 : 260;

  // Single source of truth for every nav link so active/hover states, the
  // framer-motion active indicator, sizing, transitions, and the collapsed
  // tooltip are identical across primary, secondary, and Settings items.
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    const Icon = item.icon;

    return (
      <Link
        key={item.path}
        href={item.path}
        onClick={onMobileClose}
        className={`
          group relative flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px]
          transition-all duration-200 ease-out
          ${
            active
              ? "bg-[var(--accent-subtle,rgba(99,102,241,0.08))] text-accent-500"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          }
        `}
      >
        {/* Active indicator bar */}
        {active && (
          <motion.div
            layoutId="sidebar-active-indicator"
            className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-500"
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
        )}

        {/* Active background glow */}
        {active && (
          <motion.div
            layoutId="sidebar-active-bg"
            className="absolute inset-0 rounded-xl bg-accent-500/[0.06]"
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          />
        )}

        <motion.div className="relative flex-shrink-0">
          <Icon size={20} strokeWidth={active ? 2 : 1.5} />
        </motion.div>

        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden whitespace-nowrap text-sm font-medium"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Tooltip for collapsed state */}
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] opacity-0 shadow-lg ring-1 ring-[var(--border)] transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2.5 px-4">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent-gradient"
        >
          <span className="text-sm font-bold text-white select-none">C</span>
        </div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden whitespace-nowrap text-base font-semibold tracking-tight text-[var(--text-primary)]"
            >
              ChronAI
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
        {collapsed ? (
          // Icon-only mode: keep every destination reachable in order.
          [...PRIMARY_ITEMS, ...SECONDARY_ITEMS].map(renderNavItem)
        ) : (
          <>
            {PRIMARY_ITEMS.map(renderNavItem)}

            {/* De-emphasized "More" disclosure for the secondary group */}
            <div className="my-1 mx-3 border-t border-[var(--border-subtle)]" />

            <button
              onClick={() => setMoreOpen((o) => !o)}
              className="group flex w-full items-center gap-2 rounded-xl px-3 py-2 min-h-[36px] text-[var(--text-tertiary)] transition-all duration-200 ease-out hover:text-[var(--text-secondary)]"
              aria-expanded={moreExpanded}
              aria-label={moreExpanded ? "Collapse more navigation" : "Expand more navigation"}
            >
              <motion.div
                animate={{ rotate: moreExpanded ? 90 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex-shrink-0"
              >
                <ChevronRight size={16} strokeWidth={1.75} />
              </motion.div>
              <span className="overflow-hidden whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider">
                More
              </span>
            </button>

            <AnimatePresence initial={false}>
              {moreExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-col gap-0.5 overflow-hidden"
                >
                  {SECONDARY_ITEMS.map(renderNavItem)}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto border-t border-[var(--border-subtle)] px-3 py-3 space-y-0.5">
        {/* Settings — pinned utility anchored above the controls */}
        {renderNavItem(SETTINGS_ITEM)}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          aria-label="Toggle theme"
        >
          <motion.div
            key={theme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex-shrink-0"
          >
            {theme === "dark" ? (
              <Moon size={20} strokeWidth={1.5} />
            ) : (
              <Sun size={20} strokeWidth={1.5} />
            )}
          </motion.div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-sm font-medium"
              >
                {theme === "dark" ? "Dark mode" : "Light mode"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Collapse toggle (hidden on mobile) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[var(--text-secondary)] transition-all duration-200 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] md:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex-shrink-0"
          >
            <ChevronsLeft size={20} strokeWidth={1.5} />
          </motion.div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-sm font-medium"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden h-screen flex-shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] md:block"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-50 h-screen w-[260px] border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl md:hidden"
            >
              <div className="absolute right-3 top-4">
                <button
                  onClick={onMobileClose}
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export { ChevronsRight as MenuIcon };
