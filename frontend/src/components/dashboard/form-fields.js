"use client";

import { cn } from "@/lib/utils";

export function FormLabel({ children, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
      {required && <span className="ml-0.5 text-primary">*</span>}
    </label>
  );
}

export function FormInput({ id, label, error, className, required, ...props }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <FormLabel htmlFor={id} required={required}>{label}</FormLabel>}
      <input
        id={id}
        className={cn(
          "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          error && "border-destructive focus:border-destructive focus:ring-destructive",
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function FormSelect({ id, label, error, options = [], required, className, ...props }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <FormLabel htmlFor={id} required={required}>{label}</FormLabel>}
      <select
        id={id}
        className={cn(
          "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          error && "border-destructive focus:border-destructive focus:ring-destructive",
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function FormError({ error }) {
  if (!error) return null;
  return <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>;
}
