import React from "react";
import { cn } from "@utils/format";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "secondary" | "destructive";
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-zinc-700 text-zinc-100 border-transparent",
  outline: "bg-transparent border border-zinc-700 text-zinc-400",
  secondary: "bg-zinc-800 text-zinc-300 border-transparent",
  destructive: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
          "text-[11px] font-semibold leading-none",
          "transition-colors duration-150",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";