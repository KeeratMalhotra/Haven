"use client";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
}

const roundedStyles = {
  sm: "rounded",
  md: "rounded-lg",
  lg: "rounded-xl",
  full: "rounded-full",
};

export function Skeleton({
  className = "",
  width,
  height,
  rounded = "md",
}: SkeletonProps) {
  return (
    <div
      className={`
        animate-shimmer bg-gradient-to-r
        from-[var(--surface)] via-[var(--surface-hover)] to-[var(--surface)]
        bg-[length:200%_100%]
        ${roundedStyles[rounded]}
        ${className}
      `}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export default Skeleton;
