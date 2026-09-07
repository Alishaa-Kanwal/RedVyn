"use client";

import { cn } from "@/lib/utils";

const ROLES = [
  { id: "donor", label: "Donor" },
  { id: "guardian", label: "Patient / Guardian" },
  { id: "hospital", label: "Hospital" },
];

export function RoleTabs({ value, onChange, className }) {
  return (
    <div
      className={cn(
        "inline-flex w-full items-center rounded-full border border-border bg-card p-1 sm:w-auto",
        className
      )}
      role="tablist"
      aria-label="Signup role"
    >
      {ROLES.map((role) => {
        const active = role.id === value;
        return (
          <button
            key={role.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(role.id)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all sm:flex-none",
              active
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            )}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}
