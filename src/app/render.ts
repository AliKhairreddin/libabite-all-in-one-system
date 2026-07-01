import { state } from "./state.js";
import { ROLE_ORDER } from "../shared/constants.js";
import { escapeHtml } from "../shared/html.js";

const NAV_ICONS = {
  dashboard: `
    <svg viewBox="0 0 24 24" focusable="false">
      <rect x="3" y="3" width="7" height="8" rx="1.5"></rect>
      <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
      <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
      <rect x="3" y="15" width="7" height="6" rx="1.5"></rect>
    </svg>
  `,
  orders: `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2-2-1.35V5a2 2 0 0 1 2-2Z"></path>
      <path d="M9 8h6"></path>
      <path d="M9 12h6"></path>
      <path d="M9 16h4"></path>
    </svg>
  `,
  kitchen: `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M7 3v8"></path>
      <path d="M4 3v5a3 3 0 0 0 6 0V3"></path>
      <path d="M7 11v10"></path>
      <path d="M17 3v18"></path>
      <path d="M17 3a4 4 0 0 1 4 4v3h-4"></path>
    </svg>
  `,
  inventory: `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M12 3 4 7.2v9.6L12 21l8-4.2V7.2L12 3Z"></path>
      <path d="m4.5 7.5 7.5 4 7.5-4"></path>
      <path d="M12 11.5V21"></path>
      <path d="m8.25 5.25 7.5 4"></path>
    </svg>
  `,
  procedures: `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M9 5h6"></path>
      <path d="M9 3h6v4H9z"></path>
      <path d="M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1"></path>
      <path d="m8 14 2.4 2.4L16 11"></path>
    </svg>
  `,
  team: `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M16 21v-2a4 4 0 0 0-8 0v2"></path>
      <circle cx="12" cy="8" r="3.5"></circle>
      <path d="M20.5 21v-1.5a3.5 3.5 0 0 0-3-3.45"></path>
      <path d="M17 4.5a3 3 0 0 1 0 6"></path>
      <path d="M3.5 21v-1.5a3.5 3.5 0 0 1 3-3.45"></path>
      <path d="M7 4.5a3 3 0 0 0 0 6"></path>
    </svg>
  `,
  settings: `
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M4 7h9"></path>
      <path d="M17 7h3"></path>
      <circle cx="15" cy="7" r="2"></circle>
      <path d="M4 17h3"></path>
      <path d="M11 17h9"></path>
      <circle cx="9" cy="17" r="2"></circle>
    </svg>
  `,
  reservations: `
    <svg viewBox="0 0 24 24" focusable="false">
      <rect x="4" y="5" width="16" height="15" rx="2"></rect>
      <path d="M8 3v4"></path>
      <path d="M16 3v4"></path>
      <path d="M4 10h16"></path>
      <path d="M8 14h.01"></path>
      <path d="M12 14h.01"></path>
      <path d="M16 14h.01"></path>
      <path d="M8 17h.01"></path>
      <path d="M12 17h.01"></path>
    </svg>
  `
};

const SIDEBAR_COLLAPSED_KEY = "libabite-sidebar-collapsed";

function getStoredSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function createAppRenderer(deps) {
  const document: any = window.document;
  const {
    can,
    createNode,
    currentUser,
    ensureActiveViewAccess,
    getCurrentUserProcedures,
    getCustomerOrderingSession,
    getWebsiteOrderingUrl,
    getWebsiteReservationUrl,
    getLowStockIngredients,
    getOpenTickets,
    getOpenTicketsForCurrentUser,
    isActiveDelivery,
    procedurePeriodStatus,
    renderCustomerQrScreen,
    renderDashboard,
    renderExternalDeliveryIntegrations,
    renderInventory,
    renderKitchen,
    renderMetrics,
    renderOrderBuilder,
    renderOrders,
    renderProductManagement,
    renderProductsInSelects,
    renderProcedures,
    renderPublicHomeScreen,
    renderReservationPlanner,
    renderReservations,
    renderSettings,
    renderTeam,
    renderWasteTracking,
    renderWebsiteOrderScreen,
    renderWebsiteReservationScreen,
    roleDefinition,
    visibleViews
  } = deps;

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
    const sidebarToggle = document.querySelector("#sidebarToggle");
    const publicOrderLink = document.querySelector('[data-public-link="order"]');
    const publicReservationLink = document.querySelector('[data-public-link="reservation"]');
    const isDriverApp = Boolean(user) && user?.role === "driver" && !customerSession;
    const isKitchenStationApp = Boolean(user) && user?.role === "kitchen_staff" && !customerSession;
    const sidebarCollapsed = Boolean(user) && !isDriverApp && !isKitchenStationApp && getStoredSidebarCollapsed();
  
    renderDemoLogins();
    if (publicOrderLink) publicOrderLink.href = getWebsiteOrderingUrl();
    if (publicReservationLink) publicReservationLink.href = getWebsiteReservationUrl();
    document.body.classList.toggle("is-authenticated", Boolean(user) && !customerSession);
    document.body.classList.toggle("is-customer-ordering", Boolean(customerSession));
    document.body.classList.toggle("is-driver-app", isDriverApp);
    document.body.classList.toggle("is-kitchen-station-app", isKitchenStationApp);
    document.body.classList.toggle("is-sidebar-collapsed", sidebarCollapsed);
    customerScreen.hidden = !customerSession;
    loginScreen.classList.toggle("is-hidden", Boolean(user) || Boolean(customerSession));
    appShell.classList.toggle("is-hidden", !user || Boolean(customerSession));
    if (sidebarToggle) {
      sidebarToggle.hidden = isDriverApp || isKitchenStationApp || !user || Boolean(customerSession);
      sidebarToggle.setAttribute("aria-label", sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
      sidebarToggle.setAttribute("title", sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
    }
  
    if (loginForm && !user && !customerSession) {
      loginForm.elements.email.value = loginForm.elements.email.value || "owner@libabite.nl";
      loginForm.elements.password.value = loginForm.elements.password.value || "admin123";
    }
  
    if (!user || customerSession) return;
  
    currentUserName.textContent = user.name;
    currentUserRole.textContent = roleDefinition(user.role).label;
    quickOrderButton.hidden = !can("canCreateOrders");
    resetDemoButton.hidden = !can("canResetDemo");
  }
  
  function renderDemoLogins() {
    const container = document.querySelector("#demoLogins");
    if (!container) return;
  
    container.innerHTML = state.users
      .filter((account) => account.status === "Active")
      .slice()
      .sort((first, second) => {
        const firstRoleIndex = ROLE_ORDER.indexOf(first.role);
        const secondRoleIndex = ROLE_ORDER.indexOf(second.role);
        return (firstRoleIndex === -1 ? ROLE_ORDER.length : firstRoleIndex)
          - (secondRoleIndex === -1 ? ROLE_ORDER.length : secondRoleIndex)
          || first.name.localeCompare(second.name);
      })
      .map((user) => {
        return `
          <button class="demo-login" type="button" data-demo-login="${escapeHtml(user.email)}" data-demo-password="${escapeHtml(user.password)}">
            <strong>${escapeHtml(roleDefinition(user.role).label)} - ${escapeHtml(user.name)}</strong>
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
    if (customerSession?.mode === "public") {
      renderPublicHomeScreen();
      return;
    }
    if (customerSession?.mode === "website") {
      renderWebsiteOrderScreen();
      return;
    }
    if (customerSession?.mode === "reservation") {
      renderWebsiteReservationScreen();
      return;
    }
    if (!currentUser()) return;
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
    renderExternalDeliveryIntegrations();
    renderReservationPlanner();
    renderReservations();
    updateView();
  }
  
  function renderNav() {
    const navList = document.querySelector("#navList");
    const user = currentUser();
    const canSeeDeliveryOperations = ["owner_admin", "manager"].includes(user?.role);
    const counts = {
      orders: state.orders.filter((order) => order.status !== "Paid" && order.status !== "Cancelled").length,
      kitchen: getOpenTicketsForCurrentUser?.().length ?? getOpenTickets().length,
      inventory: getLowStockIngredients().length,
      procedures: getCurrentUserProcedures().filter((procedure) => procedurePeriodStatus(procedure).status !== "Completed").length,
      team: canSeeDeliveryOperations ? state.orders.filter(isActiveDelivery).length : 0,
      reservations: state.reservations.length
    };
  
    navList.innerHTML = "";
    visibleViews().forEach((view) => {
      const label = user?.role === "driver" && view.id === "team" ? "Delivery" : view.label;
      const button = createNode(`
        <button class="nav-item ${state.activeView === view.id ? "is-active" : ""}" type="button" data-view="${escapeHtml(view.id)}">
          <span class="nav-icon" aria-hidden="true">${NAV_ICONS[view.icon] || NAV_ICONS[view.id] || ""}</span>
          <span>${escapeHtml(label)}</span>
          ${counts[view.id] ? `<span class="nav-count">${counts[view.id]}</span>` : ""}
        </button>
      `);
      navList.append(button);
    });
  }
  
  function updateView() {
    const allowedViewIds = new Set(visibleViews().map((view) => view.id));
    document.querySelectorAll(".view").forEach((view) => {
      const viewId = view.id.replace(/^view-/, "");
      const active = allowedViewIds.has(viewId) && view.id === `view-${state.activeView}`;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
      view.setAttribute("aria-hidden", active ? "false" : "true");
    });
    const currentView = document.querySelector(`#view-${state.activeView}`);
    const user = currentUser();
    const scopedTitle = user?.role === "driver" && state.activeView === "team"
      ? "My Deliveries"
      : user?.role === "kitchen_staff" && state.activeView === "kitchen"
        ? "Kitchen Station"
        : "";
    document.querySelector("#viewTitle").textContent = scopedTitle || currentView?.dataset.title || "Dashboard";
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
