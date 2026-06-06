import {
  DEFAULT_RECIPE_ORDER_CONTEXT,
  UNPAID_PAYMENT_METHOD,
  VAT_OPTIONS,
  VAT_RATES
} from "../shared/constants.js";
import { state } from "./state.js";
import {
  driverById,
  money,
  orderById,
  productById,
  tableById,
  userNameById
} from "./entities.js";
import { getDeliveryStatus } from "../domain/delivery.js";
import { getOrderProgressSummary as summarizeOrderProgress } from "../domain/kitchen.js";
import {
  calculateItemsTotal,
  calculateOrderTotal,
  countOrderItems,
  normalizeOrderFulfillment,
  normalizeOrderItems as normalizeOrderItemsForProducts,
  normalizeOrderType,
  orderTypeDefinition,
  productCanBeOrdered,
  productCanBeOrderedForOrderContext
} from "../domain/orders.js";
import { isPaidPaymentMethod, normalizePaymentMethod, normalizePaymentStatus } from "../domain/payments.js";

export function getOrderableProducts(channel) {
  return state.products.filter((product) => productCanBeOrdered(product, channel));
}

export function getOrderableProductsForContext(orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return state.products.filter((product) => productCanBeOrderedForOrderContext(product, orderContext));
}

export function getOrderTotal(order) {
  return calculateOrderTotal(order, (productId) => productById(productId));
}

export function getVatRate(product) {
  return VAT_RATES[product?.vatSetting] ?? VAT_RATES.standard;
}

export function getVatLabel(vatSetting) {
  return VAT_OPTIONS.find((option) => option.id === vatSetting)?.label || "Standard VAT";
}

export function getOrderSubtotalExcludingVat(order) {
  return normalizeOrderItems(order.items || []).reduce((sum, item) => {
    const product = productById(item.productId);
    if (!product) return sum;
    const lineTotal = product.price * item.quantity;
    return sum + (lineTotal / (1 + getVatRate(product)));
  }, 0);
}

export function getOrderVatTotal(order) {
  return Math.max(0, getOrderTotal(order) - getOrderSubtotalExcludingVat(order));
}

export function getOrderVatBreakdown(order) {
  const breakdown = new Map();
  normalizeOrderItems(order.items || []).forEach((item) => {
    const product = productById(item.productId);
    if (!product) return;
    const vatSetting = VAT_OPTIONS.some((option) => option.id === product.vatSetting) ? product.vatSetting : "standard";
    const rate = getVatRate(product);
    const lineTotal = product.price * item.quantity;
    const tax = lineTotal - (lineTotal / (1 + rate));
    const current = breakdown.get(vatSetting) || { vatSetting, rate, tax: 0 };
    current.tax += tax;
    breakdown.set(vatSetting, current);
  });
  return [...breakdown.values()];
}

export function getCurrentOrderContext() {
  const form: any = document.querySelector("#orderForm");
  const channel = normalizeOrderType(form?.elements.channel.value || DEFAULT_RECIPE_ORDER_CONTEXT.channel);
  return {
    channel,
    fulfillment: normalizeOrderFulfillment(channel, form?.elements.fulfillment?.value || DEFAULT_RECIPE_ORDER_CONTEXT.fulfillment)
  };
}

export function normalizeOrderItems(items) {
  return normalizeOrderItemsForProducts(items, productById);
}

export function getItemsTotal(items) {
  return calculateItemsTotal(normalizeOrderItems(items), (productId) => productById(productId));
}

export function getItemCount(items) {
  return countOrderItems(normalizeOrderItems(items));
}

export function orderStatusClass(status) {
  if (status === "Paid" || status === "Served") return "ok";
  if (status === "Cancelled" || status === "Delayed") return "danger";
  if (status === "New") return "warning";
  return "info";
}

export function orderTypeLabel(order) {
  return orderTypeDefinition(order.orderType || order.channel).label;
}

export function fulfillmentLabel(order) {
  if (order.fulfillment === "Delivery") return "Delivery";
  if (order.fulfillment === "Pickup") return "Takeaway";
  return order.fulfillment || "Kitchen";
}

export function orderLocationLabel(order) {
  const table = tableById(order.tableId);
  if (table) return table.name;
  return order.customer || "Walk-in";
}

export function getOrderFulfillmentMeta(order) {
  const details = [];
  if (order.requestedTime) details.push(`${fulfillmentLabel(order)} ${order.requestedTime}`);
  if (order.customerPhone) details.push(`Phone: ${order.customerPhone}`);
  if (order.deliveryAddress) details.push(`Address: ${order.deliveryAddress}`);
  const driver = driverById(order.assignedDriver);
  if (driver) details.push(`Driver: ${driver.name}`);
  const deliveryStatus = getDeliveryStatus(order);
  if (deliveryStatus) details.push(`Delivery: ${deliveryStatus}`);
  if (order.paymentReference) details.push(`Payment ref: ${order.paymentReference}`);
  if (order.externalPlatformName || order.externalOrderId) {
    details.push(`Platform: ${[order.externalPlatformName, order.externalOrderId].filter(Boolean).join(" ")}`);
  }
  if (order.externalCommissionAmount) {
    details.push(`Platform commission: ${money(order.externalCommissionAmount)}`);
  }
  if (order.externalStatusPushedAt) details.push(`Platform status: ${order.externalStatus || "updated"}`);
  return details;
}

export function getOrderStaffName(order) {
  return userNameById(order.staffId) || order.staffName || "Staff";
}

export function getOrderPaidByName(order) {
  return userNameById(order.paidByUserId) || order.paidByName || getOrderStaffName(order);
}

export function isOrderPaid(order) {
  return order.paymentStatus === "Paid" || isPaidPaymentMethod(order.paymentMethod);
}

export function getOrderPaymentSummary(order) {
  const paid = isOrderPaid(order);
  const paymentStatus = normalizePaymentStatus(order.paymentStatus);
  const paymentMethod = normalizePaymentMethod(order.paymentMethod, order.paymentStatus);
  const statusLabel = paid ? "Paid" : paymentStatus === "Pending" ? "Pending" : paymentStatus === "Pay later" ? "Pay later" : paymentStatus;
  const className = paid ? "ok" : paymentStatus === "Pending" || paymentStatus === "Pay later" ? "warning" : paymentStatus === "Failed" ? "danger" : "warning";
  return {
    paid,
    method: paid || paymentStatus === "Pending" || paymentStatus === "Authorized" ? paymentMethod : UNPAID_PAYMENT_METHOD,
    statusLabel,
    className
  };
}

export function getKitchenOrderProgressSummary(order) {
  return summarizeOrderProgress(order, state.tickets);
}
