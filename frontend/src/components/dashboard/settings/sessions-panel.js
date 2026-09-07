"use client";

import { FormSelect } from "@/components/dashboard/form-fields";
import { cn } from "@/lib/utils";

const AUTO_LOGOUT_OPTIONS = [
  { value: "", label: "Select auto logout" },
  { value: "15", label: "15 Minutes" },
  { value: "30", label: "30 Minutes" },
  { value: "60", label: "1 Hour" },
  { value: "120", label: "2 Hours" },
  { value: "240", label: "4 Hours" },
];

export function SessionManagement({ sessions, onChange, className }) {
  const value = sessions?.autoLogoutMinutes ?? "";

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-6", className)}>
      <h3 className="mb-5 font-semibold text-foreground">Session Management</h3>
      <div className="space-y-5">
        <FormSelect
          id="autoLogout"
          label="Auto Logout"
          options={AUTO_LOGOUT_OPTIONS}
          value={String(value)}
          onChange={(e) =>
            onChange({ ...sessions, autoLogoutMinutes: Number(e.target.value) })
          }
        />
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground">Active Sessions</p>
          <p className="mt-1 text-sm text-foreground">
            RedVyn uses stateless JWT authentication. Active sessions are not tracked.
          </p>
        </div>
      </div>
    </div>
  );
}
