"use client";

import { FormInput, FormSelect } from "@/components/dashboard/form-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIMEZONE_OPTIONS = [
  { value: "", label: "Select timezone" },
  { value: "UTC", label: "UTC" },
  { value: "Asia/Karachi", label: "(GMT+05:00) Pakistan Standard Time" },
  { value: "Asia/Dubai", label: "(GMT+04:00) Gulf Standard Time" },
  { value: "Asia/Kolkata", label: "(GMT+05:30) India Standard Time" },
  { value: "Europe/London", label: "(GMT+00:00) Greenwich Mean Time" },
  { value: "America/New_York", label: "(GMT-05:00) Eastern Standard Time" },
];

const LANGUAGE_OPTIONS = [
  { value: "", label: "Select language" },
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "", label: "Select date format" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const TIME_FORMAT_OPTIONS = [
  { value: "", label: "Select time format" },
  { value: "12", label: "12 Hour (1:00 PM)" },
  { value: "24", label: "24 Hour (13:00)" },
];

const ITEMS_PER_PAGE_OPTIONS = [
  { value: "", label: "Select items per page" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
];

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function ThemeSelector({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-foreground">System Theme</span>
      <div className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted"
              )}
            >
              {active && <span className="h-2 w-2 rounded-full bg-primary" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GeneralPanel({ general, systemTheme, onChange, onThemeChange, onSave, saving }) {
  function updateField(field, value) {
    onChange({ ...general, [field]: value });
  }

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-foreground">General Settings</h2>
      <div className="space-y-5 rounded-2xl border border-border bg-card p-6">
        <FormInput
          id="organizationName"
          label="Organization Name"
          value={general?.organizationName ?? ""}
          onChange={(e) => updateField("organizationName", e.target.value)}
          placeholder="Enter organization name"
        />

        <FormInput
          id="organizationTagline"
          label="Organization Tagline"
          value={general?.organizationTagline ?? ""}
          onChange={(e) => updateField("organizationTagline", e.target.value)}
          placeholder="Enter tagline"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormInput
            id="primaryContact"
            label="Primary Contact"
            value={general?.primaryContact ?? ""}
            onChange={(e) => updateField("primaryContact", e.target.value)}
            placeholder="Enter contact number"
          />
          <FormInput
            id="email"
            type="email"
            label="Email"
            value={general?.email ?? ""}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="Enter email address"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormSelect
            id="timezone"
            label="Timezone"
            options={TIMEZONE_OPTIONS}
            value={general?.timezone ?? ""}
            onChange={(e) => updateField("timezone", e.target.value)}
          />
          <FormSelect
            id="language"
            label="Language"
            options={LANGUAGE_OPTIONS}
            value={general?.language ?? ""}
            onChange={(e) => updateField("language", e.target.value)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormSelect
            id="dateFormat"
            label="Date Format"
            options={DATE_FORMAT_OPTIONS}
            value={general?.dateFormat ?? ""}
            onChange={(e) => updateField("dateFormat", e.target.value)}
          />
          <FormSelect
            id="timeFormat"
            label="Time Format"
            options={TIME_FORMAT_OPTIONS}
            value={general?.timeFormat ?? ""}
            onChange={(e) => updateField("timeFormat", e.target.value)}
          />
        </div>

        <ThemeSelector value={systemTheme} onChange={onThemeChange} />

        <FormSelect
          id="itemsPerPage"
          label="Items Per Page"
          options={ITEMS_PER_PAGE_OPTIONS}
          value={String(general?.itemsPerPage ?? "")}
          onChange={(e) => updateField("itemsPerPage", Number(e.target.value))}
        />

        <Button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
