"use client";

import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type CardSize = "sm" | "md" | "lg";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  hover?: boolean;
  accent?: boolean;
  size?: CardSize;
  className?: string;
}

const sizeStyles: Record<CardSize, string> = {
  sm: "p-3 rounded-lg",
  md: "p-4 rounded-xl",
  lg: "p-6 rounded-2xl",
};

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

export function Card({
  children,
  hover = true,
  accent = false,
  size = "md",
  className = "",
  ...props
}: CardProps) {
  return (
    <motion.div
      whileHover={
        hover
          ? {
              y: -2,
              boxShadow:
                "0 8px 24px -8px rgba(0, 0, 0, 0.12), 0 2px 8px -2px rgba(0, 0, 0, 0.05)",
            }
          : undefined
      }
      transition={springTransition}
      className={`
        border bg-[var(--surface)]
        shadow-xs transition-colors duration-200
        ${sizeStyles[size]}
        ${accent ? "border-accent-400/30 shadow-glow-sm" : "border-[var(--border)]"}
        ${hover ? "hover:border-[var(--text-tertiary)]/30 hover:bg-[var(--surface-hover)]" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default Card;
