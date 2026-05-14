import React from "react";
import { cn } from "../../lib/utils";

export function Badge({ children, className, tone = "neutral", ...props }) {
  const tones = {
    neutral: "bg-bgMuted/50 text-textMuted border-borderDefault/60",
    info: "bg-infoBg/15 text-info dark:text-info/80 border-info/20",
    danger: "bg-dangerBg/15 text-danger dark:text-danger/80 border-danger/20",
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
