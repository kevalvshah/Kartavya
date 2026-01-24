import React from "react";
import { cn } from "../../lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-semibold outline-none";
  const variants = {
    primary:
      "bg-violet-600 text-white shadow-sm hover:bg-violet-500 active:bg-violet-700 disabled:bg-violet-600/50 disabled:text-white/70",
    ghost:
      "bg-transparent text-foreground hover:bg-muted/40 active:bg-muted/60 disabled:text-muted-foreground",
  };
  const sizes = {
    md: "h-10 px-4",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button
      disabled={disabled}
      className={cn(base, "transition-colors duration-150", variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
