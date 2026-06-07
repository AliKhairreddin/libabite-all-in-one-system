import {
  DEFAULT_RECIPE_ORDER_CONTEXT,
  FULFILLMENT_STATUSES,
  LEGACY_ORDER_TYPE_MAP,
  ORDER_OPERATIONAL_STATUSES,
  ORDER_TYPE_OPTIONS,
  PHONE_MESSAGE_FULFILLMENT_OPTIONS,
  PHONE_MESSAGE_ORDER_CHANNEL,
  WEBSITE_DEFAULT_FULFILLMENT,
  WEBSITE_FULFILLMENT_OPTIONS,
  WEBSITE_ORDER_CHANNEL
} from "../shared/constants.js";
import { normalizeLineModifiers } from "../data/normalize.js";

export function normalizeOrderItems(items, productById = (_productId) => true) {
  const byProduct = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const product = productById(item.productId);
    const quantity = Math.floor(Number(item.quantity) || 0);
    if (!product || quantity < 1) return;
    const note = String(item.note || item.notes || "").trim();
    const modifiers = normalizeLineModifiers(item.modifiers);
    const key = JSON.stringify([item.productId, note, modifiers]);
    const current = byProduct.get(key);
    if (current) {
      current.quantity += quantity;
    } else {
      byProduct.set(key, { productId: item.productId, quantity, note, modifiers });
    }
  });
  return [...byProduct.values()];
}

export function countOrderItems(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + (Math.floor(Number(item.quantity) || 0)), 0);
}

export function calculateItemsTotal(items, productById) {
  return items.reduce((sum, item) => {
    const product = productById(item.productId);
    if (!product) return sum;
    return sum + product.price * item.quantity;
  }, 0);
}

export function calculateOrderTotal(order, productById) {
  return calculateItemsTotal(order?.items || [], productById);
}

export function normalizeOrderOperationalStatus(status, fallback = "New") {
  const legacyMap = {
    Paid: "Completed",
    Served: "Served",
    "Sent to kitchen": "Sent to kitchen"
  };
  const candidate = legacyMap[status] || status || fallback;
  return ORDER_OPERATIONAL_STATUSES.includes(candidate) ? candidate : fallback;
}

export function normalizeFulfillmentStatus(status, fallback = "Not started") {
  const legacyMap = {
    "Sent to kitchen": "Preparing",
    Preparing: "Preparing",
    Ready: "Ready",
    Served: "Served",
    Paid: "Completed"
  };
  const candidate = legacyMap[status] || status || fallback;
  return FULFILLMENT_STATUSES.includes(candidate) ? candidate : fallback;
}

export function normalizeWebsiteFulfillment(value) {
  return WEBSITE_FULFILLMENT_OPTIONS.some((option) => option.value === value) ? value : WEBSITE_DEFAULT_FULFILLMENT;
}

export function websiteFulfillmentOption(value = WEBSITE_DEFAULT_FULFILLMENT) {
  const fulfillment = normalizeWebsiteFulfillment(value);
  return WEBSITE_FULFILLMENT_OPTIONS.find((option) => option.value === fulfillment) || WEBSITE_FULFILLMENT_OPTIONS[0];
}

export function isPhoneMessageOrder(channel) {
  return normalizeOrderType(channel) === PHONE_MESSAGE_ORDER_CHANNEL;
}

export function normalizePhoneMessageFulfillment(value) {
  return PHONE_MESSAGE_FULFILLMENT_OPTIONS.some((option) => option.value === value) ? value : "Pickup";
}

export function phoneMessageFulfillmentOption(value = "Pickup") {
  const fulfillment = normalizePhoneMessageFulfillment(value);
  return PHONE_MESSAGE_FULFILLMENT_OPTIONS.find((option) => option.value === fulfillment) || PHONE_MESSAGE_FULFILLMENT_OPTIONS[0];
}

export function normalizeOrderFulfillment(channel, value) {
  const normalizedChannel = normalizeOrderType(channel);
  if (isPhoneMessageOrder(normalizedChannel)) return normalizePhoneMessageFulfillment(value);
  if (normalizedChannel === WEBSITE_ORDER_CHANNEL) return normalizeWebsiteFulfillment(value);
  return orderTypeDefinition(normalizedChannel).fulfillment;
}

export function normalizeOrderType(value) {
  const candidate = LEGACY_ORDER_TYPE_MAP[value] || value || DEFAULT_RECIPE_ORDER_CONTEXT.channel;
  return ORDER_TYPE_OPTIONS.some((option) => option.value === candidate) ? candidate : DEFAULT_RECIPE_ORDER_CONTEXT.channel;
}

export function orderTypeDefinition(value) {
  return ORDER_TYPE_OPTIONS.find((option) => option.value === normalizeOrderType(value)) || ORDER_TYPE_OPTIONS[0];
}

export function getChannelAvailabilityKey(channel) {
  return orderTypeDefinition(channel).availabilityKey;
}

export function productCanBeOrdered(product, channel) {
  if (!product || !product.active || product.soldOut) return false;
  const availabilityKey = getChannelAvailabilityKey(channel);
  return Boolean(product.availability?.[availabilityKey]);
}

export function productCanBeOrderedForOrderContext(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  if (!product || !product.active || product.soldOut) return false;
  if (isPhoneMessageOrder(orderContext.channel)) {
    return productCanBeOrdered(product, phoneMessageFulfillmentOption(orderContext.fulfillment).channel);
  }
  if (!productCanBeOrdered(product, orderContext.channel)) return false;
  if (orderContext.channel !== WEBSITE_ORDER_CHANNEL) return true;
  return productCanBeOrdered(product, websiteFulfillmentOption(orderContext.fulfillment).channel);
}
