"use client";

import { useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TooltipSide = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  side?: TooltipSide;
  delay?: number;
  children: ReactNode;
  className?: string;
}

const sidePositions: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const sideAnimations = {
  top: {
    initial: { opacity: 0, y: 4, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
  },
  bottom: {
    initial: { opacity: 0, y: -4, scale: 0.96 },
    animate: { opacity: 1, y: 0, scale: 1 },
  },
  left: {
    initial: { opacity: 0, x: 4, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
  },
  right: {
    initial: { opacity: 0, x: -4, scale: 0.96 },
    animate: { opacity: 1, x: 0, scale: 1 },
  },
} as const;

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 26,
};

export function Tooltip({
  content,
  side = "top",
  delay = 300,
  children,
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            role="tooltip"
            initial={sideAnimations[side].initial}
            animate={sideAnimations[side].animate}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={springTransition}
            className={`
              absolute z-50 pointer-events-none
              ${sidePositions[side]}
            `}
          >
            <div
              className={`
                px-2.5 py-1.5 text-xs font-medium whitespace-nowrap
                rounded-lg shadow-lg
                bg-[var(--text-primary)] text-[var(--text-inverse)]
                border border-[var(--border-subtle)]
                ${className}
              `}
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Tooltip;
