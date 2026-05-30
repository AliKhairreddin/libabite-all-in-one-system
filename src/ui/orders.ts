import { state } from "../app/state.js";
import { escapeHtml } from "../shared/html.js";

export function createOrdersUi(deps) {
  const {
    can,
    emptyState,
    formatDateTime,
    fulfillmentLabel,
    getOrderFulfillmentMeta,
    getOrderPaidByName,
    getOrderPaymentSummary,
    getOrderStaffName,
    getOrderSubtotalExcludingVat,
    getOrderTotal,
    getOrderVatBreakdown,
    getVatLabel,
    isOrderPaid,
    money,
    orderById,
    orderCard,
    orderItemDetailText,
    orderLocationLabel,
    orderStatusClass,
    orderTypeDefinition,
    orderTypeLabel,
    paymentCaptureHtml,
    productById
  } = deps;

  function renderOrders() {
    const filtered = state.orderFilter === "All"
      ? state.orders
      : state.orderFilter === "Dine-in"
        ? state.orders.filter((order) => orderTypeDefinition(order.channel).requiresTable)
        : state.orderFilter === "Kitchen"
          ? state.orders.filter((order) => ["Sent to kitchen", "Preparing", "Delayed", "Ready"].includes(order.status))
          : state.orderFilter === "Paid"
            ? state.orders.filter((order) => isOrderPaid(order))
            : state.orderFilter === "Unpaid"
              ? state.orders.filter((order) => !isOrderPaid(order) && order.status !== "Cancelled")
              : state.orders.filter((order) => order.fulfillment === state.orderFilter);
    document.querySelector("#orderList").innerHTML = filtered.length
      ? filtered.slice().reverse().map(orderCard).join("")
      : emptyState("No orders match this filter.");
  
    document.querySelectorAll("[data-order-filter]").forEach((button: any) => {
      button.classList.toggle("is-selected", button.dataset.orderFilter === state.orderFilter);
    });
  
    renderReceipt();
  }
  
  function receiptLineHtml(item) {
    const product = productById(item.productId);
    if (!product) return "";
    const detail = orderItemDetailText(item);
    return `
      <div class="receipt-line">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <span>Qty ${item.quantity} x ${escapeHtml(money(product.price))}</span>
          ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
        </div>
        <span>${escapeHtml(money(product.price * item.quantity))}</span>
      </div>
    `;
  }
  
  function renderReceipt() {
    const container = document.querySelector("#receiptPreview");
    if (!container) return;
  
    const order = orderById(state.receiptOrderId) || state.orders[state.orders.length - 1];
    if (!order) {
      container.innerHTML = emptyState("Select an order to show a receipt.");
      return;
    }
  
    const settings = state.restaurantSettings;
    const paymentSummary = getOrderPaymentSummary(order);
    const vatBreakdown = getOrderVatBreakdown(order);
    const fulfillmentMeta = getOrderFulfillmentMeta(order);
    state.receiptOrderId = order.id;
    container.innerHTML = `
      <article class="receipt-card">
        <header>
          <div>
            <strong>${escapeHtml(settings.restaurantName)}</strong>
            <span>${escapeHtml(settings.location)}</span>
          </div>
          <div class="ticket-pills">
            <span class="pill ${orderStatusClass(order.status)}">${escapeHtml(order.status)}</span>
            <span class="pill ${paymentSummary.className}">${escapeHtml(paymentSummary.statusLabel)}</span>
          </div>
        </header>
        <div class="receipt-meta">
          <span>Order #${escapeHtml(order.number)}</span>
          <span>${escapeHtml(formatDateTime(order.createdAtMs, order.createdAt))}</span>
          <span>${escapeHtml(orderTypeLabel(order))}</span>
          <span>${escapeHtml(orderLocationLabel(order))}</span>
          <span>${escapeHtml(fulfillmentLabel(order))}</span>
          <span>Staff: ${escapeHtml(getOrderStaffName(order))}</span>
          ${fulfillmentMeta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
        <div class="receipt-lines">
          ${order.items.map(receiptLineHtml).join("")}
        </div>
        ${order.notes ? `<p class="receipt-note">Order note: ${escapeHtml(order.notes)}</p>` : ""}
        <div class="receipt-totals">
          <div class="receipt-total receipt-subtotal">
            <span>Subtotal excl. VAT</span>
            <strong>${escapeHtml(money(getOrderSubtotalExcludingVat(order)))}</strong>
          </div>
          ${vatBreakdown.map((row) => `
            <div class="receipt-total receipt-tax">
              <span>${escapeHtml(getVatLabel(row.vatSetting))} (${Math.round(row.rate * 100)}%)</span>
              <strong>${escapeHtml(money(row.tax))}</strong>
            </div>
          `).join("")}
          <div class="receipt-total">
            <span>Total</span>
            <strong>${escapeHtml(money(getOrderTotal(order)))}</strong>
          </div>
        </div>
        <div class="receipt-meta">
          <span>Payment method: ${escapeHtml(paymentSummary.method)}</span>
          ${paymentSummary.paid && order.paidAt ? `<span>Paid ${escapeHtml(formatDateTime(order.paidAtMs, order.paidAt))}</span>` : ""}
          ${paymentSummary.paid ? `<span>Paid by: ${escapeHtml(getOrderPaidByName(order))}</span>` : ""}
          ${order.paymentProcessor ? `<span>Processor: ${escapeHtml(order.paymentProcessor)}</span>` : ""}
        </div>
        <div class="mini-actions receipt-actions">
          ${can("canCreateOrders") && !paymentSummary.paid && order.status !== "Cancelled" ? paymentCaptureHtml(order) : ""}
          <button class="mini-btn" type="button" data-print-receipt="${escapeHtml(order.id)}">Print Receipt</button>
        </div>
      </article>
    `;
  }
  
  return {
    renderOrders,
    renderReceipt
  };
}
