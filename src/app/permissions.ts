import { saveState, state } from "./state.js";
import { views } from "./views.js";
import { KITCHEN_STATIONS, ROLE_DEFINITIONS } from "../shared/constants.js";
import { normalizeKitchenStation } from "../data/normalize.js";
import { toDateInputString } from "../domain/scheduling.js";
import {
  canView as canViewFromList,
  getCurrentRoleKey,
  getCurrentUser,
  roleCan,
  roleDefinition as getRoleDefinition,
  visibleViewsForRole
} from "../domain/users.js";

const MANAGEMENT_ROLES = new Set(["owner_admin", "manager"]);
const NON_KITCHEN_STATIONS = new Set(["All", "Restaurant floor", "Cashier", "Delivery", "Cleaning"]);

export function roleDefinition(role) {
  return getRoleDefinition(role, ROLE_DEFINITIONS);
}

export function currentUser() {
  return getCurrentUser(state.users, state.currentUserId);
}

export function currentRoleKey() {
  return getCurrentRoleKey(currentUser());
}

export function currentRole() {
  return roleDefinition(currentRoleKey());
}

export function can(permission) {
  return Boolean(currentUser() && roleCan(currentRole(), permission));
}

export function isManagementRole(role = currentRoleKey()) {
  return MANAGEMENT_ROLES.has(role);
}

export function canManageKitchenScreens() {
  return isManagementRole();
}

function kitchenStationOrBlank(value) {
  const station = normalizeKitchenStation(value);
  if (!String(value || "").trim() || NON_KITCHEN_STATIONS.has(station)) return "";
  return station;
}

function assignedKitchenStationFromShift(user) {
  if (!user) return "";
  const today = toDateInputString();
  const kitchenShifts = (state.staffShifts || [])
    .filter((shift) => shift.staffId === user.id)
    .map((shift) => ({
      ...shift,
      station: kitchenStationOrBlank(shift.station)
    }))
    .filter((shift) => shift.station && (shift.role === "Kitchen" || KITCHEN_STATIONS.includes(shift.station)));
  const activeShift = kitchenShifts.find((shift) => shift.clockInAtMs && !shift.clockOutAtMs);
  if (activeShift) return activeShift.station;
  const todayShift = kitchenShifts.find((shift) => shift.date === today);
  return todayShift?.station || "";
}

export function currentKitchenStation() {
  const user = currentUser();
  if (user?.role !== "kitchen_staff") return "";
  return kitchenStationOrBlank(user.station || user.kitchenStation)
    || assignedKitchenStationFromShift(user)
    || kitchenStationOrBlank(state.activeStation)
    || "Main kitchen";
}

export function canUseKitchenStation(station) {
  if (canManageKitchenScreens()) return true;
  const scopedStation = currentKitchenStation();
  return Boolean(scopedStation && normalizeKitchenStation(station) === scopedStation);
}

export function canUpdateKitchenTicket(ticket) {
  return Boolean(ticket && can("canAdvanceTickets") && canUseKitchenStation(ticket.station));
}

export function visibleViews() {
  const user = currentUser();
  if (!user) return [];
  return visibleViewsForRole(views, currentRole());
}

export function canView(viewId) {
  return canViewFromList(visibleViews(), viewId);
}

export function ensureActiveViewAccess() {
  if (!currentUser()) return;
  if (canView(state.activeView)) return;
  state.activeView = currentRole().homeView;
  if (!canView(state.activeView)) state.activeView = visibleViews()[0]?.id || "dashboard";
  saveState();
}
