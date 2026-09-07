"use client";

import { usePathname } from "next/navigation";

export function SectionPlaceholder() {
  const pathname = usePathname();
  const section = pathname.split("/").filter(Boolean).pop() || "section";
  const title = section.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground">
        This {title.toLowerCase()} view is being wired up. Check back soon.
      </p>
      <div className="h-48 rounded-2xl border border-dashed border-border bg-card" />
    </div>
  );
}
