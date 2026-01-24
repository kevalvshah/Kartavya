import React from "react";
import { cn } from "../../lib/utils";

export function Badge({ children, className, tone = "neutral", ...props }) {
  const tones = {
    neutral: "bg-muted/50 text-muted-foreground border-border/60",
    info: "bg-violet-500/15 text-violet-200 dark:text-violet-100 border-violet-500/20",
    danger: "bg-rose-500/15 text-rose-200 dark:text-rose-100 border-rose-500/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone] || tones.neutral,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
