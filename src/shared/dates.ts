import { MINUTE_MS } from "./constants.js";

export function timeNow() {
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

export function formatDateTime(timestamp, fallbackClockTime = "") {
  const resolvedTimestamp = normalizeOptionalTimestamp(timestamp) || parseClockTimeToTimestamp(fallbackClockTime) || Date.now();
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(resolvedTimestamp));
}

export function parseClockTimeToTimestamp(time) {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;

  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();
  const timestamp = new Date(now);
  timestamp.setHours(hours, minutes, 0, 0);

  if (timestamp.getTime() - now.getTime() > 5 * MINUTE_MS) {
    timestamp.setDate(timestamp.getDate() - 1);
  }

  return timestamp.getTime();
}

export function normalizeOptionalTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : "";
}

export function normalizeTimestamp(value, fallbackClockTime = "") {
  return normalizeOptionalTimestamp(value) || parseClockTimeToTimestamp(fallbackClockTime) || Date.now();
}

export function formatDuration(minutes) {
  const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
  if (safeMinutes < 1) return "<1m";
  if (safeMinutes < 60) return `${safeMinutes}m`;

  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
