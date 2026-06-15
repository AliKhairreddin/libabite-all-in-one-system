import {
  DEFAULT_PAID_PAYMENT_METHOD,
  TICKET_STATUSES,
  UNPAID_PAYMENT_METHOD
} from "../shared/constants.js";
import { normalizeKitchenStation, normalizeLineModifiers } from "../data/normalize.js";
import { advanceStatus, resolveOrderStatusFromTickets, setTicketStatus } from "../domain/kitchen.js";
import {
  normalizeFulfillmentStatus,
  normalizeOrderFulfillment,
  normalizeOrderOperationalStatus,
  normalizeOrderType,
  orderTypeDefinition,
  productCanBeOrderedForOrderContext
} from "../domain/orders.js";
import { getPaymentStatusForMethod, isPaidPaymentMethod, normalizePaymentMethod } from "../domain/payments.js";
import { createReceiptPdfBlob } from "../domain/receipt-pdf.js";
import { isReservationTime } from "../domain/reservations.js";
import { timeNow } from "../shared/dates.js";
import { saveState, state } from "./state.js";
import { applyPaidPaymentToOrder } from "./payment-ledger.js";
import { enqueueReceiptPrintJob } from "./receipt-printing.js";

export function createStaffOrderRuntime(deps) {
  const {
    assignDriverToDeliveryOrder,
    can,
    canView,
    currentUser,
    deductInventoryForItems,
    formatDateTime,
    formatStockAmount,
    fulfillmentLabel,
    getManualOrderCustomerDetails,
    getOrderCompletionToast,
    getOrderFulfillmentMeta,
    getOrderPaidByName,
    getOrderPaymentSummary,
    getOrderStaffName,
    getOrderSubtotalExcludingVat,
    getOrderTotal,
    getOrderVatBreakdown,
    getVatLabel,
    getSelectedPaymentMethodFromAction,
    getStockShortages,
    ingredientById,
    isOrderPaid,
    money,
    normalizeOrderItems,
    orderById,
    orderLocationLabel,
    orderTypeLabel,
    productById,
    recipeLineAppliesToOrder,
    render,
    renderManualOrderControls,
    renderOrderBuilder,
    showToast,
    tableById,
    upsertCustomerFromOrderDetails
  } = deps;

  function getSelectedLineModifiers() {
    const checked = Array.from(document.querySelectorAll("input[name='lineModifier']:checked") as NodeListOf<HTMLInputElement>)
      .map((input) => input.value);
    const customModifierInput = document.querySelector("#orderCustomModifier") as HTMLInputElement | null;
    const customModifier = String(customModifierInput?.value || "").trim();
    return normalizeLineModifiers(customModifier ? [...checked, customModifier] : checked);
  }

  function clearLineDetailFields() {
    document.querySelectorAll("input[name='lineModifier']:checked").forEach((input: HTMLInputElement) => {
      input.checked = false;
    });
    const noteInput = document.querySelector("#orderLineNote") as HTMLInputElement | null;
    const customModifierInput = document.querySelector("#orderCustomModifier") as HTMLInputElement | null;
    if (noteInput) noteInput.value = "";
    if (customModifierInput) customModifierInput.value = "";
  }

  function addOrderDraftLine(productId, quantity, note = "", modifiers = []) {
    if (!can("canCreateOrders")) {
      showToast("This role cannot create orders.");
      return;
    }

    const product = productById(productId);
    const orderForm: any = document.querySelector("#orderForm");
    const channel = normalizeOrderType(orderForm?.elements.channel.value || "Dine-in");
    const orderContext = getCurrentOrderContext();
    const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    const availability = deps.getProductAvailability(product, state.orderDraft, orderContext);

    if (!product) return;

    if (!productCanBeOrderedForOrderContext(product, orderContext)) {
      showToast(`${product.name} is not active for ${channel}.`);
      renderOrderBuilder();
      return;
    }

    if (requestedQuantity > availability.maxQuantity) {
      showToast(`Only ${availability.maxQuantity} ${product.name} can be added with current stock.`);
      renderOrderBuilder();
      return;
    }

    state.orderDraft = normalizeOrderItems([
      ...state.orderDraft,
      {
        productId: product.id,
        quantity: requestedQuantity,
        note: String(note || "").trim(),
        modifiers: normalizeLineModifiers(modifiers)
      }
    ]);
    saveState();
    clearLineDetailFields();
    render();
    showToast(`${requestedQuantity}x ${product.name} added to basket.`);
  }

  function removeOrderDraftLine(index) {
    state.orderDraft.splice(Number(index), 1);
    state.orderDraft = normalizeOrderItems(state.orderDraft);
    saveState();
    render();
  }

  function clearOrderDraft() {
    state.orderDraft = [];
    saveState();
    render();
  }

  function getCurrentOrderContext() {
    const form: any = document.querySelector("#orderForm");
    const channel = normalizeOrderType(form?.elements.channel.value || "Dine-in");
    return {
      channel,
      fulfillment: normalizeOrderFulfillment(channel, form?.elements.fulfillment?.value || orderTypeDefinition(channel).fulfillment)
    };
  }

  function getOrderCustomerLabel(channel, tableId, customerName) {
    const orderType = orderTypeDefinition(channel);
    const table = tableById(tableId);
    if (orderType.requiresTable && table) return table.name;
    return String(customerName || "").trim() || (orderType.requiresTable ? "Unassigned table" : "Walk-in");
  }

  function getKitchenTicketNotes(order, item) {
    return [
      ...getOrderFulfillmentMeta(order),
      order.customerNotes ? `Customer note: ${order.customerNotes}` : "",
      order.notes,
      item.modifiers?.length ? `Modifiers: ${item.modifiers.join(", ")}` : "",
      item.note ? `Line note: ${item.note}` : ""
    ].filter(Boolean).join(" | ");
  }

  function createKitchenTicketsForOrder(order) {
    const existingTickets = state.tickets.filter((ticket) => ticket.orderId === order.id);
    if (existingTickets.length) return existingTickets;

    const createdAt = order.sentAt || timeNow();
    const createdAtMs = Date.now();
    const tickets = order.items.map((item, index) => {
      const product = productById(item.productId);
      return {
        id: `TCK-${order.number}-${index + 1}`,
        orderId: order.id,
        productId: product.id,
        quantity: item.quantity,
        station: normalizeKitchenStation(product.station),
        status: "Queued",
        createdAt,
        createdAtMs,
        acceptedAtMs: "",
        startedAtMs: "",
        delayedAtMs: "",
        readyAtMs: "",
        completedAtMs: "",
        notes: getKitchenTicketNotes(order, item),
        issueNote: ""
      };
    });
    state.tickets.push(...tickets);
    return tickets;
  }

  function validateOrderForKitchen(order) {
    const orderContext = {
      channel: order.channel,
      fulfillment: order.fulfillment
    };
    const shortages = getStockShortages(order.items, orderContext);
    if (shortages.length) {
      const missing = shortages.map((item) => `${formatStockAmount(item.shortage, item.ingredient.unit)} ${item.ingredient.name}`).join(", ");
      return { ok: false, message: `Cannot send order; missing ${missing}.` };
    }

    const unavailableItem = order.items.find((item) => !productCanBeOrderedForOrderContext(productById(item.productId), orderContext));
    if (unavailableItem) {
      const unavailableProduct = productById(unavailableItem.productId);
      return { ok: false, message: `${unavailableProduct?.name || "That product"} is not available for ${order.channel}.` };
    }

    const inactiveIngredientItem = order.items.find((item) => {
      const product = productById(item.productId);
      return (product?.recipe || []).some((line) => {
        if (!recipeLineAppliesToOrder(line, orderContext)) return false;
        const ingredient = ingredientById(line.ingredientId);
        return !ingredient?.active;
      });
    });
    if (inactiveIngredientItem) {
      const product = productById(inactiveIngredientItem.productId);
      return { ok: false, message: `${product?.name || "That product"} has an inactive purchased product in its recipe.` };
    }

    return { ok: true, orderContext };
  }

  function sendOrderToKitchen(orderId, options: any = {}) {
    if (!options.skipPermission && !can("canCreateOrders")) {
      showToast("This role cannot send orders.");
      return false;
    }

    const order = orderById(orderId);
    if (!order) return false;
    if (order.status === "Cancelled" || order.status === "Paid") {
      showToast(`Order #${order.number} cannot be sent from ${order.status}.`);
      return false;
    }

    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
      showToast(validation.message);
      renderOrderBuilder();
      return false;
    }

    order.sentAt = order.sentAt || timeNow();
    order.status = "Sent to kitchen";
    order.operationalStatus = normalizeOrderOperationalStatus(order.status);
    order.fulfillmentStatus = normalizeFulfillmentStatus(order.status);
    const tickets = createKitchenTicketsForOrder(order);
    const stations = [...new Set(tickets.map((ticket) => ticket.station))];
    const stockChanges = order.inventoryDeducted ? [] : deductInventoryForItems(order.items, validation.orderContext);
    order.inventoryDeducted = true;

    assignDriverToDeliveryOrder(order);
    enqueueReceiptPrintJob(order, options.receiptPrintTrigger || "order_sent");

    saveState();
    render();
    if (!options.silent) {
      showToast(getOrderCompletionToast(order.number, stations, stockChanges, order.items, validation.orderContext));
    }
    return true;
  }

  function createOrder(formData, mode = "kitchen") {
    if (!can("canCreateOrders")) {
      showToast("This role cannot create orders.");
      return;
    }

    const channel = normalizeOrderType(formData.get("channel"));
    const orderType = orderTypeDefinition(channel);
    const fulfillment = normalizeOrderFulfillment(channel, formData.get("fulfillment") || orderType.fulfillment);
    const paymentMethod = normalizePaymentMethod(formData.get("paymentMethod") || formData.get("paymentStatus"));
    const paymentStatus = getPaymentStatusForMethod(paymentMethod, formData.get("paymentStatus"));
    const items = state.orderDraft.length
      ? normalizeOrderItems(state.orderDraft)
      : normalizeOrderItems([{ productId: formData.get("productId"), quantity: formData.get("quantity") }]);
    const tableId = formData.get("tableId");

    if (!items.length) {
      showToast("Add an item before sending the order.");
      return;
    }

    if (orderType.requiresTable && !tableById(tableId)) {
      showToast("Select a table before creating the dine-in order.");
      return;
    }

    const manualCustomer = getManualOrderCustomerDetails(formData, channel);
    if (manualCustomer) {
      if (!manualCustomer.name || !manualCustomer.phone) {
        showToast("Enter the customer name and phone number.");
        renderManualOrderControls();
        return;
      }
      if (fulfillment === "Delivery" && !manualCustomer.deliveryAddress) {
        showToast("Enter a delivery address before sending a delivery order.");
        renderManualOrderControls();
        return;
      }
    }

    const requestedTime = String(formData.get("requestedTime") || "").trim();
    if (requestedTime && !isReservationTime(requestedTime)) {
      showToast("Choose a valid pickup or delivery time.");
      return;
    }

    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const staff = currentUser();
    const order: any = {
      id: orderId,
      number,
      channel,
      orderType: channel,
      tableId: tableById(tableId) ? tableId : "",
      customer: manualCustomer?.name || getOrderCustomerLabel(channel, tableId, formData.get("customer")),
      customerName: manualCustomer?.name || "",
      customerPhone: manualCustomer?.phone || "",
      customerEmail: manualCustomer?.email || "",
      deliveryAddress: manualCustomer?.deliveryAddress || "",
      requestedTime,
      paymentStatus,
      paymentMethod,
      fulfillment,
      status: "New",
      operationalStatus: "New",
      fulfillmentStatus: "Not started",
      createdAt,
      createdAtMs,
      sentAt: "",
      paidAt: paymentStatus === "Paid" ? createdAt : "",
      paidAtMs: paymentStatus === "Paid" ? createdAtMs : "",
      staffId: staff?.id || "",
      staffName: staff?.name || "",
      paidByUserId: paymentStatus === "Paid" ? staff?.id || "" : "",
      paidByName: paymentStatus === "Paid" ? staff?.name || "" : "",
      waiterPickupStatus: "",
      waiterNotifiedAt: "",
      waiterNotifiedAtMs: "",
      waiterPickedUpAt: "",
      waiterPickedUpAtMs: "",
      waiterPickedUpByUserId: "",
      waiterPickedUpByName: "",
      servedAt: "",
      servedAtMs: "",
      servedByUserId: "",
      servedByName: "",
      inventoryDeducted: false,
      assignedDriver: fulfillment === "Delivery" ? String(formData.get("assignedDriver") || "").trim() : "",
      pickupStatus: "",
      deliveryStatus: "",
      deliveryAssignedAtMs: "",
      deliveryStatusUpdatedAtMs: "",
      deliveredAt: "",
      deliveredAtMs: "",
      failedAt: "",
      failedAtMs: "",
      returnedAt: "",
      returnedAtMs: "",
      deliveryWasLate: false,
      deliveryNotes: [],
      deliveryProofPhotoName: "",
      deliveryProofAtMs: "",
      deliveryProofByName: "",
      cashCollected: false,
      cashCollectedAt: "",
      cashCollectedAtMs: "",
      cashCollectedByName: "",
      customerNotes: manualCustomer?.notes || "",
      notes: String(formData.get("notes") || "").trim(),
      items: items.map((item) => ({ ...item }))
    };

    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
      showToast(validation.message);
      renderOrderBuilder();
      return;
    }

    const customerRecord = manualCustomer ? upsertCustomerFromOrderDetails(manualCustomer) : null;
    if (customerRecord) order.customerId = customerRecord.id;
    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.orderDraft = [];
    state.receiptOrderId = order.id;
    if (paymentStatus === "Paid") enqueueReceiptPrintJob(order, "order_paid");

    if (mode === "kitchen") {
      sendOrderToKitchen(order.id);
      return;
    }

    saveState();
    render();
    showToast(`Order #${number} saved as New.`);
  }

  function isWaiterPickupOrder(order) {
    return orderTypeDefinition(order.channel || order.orderType).requiresTable && order.fulfillment === "Kitchen";
  }

  function updateWaiterPickupStatus(order) {
    if (!isWaiterPickupOrder(order)) return;
    if (order.status === "Ready") {
      const now = Date.now();
      order.waiterPickupStatus = order.waiterPickupStatus === "Picked up" ? "Picked up" : "Ready for pickup";
      order.waiterNotifiedAt = order.waiterNotifiedAt || timeNow();
      order.waiterNotifiedAtMs = order.waiterNotifiedAtMs || now;
      return;
    }
    if (order.status === "Served" || order.status === "Paid") {
      order.waiterPickupStatus = "Served";
    }
  }

  function syncOrderStatus(orderId) {
    const tickets = state.tickets.filter((ticket) => ticket.orderId === orderId);
    const order = orderById(orderId);
    if (!order || !tickets.length) return;
    if (order.status === "Paid" || order.status === "Cancelled") return;
    order.status = resolveOrderStatusFromTickets(order, tickets, {
      isPaid: isOrderPaid(order),
      isTableService: isWaiterPickupOrder(order)
    });
    order.operationalStatus = normalizeOrderOperationalStatus(order.status);
    order.fulfillmentStatus = normalizeFulfillmentStatus(order.status);
    updateWaiterPickupStatus(order);
  }

  function advanceTicket(ticketId) {
    if (!can("canAdvanceTickets")) {
      showToast("This role cannot update kitchen tickets.");
      return;
    }

    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    setTicketStatus(ticket, advanceStatus(ticket.status));
    syncOrderStatus(ticket.orderId);
    saveState();
    render();
    showToast(`Ticket moved to ${ticket.status}.`);
  }

  function updateTicketStatus(ticketId, status) {
    if (!can("canAdvanceTickets")) {
      showToast("This role cannot update kitchen tickets.");
      return;
    }

    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket || !TICKET_STATUSES.includes(status)) return;
    setTicketStatus(ticket, status);
    syncOrderStatus(ticket.orderId);
    saveState();
    render();
    showToast(`Kitchen task marked ${deps.getTicketStatusLabel(ticket.status).toLowerCase()}.`);
  }

  function markTicketDelayed(ticketId) {
    if (!can("canAdvanceTickets")) {
      showToast("This role cannot update kitchen tickets.");
      return;
    }

    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    const issueNote = window.prompt("Issue note for the delay", ticket.issueNote || "");
    if (issueNote === null) return;
    ticket.issueNote = String(issueNote || "").trim();
    setTicketStatus(ticket, "Delayed");
    syncOrderStatus(ticket.orderId);
    saveState();
    render();
    showToast("Kitchen task marked delayed.");
  }

  function addTicketIssueNote(ticketId) {
    if (!can("canAdvanceTickets")) {
      showToast("This role cannot update kitchen tickets.");
      return;
    }

    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) return;
    const issueNote = window.prompt("Issue note", ticket.issueNote || "");
    if (issueNote === null) return;
    ticket.issueNote = String(issueNote || "").trim();
    saveState();
    render();
    showToast(ticket.issueNote ? "Issue note added." : "Issue note cleared.");
  }

  function advanceOrder(orderId) {
    if (!can("canCreateOrders") && !can("canAdvanceTickets")) {
      showToast("This role cannot update orders.");
      return;
    }

    const order = orderById(orderId);
    if (!order) return;
    if (order.status === "New") {
      sendOrderToKitchen(orderId);
      return;
    }
    if (order.status === "Ready") {
      markOrderServed(orderId);
      return;
    }
    if (order.status === "Served") {
      markOrderPaid(orderId);
      return;
    }

    const orderTickets = state.tickets.filter((ticket) => ticket.orderId === orderId && ticket.status !== "Done");
    orderTickets.forEach((ticket) => {
      setTicketStatus(ticket, advanceStatus(ticket.status));
    });
    syncOrderStatus(orderId);
    saveState();
    render();
    showToast("Order status updated.");
  }

  function markOrderServed(orderId) {
    if (!can("canCreateOrders")) {
      showToast("This role cannot update orders.");
      return;
    }

    const order = orderById(orderId);
    if (!order || order.status === "Cancelled" || order.status === "Paid") return;
    const staff = currentUser();
    const now = Date.now();
    state.tickets
      .filter((ticket) => ticket.orderId === orderId)
      .forEach((ticket) => setTicketStatus(ticket, "Done"));
    order.status = isOrderPaid(order) ? "Paid" : "Served";
    order.operationalStatus = normalizeOrderOperationalStatus(order.status);
    order.fulfillmentStatus = normalizeFulfillmentStatus(order.status);
    order.waiterPickupStatus = isWaiterPickupOrder(order) ? "Served" : order.waiterPickupStatus || "";
    order.servedAt = order.servedAt || timeNow();
    order.servedAtMs = order.servedAtMs || now;
    order.servedByUserId = staff?.id || order.servedByUserId || "";
    order.servedByName = staff?.name || order.servedByName || "";
    saveState();
    render();
    showToast(`Order #${order.number} marked served.`);
  }

  function markWaiterPickup(orderId) {
    if (!can("canCreateOrders")) {
      showToast("This role cannot update table pickups.");
      return;
    }

    const order = orderById(orderId);
    if (!order || !isWaiterPickupOrder(order)) return;
    if (order.status !== "Ready") {
      showToast(`Order #${order.number} is not ready for pickup yet.`);
      return;
    }

    const staff = currentUser();
    const now = Date.now();
    order.waiterPickupStatus = "Picked up";
    order.waiterPickedUpAt = timeNow();
    order.waiterPickedUpAtMs = now;
    order.waiterPickedUpByUserId = staff?.id || "";
    order.waiterPickedUpByName = staff?.name || "";
    saveState();
    render();
    showToast(`Order #${order.number} picked up for ${orderLocationLabel(order)}.`);
  }

  function markOrderPaid(orderId, paymentMethod = DEFAULT_PAID_PAYMENT_METHOD) {
    if (!can("canCreateOrders")) {
      showToast("This role cannot take payment.");
      return;
    }

    const order = orderById(orderId);
    if (!order || order.status === "Cancelled") return;
    const method = normalizePaymentMethod(paymentMethod);
    const staff = currentUser();
    const paidMethod = isPaidPaymentMethod(method) ? method : DEFAULT_PAID_PAYMENT_METHOD;
    applyPaidPaymentToOrder(order, {
      provider: paidMethod === "Cash" ? "cash" : "manual",
      paymentMethod: paidMethod,
      paymentProcessor: paidMethod === "Cash" ? "Cash" : "Manual in-person payment",
      paidByUserId: staff?.id || order.paidByUserId || "",
      paidByName: staff?.name || order.paidByName || "",
      captureMode: paidMethod === "Cash" ? "staff_recorded" : "terminal"
    });
    const printJob = enqueueReceiptPrintJob(order, "order_paid");
    if (order.status === "Served") order.status = "Paid";
    order.operationalStatus = normalizeOrderOperationalStatus(order.status);
    order.fulfillmentStatus = normalizeFulfillmentStatus(order.status);
    state.receiptOrderId = order.id;
    saveState();
    render();
    showToast(`Payment recorded for order #${order.number}.${printJob ? " Receipt queued." : ""}`);
  }

  function cancelOrder(orderId) {
    if (!can("canCreateOrders")) {
      showToast("This role cannot cancel orders.");
      return;
    }

    const order = orderById(orderId);
    if (!order || order.status !== "New") {
      showToast("Only New orders can be cancelled in this phase.");
      return;
    }

    order.status = "Cancelled";
    order.paymentStatus = "Unpaid";
    order.paymentMethod = UNPAID_PAYMENT_METHOD;
    order.paidAt = "";
    order.paidAtMs = "";
    order.paidByUserId = "";
    order.paidByName = "";
    saveState();
    render();
    showToast(`Order #${order.number} cancelled.`);
  }

  function showOrderReceipt(orderId) {
    const order = orderById(orderId);
    if (!order) return;
    state.receiptOrderId = order.id;
    if (canView("orders")) state.activeView = "orders";
    saveState();
    render();
  }

  function printOrderReceipt(orderId) {
    const order = orderById(orderId);
    if (!order) return;
    state.receiptOrderId = order.id;
    const printJob = enqueueReceiptPrintJob(order, "manual_reprint", { force: true });
    saveState();
    render();
    showToast(printJob
      ? `Receipt print queued for order #${order.number}.`
      : `Could not queue receipt print for order #${order.number}.`);
  }

  function buildReceiptPdfInput(order) {
    const settings = state.restaurantSettings;
    const paymentSummary = getOrderPaymentSummary(order);
    const totals = [
      { label: "Subtotal excl. VAT", value: money(getOrderSubtotalExcludingVat(order)) },
      ...getOrderVatBreakdown(order).map((row) => ({
        label: `${getVatLabel(row.vatSetting)} (${Math.round(row.rate * 100)}%)`,
        value: money(row.tax)
      })),
      { label: "Total", value: money(getOrderTotal(order)) }
    ];
    const paymentRows = [
      `Payment: ${paymentSummary.statusLabel}`,
      `Method: ${paymentSummary.method}`,
      paymentSummary.paid && order.paidAt ? `Paid: ${formatDateTime(order.paidAtMs, order.paidAt)}` : "",
      paymentSummary.paid ? `Paid by: ${getOrderPaidByName(order)}` : "",
      order.paymentProcessor ? `Processor: ${order.paymentProcessor}` : ""
    ].filter(Boolean);

    return {
      restaurantName: settings.restaurantName,
      location: settings.location,
      orderNumber: order.number,
      createdAt: formatDateTime(order.createdAtMs, order.createdAt),
      orderType: orderTypeLabel(order),
      locationLabel: orderLocationLabel(order),
      fulfillment: fulfillmentLabel(order),
      staffName: getOrderStaffName(order),
      items: order.items.map((item) => {
        const product = productById(item.productId);
        const detail = [
          item.modifiers?.length ? item.modifiers.join(", ") : "",
          item.note || ""
        ].filter(Boolean).join(" · ");
        return {
          name: product?.name || "Unknown item",
          detail,
          quantity: item.quantity,
          unitPrice: money(product?.price || 0),
          total: money((product?.price || 0) * item.quantity)
        };
      }),
      notes: order.notes,
      totals,
      paymentRows,
      footerRows: getOrderFulfillmentMeta(order)
    };
  }

  function openOrderReceiptPdf(orderId) {
    const order = orderById(orderId);
    if (!order) return;
    state.receiptOrderId = order.id;
    saveState();
    render();

    const blob = createReceiptPdfBlob(buildReceiptPdfInput(order));
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) {
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${order.number}.pdf`;
      link.click();
      showToast(`Receipt PDF downloaded for order #${order.number}.`);
    } else {
      showToast(`Receipt PDF opened for order #${order.number}.`);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return {
    addOrderDraftLine,
    addTicketIssueNote,
    advanceOrder,
    advanceTicket,
    cancelOrder,
    clearOrderDraft,
    createOrder,
    getSelectedLineModifiers,
    markOrderPaid,
    markOrderServed,
    markWaiterPickup,
    markTicketDelayed,
    openOrderReceiptPdf,
    printOrderReceipt,
    removeOrderDraftLine,
    sendOrderToKitchen,
    showOrderReceipt,
    updateTicketStatus,
    validateOrderForKitchen
  };
}
