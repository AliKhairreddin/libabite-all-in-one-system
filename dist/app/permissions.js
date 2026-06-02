import { saveState, state } from "./state.js";
import { views } from "./views.js";
import { ROLE_DEFINITIONS } from "../shared/constants.js";
import { canView as canViewFromList, getCurrentRoleKey, getCurrentUser, roleCan, roleDefinition as getRoleDefinition, visibleViewsForRole } from "../domain/users.js";
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
export function visibleViews() {
    const user = currentUser();
    if (!user)
        return [];
    return visibleViewsForRole(views, currentRole());
}
export function canView(viewId) {
    return canViewFromList(visibleViews(), viewId);
}
export function ensureActiveViewAccess() {
    if (!currentUser())
        return;
    if (canView(state.activeView))
        return;
    state.activeView = currentRole().homeView;
    if (!canView(state.activeView))
        state.activeView = visibleViews()[0]?.id || "dashboard";
    saveState();
}
//# sourceMappingURL=permissions.js.map