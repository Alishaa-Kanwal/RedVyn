"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  formatDateRange,
  formatTime,
  getHoursMinutes,
  startOfMonth,
  endOfMonth,
} from "@/lib/date-utils";

const HOUR_START = 6;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_STYLES = {
  donor_call:
    "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground",
  hospital_collection:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  standby_check:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  follow_up_call:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
};

export function eventStyle(type) {
  return TYPE_STYLES[type] || "bg-muted text-foreground border-border";
}

function useWeekDays(date) {
  return useMemo(() => {
    const start = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [date]);
}

export function ScheduleCalendar({
  view,
  currentDate,
  events,
  onViewChange,
  onDateChange,
  onEventClick,
  onDayClick,
  loading,
}) {
  const weekDays = useWeekDays(currentDate);
  const rangeLabel = useMemo(() => {
    if (view === "month") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (view === "day") {
      return currentDate.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return formatDateRange(weekDays[0], weekDays[6]);
  }, [view, currentDate, weekDays]);

  function previous() {
    if (view === "day") onDateChange(addDays(currentDate, -1));
    else if (view === "week") onDateChange(addWeeks(currentDate, -1));
    else onDateChange(addMonths(currentDate, -1));
  }

  function next() {
    if (view === "day") onDateChange(addDays(currentDate, 1));
    else if (view === "week") onDateChange(addWeeks(currentDate, 1));
    else onDateChange(addMonths(currentDate, 1));
  }

  function today() {
    onDateChange(new Date());
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={previous}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-2 text-lg font-bold text-foreground">{rangeLabel}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={today}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Today
          </button>
          <div className="flex rounded-full border border-border p-1">
            {["day", "week", "month"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 animate-pulse flex-col gap-3">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="flex-1 rounded-lg bg-muted" />
        </div>
      ) : view === "week" ? (
        <WeekView
          days={weekDays}
          events={events}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />
      ) : view === "day" ? (
        <DayView
          day={currentDate}
          events={events}
          onEventClick={onEventClick}
        />
      ) : (
        <MonthView
          date={currentDate}
          events={events}
          onDayClick={onDayClick}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}

function WeekView({ days, events, onEventClick, onDayClick }) {
  return (
    <div className="flex h-[600px] flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-8 border-b border-border">
        <div className="p-2" />
        {days.map((day) => {
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayClick?.(day)}
              className={cn(
                "flex flex-col items-center justify-center p-2 text-sm transition-colors hover:bg-muted",
                isToday && "bg-primary/5",
              )}
            >
              <span className="text-xs text-muted-foreground">{DAYS[day.getDay()]}</span>
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full font-bold",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="grid grid-cols-8">
          {/* Time labels */}
          <div className="border-r border-border">
            {HOURS.map((hour) => (
              <div key={hour} className="relative h-16">
                <span className="absolute -top-2 right-2 text-[10px] text-muted-foreground">
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div key={day.toISOString()} className="relative border-r border-border last:border-r-0">
              {HOURS.map((hour) => (
                <div key={hour} className="h-16 border-b border-border" />
              ))}
              <DayEvents day={day} events={events} onEventClick={onEventClick} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DayView({ day, events, onEventClick }) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), day));

  return (
    <div className="flex h-[600px] flex-col overflow-hidden">
      <div className="border-b border-border p-3 text-center">
        <span className="text-lg font-bold text-foreground">
          {day.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>
      <div className="relative flex-1 overflow-y-auto">
        <div className="relative">
          {HOURS.map((hour) => (
            <div key={hour} className="flex h-16 border-b border-border">
              <div className="w-16 border-r border-border py-1 pr-2 text-right text-[10px] text-muted-foreground">
                {formatHour(hour)}
              </div>
              <div className="flex-1" />
            </div>
          ))}
          <div className="absolute left-16 right-0 top-0">
            <DayEvents day={day} events={events} onEventClick={onEventClick} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthView({ date, events, onDayClick, onEventClick }) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const monthStartDay = start.getDay();
  const daysInMonth = end.getDate();
  const cells = [];

  for (let i = 0; i < monthStartDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), d));
  }

  return (
    <div className="grid grid-cols-7 gap-1">
      {DAYS.map((d) => (
        <div key={d} className="p-2 text-center text-xs font-semibold text-muted-foreground">
          {d}
        </div>
      ))}
      {cells.map((day, idx) => {
        if (!day) return <div key={idx} className="aspect-square rounded-lg bg-muted/20" />;
        const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), day));
        const isToday = isSameDay(day, new Date());
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onDayClick?.(day)}
            className={cn(
              "flex aspect-square flex-col gap-1 rounded-lg border border-border p-1.5 text-left transition-colors hover:bg-muted/30",
              isToday && "bg-primary/5",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                isToday ? "bg-primary text-primary-foreground" : "text-foreground",
              )}
            >
              {day.getDate()}
            </span>
            <div className="flex flex-wrap gap-1 overflow-hidden">
              {dayEvents.slice(0, 4).map((e) => (
                <span
                  key={e.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEventClick?.(e);
                  }}
                  className={cn("h-1.5 w-1.5 rounded-full", eventStyle(e.type).split(" ")[0])}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayEvents({ day, events, onEventClick }) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.startAt), day));

  return dayEvents.map((event) => {
    const { hours, minutes } = getHoursMinutes(event.startAt);
    const startMinutes = (hours - HOUR_START) * 60 + minutes;
    const duration = event.durationMinutes || 30;
    const top = (startMinutes / 60) * 4; // 4rem per hour
    const height = (duration / 60) * 4;

    return (
      <button
        key={event.id}
        type="button"
        onClick={() => onEventClick?.(event)}
        style={{ top: `${top}rem`, height: `${height}rem` }}
        className={cn(
          "absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition-transform hover:scale-[1.02]",
          eventStyle(event.type),
        )}
      >
        <span className="block truncate font-semibold">{event.title}</span>
        <span className="block truncate opacity-90">{formatTime(event.startAt)}</span>
      </button>
    );
  });
}

function formatHour(hour) {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h} ${ampm}`;
}
