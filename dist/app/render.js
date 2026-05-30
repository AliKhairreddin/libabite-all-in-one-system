import { state } from "./state.js";
import { ROLE_ORDER } from "../shared/constants.js";
import { escapeHtml } from "../shared/html.js";
export function createAppRenderer(deps) {
    const document = window.document;
    const { can, createNode, currentUser, ensureActiveViewAccess, getCurrentUserProcedures, getCustomerOrderingSession, getLowStockIngredients, getOpenTickets, isActiveDelivery, procedurePeriodStatus, renderCustomerQrScreen, renderDashboard, renderInventory, renderKitchen, renderMetrics, renderOrderBuilder, renderOrders, renderProductManagement, renderProductsInSelects, renderProcedures, renderReservationPlanner, renderReservations, renderSettings, renderTeam, renderWasteTracking, renderWebsiteOrderScreen, roleDefinition, visibleViews } = deps;
    function renderAuthShell() {
        const user = currentUser();
        const customerSession = getCustomerOrderingSession();
        const loginScreen = document.querySelector("#loginScreen");
        const appShell = document.querySelector(".app-shell");
        const customerScreen = document.querySelector("#customerQrScreen");
        const loginForm = document.querySelector("#loginForm");
        const currentUserName = document.querySelector("#currentUserName");
        const currentUserRole = document.querySelector("#currentUserRole");
        const quickOrderButton = document.querySelector("#quickOrderBtn");
        const resetDemoButton = document.querySelector("#resetDemoBtn");
        renderDemoLogins();
        document.body.classList.toggle("is-authenticated", Boolean(user) && !customerSession);
        document.body.classList.toggle("is-customer-ordering", Boolean(customerSession));
        customerScreen.hidden = !customerSession;
        loginScreen.classList.toggle("is-hidden", Boolean(user) || Boolean(customerSession));
        appShell.classList.toggle("is-hidden", !user || Boolean(customerSession));
        if (loginForm && !user && !customerSession) {
            loginForm.elements.email.value = loginForm.elements.email.value || "owner@libabite.nl";
            loginForm.elements.password.value = loginForm.elements.password.value || "admin123";
        }
        if (!user || customerSession)
            return;
        currentUserName.textContent = user.name;
        currentUserRole.textContent = roleDefinition(user.role).label;
        quickOrderButton.hidden = !can("canCreateOrders");
        resetDemoButton.hidden = !can("canResetDemo");
    }
    function renderDemoLogins() {
        const container = document.querySelector("#demoLogins");
        if (!container)
            return;
        container.innerHTML = ROLE_ORDER
            .map((role) => {
            const user = state.users.find((account) => account.role === role && account.status === "Active");
            if (!user)
                return "";
            return `
          <button class="demo-login" type="button" data-demo-login="${escapeHtml(user.email)}" data-demo-password="${escapeHtml(user.password)}">
            <strong>${escapeHtml(roleDefinition(role).label)}</strong>
            <span>${escapeHtml(user.email)}</span>
          </button>
        `;
        })
            .join("");
    }
    function render() {
        renderAuthShell();
        const customerSession = getCustomerOrderingSession();
        if (customerSession?.mode === "qr") {
            renderCustomerQrScreen();
            return;
        }
        if (customerSession?.mode === "website") {
            renderWebsiteOrderScreen();
            return;
        }
        if (!currentUser())
            return;
        ensureActiveViewAccess();
        renderNav();
        renderProductsInSelects();
        renderOrderBuilder();
        renderMetrics();
        renderDashboard();
        renderOrders();
        renderKitchen();
        renderProductManagement();
        renderInventory();
        renderWasteTracking();
        renderProcedures();
        renderTeam();
        renderSettings();
        renderReservationPlanner();
        renderReservations();
        updateView();
    }
    function renderNav() {
        const navList = document.querySelector("#navList");
        const counts = {
            orders: state.orders.filter((order) => order.status !== "Paid" && order.status !== "Cancelled").length,
            kitchen: getOpenTickets().length,
            inventory: getLowStockIngredients().length,
            procedures: getCurrentUserProcedures().filter((procedure) => procedurePeriodStatus(procedure).status !== "Completed").length,
            team: state.orders.filter(isActiveDelivery).length,
            reservations: state.reservations.length
        };
        navList.innerHTML = "";
        visibleViews().forEach((view) => {
            const button = createNode(`
        <button class="nav-item ${state.activeView === view.id ? "is-active" : ""}" type="button" data-view="${escapeHtml(view.id)}">
          <span class="nav-icon" aria-hidden="true">${escapeHtml(view.icon)}</span>
          <span>${escapeHtml(view.label)}</span>
          ${counts[view.id] ? `<span class="nav-count">${counts[view.id]}</span>` : ""}
        </button>
      `);
            navList.append(button);
        });
    }
    function updateView() {
        document.querySelectorAll(".view").forEach((view) => {
            view.classList.toggle("is-active", view.id === `view-${state.activeView}`);
        });
        const currentView = document.querySelector(`#view-${state.activeView}`);
        document.querySelector("#viewTitle").textContent = currentView?.dataset.title || "Dashboard";
        document.querySelectorAll(".nav-item").forEach((item) => {
            item.classList.toggle("is-active", item.dataset.view === state.activeView);
        });
    }
    return {
        render,
        renderNav,
        updateView
    };
}
//# sourceMappingURL=render.js.map