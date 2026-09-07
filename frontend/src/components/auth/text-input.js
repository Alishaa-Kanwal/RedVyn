"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const TextInput = forwardRef(function TextInput(
  { label, error, icon: Icon, className, ...props },
  ref
) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}
      <div
        className={cn(
          "flex items-center overflow-hidden rounded-xl border bg-card transition-colors focus-within:border-primary",
          error ? "border-primary" : "border-border"
        )}
      >
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70",
            !Icon && "px-4"
          )}
          {...props}
        />
      </div>
      {error && <span className="text-xs font-medium text-primary">{error}</span>}
    </label>
  );
});
