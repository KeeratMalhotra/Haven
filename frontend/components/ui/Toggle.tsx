"use client";

import { motion } from "framer-motion";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  className = "",
}: ToggleProps) {
  return (
    <label
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${
        disabled ? "opacity-50 pointer-events-none" : ""
      } ${className}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 items-center rounded-full
          transition-colors duration-200 focus-ring
          ${checked ? "bg-accent-500" : "bg-[var(--border)]"}
        `}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`
            inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm
            ${checked ? "ml-[18px]" : "ml-[3px]"}
          `}
        />
      </button>
      {label && (
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      )}
    </label>
  );
}

export default Toggle;
