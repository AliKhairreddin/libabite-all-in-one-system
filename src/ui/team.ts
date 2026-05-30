import { state } from "../app/state.js";
import { DRIVER_IDLE_STATUS, ROLE_ORDER } from "../shared/constants.js";
import { formatDateTime } from "../shared/dates.js";
import { escapeHtml } from "../shared/html.js";
import {
  deliveryIsLate,
  deliveryStatusClass,
  formatDeliveryEta,
  getDeliveryLateMinutes,
  getDeliveryLocationForStatus,
  getDeliveryStatus,
  isActiveDelivery,
  isDeliveryOrder,
  isDeliveryTerminal,
  normalizePickupStatus
} from "../domain/delivery.js";

export function createTeamUi(deps) {
  const document: any = window.document;
  const {
    can,
    canManageDeliveryOperations,
    currentDriverRecord,
    currentRoleKey,
    currentUser,
    currentUserCanUpdateDelivery,
    driverById,
    emptyState,
    getOrderPaymentSummary,
    orderById,
    orderItemDetailText,
    productById,
    roleDefinition
  } = deps;

  function getDeliveryOrders() {
    return state.orders
      .filter(isDeliveryOrder)
      .slice()
      .sort((first, second) => (second.createdAtMs || 0) - (first.createdAtMs || 0));
  }
  
  function getDriverDeliveryOrders(driver) {
    if (!driver) return [];
    return getDeliveryOrders().filter((order) => order.assignedDriver === driver.id);
  }
  
  function getCurrentDriverDeliveryOrders() {
    return getDriverDeliveryOrders(currentDriverRecord())
      .filter((order) => !isDeliveryTerminal(order) && order.status !== "Cancelled");
  }
  
  function deliveryOrderItemsText(order) {
    return order.items
      .map((item) => {
        const product = productById(item.productId);
        if (!product) return null;
        const detail = orderItemDetailText(item);
        return `${item.quantity}x ${product.name}${detail ? ` (${detail})` : ""}`;
      })
      .filter(Boolean)
      .join(", ");
  }
  
  function deliveryNotesHtml(order) {
    const notes = [
      order.customerNotes ? { label: "Customer", text: order.customerNotes } : null,
      order.notes ? { label: "Order", text: order.notes } : null,
      ...(order.deliveryNotes || []).map((note) => ({
        label: `${note.authorName} ${formatDateTime(note.atMs, note.at)}`,
        text: note.text
      }))
    ].filter(Boolean);
  
    return notes.length
      ? notes.map((note) => `
        <div class="delivery-note-row">
          <span>${escapeHtml(note.label)}</span>
          <p>${escapeHtml(note.text)}</p>
        </div>
      `).join("")
      : `<p class="draft-empty">No notes added.</p>`;
  }
  
  function deliveryStatusActionsHtml(order) {
    const status = getDeliveryStatus(order) || "Assigned";
    const nextStatuses = {
      Assigned: ["At restaurant"],
      "At restaurant": ["Picked up"],
      "Picked up": ["On the way"],
      "On the way": ["Delivered", "Failed delivery"],
      "Failed delivery": ["Returned"]
    }[status] || [];
  
    return nextStatuses.map((nextStatus) => `
      <button class="mini-btn ${nextStatus === "Failed delivery" || nextStatus === "Returned" ? "danger-action" : ""}" type="button" data-delivery-status="${escapeHtml(nextStatus)}" data-delivery-order="${escapeHtml(order.id)}">
        ${escapeHtml(nextStatus === "Delivered" ? "Mark delivered" : nextStatus)}
      </button>
    `).join("");
  }
  
  function deliveryProofSummaryHtml(order) {
    const proof = order.deliveryProofPhotoName
      ? `Photo: ${order.deliveryProofPhotoName}${order.deliveryProofAtMs ? ` at ${formatDateTime(order.deliveryProofAtMs)}` : ""}`
      : "No photo proof";
    const cash = order.cashCollected
      ? `Cash collected${order.cashCollectedAtMs ? ` at ${formatDateTime(order.cashCollectedAtMs, order.cashCollectedAt)}` : ""}`
      : "No cash collection recorded";
    return `
      <div class="delivery-proof-grid">
        <div>
          <span>Delivery proof</span>
          <strong>${escapeHtml(proof)}</strong>
        </div>
        <div>
          <span>Cash</span>
          <strong>${escapeHtml(cash)}</strong>
        </div>
      </div>
    `;
  }
  
  function deliveryOrderCard(order, options: any = {}) {
    const driver = driverById(order.assignedDriver);
    const paymentSummary = getOrderPaymentSummary(order);
    const status = getDeliveryStatus(order) || (order.assignedDriver ? "Assigned" : "Unassigned");
    const pickupStatus = order.pickupStatus || normalizePickupStatus("", status);
    const late = deliveryIsLate(order);
    const items = deliveryOrderItemsText(order);
    const includeActions = Boolean(options.includeActions && currentUserCanUpdateDelivery(order));
    return `
      <article class="delivery-order-card ${late ? "is-late" : ""}">
        <header>
          <div>
            <span class="delivery-kicker">Order #${escapeHtml(order.number)}${driver ? ` | ${escapeHtml(driver.name)}` : ""}</span>
            <strong>${escapeHtml(order.customerName || order.customer || "Customer")}</strong>
            <p>${escapeHtml(order.deliveryAddress || "No address saved")}</p>
          </div>
          <div class="ticket-pills">
            <span class="pill ${deliveryStatusClass(status)}">${escapeHtml(status)}</span>
            <span class="pill ${paymentSummary.className}">${escapeHtml(paymentSummary.statusLabel)}</span>
            ${late ? `<span class="pill danger">Late</span>` : ""}
          </div>
        </header>
        <div class="delivery-detail-grid">
          <div>
            <span>Phone</span>
            <strong>${escapeHtml(order.customerPhone || "No phone")}</strong>
          </div>
          <div>
            <span>Order details</span>
            <strong>${escapeHtml(items || "No items")}</strong>
          </div>
          <div>
            <span>Pickup status</span>
            <strong>${escapeHtml(pickupStatus || "Unassigned")}</strong>
          </div>
          <div>
            <span>Delivery status</span>
            <strong>${escapeHtml(status)}</strong>
          </div>
          <div>
            <span>ETA</span>
            <strong>${escapeHtml(formatDeliveryEta(order))}</strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>${escapeHtml(`${paymentSummary.statusLabel} | ${paymentSummary.method}`)}</strong>
          </div>
        </div>
        <div class="delivery-notes">
          <span>Notes</span>
          ${deliveryNotesHtml(order)}
        </div>
        ${deliveryProofSummaryHtml(order)}
        ${includeActions ? `
          <div class="delivery-actions">
            <div class="mini-actions">${deliveryStatusActionsHtml(order)}</div>
            ${!paymentSummary.paid ? `<button class="mini-btn" type="button" data-delivery-cash="${escapeHtml(order.id)}">Mark cash collected</button>` : ""}
            <div class="delivery-action-row">
              <input type="text" data-delivery-note-input="${escapeHtml(order.id)}" placeholder="Add delivery note" aria-label="Delivery note for order #${escapeHtml(order.number)}">
              <button class="mini-btn" type="button" data-add-delivery-note="${escapeHtml(order.id)}">Add note</button>
            </div>
            <div class="delivery-action-row">
              <input type="file" accept="image/*" data-delivery-proof-input="${escapeHtml(order.id)}" aria-label="Proof photo for order #${escapeHtml(order.number)}">
              <button class="mini-btn" type="button" data-upload-delivery-proof="${escapeHtml(order.id)}">Upload photo</button>
            </div>
          </div>
        ` : ""}
      </article>
    `;
  }
  
  function renderDriverApp() {
    const panel = document.querySelector("#driverAppPanel");
    const summary = document.querySelector("#driverStatusStrip");
    const list = document.querySelector("#driverOrderList");
    if (!panel || !summary || !list) return;
  
    const isDriverRole = currentRoleKey() === "driver";
    panel.hidden = !isDriverRole;
    if (!isDriverRole) return;
  
    const driver = currentDriverRecord();
    const activeOrders = getCurrentDriverDeliveryOrders();
    const allDriverOrders = getDriverDeliveryOrders(driver);
    const completed = allDriverOrders.filter((order) => getDeliveryStatus(order) === "Delivered").length;
    const late = activeOrders.filter(deliveryIsLate).length;
    const currentStatus = driver?.status || DRIVER_IDLE_STATUS;
  
    summary.innerHTML = [
      { label: "Driver status", value: currentStatus, note: driver?.location || "Restaurant", className: currentStatus === DRIVER_IDLE_STATUS ? "ok" : "info" },
      { label: "Assigned orders", value: activeOrders.length, note: activeOrders.length ? `${late} late` : "No active delivery", className: late ? "danger" : activeOrders.length ? "info" : "ok" },
      { label: "Completed", value: completed, note: "Delivery history", className: "ok" },
      { label: "Next ETA", value: activeOrders[0] ? formatDeliveryEta(activeOrders[0]) : "-", note: activeOrders[0]?.deliveryAddress || "Waiting", className: late ? "danger" : "info" }
    ].map((card) => `
      <article class="procedure-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
      </article>
    `).join("");
  
    list.innerHTML = activeOrders.length
      ? activeOrders.map((order) => deliveryOrderCard(order, { includeActions: true })).join("")
      : emptyState(driver ? "No assigned delivery orders right now." : "No driver profile found for this account.");
  }
  
  function driverOptionHtml(order) {
    return state.drivers.map((driver) => {
      const blocked = driver.status !== DRIVER_IDLE_STATUS && driver.orderId !== order.id;
      return `<option value="${escapeHtml(driver.id)}" ${driver.id === order.assignedDriver ? "selected" : ""} ${blocked ? "disabled" : ""}>${escapeHtml(driver.name)} - ${escapeHtml(driver.status)}</option>`;
    }).join("");
  }
  
  function deliveryAssignmentCard(order) {
    const driver = driverById(order.assignedDriver);
    const status = getDeliveryStatus(order) || "Unassigned";
    return `
      <article class="delivery-assignment-card">
        <header>
          <div>
            <strong>#${escapeHtml(order.number)} ${escapeHtml(order.customerName || order.customer || "Customer")}</strong>
            <p>${escapeHtml(order.deliveryAddress || "No address")} | ${escapeHtml(deliveryOrderItemsText(order))}</p>
          </div>
          <span class="pill ${deliveryStatusClass(status)}">${escapeHtml(status)}</span>
        </header>
        <div class="delivery-assignment-controls">
          <select data-delivery-driver-select="${escapeHtml(order.id)}" aria-label="Driver for order #${escapeHtml(order.number)}">
            <option value="">Unassigned</option>
            ${driverOptionHtml(order)}
          </select>
          <button class="mini-btn" type="button" data-assign-delivery-driver="${escapeHtml(order.id)}">${driver ? "Reassign" : "Assign"}</button>
        </div>
      </article>
    `;
  }
  
  function managerDeliveryCard(order) {
    const driver = driverById(order.assignedDriver);
    const status = getDeliveryStatus(order) || "Unassigned";
    const late = deliveryIsLate(order);
    return `
      <article class="manager-delivery-card ${late ? "is-late" : ""}">
        <header>
          <div>
            <strong>#${escapeHtml(order.number)} ${escapeHtml(driver?.name || "Unassigned")}</strong>
            <p>${escapeHtml(driver?.location || getDeliveryLocationForStatus(order, status))}</p>
          </div>
          <div class="ticket-pills">
            <span class="pill ${deliveryStatusClass(status)}">${escapeHtml(status)}</span>
            <span class="pill ${late ? "danger" : "info"}">${escapeHtml(formatDeliveryEta(order))}</span>
          </div>
        </header>
        <p>${escapeHtml(order.customerName || order.customer || "Customer")} | ${escapeHtml(order.deliveryAddress || "No address")} | ${escapeHtml(order.customerPhone || "No phone")}</p>
        ${deliveryProofSummaryHtml(order)}
      </article>
    `;
  }
  
  function driverPerformanceCard(driver) {
    const orders = getDriverDeliveryOrders(driver);
    const active = orders.filter(isActiveDelivery).length;
    const delivered = orders.filter((order) => getDeliveryStatus(order) === "Delivered").length;
    const exceptions = orders.filter((order) => ["Failed delivery", "Returned"].includes(getDeliveryStatus(order))).length;
    const late = orders.filter((order) => order.deliveryWasLate || deliveryIsLate(order)).length;
    const cash = orders.filter((order) => order.cashCollected).length;
    const successRate = delivered + exceptions ? Math.round((delivered / (delivered + exceptions)) * 100) : 100;
    return `
      <article class="driver-performance-card">
        <header>
          <div>
            <strong>${escapeHtml(driver.name)}</strong>
            <p>${escapeHtml(driver.status)} | ${escapeHtml(driver.location)}</p>
          </div>
          <span class="pill ${active ? "info" : "ok"}">${active} active</span>
        </header>
        <div class="delivery-performance-grid">
          <span>Delivered</span><strong>${delivered}</strong>
          <span>Late</span><strong>${late}</strong>
          <span>Exceptions</span><strong>${exceptions}</strong>
          <span>Cash stops</span><strong>${cash}</strong>
          <span>Success rate</span><strong>${successRate}%</strong>
        </div>
      </article>
    `;
  }
  
  function renderDeliveryManager() {
    const panel = document.querySelector("#deliveryManagementPanel");
    const summary = document.querySelector("#deliveryManagerSummary");
    const assignments = document.querySelector("#deliveryAssignmentList");
    const activeList = document.querySelector("#managerDeliveryList");
    const completedList = document.querySelector("#completedDeliveryList");
    const performanceList = document.querySelector("#driverPerformanceList");
    if (!panel || !summary || !assignments || !activeList || !completedList || !performanceList) return;
  
    const visible = canManageDeliveryOperations();
    panel.hidden = !visible;
    if (!visible) return;
  
    const deliveryOrders = getDeliveryOrders();
    const activeOrders = deliveryOrders.filter((order) => order.assignedDriver && !isDeliveryTerminal(order) && order.status !== "Cancelled");
    const assignmentOrders = deliveryOrders.filter((order) => !isDeliveryTerminal(order) && order.status !== "Cancelled");
    const completedOrders = deliveryOrders.filter((order) => ["Delivered", "Returned", "Failed delivery"].includes(getDeliveryStatus(order)));
    const lateOrders = activeOrders.filter(deliveryIsLate);
  
    summary.innerHTML = [
      { label: "Active deliveries", value: activeOrders.length, note: `${state.drivers.filter((driver) => driver.status !== DRIVER_IDLE_STATUS).length} drivers busy`, className: activeOrders.length ? "info" : "ok" },
      { label: "Late deliveries", value: lateOrders.length, note: lateOrders.length ? "Needs attention" : "On track", className: lateOrders.length ? "danger" : "ok" },
      { label: "Completed", value: completedOrders.filter((order) => getDeliveryStatus(order) === "Delivered").length, note: `${completedOrders.length} total outcomes`, className: "ok" },
      { label: "Unassigned", value: assignmentOrders.filter((order) => !order.assignedDriver).length, note: "Ready for driver", className: assignmentOrders.some((order) => !order.assignedDriver) ? "warning" : "ok" }
    ].map((card) => `
      <article class="procedure-summary-card">
        <span>${escapeHtml(card.label)}</span>
        <strong>${escapeHtml(card.value)}</strong>
        <small class="${escapeHtml(card.className)}">${escapeHtml(card.note)}</small>
      </article>
    `).join("");
  
    assignments.innerHTML = assignmentOrders.length
      ? assignmentOrders.map(deliveryAssignmentCard).join("")
      : emptyState("No delivery orders are waiting for assignment.");
    activeList.innerHTML = activeOrders.length
      ? activeOrders.sort((first, second) => getDeliveryLateMinutes(second) - getDeliveryLateMinutes(first)).map(managerDeliveryCard).join("")
      : emptyState("No active deliveries.");
    completedList.innerHTML = completedOrders.length
      ? completedOrders.slice(0, 6).map(managerDeliveryCard).join("")
      : emptyState("No completed deliveries yet.");
    performanceList.innerHTML = state.drivers.length
      ? state.drivers.map(driverPerformanceCard).join("")
      : emptyState("No drivers created yet.");
  }
  
  function renderTeam() {
    const isDriverRole = currentRoleKey() === "driver";
    const user = currentUser();
    const schedulePanel = document.querySelector("#schedulePanel");
    const staffRoleSelect = document.querySelector("#staffRoleSelect");
    const userList = document.querySelector("#userList");
    const driversPanel = document.querySelector("#driversPanel");
  
    document.querySelectorAll(".admin-only").forEach((panel) => {
      panel.hidden = !can("canCreateUsers");
    });
  
    if (schedulePanel) schedulePanel.hidden = isDriverRole;
    if (driversPanel) driversPanel.classList.toggle("wide-panel", isDriverRole);
  
    if (staffRoleSelect) {
      staffRoleSelect.innerHTML = ROLE_ORDER
        .filter((role) => role !== "owner_admin")
        .map((role) => `<option value="${escapeHtml(role)}">${escapeHtml(roleDefinition(role).label)}</option>`)
        .join("");
    }
  
    if (userList) {
      userList.innerHTML = state.users
        .map((account) => `
          <article class="user-card">
            <div>
              <strong>${escapeHtml(account.name)}</strong>
              <p>${escapeHtml(account.email)}</p>
            </div>
            <span class="pill ${account.status === "Active" ? "ok" : "warning"}">${escapeHtml(roleDefinition(account.role).label)}</span>
          </article>
        `)
        .join("");
    }
  
    const staffToShow = isDriverRole ? [] : state.staff;
    document.querySelector("#staffList").innerHTML = staffToShow.length
      ? staffToShow.map((person) => {
      const late = person.clocked !== "-" && person.clocked > person.planned.slice(0, 5);
      return `
        <article class="staff-card">
          <header>
            <div>
              <strong>${escapeHtml(person.name)}</strong>
              <p>${escapeHtml(person.role)} | Planned ${escapeHtml(person.planned)}</p>
            </div>
            <span class="pill ${late ? "warning" : "ok"}">${escapeHtml(person.status)}</span>
          </header>
          <p>Clocked: ${escapeHtml(person.clocked)}</p>
        </article>
      `;
    }).join("")
      : emptyState("No staff schedule is visible for this role.");
  
    const driversToShow = isDriverRole
      ? state.drivers.filter((driver) => driver.id === user.id || driver.name.split(" ")[0] === user.name.split(" ")[0])
      : state.drivers;
  
    document.querySelector("#driverList").innerHTML = driversToShow.length
      ? driversToShow.map((driver) => {
      const order = driver.orderId ? orderById(driver.orderId) : null;
      const statusClass = driver.status === DRIVER_IDLE_STATUS ? "ok" : driver.status === "Failed delivery" ? "danger" : "info";
      return `
        <article class="driver-card">
          <header>
            <div>
              <strong>${escapeHtml(driver.name)}</strong>
              <p>${escapeHtml(driver.location)}</p>
            </div>
            <span class="pill ${statusClass}">${escapeHtml(driver.status)}</span>
          </header>
          <p>${escapeHtml(order ? `Order #${order.number} | ETA ${formatDeliveryEta(order)}` : "Ready for next delivery.")}</p>
        </article>
      `;
    }).join("")
      : emptyState("No driver profile found for this account.");
  
    renderDriverApp();
    renderDeliveryManager();
  }
  
  return {
    getCurrentDriverDeliveryOrders,
    getDeliveryOrders,
    getDriverDeliveryOrders,
    renderDeliveryManager,
    renderDriverApp,
    renderTeam
  };
}
