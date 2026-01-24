import React from "react";
import { cn } from "../../lib/utils";

export function Select({ value, onChange, options, className, ...props }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 w-full rounded-2xl border border-border/60 bg-background/40 px-3 text-sm outline-none",
        "focus:ring-2 focus:ring-violet-500/40",
        className,
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
