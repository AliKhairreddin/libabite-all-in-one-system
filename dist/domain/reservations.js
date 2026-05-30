import { RESERVATION_TURNOVER_MINUTES } from "../shared/constants.js";
export function isReservationTime(time) {
    return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function getReservationMinutes(time) {
    if (!isReservationTime(time))
        return null;
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}
export function formatReservationMinutes(totalMinutes) {
    const wrappedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const hours = Math.floor(wrappedMinutes / 60);
    const minutes = wrappedMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
export function getReservationWindow(time, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const start = getReservationMinutes(time);
    return start === null ? null : { start, end: start + turnoverMinutes };
}
export function getReservationWindowLabel(time, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const window = getReservationWindow(time, turnoverMinutes);
    return window ? `${formatReservationMinutes(window.start)}-${formatReservationMinutes(window.end)}` : "Time needed";
}
export function reservationWindowsOverlap(firstWindow, secondWindow) {
    return firstWindow.start < secondWindow.end && secondWindow.start < firstWindow.end;
}
export function getReservationConflicts(candidate, reservations, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
    if (!candidate.tableId || !candidateWindow)
        return [];
    return reservations.filter((reservation) => {
        if (reservation.id === candidate.id || reservation.tableId !== candidate.tableId || reservation.status === "Cancelled") {
            return false;
        }
        const reservationWindow = getReservationWindow(reservation.time, turnoverMinutes);
        return reservationWindow && reservationWindowsOverlap(candidateWindow, reservationWindow);
    });
}
export function getAvailableReservationTable(candidate, tables, reservations, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
    return tables
        .filter((table) => table.capacity >= guests)
        .slice()
        .sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name))
        .find((table) => !getReservationConflicts({ ...candidate, guests, tableId: table.id }, reservations, turnoverMinutes).length) || null;
}
export function getReservationIssues(reservation, tables, reservations, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const issues = [];
    const table = tables.find((item) => item.id === reservation.tableId);
    if (!table) {
        issues.push("Missing table");
        return issues;
    }
    if (reservation.guests > table.capacity) {
        issues.push(`Over capacity by ${reservation.guests - table.capacity}`);
    }
    const conflicts = getReservationConflicts(reservation, reservations, turnoverMinutes);
    if (conflicts.length) {
        issues.push(`Overlaps ${conflicts.map((conflict) => `${conflict.time} ${conflict.name}`).join(", ")}`);
    }
    return issues;
}
export function getReservationValidation(candidate, tables, reservations, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
    const table = tables.find((item) => item.id === candidate.tableId);
    if (!table) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: "Select table",
            detail: "Choose a table before confirming this reservation."
        };
    }
    if (!isReservationTime(candidate.time)) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: table.name,
            detail: "Choose an arrival time before checking the table."
        };
    }
    if (guests > table.capacity) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Too small",
            title: table.name,
            detail: `${table.name} seats ${table.capacity}; choose a larger table for ${guests} guests.`
        };
    }
    const conflicts = getReservationConflicts({ ...candidate, guests }, reservations, turnoverMinutes);
    if (conflicts.length) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Collision",
            title: `${table.name} is already held`,
            detail: `Conflicts with ${conflicts.map((reservation) => `${reservation.time} ${reservation.name}`).join(", ")}. Holds last ${turnoverMinutes} minutes.`
        };
    }
    return {
        ok: true,
        className: "",
        pillClass: "ok",
        pillText: "Available",
        title: `${table.name} available`,
        detail: `Seats ${table.capacity}; ${getReservationWindowLabel(candidate.time, turnoverMinutes)} for ${guests} guests.`
    };
}
//# sourceMappingURL=reservations.js.map