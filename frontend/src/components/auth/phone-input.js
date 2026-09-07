"use client";

import { forwardRef, useState } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const CODES = [
  { value: "+92", label: "+92", flag: "🇵🇰" },
];

export const PhoneInput = forwardRef(function PhoneInput(
  { label, error, className, ...props },
  ref
) {
  const [code, setCode] = useState("+92");

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
          <Phone className="h-4 w-4" />
        </span>
        <div className="flex h-11 shrink-0 items-center border-r border-border bg-muted/30 px-2">
          <select
            aria-label="Country code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-full bg-transparent text-sm font-medium text-foreground outline-none"
          >
            {CODES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.flag} {c.label}
              </option>
            ))}
          </select>
        </div>
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          className="h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
          {...props}
        />
      </div>
      {error && <span className="text-xs font-medium text-primary">{error}</span>}
    </label>
  );
});
