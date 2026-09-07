"use client";

import { useEffect, useState } from "react";
import {
  Mic,
  MicOff,
  Grid3x3,
  PhoneOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function avatarInitial(name) {
  return name?.charAt(0).toUpperCase() || "?";
}

export function CallsActivePanel({ call, onEndCall, onStatusChanged }) {
  const [duration, setDuration] = useState(call?.durationSeconds || 0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [held, setHeld] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (!call) return;
    const interval = setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id]);

  if (!call) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Select a call to begin.</p>
      </div>
    );
  }

  async function updateDonorStatus(status) {
    if (call.contactType !== "donor" || !call.contactId) return;
    setActing(true);
    setActionError(null);
    try {
      await apiFetch(`/api/donors/${call.contactId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onStatusChanged?.();
    } catch (err) {
      setActionError(err.message || "Could not update status");
    } finally {
      setActing(false);
    }
  }

  const quickActions = [
    {
      id: "confirm",
      label: "Confirm Availability",
      icon: CheckCircle2,
      variant: "success",
      onClick: () => updateDonorStatus("active"),
    },
    {
      id: "not_available",
      label: "Not Available",
      icon: XCircle,
      variant: "neutral",
      onClick: () => updateDonorStatus("paused"),
    },
    {
      id: "callback",
      label: "Call Back Later",
      icon: Clock,
      variant: "neutral",
      onClick: () => {
        // No persistent call-back queue endpoint exists yet; this is a UI action only.
        console.log("Call back later flagged for", call.contactId);
      },
    },
    {
      id: "wrong_number",
      label: "Wrong Number",
      icon: Ban,
      variant: "danger",
      onClick: () => updateDonorStatus("blocked"),
    },
    {
      id: "end",
      label: "End Call",
      icon: PhoneOff,
      variant: "danger",
      onClick: () => onEndCall?.(),
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Active Call</h2>
        <div className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          <span className="text-xs font-semibold text-destructive">REC {formatDuration(duration)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {avatarInitial(call.contactName)}
        </div>
        <h3 className="mt-3 text-xl font-bold text-foreground">{call.contactName}</h3>
        <p className="text-sm capitalize text-muted-foreground">
          {call.contactType} · {call.phone ? call.phone : "Number hidden"}
        </p>
      </div>

      {/* Waveform */}
      <div className="my-6 flex h-16 items-center justify-center gap-1">
        {Array.from({ length: 40 }).map((_, i) => {
          const height = 20 + Math.abs(Math.sin(i * 0.7 + duration * 0.1)) * 60;
          return (
            <div
              key={i}
              style={{ height: `${height}%` }}
              className="w-1 rounded-full bg-primary transition-all duration-100"
            />
          );
        })}
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-4">
        <ControlButton
          active={muted}
          onClick={() => setMuted((v) => !v)}
          icon={muted ? MicOff : Mic}
          label="Mute"
        />
        <ControlButton icon={Grid3x3} label="Keypad" />
        <button
          type="button"
          onClick={() => onEndCall?.()}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-105"
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
        <ControlButton
          active={speaker}
          onClick={() => setSpeaker((v) => !v)}
          icon={speaker ? Volume2 : VolumeX}
          label="Speaker"
        />
        <ControlButton
          active={held}
          onClick={() => setHeld((v) => !v)}
          icon={held ? Play : Pause}
          label="Hold"
        />
      </div>

      {/* Quick actions */}
      <div className="mt-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>
        {quickActions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={acting}
            onClick={action.onClick}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition-colors",
              action.variant === "success" &&
                "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-400",
              action.variant === "danger" &&
                "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20",
              action.variant === "neutral" &&
                "border-border bg-muted text-foreground hover:bg-muted/80",
            )}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="mt-3 text-center text-xs text-destructive">{actionError}</p>
      )}

      <p className="mt-4 text-center text-[10px] text-muted-foreground">
        Quick actions update donor status via existing /api/donors/:id/status.
      </p>
    </div>
  );
}

function ControlButton({ icon: Icon, active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl p-2 text-xs font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={label}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
          active
            ? "border-primary bg-primary/10"
            : "border-border bg-card hover:bg-muted",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      {label}
    </button>
  );
}
