import { SCHEDULE_ROLES, SCHEDULE_STATIONS } from "../shared/constants.js";
import { timeNow } from "../shared/dates.js";
import { uniqueRecordId } from "../shared/ids.js";
import {
  addDays,
  getShiftAttendanceStatus,
  getWeekStartDate,
  isShiftTime,
  normalizeScheduleRole,
  normalizeScheduleStation,
  normalizeShiftDate,
  sortShiftsByDateTime,
  toDateInputString
} from "../domain/scheduling.js";
import { saveState, state } from "./state.js";

export function createSchedulingRuntime(deps) {
  const {
    can,
    currentRoleKey,
    currentUser,
    render,
    roleDefinition,
    showToast
  } = deps;

  function canManageSchedule() {
    return Boolean(can("canManageSchedule") || ["owner_admin", "manager"].includes(currentRoleKey()));
  }

  function shiftById(shiftId) {
    return state.staffShifts.find((shift) => shift.id === shiftId);
  }

  function staffUserById(staffId) {
    return state.users.find((user) => user.id === staffId && user.status === "Active");
  }

  function canUseShiftClock(shift) {
    const user = currentUser();
    return Boolean(shift && user && (shift.staffId === user.id || canManageSchedule()));
  }

  function defaultScheduleRoleForUser(user) {
    const operationalRole = roleDefinition(user?.role).operationalRole || "Front";
    return operationalRole === "Owner/Admin" ? "Manager" : operationalRole;
  }

  function defaultScheduleStationForRole(role) {
    if (role === "Driver") return "Delivery";
    if (role === "Kitchen") return "Main kitchen";
    if (role === "Cashier") return "Cashier";
    if (role === "Grill") return "Grill station";
    if (role === "Sweets") return "Sweets station";
    if (role === "Packaging") return "Packaging station";
    return "Restaurant floor";
  }

  function createStaffShift(formData) {
    if (!canManageSchedule()) {
      showToast("Only managers can create or edit shifts.");
      return;
    }

    const shiftId = String(formData.get("shiftId") || "").trim();
    const staff = staffUserById(String(formData.get("staffId") || "").trim());
    const fallbackRole = defaultScheduleRoleForUser(staff);
    const role = normalizeScheduleRole(formData.get("role"), fallbackRole);
    const station = normalizeScheduleStation(formData.get("station"), defaultScheduleStationForRole(role));
    const date = normalizeShiftDate(formData.get("date"), toDateInputString());
    const startTime = String(formData.get("startTime") || "").trim();
    const endTime = String(formData.get("endTime") || "").trim();
    const notes = String(formData.get("notes") || "").replace(/\s+/g, " ").trim();

    if (!staff || !isShiftTime(startTime) || !isShiftTime(endTime) || !SCHEDULE_ROLES.includes(role) || !SCHEDULE_STATIONS.includes(station)) {
      showToast("Choose staff, role, station, and valid start/end times.");
      return;
    }

    const existingShift = shiftById(shiftId);
    const now = Date.now();
    if (existingShift) {
      const staffChanged = existingShift.staffId !== staff.id;
      Object.assign(existingShift, {
        staffId: staff.id,
        staffName: staff.name,
        role,
        station,
        date,
        startTime,
        endTime,
        notes,
        updatedAtMs: now
      });
      if (staffChanged) {
        Object.assign(existingShift, {
          notifiedAtMs: "",
          notifiedAt: "",
          clockInAtMs: "",
          clockInAt: "",
          clockOutAtMs: "",
          clockOutAt: "",
          breakStartedAtMs: "",
          breakStartedAt: "",
          breakMinutes: 0,
          status: "Scheduled"
        });
      }
      state.staffShifts = sortShiftsByDateTime(state.staffShifts);
      cancelStaffShiftEdit();
      saveState();
      render();
      showToast(`${staff.name}'s shift updated.`);
      return;
    }

    state.staffShifts.push({
      id: uniqueRecordId(`shift-${date}-${staff.id}-${startTime}`, [state.staffShifts], "shift"),
      staffId: staff.id,
      staffName: staff.name,
      role,
      station,
      date,
      startTime,
      endTime,
      notifiedAtMs: "",
      notifiedAt: "",
      clockInAtMs: "",
      clockInAt: "",
      clockOutAtMs: "",
      clockOutAt: "",
      breakStartedAtMs: "",
      breakStartedAt: "",
      breakMinutes: 0,
      status: "Scheduled",
      notes,
      createdAtMs: now,
      updatedAtMs: now
    });
    state.staffShifts = sortShiftsByDateTime(state.staffShifts);
    cancelStaffShiftEdit();
    saveState();
    render();
    showToast(`${staff.name}'s shift was added to the schedule.`);
  }

  function selectStaffShiftForEdit(shiftId) {
    if (!canManageSchedule()) {
      showToast("Only managers can edit shifts.");
      return;
    }

    const shift = shiftById(shiftId);
    const form = document.querySelector("#shiftForm") as HTMLFormElement | null;
    if (!shift || !form) {
      showToast("Choose a shift to edit.");
      return;
    }

    const elements: any = form.elements;
    elements.shiftId.value = shift.id;
    elements.staffId.value = shift.staffId;
    elements.role.value = shift.role;
    elements.station.value = shift.station;
    elements.date.value = shift.date;
    elements.startTime.value = shift.startTime;
    elements.endTime.value = shift.endTime;
    elements.notes.value = shift.notes || "";
    const submitButton = form.querySelector("[data-shift-submit-label]");
    if (submitButton) submitButton.textContent = "Save Shift";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelStaffShiftEdit() {
    const form = document.querySelector("#shiftForm") as HTMLFormElement | null;
    if (!form) return;
    form.reset();
    const elements: any = form.elements;
    elements.shiftId.value = "";
    if (elements.role) elements.role.value = "Front";
    if (elements.station) elements.station.value = "Restaurant floor";
    elements.date.value = toDateInputString();
    elements.startTime.value = "12:00";
    elements.endTime.value = "20:00";
    if (elements.notes) elements.notes.value = "";
    const submitButton = form.querySelector("[data-shift-submit-label]");
    if (submitButton) submitButton.textContent = "Create Shift";
  }

  function notifyStaffShift(shiftId) {
    if (!canManageSchedule()) {
      showToast("Only managers can notify staff.");
      return;
    }

    const shift = shiftById(shiftId);
    if (!shift) {
      showToast("Choose a shift to notify.");
      return;
    }

    shift.notifiedAtMs = Date.now();
    shift.notifiedAt = timeNow();
    if (!shift.clockInAtMs) shift.status = "Notified";
    saveState();
    render();
    showToast(`${shift.staffName} notified for ${shift.date} ${shift.startTime}.`);
  }

  function moveScheduleWeek(direction) {
    if (!canManageSchedule()) return;
    const currentWeekStart = getWeekStartDate(state.scheduleWeekStart || toDateInputString());
    if (direction === "previous") state.scheduleWeekStart = addDays(currentWeekStart, -7);
    else if (direction === "next") state.scheduleWeekStart = addDays(currentWeekStart, 7);
    else state.scheduleWeekStart = getWeekStartDate(toDateInputString());
    saveState();
    render();
  }

  function clockInShift(shiftId) {
    const shift = shiftById(shiftId);
    if (!canUseShiftClock(shift)) {
      showToast("This shift is not available for your time clock.");
      return;
    }
    if (shift.clockInAtMs) {
      showToast(`${shift.staffName} is already clocked in.`);
      return;
    }

    shift.clockInAtMs = Date.now();
    shift.clockInAt = timeNow();
    shift.status = getShiftAttendanceStatus(shift);
    saveState();
    render();
    showToast(`${shift.staffName} clocked in.`);
  }

  function clockOutShift(shiftId) {
    const shift = shiftById(shiftId);
    if (!canUseShiftClock(shift)) {
      showToast("This shift is not available for your time clock.");
      return;
    }
    if (!shift.clockInAtMs || shift.clockOutAtMs) {
      showToast("Clock in before clocking out.");
      return;
    }

    const now = Date.now();
    if (shift.breakStartedAtMs) {
      shift.breakMinutes = Math.max(0, Math.round(Number(shift.breakMinutes) || 0) + Math.round((now - shift.breakStartedAtMs) / 60000));
      shift.breakStartedAtMs = "";
      shift.breakStartedAt = "";
    }
    shift.clockOutAtMs = now;
    shift.clockOutAt = timeNow();
    shift.status = getShiftAttendanceStatus(shift, now);
    saveState();
    render();
    showToast(`${shift.staffName} clocked out.`);
  }

  function startShiftBreak(shiftId) {
    const shift = shiftById(shiftId);
    if (!canUseShiftClock(shift) || !shift.clockInAtMs || shift.clockOutAtMs) {
      showToast("Breaks can only be started during an active shift.");
      return;
    }
    if (shift.breakStartedAtMs) {
      showToast("Break is already running.");
      return;
    }

    shift.breakStartedAtMs = Date.now();
    shift.breakStartedAt = timeNow();
    shift.status = "On break";
    saveState();
    render();
    showToast("Break started.");
  }

  function endShiftBreak(shiftId) {
    const shift = shiftById(shiftId);
    if (!canUseShiftClock(shift) || !shift.breakStartedAtMs) {
      showToast("No active break found for this shift.");
      return;
    }

    const now = Date.now();
    shift.breakMinutes = Math.max(0, Math.round(Number(shift.breakMinutes) || 0) + Math.round((now - shift.breakStartedAtMs) / 60000));
    shift.breakStartedAtMs = "";
    shift.breakStartedAt = "";
    shift.status = getShiftAttendanceStatus(shift, now);
    saveState();
    render();
    showToast("Break ended.");
  }

  return {
    canManageSchedule,
    cancelStaffShiftEdit,
    clockInShift,
    clockOutShift,
    createStaffShift,
    endShiftBreak,
    moveScheduleWeek,
    notifyStaffShift,
    selectStaffShiftForEdit,
    startShiftBreak
  };
}
