import React from "react";
import { cn } from "@utils/format";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          // Layout
          "flex w-full rounded-lg px-3 py-2.5 text-sm",
          // Colors
          "bg-zinc-800/60 border border-zinc-700",
          "text-zinc-100 placeholder:text-zinc-500",
          // Focus
          "outline-none transition-colors duration-150",
          "focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20",
          // Resize
          "resize-y min-h-[80px]",
          // Disabled
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";