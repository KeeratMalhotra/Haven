"use client";

import { type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  hover?: boolean;
  accent?: boolean;
  className?: string;
}

export function Card({
  children,
  hover = true,
  accent = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2, boxShadow: "0 8px 24px -8px rgba(0, 0, 0, 0.12)" } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`
        rounded-xl border bg-[var(--surface)] p-4
        transition-colors duration-150
        ${accent ? "border-accent-400/30" : "border-[var(--border)]"}
        ${hover ? "hover:border-[var(--border)] hover:bg-[var(--surface-hover)]" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default Card;
