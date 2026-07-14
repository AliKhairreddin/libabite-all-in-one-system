import {
  RESERVATION_ACTIVE_STATUSES,
  RESERVATION_STATUSES,
  RESERVATION_TURNOVER_MINUTES
} from "../shared/constants.js";

const INACTIVE_RESERVATION_STATUSES = ["Cancelled", "Declined", "No-show"];

export function isReservationDate(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
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
  if (normalized === "Pending") return "warning";
  if (normalized === "Confirmed" || normalized === "Arrived") return "ok";
  if (INACTIVE_RESERVATION_STATUSES.includes(normalized)) return "danger";
  return "info";
}

export function getReservationMinutes(time) {
  if (!isReservationTime(time)) return null;
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
  if (start === null || end === null) return null;
  return { start, end: end <= start ? end + 1440 : end };
}

export function getReservationWindowLabel(time, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
  const window = getReservationWindow(time, turnoverMinutes);
  return window ? `${formatReservationMinutes(window.start)}-${formatReservationMinutes(window.end)}` : "Time needed";
}

function getZonedDateTimeParts(timestampMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestampMs));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

export function getRestaurantLocalDate(timestampMs = Date.now(), timeZone = "Europe/Amsterdam") {
  const timestamp = Number(timestampMs);
  if (!Number.isFinite(timestamp)) return "";
  try {
    const parts = getZonedDateTimeParts(timestamp, timeZone);
    return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

export function addReservationCalendarDays(date, days) {
  if (!isReservationDate(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day + Math.trunc(Number(days) || 0));
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function getReservationDateBounds(policy: any = {}) {
  const nowMs = Number.isFinite(Number(policy.nowMs)) ? Number(policy.nowMs) : Date.now();
  const timeZone = String(policy.timeZone || "Europe/Amsterdam").trim();
  const horizonDays = Math.max(1, Math.floor(Number(policy.reservationHorizonDays) || 90));
  const min = getRestaurantLocalDate(nowMs, timeZone);
  return {
    min,
    max: addReservationCalendarDays(min, horizonDays),
    horizonDays
  };
}

export function reservationDateTimeToUtcMs(date, time, timeZone = "Europe/Amsterdam") {
  if (!isReservationDate(date) || !isReservationTime(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = desiredAsUtc;

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const actual = getZonedDateTimeParts(guess, timeZone);
      const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
      guess += desiredAsUtc - actualAsUtc;
    }
    const verified = getZonedDateTimeParts(guess, timeZone);
    if (
      verified.year !== year
      || verified.month !== month
      || verified.day !== day
      || verified.hour !== hour
      || verified.minute !== minute
    ) return null;
    return guess;
  } catch {
    return null;
  }
}

function reservationPolicyBlock(title, detail, pillText = "Blocked") {
  return {
    ok: false,
    className: "danger",
    pillClass: "danger",
    pillText,
    title,
    detail
  };
}

export function getReservationPolicyValidation(candidate, policy: any = {}) {
  if (!isReservationDate(candidate?.date)) {
    return reservationPolicyBlock("Choose date", "Choose a valid reservation date.");
  }
  if (!isReservationTime(candidate?.time)) {
    return reservationPolicyBlock("Choose time", "Choose an arrival time before checking availability.");
  }
  // Domain callers that do not supply a policy retain the reusable table and
  // capacity validator. The application selector always supplies restaurant
  // settings for public requests.
  if (!policy || !Object.keys(policy).length) return { ok: true };
  if (policy.reservationsEnabled === false) {
    return reservationPolicyBlock("Reservations paused", "Online reservation requests are currently paused.", "Paused");
  }

  const guests = Math.max(1, Math.floor(Number(candidate?.guests) || 1));
  const maxGuests = Math.max(1, Math.floor(Number(policy.reservationMaxGuests) || 12));
  if (guests > maxGuests) {
    return reservationPolicyBlock(
      "Party too large",
      `Online reservations are limited to ${maxGuests} guests. Contact the restaurant for larger groups.`,
      "Call us"
    );
  }

  const opensAt = isReservationTime(policy.opensAt) ? policy.opensAt : "11:00";
  const closesAt = isReservationTime(policy.closesAt) ? policy.closesAt : "22:00";
  const requestedMinutes = getReservationMinutes(candidate.time);
  const openMinutes = getReservationMinutes(opensAt);
  const closeMinutes = getReservationMinutes(closesAt);
  const withinHours = openMinutes !== closeMinutes && (closeMinutes > openMinutes
    ? requestedMinutes >= openMinutes && requestedMinutes < closeMinutes
    : requestedMinutes >= openMinutes || requestedMinutes < closeMinutes);
  if (!withinHours) {
    return reservationPolicyBlock(
      "Outside booking hours",
      `Choose an arrival time between ${opensAt} and ${closesAt}.`,
      "Closed"
    );
  }

  const timeZone = String(policy.timeZone || "Europe/Amsterdam").trim();
  const requestedAtMs = reservationDateTimeToUtcMs(candidate.date, candidate.time, timeZone);
  if (!Number.isFinite(requestedAtMs)) {
    return reservationPolicyBlock("Invalid local time", "Choose another arrival time.");
  }
  const nowMs = Number.isFinite(Number(policy.nowMs)) ? Number(policy.nowMs) : Date.now();
  const leadMinutes = Math.max(0, Math.floor(Number(policy.reservationLeadMinutes) || 0));
  if (requestedAtMs < nowMs + leadMinutes * 60 * 1000) {
    return reservationPolicyBlock(
      "More notice needed",
      leadMinutes
        ? `Online requests need at least ${leadMinutes} minutes' notice.`
        : "Choose a future arrival time.",
      "Too soon"
    );
  }
  const dateBounds = getReservationDateBounds({ ...policy, nowMs, timeZone });
  if (candidate.date > dateBounds.max) {
    return reservationPolicyBlock(
      "Too far ahead",
      `Online reservations open ${dateBounds.horizonDays} days in advance.`,
      "Not open yet"
    );
  }
  return { ok: true };
}

export function getReservationDateLabel(date) {
  if (!isReservationDate(date)) return "Today";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${date}T00:00:00`));
}

export function reservationWindowsOverlap(firstWindow, secondWindow) {
  return firstWindow.start < secondWindow.end && secondWindow.start < firstWindow.end;
}

function sameReservationDate(firstDate, secondDate) {
  if (!firstDate || !secondDate) return true;
  return firstDate === secondDate;
}

function getAbsoluteReservationWindow(reservation, turnoverMinutes, timeZone) {
  if (!isReservationDate(reservation?.date) || !isReservationTime(reservation?.time)) return null;
  const start = reservationDateTimeToUtcMs(reservation.date, reservation.time, timeZone);
  if (!Number.isFinite(start)) return null;
  return {
    start,
    end: start + Math.max(0, Number(turnoverMinutes) || 0) * 60 * 1000
  };
}

function reservationRecordsOverlap(first, second, turnoverMinutes, timeZone) {
  const firstAbsoluteWindow = getAbsoluteReservationWindow(first, turnoverMinutes, timeZone);
  const secondAbsoluteWindow = getAbsoluteReservationWindow(second, turnoverMinutes, timeZone);
  if (firstAbsoluteWindow && secondAbsoluteWindow) {
    return reservationWindowsOverlap(firstAbsoluteWindow, secondAbsoluteWindow);
  }
  if (!sameReservationDate(first?.date, second?.date)) return false;
  const firstWindow = getReservationWindow(first?.time, turnoverMinutes);
  const secondWindow = getReservationWindow(second?.time, turnoverMinutes);
  return Boolean(firstWindow && secondWindow && reservationWindowsOverlap(firstWindow, secondWindow));
}

export function getReservationConflicts(
  candidate,
  reservations,
  turnoverMinutes = RESERVATION_TURNOVER_MINUTES,
  timeZone = candidate?.timeZone || "Europe/Amsterdam"
) {
  const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
  if (!candidate.tableId || !candidateWindow) return [];

  return reservations.filter((reservation) => {
    if (
      reservation.id === candidate.id
      || reservation.tableId !== candidate.tableId
      || !isActiveReservationStatus(reservation.status)
    ) {
      return false;
    }
    return reservationRecordsOverlap(candidate, reservation, turnoverMinutes, timeZone);
  });
}

function getGuestCount(value) {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function getTableCapacity(table) {
  return Math.max(0, Math.floor(Number(table?.capacity) || 0));
}

function getTableZone(table) {
  return String(table?.zone || "").trim().toLowerCase();
}

function getTableName(table) {
  return String(table?.name || table?.id || "Table").trim();
}

function tableHasAvailability(candidate, table, reservations, turnoverMinutes, timeZone) {
  return Boolean(table?.id)
    && !getReservationConflicts({ ...candidate, tableId: table.id }, reservations, turnoverMinutes, timeZone).length;
}

function compareTablesForParty(guests) {
  return (first, second) => {
    const firstCapacity = getTableCapacity(first);
    const secondCapacity = getTableCapacity(second);

    if (guests <= 2) {
      const firstTwoTop = firstCapacity === 2 ? 0 : 1;
      const secondTwoTop = secondCapacity === 2 ? 0 : 1;
      if (firstTwoTop !== secondTwoTop) return firstTwoTop - secondTwoTop;
    }

    return firstCapacity - secondCapacity || getTableName(first).localeCompare(getTableName(second));
  };
}

export function getAvailableReservationTables(
  candidate,
  tables,
  reservations,
  turnoverMinutes = RESERVATION_TURNOVER_MINUTES,
  timeZone = candidate?.timeZone || "Europe/Amsterdam"
) {
  const guests = getGuestCount(candidate.guests);
  return tables
    .filter((table) => getTableCapacity(table) >= guests)
    .filter((table) => tableHasAvailability({ ...candidate, guests }, table, reservations, turnoverMinutes, timeZone))
    .slice()
    .sort(compareTablesForParty(guests));
}

export function getAvailableReservationTable(
  candidate,
  tables,
  reservations,
  turnoverMinutes = RESERVATION_TURNOVER_MINUTES,
  timeZone = candidate?.timeZone || "Europe/Amsterdam"
) {
  return getAvailableReservationTables(candidate, tables, reservations, turnoverMinutes, timeZone)[0] || null;
}

export function getReservationMergeOptions(
  candidate,
  tables,
  reservations,
  turnoverMinutes = RESERVATION_TURNOVER_MINUTES,
  timeZone = candidate?.timeZone || "Europe/Amsterdam"
) {
  const guests = getGuestCount(candidate.guests);
  if (guests < 5) return [];

  const availableTables = tables
    .filter((table) => tableHasAvailability({ ...candidate, guests }, table, reservations, turnoverMinutes, timeZone))
    .slice()
    .sort(compareTablesForParty(guests));

  const options = [];
  for (let firstIndex = 0; firstIndex < availableTables.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < availableTables.length; secondIndex += 1) {
      const firstTable = availableTables[firstIndex];
      const secondTable = availableTables[secondIndex];
      const capacity = getTableCapacity(firstTable) + getTableCapacity(secondTable);
      if (capacity < guests) continue;
      options.push({
        kind: "merge",
        tables: [firstTable, secondTable],
        capacity,
        sameZone: Boolean(getTableZone(firstTable) && getTableZone(firstTable) === getTableZone(secondTable))
      });
    }
  }

  return options.sort((first, second) => {
    if (first.sameZone !== second.sameZone) return first.sameZone ? -1 : 1;
    return first.capacity - second.capacity
      || getTableCapacity(second.tables[0]) - getTableCapacity(first.tables[0])
      || getTableName(first.tables[0]).localeCompare(getTableName(second.tables[0]));
  });
}

export function getReservationSeatingRecommendation(
  candidate,
  tables,
  reservations,
  turnoverMinutes = RESERVATION_TURNOVER_MINUTES,
  timeZone = candidate?.timeZone || "Europe/Amsterdam"
) {
  const guests = getGuestCount(candidate.guests);
  const singleTable = getAvailableReservationTable({ ...candidate, guests }, tables, reservations, turnoverMinutes, timeZone);
  const mergeOption = getReservationMergeOptions({ ...candidate, guests }, tables, reservations, turnoverMinutes, timeZone)[0] || null;

  if (singleTable) {
    const detail = guests <= 2
      ? `${getTableName(singleTable)} keeps two-person parties on a two-seater first when one is free.`
      : `${getTableName(singleTable)} is the smallest available table that seats ${guests}.`;
    return {
      kind: "single",
      title: `${getTableName(singleTable)} recommended`,
      detail: mergeOption
        ? `${detail} For a joined setup, merge ${mergeOption.tables.map(getTableName).join(" + ")}.`
        : detail,
      table: singleTable,
      tables: [singleTable],
      capacity: getTableCapacity(singleTable)
    };
  }

  if (mergeOption) {
    return {
      kind: "merge",
      title: `Merge ${mergeOption.tables.map(getTableName).join(" + ")}`,
      detail: `Combined capacity ${mergeOption.capacity} for ${guests} guests. Staff can record the booking manually and note the joined setup.`,
      tables: mergeOption.tables,
      capacity: mergeOption.capacity
    };
  }

  return {
    kind: "none",
    title: "No seating recommendation",
    detail: `No available table setup seats ${guests} guests for this time.`,
    tables: [],
    capacity: 0
  };
}

export function getReservationBlockConflicts(candidate, blocks, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
  const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
  if (!candidateWindow) return [];

  return (Array.isArray(blocks) ? blocks : []).filter((block) => {
    if (block.active === false) return false;
    if (!sameReservationDate(candidate.date, block.date)) return false;
    const blockWindow = getTimeRangeWindow(block.startTime, block.endTime);
    return blockWindow && reservationWindowsOverlap(candidateWindow, blockWindow);
  });
}

export function getApplicableCapacityRules(candidate, capacityRules, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
  const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
  if (!candidateWindow) return [];

  return (Array.isArray(capacityRules) ? capacityRules : []).filter((rule) => {
    if (rule.active === false) return false;
    if (rule.date && candidate.date && rule.date !== candidate.date) return false;
    const ruleWindow = getTimeRangeWindow(rule.startTime, rule.endTime);
    return ruleWindow && reservationWindowsOverlap(candidateWindow, ruleWindow);
  });
}

export function getReservationCapacityIssue(candidate, reservations, capacityRules, turnoverMinutes = RESERVATION_TURNOVER_MINUTES) {
  const candidateWindow = getReservationWindow(candidate.time, turnoverMinutes);
  if (!candidateWindow) return null;

  const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));
  const activeReservations = reservations.filter((reservation) => {
    if (reservation.id === candidate.id || !isActiveReservationStatus(reservation.status)) return false;
    if (!sameReservationDate(candidate.date, reservation.date)) return false;
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
  if (capacityIssue) issues.push(capacityIssue.detail);
  return issues;
}

export function getReservationIssues(
  reservation,
  tables,
  reservations,
  turnoverMinutes = RESERVATION_TURNOVER_MINUTES,
  blocks = [],
  capacityRules = [],
  timeZone = reservation?.timeZone || "Europe/Amsterdam"
) {
  if (!isActiveReservationStatus(reservation.status)) return [];

  const issues = [];
  const table = tables.find((item) => item.id === reservation.tableId);

  if (!table) {
    issues.push("Needs table");
    return issues;
  }

  if (reservation.guests > table.capacity) {
    issues.push(`Over capacity by ${reservation.guests - table.capacity}`);
  }

  const conflicts = getReservationConflicts(reservation, reservations, turnoverMinutes, timeZone);
  if (conflicts.length) {
    issues.push(`Overlaps ${conflicts.map((conflict) => `${conflict.time} ${conflict.name}`).join(", ")}`);
  }

  issues.push(...getReservationPolicyIssues(reservation, reservations, blocks, capacityRules, turnoverMinutes));
  return issues;
}

export function getReservationRequestValidation(candidate, tables, reservations, blocks = [], capacityRules = [], turnoverMinutes = RESERVATION_TURNOVER_MINUTES, policy: any = {}) {
  const guests = Math.max(1, Math.floor(Number(candidate.guests) || 1));

  const policyValidation = getReservationPolicyValidation(candidate, policy);
  if (!policyValidation.ok) return policyValidation;

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
    : getAvailableReservationTable(
      candidate,
      tables,
      reservations,
      turnoverMinutes,
      policy.timeZone || candidate?.timeZone || "Europe/Amsterdam"
    );

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

export function getReservationValidation(
  candidate,
  tables,
  reservations,
  turnoverMinutes = RESERVATION_TURNOVER_MINUTES,
  blocks = [],
  capacityRules = [],
  timeZone = candidate?.timeZone || "Europe/Amsterdam"
) {
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

  const conflicts = getReservationConflicts({ ...candidate, guests }, reservations, turnoverMinutes, timeZone);
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
