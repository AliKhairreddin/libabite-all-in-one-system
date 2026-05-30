import { DEFAULT_PAID_PAYMENT_METHOD, PAYMENT_METHOD_OPTIONS } from "../shared/constants.js";
import { isPaidPaymentMethod, normalizePaymentMethod } from "../domain/payments.js";
import { escapeHtml } from "../shared/html.js";
export function createOrderCardsUi(deps) {
    const { can, formatStockAmount, fulfillmentLabel, getActiveSupplierOrder, getOrderFulfillmentMeta, getOrderPaymentSummary, getOrderProgressSummary, getOrderStaffName, getOrderTotal, getSupplierOrderQuantity, money, orderLocationLabel, orderStatusClass, orderTypeLabel, productById } = deps;
    function paymentMethodOptionsHtml(selectedMethod = DEFAULT_PAID_PAYMENT_METHOD, paidOnly = false) {
        const options = paidOnly ? PAYMENT_METHOD_OPTIONS.filter((option) => option.paid) : PAYMENT_METHOD_OPTIONS;
        const normalizedMethod = normalizePaymentMethod(selectedMethod);
        const selected = paidOnly && !isPaidPaymentMethod(normalizedMethod) ? DEFAULT_PAID_PAYMENT_METHOD : normalizedMethod;
        return options
            .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
            .join("");
    }
    function paymentCaptureHtml(order) {
        return `
      <span class="payment-capture">
        <select class="mini-select" data-payment-method-select="${escapeHtml(order.id)}" aria-label="Payment method for order #${escapeHtml(order.number)}">
          ${paymentMethodOptionsHtml(order.paymentMethod, true)}
        </select>
        <button class="mini-btn" type="button" data-mark-paid="${escapeHtml(order.id)}">Mark Paid</button>
      </span>
    `;
    }
    function getSelectedPaymentMethodFromAction(action) {
        const select = action.closest(".payment-capture")?.querySelector("[data-payment-method-select]");
        return normalizePaymentMethod(select?.value || DEFAULT_PAID_PAYMENT_METHOD);
    }
    function orderItemDetailText(item) {
        const details = [
            item.modifiers?.length ? item.modifiers.join(", ") : "",
            item.note || ""
        ].filter(Boolean);
        return details.join(" · ");
    }
    function orderCard(order) {
        const productLines = order.items.map((item) => {
            const product = productById(item.productId);
            if (!product)
                return null;
            const detail = orderItemDetailText(item);
            return `${item.quantity}x ${product.name}${detail ? ` (${detail})` : ""}`;
        }).filter(Boolean).join(", ");
        const statusClass = orderStatusClass(order.status);
        const paymentSummary = getOrderPaymentSummary(order);
        const canFrontUpdate = can("canCreateOrders") && order.status !== "Paid" && order.status !== "Cancelled";
        const canKitchenUpdate = can("canAdvanceTickets") && ["Sent to kitchen", "Preparing", "Delayed"].includes(order.status);
        const kitchenSummary = getOrderProgressSummary(order);
        const fulfillmentMeta = getOrderFulfillmentMeta(order);
        return `
      <article class="order-card">
        <div>
          <div class="card-title">
            <strong>#${order.number} ${escapeHtml(productLines)}</strong>
            <span class="pill ${statusClass}">${escapeHtml(order.status)}</span>
            <span class="pill ${paymentSummary.className}">${escapeHtml(paymentSummary.statusLabel)}</span>
          </div>
          <div class="meta-line">
            <span>${escapeHtml(orderTypeLabel(order))}</span>
            <span>${escapeHtml(orderLocationLabel(order))}</span>
            <span>${escapeHtml(fulfillmentLabel(order))}</span>
            <span>${escapeHtml(money(getOrderTotal(order)))}</span>
            <span>Payment: ${escapeHtml(paymentSummary.method)}</span>
            <span>Staff: ${escapeHtml(getOrderStaffName(order))}</span>
            ${fulfillmentMeta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
          </div>
          ${kitchenSummary.total ? `
            <div class="order-progress-mini">
              <div class="progress-track"><div class="progress-bar" style="--value: ${kitchenSummary.percent}%"></div></div>
              <span>${kitchenSummary.finished}/${kitchenSummary.total} kitchen tasks ready</span>
            </div>
          ` : ""}
        </div>
        <div class="mini-actions">
          ${order.status === "New" && canFrontUpdate ? `<button class="mini-btn" type="button" data-send-kitchen="${escapeHtml(order.id)}">Send</button>` : ""}
          ${canKitchenUpdate ? `<button class="mini-btn" type="button" data-next-order="${escapeHtml(order.id)}">Next</button>` : ""}
          ${order.status === "Ready" && canFrontUpdate ? `<button class="mini-btn" type="button" data-mark-served="${escapeHtml(order.id)}">Served</button>` : ""}
          ${!paymentSummary.paid && canFrontUpdate ? paymentCaptureHtml(order) : ""}
          ${order.status === "New" && canFrontUpdate ? `<button class="mini-btn danger-action" type="button" data-cancel-order="${escapeHtml(order.id)}">Cancel</button>` : ""}
          <button class="mini-btn" type="button" data-show-receipt="${escapeHtml(order.id)}">Receipt</button>
          <button class="mini-btn" type="button" data-print-receipt="${escapeHtml(order.id)}">Print</button>
        </div>
      </article>
    `;
    }
    function alertCard(ingredient) {
        const reorderQuantity = getSupplierOrderQuantity(ingredient);
        const cls = ingredient.stock <= ingredient.min ? "danger" : "";
        const activeSupplierOrder = getActiveSupplierOrder(ingredient.supplier);
        const isAwaitingReceipt = activeSupplierOrder?.status === "Ordered"
            && activeSupplierOrder.items.some((item) => item.ingredientId === ingredient.id);
        const supplierText = isAwaitingReceipt
            ? `Ordered from ${ingredient.supplier}; waiting to receive ${formatStockAmount(reorderQuantity, ingredient.unit)}.`
            : `Suggested reorder ${formatStockAmount(reorderQuantity, ingredient.unit)} from ${ingredient.supplier}.`;
        return `
      <article class="alert-card ${cls}">
        <div class="card-title">
          <strong>${escapeHtml(ingredient.name)}</strong>
          <span class="pill danger">${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</span>
        </div>
        <p>At or below ${ingredient.min} ${escapeHtml(ingredient.unit)}. ${escapeHtml(supplierText)}</p>
      </article>
    `;
    }
    return {
        alertCard,
        getSelectedPaymentMethodFromAction,
        orderCard,
        orderItemDetailText,
        paymentCaptureHtml
    };
}
//# sourceMappingURL=order-cards.js.map