"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { motion } from "framer-motion";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      className = "",
      wrapperClassName = "",
      id,
      onAnimationStart: _onAnimationStart,
      onDragStart: _onDragStart,
      onDragEnd: _onDragEnd,
      onDrag: _onDrag,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-medium text-[var(--text-secondary)] dark:text-[#a8a39c]"
          >
            {label}
          </label>
        )}
        <motion.input
          ref={ref}
          id={inputId}
          transition={springTransition}
          className={`
            h-10 w-full rounded-lg border px-3 text-sm
            bg-[var(--surface)] text-[var(--text-primary)] dark:text-[#ece9e4]
            border-[var(--border)] placeholder:text-[var(--text-tertiary)] dark:text-[#847e76]
            focus:outline-none focus:border-[var(--border-focus)]
            focus:ring-2 focus:ring-[var(--accent)]/10
            transition-colors duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-danger-400 focus:border-danger-400 focus:ring-danger-400/10" : ""}
            ${className}
          `}
          {...(props as Record<string, unknown>)}
        />
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className="text-xs text-danger-400"
          >
            {error}
          </motion.p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
