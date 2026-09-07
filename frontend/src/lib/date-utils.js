export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function endOfWeek(date) {
  const start = startOfWeek(date);
  return addDays(start, 6);
}

export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isWithinInterval(date, start, end) {
  return date >= start && date <= end;
}

export function formatDateRange(start, end) {
  const opts = { day: "numeric", month: "short", year: "numeric" };
  const startStr = start.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const endStr = end.toLocaleDateString("en-US", opts);
  return `${startStr} - ${endStr}`;
}

export function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function getHoursMinutes(iso) {
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}
