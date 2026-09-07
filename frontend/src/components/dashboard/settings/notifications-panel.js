"use client";

import { cn } from "@/lib/utils";

const NOTIFICATION_ITEMS = [
  {
    key: "newEmergencyCase",
    title: "New Emergency Case",
    description: "Instant alerts for new emergency cases",
  },
  {
    key: "donorConfirmed",
    title: "Donor Confirmed",
    description: "Notify when a donor confirms",
  },
  {
    key: "missedCalls",
    title: "Missed Calls",
    description: "Alert for missed donor calls",
  },
  {
    key: "caseEscalation",
    title: "Case Escalation",
    description: "Notify when case escalates",
  },
  {
    key: "dailySummary",
    title: "Daily Summary",
    description: "Receive daily summary report",
  },
];

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function NotificationPreferences({
  notifications,
  onChange,
  title = "Notification Preferences",
  showHeader = true,
  className,
}) {
  function handleToggle(key) {
    onChange({ ...notifications, [key]: !notifications[key] });
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-6", className)}>
      {showHeader && (
        <h3 className="mb-5 font-semibold text-foreground">{title}</h3>
      )}
      <div className="space-y-5">
        {NOTIFICATION_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Toggle
              checked={!!notifications?.[item.key]}
              onChange={() => handleToggle(item.key)}
              label={item.title}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
