"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAuth, dashboardPath } from "@/components/auth-provider";
import { useSettings } from "@/hooks/use-settings";
import { SettingsShell } from "@/components/dashboard/settings/settings-shell";
import { LoadingSettings } from "@/components/dashboard/settings/loading-settings";

/**
 * Admin-only settings page.
 *
 * - Fetches settings from GET /api/settings.
 * - Persists via PATCH /api/settings and reports success/error with toast.
 * - The System Theme selector drives the same next-themes state as the top-bar
 *   theme toggle; selecting Dark flips the whole dashboard immediately.
 * - Role-gated to admin on the frontend so non-admin roles cannot reach the
 *   route, matching the backend's requireRole(["admin"]) enforcement.
 */
export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { data, loading, error, refresh, update } = useSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const themeApplied = useRef(false);

  // Redirect non-admin roles away from this route.
  useEffect(() => {
    if (!authLoading && user && user.role !== "admin") {
      router.replace(dashboardPath(user.role));
    }
  }, [authLoading, user, router]);

  // Initialize form state from fetched settings. This is a render-phase update
  // so the form can be set from asynchronous data without placing setState in
  // an effect. Keep the form blank when the endpoint is not ready so we never
  // display fabricated sample data.
  if (!form && data) {
    setForm(data);
  }

  // Apply the saved system theme once when settings load. Use a ref so user
  // clicks are not overwritten by this effect re-running after theme changes.
  useEffect(() => {
    const savedTheme = data?.general?.systemTheme;
    if (savedTheme && !themeApplied.current) {
      themeApplied.current = true;
      setTheme(savedTheme);
    }
  }, [data?.general?.systemTheme, setTheme]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      // Persist the currently applied theme alongside the rest of the form.
      const payload = {
        ...form,
        general: {
          ...form.general,
          systemTheme: theme || form.general.systemTheme || "system",
        },
      };
      await update(payload);
      toast.success("Settings saved successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function handleThemeChange(value) {
    setTheme(value);
    setForm((f) => ({ ...f, general: { ...f.general, systemTheme: value } }));
  }

  if (authLoading || !user || user.role !== "admin") {
    return <LoadingSettings />;
  }

  if (loading) {
    return <LoadingSettings />;
  }

  if (!form) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-destructive">
          <p className="text-sm font-medium">Could not load settings.</p>
          <p className="mt-1 text-sm">{error?.message || "Unknown error"}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <SettingsShell
      form={form}
      setForm={setForm}
      saving={saving}
      error={error}
      onRetry={refresh}
      onSave={handleSave}
      onThemeChange={handleThemeChange}
      systemTheme={theme || resolvedTheme || form.general.systemTheme || "system"}
    />
  );
}
