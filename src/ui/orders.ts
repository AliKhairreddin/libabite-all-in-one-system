import { state } from "../app/state.js";
import { getValidOrderLineSnapshot } from "../domain/orders.js";
import { escapeHtml } from "../shared/html.js";
import { getReceiptPrintSummary } from "../app/receipt-printing.js";

export function createOrdersUi(deps) {
  const {
    can,
    emptyState,
    formatDateTime,
    fulfillmentLabel,
    getOrderFulfillmentMeta,
    getOrderPaidByName,
    getOrderPaymentSummary,
    getOrderProgressSummary,
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
    productById,
    getWaiterPickupOrders
  } = deps;

  function getOrderItemDisplay(item) {
    const snapshot = getValidOrderLineSnapshot(item);
    if (snapshot) {
      return {
        name: snapshot.productName,
        unitPrice: snapshot.unitPriceCents / 100,
        lineTotal: snapshot.lineTotalCents / 100
      };
    }

    const product = productById(item?.productId);
    const quantity = Math.floor(Number(item?.quantity) || 0);
    const price = Number(product?.price);
    if (!product || quantity < 1 || !Number.isFinite(price) || price < 0) return null;
    return {
      name: product.name,
      unitPrice: price,
      lineTotal: price * quantity
    };
  }

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
  
    renderWaiterPickupQueue();
    renderReceipt();
  }

  function waiterPickupItemsText(order) {
    return order.items.map((item) => {
      const display = getOrderItemDisplay(item);
      if (!display) return null;
      const detail = orderItemDetailText(item);
      return `${item.quantity}x ${display.name}${detail ? ` (${detail})` : ""}`;
    }).filter(Boolean).join(", ");
  }

  function waiterPickupCard(order) {
    const progress = getOrderProgressSummary(order);
    const paymentSummary = getOrderPaymentSummary(order);
    const pickupStatus = order.waiterPickupStatus || (order.status === "Ready" ? "Ready for pickup" : order.status);
    const pickedUpBy = order.waiterPickedUpByName ? `Picked up by ${order.waiterPickedUpByName}` : "";
    const notifiedAt = order.waiterNotifiedAtMs ? `Notified ${formatDateTime(order.waiterNotifiedAtMs, order.waiterNotifiedAt)}` : "";
    const ready = order.status === "Ready";
    const pickedUp = pickupStatus === "Picked up";
    return `
      <article class="waiter-pickup-card ${ready ? "is-ready" : ""} ${order.status === "Delayed" ? "is-delayed" : ""}">
        <div>
          <header>
            <strong>#${escapeHtml(order.number)} ${escapeHtml(orderLocationLabel(order))}</strong>
            <span class="pill ${orderStatusClass(order.status)}">${escapeHtml(pickupStatus)}</span>
            <span class="pill ${paymentSummary.className}">${escapeHtml(paymentSummary.statusLabel)}</span>
          </header>
          <div class="waiter-pickup-meta">
            <span>${escapeHtml(orderTypeLabel(order))}</span>
            <span>${escapeHtml(progress.finished)}/${escapeHtml(progress.total)} kitchen tasks ready</span>
            ${notifiedAt ? `<span>${escapeHtml(notifiedAt)}</span>` : ""}
            ${pickedUpBy ? `<span>${escapeHtml(pickedUpBy)}</span>` : ""}
          </div>
          <p class="waiter-pickup-items">${escapeHtml(waiterPickupItemsText(order))}</p>
        </div>
        <div class="mini-actions waiter-pickup-actions">
          ${ready && !pickedUp ? `<button class="mini-btn" type="button" data-waiter-pickup="${escapeHtml(order.id)}">Pick up</button>` : ""}
          ${ready ? `<button class="mini-btn" type="button" data-mark-served="${escapeHtml(order.id)}">Served</button>` : ""}
          <button class="mini-btn" type="button" data-show-receipt="${escapeHtml(order.id)}">Receipt</button>
        </div>
      </article>
    `;
  }

  function renderWaiterPickupQueue() {
    const container = document.querySelector("#waiterPickupQueue");
    if (!container) return;

    const queue = getWaiterPickupOrders();
    container.innerHTML = queue.length
      ? queue.map(waiterPickupCard).join("")
      : "";
  }
  
  function receiptLineHtml(item) {
    const display = getOrderItemDisplay(item);
    if (!display) return "";
    const detail = orderItemDetailText(item);
    return `
      <div class="receipt-line">
        <div>
          <strong>${escapeHtml(display.name)}</strong>
          <span>Qty ${item.quantity} x ${escapeHtml(money(display.unitPrice))}</span>
          ${detail ? `<span>${escapeHtml(detail)}</span>` : ""}
        </div>
        <span>${escapeHtml(money(display.lineTotal))}</span>
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
    const receiptPrint = getReceiptPrintSummary(order.id);
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
          <span>Print: ${escapeHtml(receiptPrint.label)}</span>
          ${paymentSummary.paid && order.paidAt ? `<span>Paid ${escapeHtml(formatDateTime(order.paidAtMs, order.paidAt))}</span>` : ""}
          ${paymentSummary.paid ? `<span>Paid by: ${escapeHtml(getOrderPaidByName(order))}</span>` : ""}
          ${order.paymentProcessor ? `<span>Processor: ${escapeHtml(order.paymentProcessor)}</span>` : ""}
        </div>
        <div class="mini-actions receipt-actions">
          ${can("canCreateOrders") && !paymentSummary.paid && order.status !== "Cancelled" ? paymentCaptureHtml(order) : ""}
          <button class="mini-btn" type="button" data-pdf-receipt="${escapeHtml(order.id)}">PDF Receipt</button>
          <button class="mini-btn" type="button" data-print-receipt="${escapeHtml(order.id)}">Queue Print</button>
        </div>
      </article>
    `;
  }
  
  return {
    renderOrders,
    renderReceipt
  };
}
