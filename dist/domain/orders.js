import { DEFAULT_RECIPE_ORDER_CONTEXT, FULFILLMENT_STATUSES, LEGACY_ORDER_TYPE_MAP, ORDER_OPERATIONAL_STATUSES, ORDER_TYPE_OPTIONS, PHONE_MESSAGE_FULFILLMENT_OPTIONS, PHONE_MESSAGE_ORDER_CHANNEL, WEBSITE_DEFAULT_FULFILLMENT, WEBSITE_FULFILLMENT_OPTIONS, WEBSITE_ORDER_CHANNEL } from "../shared/constants.js";
import { normalizeLineModifiers } from "../data/normalize.js";
import { normalizeVatSetting, vatRateForSetting } from "./commerce.js";
function cleanSnapshotText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}
function normalizeCurrencyCents(value) {
    const cents = Number(value);
    return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}
function priceToCents(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0)
        return null;
    const cents = Math.round(price * 100);
    return Number.isSafeInteger(cents) ? cents : null;
}
export function getValidOrderLineSnapshot(item) {
    const quantity = Math.floor(Number(item?.quantity) || 0);
    const productName = cleanSnapshotText(item?.productName);
    const unitPriceCents = normalizeCurrencyCents(item?.unitPriceCents);
    const lineTotalCents = normalizeCurrencyCents(item?.lineTotalCents);
    const vatSetting = normalizeVatSetting(item?.vatSetting, "");
    const vatRate = Number(item?.vatRate);
    const kitchenStation = cleanSnapshotText(item?.kitchenStation);
    if (quantity < 1
        || !productName
        || unitPriceCents === null
        || lineTotalCents === null
        || lineTotalCents !== unitPriceCents * quantity
        || !vatSetting
        || !Number.isFinite(vatRate)
        || vatRate < 0
        || vatRate > 1)
        return null;
    return {
        productName,
        unitPriceCents,
        vatSetting,
        vatRate,
        lineTotalCents,
        ...(kitchenStation ? { kitchenStation } : {})
    };
}
export function getOrderLineReportingValues(item, product = null) {
    const productId = cleanSnapshotText(item?.productId);
    const quantity = Math.floor(Number(item?.quantity) || 0);
    const snapshot = getValidOrderLineSnapshot(item);
    if (!productId || quantity < 1 || (!snapshot && !product))
        return null;
    const fallbackUnitPriceCents = priceToCents(product?.price);
    const lineRevenueCents = snapshot
        ? snapshot.lineTotalCents
        : fallbackUnitPriceCents === null ? 0 : fallbackUnitPriceCents * quantity;
    return {
        productId,
        productName: snapshot?.productName || cleanSnapshotText(product?.name) || productId,
        quantity,
        lineRevenueCents,
        usesSnapshot: Boolean(snapshot)
    };
}
export function normalizeOrderItems(items, productById = (_productId) => true) {
    const byProduct = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
        const product = productById(item.productId);
        const quantity = Math.floor(Number(item.quantity) || 0);
        if (!product || quantity < 1)
            return;
        const note = String(item.note || item.notes || "").trim();
        const modifiers = normalizeLineModifiers(item.modifiers);
        const key = JSON.stringify([item.productId, note, modifiers]);
        const current = byProduct.get(key);
        if (current) {
            current.quantity += quantity;
        }
        else {
            byProduct.set(key, { productId: item.productId, quantity, note, modifiers });
        }
    });
    return [...byProduct.values()];
}
export function countOrderItems(items) {
    return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + (Math.floor(Number(item.quantity) || 0)), 0);
}
export function snapshotOrderItems(items, productById) {
    return normalizeOrderItems(items, productById).map((item) => {
        const product = productById(item.productId);
        const unitPriceCents = priceToCents(product?.price);
        if (unitPriceCents === null)
            return item;
        const vatSetting = normalizeVatSetting(product?.vatSetting, "reduced");
        return {
            ...item,
            productName: cleanSnapshotText(product?.name) || item.productId,
            unitPriceCents,
            vatSetting,
            vatRate: vatRateForSetting(vatSetting),
            lineTotalCents: unitPriceCents * item.quantity,
            ...(cleanSnapshotText(product?.station) ? { kitchenStation: cleanSnapshotText(product.station) } : {})
        };
    });
}
export function getOrderLineTotalCents(item, productById) {
    const snapshot = getValidOrderLineSnapshot(item);
    if (snapshot)
        return snapshot.lineTotalCents;
    const quantity = Math.floor(Number(item?.quantity) || 0);
    if (quantity < 1 || typeof productById !== "function")
        return 0;
    const unitPriceCents = priceToCents(productById(item?.productId)?.price);
    return unitPriceCents === null ? 0 : unitPriceCents * quantity;
}
export function calculateItemsTotal(items, productById) {
    const totalCents = (Array.isArray(items) ? items : []).reduce((sum, item) => sum + getOrderLineTotalCents(item, productById), 0);
    return totalCents / 100;
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
    if (isPhoneMessageOrder(normalizedChannel))
        return normalizePhoneMessageFulfillment(value);
    if (normalizedChannel === WEBSITE_ORDER_CHANNEL)
        return normalizeWebsiteFulfillment(value);
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
    if (!product || !product.active || product.soldOut)
        return false;
    const availabilityKey = getChannelAvailabilityKey(channel);
    return Boolean(product.availability?.[availabilityKey]);
}
export function productCanBeOrderedForOrderContext(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    if (!product || !product.active || product.soldOut)
        return false;
    if (isPhoneMessageOrder(orderContext.channel)) {
        return productCanBeOrdered(product, phoneMessageFulfillmentOption(orderContext.fulfillment).channel);
    }
    if (!productCanBeOrdered(product, orderContext.channel))
        return false;
    if (orderContext.channel !== WEBSITE_ORDER_CHANNEL)
        return true;
    return productCanBeOrdered(product, websiteFulfillmentOption(orderContext.fulfillment).channel);
}
//# sourceMappingURL=orders.js.map