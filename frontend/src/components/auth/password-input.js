"use client";

import { forwardRef, useMemo, useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

function strength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

const LABELS = ["Weak", "Fair", "Good", "Strong"];

export const PasswordInput = forwardRef(function PasswordInput(
  { label, error, showStrength = false, className, value, onChange, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  const [internalValue, setInternalValue] = useState("");
  const password = value ?? internalValue;
  const score = useMemo(() => strength(password), [password]);

  function handleChange(event) {
    setInternalValue(event.target.value);
    onChange?.(event);
  }

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
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground">
          <Lock className="h-4 w-4" />
        </span>
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className="h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          {...props}
          {...(value !== undefined ? { value } : {})}
          onChange={handleChange}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && password && (
        <div className="flex items-center gap-2">
          <div className="flex h-1 flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-full flex-1 rounded-full transition-colors",
                  i < score ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{LABELS[score]}</span>
        </div>
      )}
      {error && <span className="text-xs font-medium text-primary">{error}</span>}
    </label>
  );
});
