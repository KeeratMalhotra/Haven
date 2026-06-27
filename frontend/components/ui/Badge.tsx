"use client";

import { type ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
  success:
    "bg-success-50 text-success-700 border-success-200 dark:bg-success-700/15 dark:text-success-300 dark:border-success-600/30",
  warning:
    "bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-700/15 dark:text-warning-300 dark:border-warning-600/30",
  danger:
    "bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-700/15 dark:text-danger-300 dark:border-danger-600/30",
  info: "bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-700/15 dark:text-accent-300 dark:border-accent-600/30",
};

export function Badge({
  variant = "default",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full border
        px-2.5 py-0.5 text-xs font-medium
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export default Badge;
