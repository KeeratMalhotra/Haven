"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { motion } from "framer-motion";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

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
            className="text-sm font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <motion.input
          ref={ref}
          id={inputId}
          whileFocus={{ scale: 1.005 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`
            h-10 w-full rounded-lg border px-3 text-sm
            bg-[var(--surface)] text-[var(--text-primary)]
            border-[var(--border)] placeholder:text-[var(--text-tertiary)]
            focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20
            transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-danger-400 focus:border-danger-400 focus:ring-danger-400/20" : ""}
            ${className}
          `}
          {...(props as Record<string, unknown>)}
        />
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
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
