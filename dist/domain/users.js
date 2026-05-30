export function roleDefinition(role, roleDefinitions, fallbackRole = "waiter_cashier") {
    return roleDefinitions[role] || roleDefinitions[fallbackRole];
}
export function getCurrentUser(users, currentUserId) {
    return users.find((user) => user.id === currentUserId && user.status === "Active") || null;
}
export function getCurrentRoleKey(user) {
    return user?.role || "";
}
export function roleCan(role, permission) {
    return Boolean(role && role[permission]);
}
export function visibleViewsForRole(views, role) {
    const allowedViews = new Set(role?.views || []);
    return views.filter((view) => allowedViews.has(view.id));
}
export function canView(views, viewId) {
    return views.some((view) => view.id === viewId);
}
//# sourceMappingURL=users.js.map