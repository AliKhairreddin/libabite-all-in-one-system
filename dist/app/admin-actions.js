import { DEFAULT_RESTAURANT_SETTINGS, LANGUAGE_OPTIONS, ROLE_DEFINITIONS } from "../shared/constants.js";
import { normalizeRestaurantSettings } from "../data/normalize.js";
import { uniqueRecordId } from "../shared/ids.js";
import { saveState, state } from "./state.js";
export function createAdminActionsRuntime(deps) {
    const { can, render, roleDefinition, showToast } = deps;
    function createStaffUser(formData) {
        if (!can("canCreateUsers")) {
            showToast("Only Owner/Admin can create staff users.");
            return;
        }
        const name = String(formData.get("name") || "").trim();
        const email = String(formData.get("email") || "").trim().toLowerCase();
        const role = String(formData.get("role") || "");
        const password = String(formData.get("password") || "").trim();
        const planned = String(formData.get("planned") || "12:00-20:00").trim();
        if (!name || !email || !ROLE_DEFINITIONS[role] || role === "owner_admin" || password.length < 4) {
            showToast("Add a name, email, staff role, and password of at least 4 characters.");
            return;
        }
        if (state.users.some((user) => user.email === email)) {
            showToast("A user with that email already exists.");
            return;
        }
        const id = uniqueRecordId(email.split("@")[0], [state.users, state.staff, state.drivers]);
        const roleInfo = roleDefinition(role);
        state.users.push({ id, name, email, role, password, status: "Active" });
        state.staff.push({
            id,
            name,
            role: roleInfo.operationalRole,
            planned,
            clocked: "-",
            status: "Starts soon"
        });
        if (role === "driver") {
            state.drivers.push({
                id,
                name,
                status: "Available",
                eta: "-",
                orderId: null,
                location: "Restaurant"
            });
        }
        saveState();
        render();
        showToast(`${name} can now log in as ${roleInfo.label}.`);
    }
    function saveRestaurantSettings(formData) {
        if (!can("canEditSettings")) {
            showToast("This role cannot edit restaurant settings.");
            return;
        }
        const defaultLanguage = String(formData.get("defaultLanguage") || DEFAULT_RESTAURANT_SETTINGS.defaultLanguage);
        const supportedLanguages = formData.getAll("supportedLanguages").filter((language) => {
            return LANGUAGE_OPTIONS.some((option) => option.id === language);
        });
        if (!supportedLanguages.includes(defaultLanguage))
            supportedLanguages.push(defaultLanguage);
        state.restaurantSettings = normalizeRestaurantSettings({
            restaurantName: String(formData.get("restaurantName") || "").trim(),
            location: String(formData.get("location") || "").trim(),
            currency: "EUR",
            opensAt: String(formData.get("opensAt") || ""),
            closesAt: String(formData.get("closesAt") || ""),
            defaultLanguage,
            supportedLanguages
        });
        saveState();
        render();
        showToast("Restaurant settings saved.");
    }
    return {
        createStaffUser,
        saveRestaurantSettings
    };
}
//# sourceMappingURL=admin-actions.js.map