import {
  EXTERNAL_DELIVERY_ORDER_CHANNEL,
  EXTERNAL_DELIVERY_PLATFORMS
} from "../shared/constants.js";
import {
  buildExternalMenuPayload,
  calculateExternalCommission,
  externalImportMethodLabel,
  externalPlatformName,
  matchExternalOrderItems,
  mapInternalOrderStatusToExternalStatus,
  normalizeExternalCommissionRate,
  normalizeExternalImportMethod,
  normalizeExternalPlatformId,
  normalizeExternalPlatformStatus,
  parseExternalOrderLines
} from "../domain/external-delivery.js";
import { timeNow } from "../shared/dates.js";
import { slugify, uniqueRecordId } from "../shared/ids.js";
import { saveState, state } from "./state.js";
import { recordOrderPayment } from "./payment-ledger.js";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sameText(first, second) {
  return cleanText(first).toLowerCase() === cleanText(second).toLowerCase();
}

export function createExternalDeliveryRuntime(deps) {
  const {
    can,
    currentUser,
    getOrderTotal,
    normalizeOrderItems,
    productById,
    render,
    sendOrderToKitchen,
    showToast,
    upsertCustomerFromOrderDetails,
    validateOrderForKitchen
  } = deps;

  function platformById(platformId) {
    const id = normalizeExternalPlatformId(platformId);
    return state.externalPlatforms.find((platform) => platform.id === id);
  }

  function requirePlatformManager() {
    if (!can("canEditSettings")) {
      showToast("This role cannot manage external platform settings.");
      return false;
    }
    return true;
  }

  function requireExternalOrderAccess() {
    if (!can("canCreateOrders")) {
      showToast("This role cannot import external orders.");
      return false;
    }
    return true;
  }

  function saveExternalPlatformRecord(formData) {
    if (!requirePlatformManager()) return;

    const platformId = normalizeExternalPlatformId(formData.get("platformId"));
    const option = EXTERNAL_DELIVERY_PLATFORMS.find((platform) => platform.id === platformId);
    const existing = platformById(platformId);
    const record = {
      id: platformId,
      name: option?.name || externalPlatformName(platformId),
      status: normalizeExternalPlatformStatus(formData.get("status")),
      integrationMethod: normalizeExternalImportMethod(formData.get("integrationMethod")),
      commissionRate: normalizeExternalCommissionRate(formData.get("commissionRate")),
      apiDetails: cleanText(formData.get("apiDetails")),
      lastMenuPushedAt: existing?.lastMenuPushedAt || "",
      lastMenuPushedAtMs: existing?.lastMenuPushedAtMs || "",
      lastMenuPayload: existing?.lastMenuPayload || null
    };

    if (existing) Object.assign(existing, record);
    else state.externalPlatforms.push(record);

    saveState();
    render();
    showToast(`${record.name} integration saved.`);
  }

  function saveExternalProductMapping(formData) {
    if (!requirePlatformManager()) return;

    const platformId = normalizeExternalPlatformId(formData.get("platformId"));
    const externalName = cleanText(formData.get("externalName"));
    const externalCode = cleanText(formData.get("externalCode"));
    const product = productById(formData.get("productId"));
    const commissionRateInput = cleanText(formData.get("commissionRate"));
    if (!externalName && !externalCode) {
      showToast("Add an external name or platform code.");
      return;
    }
    if (!product || !product.active || !product.availability?.externalDeliveryApps) {
      showToast("Choose an active internal product available for external delivery apps.");
      return;
    }

    const mappingId = cleanText(formData.get("mappingId"));
    const existing = state.externalProductMappings.find((mapping) => mapping.id === mappingId)
      || state.externalProductMappings.find((mapping) => {
        if (mapping.platformId !== platformId) return false;
        if (externalCode && sameText(mapping.externalCode, externalCode)) return true;
        return externalName && sameText(mapping.externalName, externalName);
      });
    const id = existing?.id || uniqueRecordId(`MAP-${platformId}-${slugify(externalCode || externalName, "external-product")}`, [state.externalProductMappings], "external-mapping");
    const mapping = {
      id,
      platformId,
      externalName,
      externalCode,
      productId: product.id,
      commissionRate: commissionRateInput ? normalizeExternalCommissionRate(commissionRateInput) : "",
      active: formData.getAll("active").includes("on"),
      lastPushedAt: existing?.lastPushedAt || "",
      lastPushedAtMs: existing?.lastPushedAtMs || ""
    };

    if (existing) Object.assign(existing, mapping);
    else state.externalProductMappings.push(mapping);

    saveState();
    render();
    showToast(`${externalName || externalCode} mapped to ${product.name}.`);
  }

  function toggleExternalProductMapping(mappingId) {
    if (!requirePlatformManager()) return;
    const mapping = state.externalProductMappings.find((item) => item.id === mappingId);
    if (!mapping) {
      showToast("External product mapping not found.");
      return;
    }
    mapping.active = !mapping.active;
    saveState();
    render();
    showToast(`${mapping.externalName || mapping.externalCode} mapping ${mapping.active ? "enabled" : "paused"}.`);
  }

  function pushMenuToExternalPlatform(platformId) {
    if (!requirePlatformManager()) return;
    const platform = platformById(platformId);
    if (!platform) {
      showToast("External platform not found.");
      return;
    }

    const now = timeNow();
    const nowMs = Date.now();
    const payload = buildExternalMenuPayload(platform, state.externalProductMappings, productById, {
      generatedAt: new Date(nowMs).toISOString()
    });
    platform.lastMenuPushedAt = now;
    platform.lastMenuPushedAtMs = nowMs;
    platform.lastMenuPayload = payload;
    state.externalProductMappings
      .filter((mapping) => mapping.platformId === platform.id && mapping.active !== false)
      .forEach((mapping) => {
        mapping.lastPushedAt = now;
        mapping.lastPushedAtMs = nowMs;
      });

    saveState();
    render();
    showToast(`${payload.items.length} menu items prepared for ${platform.name}.`);
  }

  function importExternalOrder(formData) {
    if (!requireExternalOrderAccess()) return;

    const platformId = normalizeExternalPlatformId(formData.get("platformId"));
    const platform = platformById(platformId);
    if (!platform) {
      showToast("Choose an external platform.");
      return;
    }

    const rawText = String(formData.get("rawOrder") || "").trim();
    const rawItems = parseExternalOrderLines(rawText);
    if (!rawItems.length) {
      showToast("Paste at least one external order line.");
      return;
    }

    const { matched, unmatched } = matchExternalOrderItems(rawItems, {
      platformId,
      mappings: state.externalProductMappings,
      productById
    });
    if (unmatched.length) {
      const missing = unmatched.map((item) => item.externalCode || item.externalName).join(", ");
      showToast(`Map these external items before importing: ${missing}.`);
      return;
    }

    const items = normalizeOrderItems(matched.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      note: [item.note, `External ${item.externalCode || item.externalName}`].filter(Boolean).join(" | "),
      modifiers: []
    })));
    if (!items.length) {
      showToast("No mapped products could be imported.");
      return;
    }

    const number = state.nextOrderNumber;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const externalOrderId = cleanText(formData.get("externalOrderId")) || `${platform.id.toUpperCase()}-${createdAtMs}`;
    const customerName = cleanText(formData.get("customerName"));
    const customerPhone = cleanText(formData.get("customerPhone"));
    const deliveryAddress = cleanText(formData.get("deliveryAddress"));
    const importMethod = normalizeExternalImportMethod(formData.get("importMethod") || platform.integrationMethod);
    const commissionRateInput = cleanText(formData.get("commissionRate"));
    const commissionRate = commissionRateInput
      ? normalizeExternalCommissionRate(commissionRateInput)
      : normalizeExternalCommissionRate(platform.commissionRate);
    const staff = currentUser();
    const order: any = {
      id: `ORD-${number}`,
      number,
      channel: EXTERNAL_DELIVERY_ORDER_CHANNEL,
      orderType: EXTERNAL_DELIVERY_ORDER_CHANNEL,
      tableId: "",
      customer: customerName || platform.name,
      customerName,
      customerPhone,
      customerEmail: "",
      deliveryAddress,
      requestedTime: cleanText(formData.get("requestedTime")),
      paymentStatus: "Paid",
      paymentMethod: "External delivery app payment",
      paymentReference: externalOrderId,
      paymentProcessor: platform.name,
      fulfillment: "Delivery",
      status: "New",
      operationalStatus: "New",
      fulfillmentStatus: "Scheduled",
      createdAt,
      createdAtMs,
      sentAt: "",
      paidAt: createdAt,
      paidAtMs: createdAtMs,
      staffId: staff?.id || "",
      staffName: staff?.name || externalImportMethodLabel(importMethod),
      paidByUserId: "",
      paidByName: platform.name,
      inventoryDeducted: false,
      assignedDriver: "",
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
      customerNotes: "",
      notes: [cleanText(formData.get("notes")), `Imported from ${platform.name} via ${externalImportMethodLabel(importMethod)}.`].filter(Boolean).join(" "),
      externalPlatformId: platform.id,
      externalPlatformName: platform.name,
      externalOrderId,
      externalImportMethod: importMethod,
      externalCommissionRate: commissionRate,
      externalCommissionAmount: 0,
      externalStatus: "accepted",
      externalStatusPushedAt: "",
      externalStatusPushedAtMs: "",
      items
    };
    order.externalCommissionAmount = calculateExternalCommission(getOrderTotal(order), commissionRate);

    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
      showToast(validation.message);
      return;
    }

    const customerRecord = customerName || customerPhone
      ? upsertCustomerFromOrderDetails({ name: customerName || platform.name, phone: customerPhone, deliveryAddress })
      : null;
    if (customerRecord) order.customerId = customerRecord.id;

    state.orders.push(order);
    recordOrderPayment(order, {
      provider: platform.id,
      paymentMethod: "External delivery app payment",
      paymentProcessor: platform.name,
      paymentReference: externalOrderId,
      amountCents: Math.round(getOrderTotal(order) * 100),
      captureMode: "external_platform",
      sourceChannel: EXTERNAL_DELIVERY_ORDER_CHANNEL
    });
    state.nextOrderNumber += 1;
    state.receiptOrderId = order.id;
    state.externalOrderImports.push({
      id: `EXT-IMP-${createdAtMs}`,
      platformId: platform.id,
      platformName: platform.name,
      externalOrderId,
      importMethod,
      orderId: order.id,
      importedAt: createdAt,
      importedAtMs: createdAtMs,
      status: "Imported",
      matchedItems: matched.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        externalCode: item.externalCode,
        externalName: item.externalName
      })),
      unmatchedItems: [],
      rawText,
      lastPushedStatus: "",
      statusPushedAt: "",
      statusPushedAtMs: ""
    });
    state.externalOrderImports = state.externalOrderImports.slice(-80);
    sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
    showToast(`${platform.name} order ${externalOrderId} imported and sent to kitchen.`);
  }

  function pushExternalOrderStatus(orderId) {
    if (!can("canCreateOrders") && !can("canEditSettings")) {
      showToast("This role cannot update external platform statuses.");
      return;
    }

    const order = state.orders.find((item) => item.id === orderId);
    if (!order || order.channel !== EXTERNAL_DELIVERY_ORDER_CHANNEL) {
      showToast("Choose an external delivery app order.");
      return;
    }

    const nextStatus = mapInternalOrderStatusToExternalStatus(order);
    const now = timeNow();
    const nowMs = Date.now();
    order.externalStatus = nextStatus;
    order.externalStatusPushedAt = now;
    order.externalStatusPushedAtMs = nowMs;
    const importRecord = state.externalOrderImports.find((record) => record.orderId === order.id);
    if (importRecord) {
      importRecord.status = "Status pushed";
      importRecord.lastPushedStatus = nextStatus;
      importRecord.statusPushedAt = now;
      importRecord.statusPushedAtMs = nowMs;
    }

    saveState();
    render();
    showToast(`${order.externalPlatformName || "Platform"} status updated to ${nextStatus}.`);
  }

  return {
    importExternalOrder,
    pushExternalOrderStatus,
    pushMenuToExternalPlatform,
    saveExternalPlatformRecord,
    saveExternalProductMapping,
    toggleExternalProductMapping
  };
}
