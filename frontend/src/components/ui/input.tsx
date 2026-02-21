import React from "react";
import { cn } from "@utils/format";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          // Layout & shape
          "flex w-full rounded-lg px-3 py-2 text-sm",
          // Colors
          "bg-theme border border-primary",
          "text-zinc-100 placeholder:text-zinc-500",
          // Focus ring
          "outline-none transition-colors duration-150",
          "focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
          // Disabled
          "disabled:pointer-events-none disabled:opacity-50",
          // File input
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-zinc-300",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";