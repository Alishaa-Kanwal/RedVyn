"use client";

import { Lock, Shield } from "lucide-react";
import { FormSelect } from "@/components/dashboard/form-fields";

const AUTO_LOGOUT_OPTIONS = [
  { value: "", label: "Select auto logout" },
  { value: "15", label: "15 Minutes" },
  { value: "30", label: "30 Minutes" },
  { value: "60", label: "1 Hour" },
  { value: "120", label: "2 Hours" },
  { value: "240", label: "4 Hours" },
];

export function SecurityPanel({ sessions, onChange }) {
  const value = sessions?.autoLogoutMinutes ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-foreground">Security</h2>
        <p className="text-sm text-muted-foreground">
          Configure security-related preferences.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Auto Logout</h3>
            <p className="text-sm text-muted-foreground">
              Automatically log out after a period of inactivity.
            </p>
          </div>
        </div>
        <FormSelect
          id="security-autoLogout"
          label="Auto Logout"
          options={AUTO_LOGOUT_OPTIONS}
          value={String(value)}
          onChange={(e) =>
            onChange({ ...sessions, autoLogoutMinutes: Number(e.target.value) })
          }
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Active Sessions</h3>
          </div>
        </div>
        <p className="text-sm text-foreground">
          RedVyn uses stateless JWT authentication. There is no server-side session store,
          so active sessions are not tracked.
        </p>
      </div>
    </div>
  );
}
