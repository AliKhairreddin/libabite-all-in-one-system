import { saveState, state } from "./state.js";
export function createSessionActionsRuntime(deps) {
    const { canView, render, roleDefinition, showToast } = deps;
    function login(formData) {
        const email = String(formData.get("email") || "").trim().toLowerCase();
        const password = String(formData.get("password") || "");
        const user = state.users.find((account) => account.email === email && account.status === "Active");
        if (!user || user.password !== password) {
            showToast("Email or password is not correct.");
            return;
        }
        state.currentUserId = user.id;
        state.activeView = roleDefinition(user.role).homeView;
        saveState();
        render();
        showToast(`Logged in as ${roleDefinition(user.role).label}.`);
    }
    function logout() {
        state.currentUserId = "";
        saveState();
        render();
        showToast("Signed out.");
    }
    function setView(view) {
        if (!canView(view)) {
            showToast("That page is not available for this role.");
            return;
        }
        state.activeView = view;
        saveState();
        render();
    }
    return {
        login,
        logout,
        setView
    };
}
//# sourceMappingURL=session-actions.js.map