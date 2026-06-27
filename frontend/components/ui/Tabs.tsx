"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Tabs Root                                                           */
/* ------------------------------------------------------------------ */

interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className = "",
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (id: string) => {
    if (!value) setInternalValue(id);
    onValueChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* TabsList                                                            */
/* ------------------------------------------------------------------ */

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = "" }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={`
        inline-flex items-center gap-1 p-1
        rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TabsTrigger                                                         */
/* ------------------------------------------------------------------ */

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className = "" }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={`
        relative px-3 py-1.5 text-sm font-medium rounded-lg
        transition-colors duration-200 ease-spring
        focus-ring select-none cursor-pointer
        ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}
        ${className}
      `}
    >
      {isActive && (
        <motion.span
          layoutId="tabs-indicator"
          className="absolute inset-0 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-xs"
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* TabsContent                                                         */
/* ------------------------------------------------------------------ */

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = "" }: TabsContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
      role="tabpanel"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default Tabs;
