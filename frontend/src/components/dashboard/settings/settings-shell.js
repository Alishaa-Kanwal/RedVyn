"use client";

import { useState } from "react";
import {
  Settings2,
  Users,
  Shield,
  Building2,
  Bell,
  MessageCircle,
  Workflow,
  Lock,
  Plug,
  ClipboardList,
  Info,
  RefreshCcw,
} from "lucide-react";
import { GeneralPanel } from "./general-panel";
import { NotificationPreferences } from "./notifications-panel";
import { SessionManagement } from "./sessions-panel";
import { AuditLogsPanel } from "./audit-logs-panel";
import { ComingSoonPanel } from "./coming-soon-panel";
import { UserManagementPanel } from "./user-management-panel";
import { RolesPermissionsPanel } from "./roles-permissions-panel";
import { HospitalVerificationPanel } from "./hospital-verification-panel";
import { SecurityPanel } from "./security-panel";
import { SystemInfoPanel } from "./system-info-panel";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "userManagement", label: "User Management", icon: Users },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "hospitalVerification", label: "Hospital Verification", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "communication", label: "Communication", icon: MessageCircle },
  { id: "automationRules", label: "Automation Rules", icon: Workflow },
  { id: "security", label: "Security", icon: Lock },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "auditLogs", label: "Audit Logs", icon: ClipboardList },
  { id: "systemInfo", label: "System Info", icon: Info },
];

const COMING_SOON_TITLES = {
  communication: "Communication",
  automationRules: "Automation Rules",
  integrations: "Integrations",
};

function CategoryNav({ active, onSelect }) {
  return (
    <nav className="space-y-1" aria-label="Settings categories">
      {CATEGORIES.map((category) => {
        const Icon = category.icon;
        const isActive = active === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border-l-4 px-3 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "border-primary bg-primary/5 text-primary"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {category.label}
          </button>
        );
      })}
    </nav>
  );
}

function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  const isNotReady = error.status === 404;
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between",
        isNotReady
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
          : "border-destructive/20 bg-destructive/10 text-destructive"
      )}
    >
      <p className="text-sm">
        {isNotReady
          ? "Settings persistence is not available yet. Values you enter will appear in the form, but saving will not persist until the backend endpoint is implemented."
          : error.message || "Could not load settings."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:self-auto"
      >
        <RefreshCcw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

export function SettingsShell({
  form,
  setForm,
  saving,
  error,
  onRetry,
  onSave,
  onThemeChange,
  systemTheme,
}) {
  const [activeCategory, setActiveCategory] = useState("general");

  function updateGeneral(general) {
    setForm((f) => ({ ...f, general }));
  }

  function updateNotifications(notifications) {
    setForm((f) => ({ ...f, notifications }));
  }

  function updateSessions(sessions) {
    setForm((f) => ({ ...f, sessions }));
  }

  function renderMiddlePanel() {
    if (activeCategory === "general") {
      return (
        <GeneralPanel
          general={form.general}
          systemTheme={systemTheme}
          onChange={updateGeneral}
          onThemeChange={onThemeChange}
          onSave={onSave}
          saving={saving}
        />
      );
    }

    if (activeCategory === "notifications") {
      return (
        <div className="space-y-6">
          <h2 className="font-semibold text-foreground">Notification Settings</h2>
          <NotificationPreferences
            notifications={form.notifications}
            onChange={updateNotifications}
            title="Notification Preferences"
          />
        </div>
      );
    }

    if (activeCategory === "auditLogs") {
      return <AuditLogsPanel />;
    }

    if (activeCategory === "userManagement") {
      return <UserManagementPanel />;
    }

    if (activeCategory === "roles") {
      return <RolesPermissionsPanel />;
    }

    if (activeCategory === "hospitalVerification") {
      return <HospitalVerificationPanel />;
    }

    if (activeCategory === "security") {
      return <SecurityPanel sessions={form.sessions} onChange={updateSessions} />;
    }

    if (activeCategory === "systemInfo") {
      return <SystemInfoPanel />;
    }

    return <ComingSoonPanel title={COMING_SOON_TITLES[activeCategory]} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage system preferences and configurations.
        </p>
      </div>

      <ErrorBanner error={error} onRetry={onRetry} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card p-3">
            <CategoryNav active={activeCategory} onSelect={setActiveCategory} />
          </div>
        </div>

        <div className="lg:col-span-5">{renderMiddlePanel()}</div>

        <div className="space-y-6 lg:col-span-4">
          <NotificationPreferences
            notifications={form.notifications}
            onChange={updateNotifications}
          />
          <SessionManagement sessions={form.sessions} onChange={updateSessions} />
        </div>
      </div>
    </div>
  );
}
