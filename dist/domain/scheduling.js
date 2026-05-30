import { MINUTE_MS, SCHEDULE_ROLES, SCHEDULE_STATIONS, SHIFT_GRACE_MINUTES } from "../shared/constants.js";
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export function toDateInputString(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * MINUTE_MS);
    return local.toISOString().slice(0, 10);
}
export function parseLocalDate(dateString) {
    const date = DATE_INPUT_PATTERN.test(String(dateString || ""))
        ? new Date(`${dateString}T00:00:00`)
        : new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}
export function addDays(dateString, days) {
    const date = parseLocalDate(dateString);
    date.setDate(date.getDate() + Number(days || 0));
    return toDateInputString(date);
}
export function getWeekStartDate(dateString = toDateInputString()) {
    const date = parseLocalDate(dateString);
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + mondayOffset);
    return toDateInputString(date);
}
export function getWeekDates(weekStartDate = getWeekStartDate()) {
    const start = getWeekStartDate(weekStartDate);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
export function isShiftDate(value) {
    return DATE_INPUT_PATTERN.test(String(value || ""));
}
export function isShiftTime(value) {
    return TIME_INPUT_PATTERN.test(String(value || ""));
}
export function normalizeShiftDate(value, fallback = toDateInputString()) {
    return isShiftDate(value) ? String(value) : fallback;
}
export function normalizeShiftTime(value, fallback = "09:00") {
    return isShiftTime(value) ? String(value) : fallback;
}
export function normalizeScheduleRole(value, fallback = "Front") {
    const candidate = String(value || "").replace(/\s+/g, " ").trim();
    return SCHEDULE_ROLES.includes(candidate) ? candidate : fallback;
}
export function normalizeScheduleStation(value, fallback = "Restaurant floor") {
    const candidate = String(value || "").replace(/\s+/g, " ").trim();
    return SCHEDULE_STATIONS.includes(candidate) ? candidate : fallback;
}
export function combineShiftDateTimeMs(dateString, timeString, options = {}) {
    const date = normalizeShiftDate(dateString);
    const time = normalizeShiftTime(timeString);
    const timestamp = new Date(`${date}T${time}:00`).getTime();
    if (!options.afterMs || timestamp > options.afterMs)
        return timestamp;
    return timestamp + 24 * 60 * MINUTE_MS;
}
export function getShiftStartMs(shift) {
    return combineShiftDateTimeMs(shift?.date, shift?.startTime);
}
export function getShiftEndMs(shift) {
    return combineShiftDateTimeMs(shift?.date, shift?.endTime, { afterMs: getShiftStartMs(shift) });
}
export function getShiftPlannedMinutes(shift) {
    return Math.max(0, Math.round((getShiftEndMs(shift) - getShiftStartMs(shift)) / MINUTE_MS));
}
export function getShiftBreakMinutes(shift, nowMs = Date.now()) {
    const savedBreakMinutes = Math.max(0, Math.round(Number(shift?.breakMinutes) || 0));
    const breakStartedAtMs = Number(shift?.breakStartedAtMs) || 0;
    if (!breakStartedAtMs || shift?.clockOutAtMs)
        return savedBreakMinutes;
    return savedBreakMinutes + Math.max(0, Math.round((nowMs - breakStartedAtMs) / MINUTE_MS));
}
export function getShiftActualMinutes(shift, nowMs = Date.now()) {
    const clockInAtMs = Number(shift?.clockInAtMs) || 0;
    if (!clockInAtMs)
        return 0;
    const clockOutAtMs = Number(shift?.clockOutAtMs) || nowMs;
    const grossMinutes = Math.max(0, Math.round((clockOutAtMs - clockInAtMs) / MINUTE_MS));
    return Math.max(0, grossMinutes - getShiftBreakMinutes(shift, nowMs));
}
export function getShiftLateMinutes(shift) {
    const clockInAtMs = Number(shift?.clockInAtMs) || 0;
    if (!clockInAtMs)
        return 0;
    const lateMinutes = Math.round((clockInAtMs - getShiftStartMs(shift)) / MINUTE_MS);
    return lateMinutes > SHIFT_GRACE_MINUTES ? lateMinutes : 0;
}
export function getShiftEarlyOutMinutes(shift) {
    const clockOutAtMs = Number(shift?.clockOutAtMs) || 0;
    if (!clockOutAtMs)
        return 0;
    const earlyMinutes = Math.round((getShiftEndMs(shift) - clockOutAtMs) / MINUTE_MS);
    return earlyMinutes > SHIFT_GRACE_MINUTES ? earlyMinutes : 0;
}
export function getShiftOvertimeMinutes(shift, nowMs = Date.now()) {
    const overtimeMinutes = getShiftActualMinutes(shift, nowMs) - getShiftPlannedMinutes(shift);
    return overtimeMinutes > SHIFT_GRACE_MINUTES ? overtimeMinutes : 0;
}
export function shiftIsMissed(shift, nowMs = Date.now()) {
    return !shift?.clockInAtMs && nowMs > getShiftEndMs(shift) + SHIFT_GRACE_MINUTES * MINUTE_MS;
}
export function getShiftAttendanceStatus(shift, nowMs = Date.now()) {
    if (shiftIsMissed(shift, nowMs))
        return "Missed";
    if (shift?.clockOutAtMs) {
        if (getShiftEarlyOutMinutes(shift))
            return "Left early";
        if (getShiftOvertimeMinutes(shift, nowMs))
            return "Overtime";
        return "Completed";
    }
    if (shift?.breakStartedAtMs)
        return "On break";
    if (shift?.clockInAtMs)
        return getShiftLateMinutes(shift) ? "Late" : "On shift";
    return shift?.notifiedAtMs ? "Notified" : "Scheduled";
}
export function getDriverOnTimeStatus(shift, nowMs = Date.now()) {
    if (normalizeScheduleRole(shift?.role, "") !== "Driver")
        return "";
    if (shiftIsMissed(shift, nowMs))
        return "Missed";
    if (!shift?.clockInAtMs)
        return "Pending";
    return getShiftLateMinutes(shift) ? "Late" : "On time";
}
export function getShiftMetrics(shift, nowMs = Date.now()) {
    const plannedMinutes = getShiftPlannedMinutes(shift);
    const actualMinutes = getShiftActualMinutes(shift, nowMs);
    const breakMinutes = getShiftBreakMinutes(shift, nowMs);
    const lateMinutes = getShiftLateMinutes(shift);
    const earlyOutMinutes = getShiftEarlyOutMinutes(shift);
    const overtimeMinutes = getShiftOvertimeMinutes(shift, nowMs);
    return {
        plannedMinutes,
        actualMinutes,
        breakMinutes,
        lateMinutes,
        earlyOutMinutes,
        overtimeMinutes,
        missed: shiftIsMissed(shift, nowMs),
        attendanceStatus: getShiftAttendanceStatus(shift, nowMs),
        driverOnTimeStatus: getDriverOnTimeStatus(shift, nowMs)
    };
}
export function formatShiftHours(minutes) {
    const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = safeMinutes / 60;
    return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)}h`;
}
export function sortShiftsByDateTime(shifts) {
    return [...(Array.isArray(shifts) ? shifts : [])].sort((first, second) => {
        return getShiftStartMs(first) - getShiftStartMs(second)
            || String(first.staffName || first.staffId || "").localeCompare(String(second.staffName || second.staffId || ""));
    });
}
//# sourceMappingURL=scheduling.js.map