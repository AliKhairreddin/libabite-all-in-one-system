import { MINUTE_MS } from "../shared/constants.js";
export function procedureStatusClass(status) {
    if (status === "Done" || status === "Completed")
        return "ok";
    if (status === "Problem")
        return "danger";
    if (status === "Skipped" || status === "Missed")
        return "warning";
    return "info";
}
export function procedureFrequencyWindowMs(frequency) {
    if (frequency === "Weekly")
        return 7 * 24 * 60 * MINUTE_MS;
    if (frequency === "Monthly")
        return 31 * 24 * 60 * MINUTE_MS;
    if (frequency === "Per shift")
        return 12 * 60 * MINUTE_MS;
    return 24 * 60 * MINUTE_MS;
}
export function procedureAssignmentAliases(user, roleDefinition) {
    const aliases = new Set(["All staff"]);
    if (!user)
        return aliases;
    const roleInfo = roleDefinition(user.role);
    aliases.add(roleInfo.operationalRole);
    aliases.add(roleInfo.label);
    if (user.role === "owner_admin")
        aliases.add("Owner/Admin");
    if (user.role === "manager")
        aliases.add("Manager");
    if (user.role === "waiter_cashier") {
        aliases.add("Front");
        aliases.add("Cashier");
    }
    if (user.role === "kitchen_staff")
        aliases.add("Kitchen");
    if (user.role === "driver")
        aliases.add("Driver");
    return aliases;
}
export function procedureAssignedToUser(procedure, user, options) {
    if (!user)
        return false;
    if (options.canReviewProcedures)
        return true;
    return procedureAssignmentAliases(user, options.roleDefinition).has(procedure.assignedRole);
}
//# sourceMappingURL=procedures.js.map