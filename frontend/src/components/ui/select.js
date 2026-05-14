import React from "react";
import { cn } from "../../lib/utils";

export function Select({ value, onChange, options, className, ...props }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 w-full rounded-2xl border border-borderDefault/60 bg-bgDefault/40 px-3 text-sm outline-none",
        "focus:ring-2 focus:ring-accent/40",
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
