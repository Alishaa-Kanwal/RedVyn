"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduleCalendar } from "@/components/dashboard/schedule-calendar";
import { SlideOver } from "@/components/dashboard/slide-over";
import { useSchedule } from "@/hooks/use-schedule";
import { startOfWeek, endOfWeek, formatTime } from "@/lib/date-utils";

export default function AdminSchedulePage() {
  const [view, setView] = useState("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Keep these Date instances stable between renders. useSchedule depends on
  // them, so recreating them on every render would repeatedly re-run its
  // loading effect whenever the hook updates its state.
  const { start, end } = useMemo(
    () => ({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }),
    [currentDate],
  );
  const { data: events, loading, error, refresh } = useSchedule(start, end, view);

  function handleDayClick(day) {
    setCurrentDate(day);
    setView("day");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        {error && (
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>

      {error && !loading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            {error.message || "Unable to load schedule."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      <ScheduleCalendar
        view={view}
        currentDate={currentDate}
        events={events}
        onViewChange={setView}
        onDateChange={setCurrentDate}
        onEventClick={setSelectedEvent}
        onDayClick={handleDayClick}
        loading={loading}
      />

      {events.length === 0 && !loading && !error && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">No events scheduled for this period.</p>
        </div>
      )}

      <SlideOver
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || "Event"}
      >
        {selectedEvent ? (
          <div className="space-y-4">
            <EventRow label="Type" value={selectedEvent.type?.replace(/_/g, " ")} />
            <EventRow label="Date" value={formatDate(selectedEvent.startAt)} />
            <EventRow label="Time" value={formatTime(selectedEvent.startAt)} />
            <EventRow
              label="Duration"
              value={`${selectedEvent.durationMinutes || 30} minutes`}
            />
            {selectedEvent.relatedType && (
              <EventRow
                label="Related to"
                value={`${selectedEvent.relatedType} (${selectedEvent.relatedId})`}
              />
            )}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </SlideOver>
    </div>
  );
}

function EventRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold capitalize text-foreground">{value || "—"}</p>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
