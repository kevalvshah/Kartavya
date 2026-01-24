import React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm outline-none",
        "focus:ring-2 focus:ring-violet-500/40",
        className,
      )}
      {...props}
    />
  );
});
