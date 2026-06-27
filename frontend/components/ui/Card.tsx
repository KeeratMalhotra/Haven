"use client";

import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  hover?: boolean;
  accent?: boolean;
  className?: string;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

export function Card({
  children,
  hover = true,
  accent = false,
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
        rounded-xl border bg-[var(--surface)] p-4
        shadow-xs transition-colors duration-200
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
