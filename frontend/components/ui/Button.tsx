"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "children" | "className"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconOnly?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700",
  secondary:
    "bg-[var(--surface)] text-[var(--text-primary)] dark:text-[#ece9e4] border border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--text-tertiary)]/30 active:bg-[var(--bg-tertiary)]",
  ghost:
    "text-[var(--text-secondary)] dark:text-[#a8a39c] hover:text-[var(--text-primary)] dark:hover:text-[#ece9e4] hover:bg-[var(--surface-hover)] active:bg-[var(--bg-tertiary)]",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2.5 rounded-xl",
};

const iconOnlySizeStyles: Record<Size, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-9 w-9 rounded-lg",
  lg: "h-11 w-11 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      iconOnly = false,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium
          transition-colors duration-200 ease-out focus-ring
          disabled:opacity-50 disabled:pointer-events-none
          select-none cursor-pointer
          ${variantStyles[variant]}
          ${iconOnly ? iconOnlySizeStyles[size] : sizeStyles[size]}
          ${iconOnly ? "p-0" : ""}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";

export default Button;
