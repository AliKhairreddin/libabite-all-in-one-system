import { RESERVATION_ACTIVE_STATUSES, RESERVATION_STATUSES, RESERVATION_TURNOVER_MINUTES } from "../shared/constants.js";
const INACTIVE_RESERVATION_STATUSES = ["Cancelled", "Declined", "No-show"];
export function isReservationDate(date) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        return false;
    const parsed = new Date(`${date}T00:00:00`);
    const [year, month, day] = date.split("-").map(Number);
    return Number.isFinite(parsed.getTime())
        && parsed.getFullYear() === year
        && parsed.getMonth() + 1 === month
        && parsed.getDate() === day;
}
export function isReservationTime(time) {
    return typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function normalizeReservationStatus(status, fallback = "Pending") {
    const candidate = String(status || "").trim();
    return RESERVATION_STATUSES.includes(candidate) ? candidate : fallback;
}
export function isActiveReservationStatus(status) {
    return RESERVATION_ACTIVE_STATUSES.includes(normalizeReservationStatus(status, "Confirmed"));
}
export function reservationStatusClass(status) {
    const normalized = normalizeReservationStatus(status, "Pending");
    if (normalized === "Pending")
        return "warning";
    if (normalized === "Confirmed" || normalized === "Arrived")
        return "ok";
    if (INACTIVE_RESERVATION_STATUSES.includes(normalized))
        return "danger";
    return "info";
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
export function getTimeRangeWindow(startTime, endTime) {
    const start = getReservationMinutes(startTime);
    const end = getReservationMinutes(endTime);
    if (start === null || end === null)
        return null;
    return { start, end: end <= start ? end + 1440 : end };
}
export function getReservationWindowLabel(time, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const window = getReservationWindow(time, turnoverMinutes);
    return window ? `${formatReservationMinutes(window.start)}-${formatReservationMinutes(window.end)}` : "Time needed";
}
export function getReservationDateLabel(date) {
    if (!isReservationDate(date))
        return "Today";
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T00:00:00`));
}
export function reservationWindowsOverlap(firstWindow, secondWindow) {
    return firstWindow.start < secondWindow.end && secondWindow.start < firstWindow.end;
}
function sameReservationDate(firstDate, secondDate) {
    if (!firstDate || !secondDate)
        return true;
    return firstDate === secondDate;
}
export function getReservationConflicts(candidate, reservations, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
    if (!candidate.tableId || !candidateWindow)
        return [];
    return reservations.filter((reservation) => {
        if (reservation.id === candidate.id
            || reservation.tableId !== candidate.tableId
            || !sameReservationDate(candidate.date, reservation.date)
            || !isActiveReservationStatus(reservation.status)) {
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
export function getReservationBlockConflicts(candidate, blocks, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
    if (!candidateWindow)
        return [];
    return (Array.isArray(blocks) ? blocks : []).filter((block) => {
        if (block.active === false)
            return false;
        if (!sameReservationDate(candidate.date, block.date))
            return false;
        const blockWindow = getTimeRangeWindow(block.startTime, block.endTime);
        return blockWindow && reservationWindowsOverlap(candidateWindow, blockWindow);
    });
}
export function getApplicableCapacityRules(candidate, capacityRules, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
    if (!candidateWindow)
        return [];
    return (Array.isArray(capacityRules) ? capacityRules : []).filter((rule) => {
        if (rule.active === false)
            return false;
        if (rule.date && candidate.date && rule.date !== candidate.date)
            return false;
        const ruleWindow = getTimeRangeWindow(rule.startTime, rule.endTime);
        return ruleWindow && reservationWindowsOverlap(candidateWindow, ruleWindow);
    });
}
export function getReservationCapacityIssue(candidate, reservations, capacityRules, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
    if (!candidateWindow)
        return null;
    const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
    const activeReservations = reservations.filter((reservation) => {
        if (reservation.id === candidate.id || !isActiveReservationStatus(reservation.status))
            return false;
        if (!sameReservationDate(candidate.date, reservation.date))
            return false;
        const reservationWindow = getReservationWindow(reservation.time, turnoverMinutes);
        return reservationWindow && reservationWindowsOverlap(candidateWindow, reservationWindow);
    });
    const rules = getApplicableCapacityRules(candidate, capacityRules, turnoverMinutes);
    for (const rule of rules) {
        const totalGuests = activeReservations.reduce((sum, reservation) => sum + (Number(reservation.guests) || 0), 0) + guests;
        const totalReservations = activeReservations.length + 1;
        const maxGuests = Math.max(0, Math.floor(Number(rule.maxGuests) || 0));
        const maxReservations = Math.max(0, Math.floor(Number(rule.maxReservations) || 0));
        if (maxGuests > 0 && totalGuests > maxGuests) {
            return {
                rule,
                title: "Capacity limit",
                detail: `${totalGuests} guests would exceed the ${maxGuests}-guest limit for ${rule.startTime}-${rule.endTime}.`
            };
        }
        if (maxReservations > 0 && totalReservations > maxReservations) {
            return {
                rule,
                title: "Reservation limit",
                detail: `${totalReservations} reservations would exceed the ${maxReservations}-booking limit for this window.`
            };
        }
    }
    return null;
}
export function getReservationPolicyIssues(candidate, reservations, blocks = [], capacityRules = [], turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const issues = [];
    const blockConflicts = getReservationBlockConflicts(candidate, blocks, turnoverMinutes);
    if (blockConflicts.length) {
        issues.push(`Blocked: ${blockConflicts.map((block) => block.reason || `${block.startTime}-${block.endTime}`).join(", ")}`);
    }
    const capacityIssue = getReservationCapacityIssue(candidate, reservations, capacityRules, turnoverMinutes);
    if (capacityIssue)
        issues.push(capacityIssue.detail);
    return issues;
}
export function getReservationIssues(reservation, tables, reservations, turnoverMinutes = RESERVATION_TURNOVER_MINUTES, blocks = [], capacityRules = []) {
    if (!isActiveReservationStatus(reservation.status))
        return [];
    const issues = [];
    const table = tables.find((item) => item.id === reservation.tableId);
    if (!table) {
        issues.push("Needs table");
        return issues;
    }
    if (reservation.guests > table.capacity) {
        issues.push(`Over capacity by ${reservation.guests - table.capacity}`);
    }
    const conflicts = getReservationConflicts(reservation, reservations, turnoverMinutes);
    if (conflicts.length) {
        issues.push(`Overlaps ${conflicts.map((conflict) => `${conflict.time} ${conflict.name}`).join(", ")}`);
    }
    issues.push(...getReservationPolicyIssues(reservation, reservations, blocks, capacityRules, turnoverMinutes));
    return issues;
}
export function getReservationRequestValidation(candidate, tables, reservations, blocks = [], capacityRules = [], turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
    const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
    if (candidate.date && !isReservationDate(candidate.date)) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: "Choose date",
            detail: "Choose a valid reservation date."
        };
    }
    if (!isReservationTime(candidate.time)) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: "Choose time",
            detail: "Choose an arrival time before checking the table."
        };
    }
    if (!String(candidate.name || "").trim()) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Name needed",
            title: "Guest details",
            detail: "Enter a guest name before confirming this reservation."
        };
    }
    if (!String(candidate.phone || candidate.email || "").trim()) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Contact",
            title: "Contact needed",
            detail: "Enter a phone number or email so staff can reach the guest."
        };
    }
    const blockConflicts = getReservationBlockConflicts(candidate, blocks, turnoverMinutes);
    if (blockConflicts.length) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: "Unavailable",
            detail: blockConflicts.map((block) => block.reason || `${block.startTime}-${block.endTime} unavailable`).join(", ")
        };
    }
    const capacityIssue = getReservationCapacityIssue(candidate, reservations, capacityRules, turnoverMinutes);
    if (capacityIssue) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Capacity",
            title: capacityIssue.title,
            detail: capacityIssue.detail
        };
    }
    const table = candidate.tableId
        ? tables.find((item) => item.id === candidate.tableId)
        : getAvailableReservationTable(candidate, tables, reservations, turnoverMinutes);
    if (!table) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Full",
            title: "No table",
            detail: `No available table seats ${guests} guests at ${candidate.time}.`
        };
    }
    return {
        ok: true,
        className: "",
        pillClass: "ok",
        pillText: "Available",
        title: `${table.name} available`,
        table,
        detail: `Seats ${table.capacity}; ${getReservationWindowLabel(candidate.time, turnoverMinutes)} for ${guests} guests.`
    };
}
export function getReservationValidation(candidate, tables, reservations, turnoverMinutes = RESERVATION_TURNOVER_MINUTES, blocks = [], capacityRules = []) {
    const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
    const table = tables.find((item) => item.id === candidate.tableId);
    if (candidate.date && !isReservationDate(candidate.date)) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: "Choose date",
            detail: "Choose a valid reservation date before checking the table."
        };
    }
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
    const blockConflicts = getReservationBlockConflicts(candidate, blocks, turnoverMinutes);
    if (blockConflicts.length) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Blocked",
            title: "Unavailable",
            detail: blockConflicts.map((block) => block.reason || `${block.startTime}-${block.endTime} unavailable`).join(", ")
        };
    }
    const capacityIssue = getReservationCapacityIssue(candidate, reservations, capacityRules, turnoverMinutes);
    if (capacityIssue) {
        return {
            ok: false,
            className: "danger",
            pillClass: "danger",
            pillText: "Capacity",
            title: capacityIssue.title,
            detail: capacityIssue.detail
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