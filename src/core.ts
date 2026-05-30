// This is the TypeScript port of the original static prototype.
// New work should move into focused modules; core.ts remains the legacy app shell
// while domain, data, and utility code are extracted incrementally.

import {
  MINUTE_MS,
  TICKET_STATUSES,
  UNPAID_PAYMENT_METHOD,
  DEFAULT_PAID_PAYMENT_METHOD,
  VAT_RATES,
  TICKET_SLA_MINUTES,
  SLA_WARNING_WINDOW_MINUTES,
  KITCHEN_STATIONS,
  KITCHEN_STATION_ALIASES,
  PRODUCT_CATEGORIES,
  VAT_OPTIONS,
  AVAILABILITY_OPTIONS,
  DEFAULT_PRODUCT_AVAILABILITY,
  UNIT_TYPES,
  DEFAULT_INVENTORY_LOCATIONS,
  INVENTORY_ACTIONS,
  WASTE_REASONS,
  RECIPE_APPLIES_OPTIONS,
  DEFAULT_MARGIN_TARGET,
  DEFAULT_MARGIN_MINIMUM,
  DEFAULT_RECIPE_ORDER_CONTEXT,
  PHASE_11_SEED_INGREDIENT_IDS,
  PHASE_11_SEED_PRODUCT_IDS,
  CUSTOMER_QR_CHANNEL,
  CUSTOMER_QR_ORDER_CONTEXT,
  WEBSITE_ORDER_CHANNEL,
  WEBSITE_PAYMENT_PROCESSOR,
  QR_CODE_STATUSES,
  DRIVER_IDLE_STATUS,
  ROLE_ORDER,
  ROLE_DEFINITIONS,
  LANGUAGE_OPTIONS,
  PROCEDURE_DEPARTMENTS,
  PROCEDURE_FREQUENCIES,
  PROCEDURE_ASSIGNED_ROLES,
  PROCEDURE_COMPLETION_STATUSES,
  DEFAULT_RESTAURANT_SETTINGS,
  DATA_MODEL
} from "./shared/constants.js";
import { resetState, saveState, state } from "./app/state.js";
import { createAppRenderer } from "./app/render.js";
import {
  normalizeKitchenStation,
  unitTypeDefinition,
  normalizeProductAvailability,
  normalizeMarginPercent,
  normalizeRecipeWastePercent,
  normalizeRecipeAppliesTo,
  normalizeRecipeLine,
  normalizeRecipeLines,
  normalizeBatchOutput,
  normalizeStockQuantity,
  normalizeInventoryLocationName,
  isDefaultInventoryLocation,
  sortInventoryLocations,
  normalizeLocationStock,
  getIngredientTotalStock,
  getIngredientPrimaryLocation,
  syncIngredientStock,
  normalizeCustomInventoryLocations,
  normalizeInventoryHistory,
  normalizeWasteReason,
  getWasteUnitOptionsForIngredient,
  normalizeWasteUnitType,
  convertWasteQuantityToStockUnits,
  getWasteCost,
  normalizeWasteTimestamp,
  normalizeWasteRecords,
  normalizeIngredients,
  normalizeProducts,
  normalizeProductionBatchLines,
  normalizeProductionBatches,
  normalizeRestaurantSettings,
  normalizeUsers,
  normalizeDrivers,
  normalizeProcedureLanguage,
  normalizeProcedureFrequency,
  normalizeProcedureAssignedRole,
  normalizeProcedureDepartment,
  normalizeListInput,
  normalizeProcedureSteps,
  normalizeProcedureMedia,
  normalizeProcedureRecord,
  normalizeProcedures,
  isLegacyProcedureList,
  mergeDefaultProcedures,
  normalizeProcedureCompletions,
  normalizeProcedureProgress,
  normalizeOrderStatus,
  normalizePaymentStatus,
  normalizeDeliveryNotes,
  normalizeLineModifiers,
  normalizeOrderLineItem,
  normalizeCustomerRecord,
  normalizeCustomers
} from "./data/normalize.js";
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
  normalizeDriverDeliveryStatus,
  normalizeDriverStatus,
  normalizePickupStatus,
  reconcileDeliveryAssignments,
  setDriverIdle,
  syncDriverWithDeliveryOrder
} from "./domain/delivery.js";
import {
  findCustomerByPhone as findCustomerByPhoneInList,
  findCustomerBySearchValue as findCustomerBySearchValueInList,
  getAddressHistoryForCustomer as getAddressHistoryForCustomerFromOrders,
  getCustomerOptionLabel as getCustomerOptionLabelFromRecord,
  getCustomerPrimaryAddress as getCustomerPrimaryAddressFromRecord,
  getFavoriteItemsForCustomer as getFavoriteItemsForCustomerFromOrders,
  getManualOrderCustomerDetails as getManualOrderCustomerDetailsFromForm,
  getOrdersForCustomer as getOrdersForCustomerFromList,
  upsertCustomerFromOrderDetails as upsertCustomerRecordFromOrderDetails
} from "./domain/customers.js";
import {
  getProductAvailability as getProductAvailabilityFromInventory,
  getStockRequirementsForItems as getStockRequirementsForItemsFromInventory,
  getStockShortages as getStockShortagesFromInventory,
  planStockDeduction
} from "./domain/inventory.js";
import { advanceStatus, getOrderProgressSummary as summarizeOrderProgress, setTicketStatus } from "./domain/kitchen.js";
import {
  calculateItemsTotal,
  calculateOrderTotal,
  countOrderItems,
  isPhoneMessageOrder,
  normalizeOrderItems as normalizeOrderItemsForProducts,
  normalizeOrderFulfillment,
  normalizeOrderType,
  normalizePhoneMessageFulfillment,
  normalizeWebsiteFulfillment,
  orderTypeDefinition,
  phoneMessageFulfillmentOption,
  productCanBeOrdered,
  productCanBeOrderedForOrderContext,
  websiteFulfillmentOption
} from "./domain/orders.js";
import { getPaymentStatusForMethod, isPaidPaymentMethod, normalizePaymentMethod } from "./domain/payments.js";
import {
  getProductCost as getProductCostFromRecipe,
  getProductGrossMargin as getProductGrossMarginFromRecipe,
  getProductMargin as getProductMarginFromRecipe,
  getProductMarginProfile as getProductMarginProfileFromRecipe,
  productAvailabilityLabel as productAvailabilityLabelForProduct,
  productHasConditionalRecipeLines as productHasConditionalRecipeLinesForProduct
} from "./domain/products.js";
import {
  convertActualUsageToStockUnits as convertActualUsageToStockUnitsForRecipe,
  convertRecipeLineToStockUnits as convertRecipeLineToStockUnitsForRecipe,
  getRecipeLineQuantity as getRecipeLineQuantityFromRecipe,
  getRecipeLineWasteMultiplier as getRecipeLineWasteMultiplierFromRecipe,
  getRecipeMeasure as getRecipeMeasureFromRecipe,
  getRecipeUsageLabel as getRecipeUsageLabelFromRecipe,
  isTakeawayDeliveryContext as isTakeawayDeliveryOrderContext,
  recipeLineAppliesToOrder as recipeLineAppliesToOrderContext
} from "./domain/recipes.js";
import {
  formatReservationMinutes,
  getAvailableReservationTable as getAvailableReservationTableFromList,
  getReservationConflicts as getReservationConflictsFromList,
  getReservationIssues as getReservationIssuesFromList,
  getReservationMinutes,
  getReservationValidation as getReservationValidationFromList,
  getReservationWindow,
  getReservationWindowLabel,
  isReservationTime
} from "./domain/reservations.js";
import {
  canView as canViewFromList,
  getCurrentRoleKey,
  getCurrentUser,
  roleCan,
  roleDefinition as getRoleDefinition,
  visibleViewsForRole
} from "./domain/users.js";
import { formatDateTime, formatDuration, normalizeOptionalTimestamp, normalizeTimestamp, timeNow } from "./shared/dates.js";
import { escapeHtml } from "./shared/html.js";
import { slugify, uniqueRecordId } from "./shared/ids.js";
import { formatMoney } from "./shared/money.js";
import { createPublicOrderingUi } from "./ui/public-ordering.js";
import { createProceduresUi } from "./ui/procedures.js";
import { createTeamUi } from "./ui/team.js";
import { createSettingsUi } from "./ui/settings.js";
import { createOrdersUi } from "./ui/orders.js";
import { createKitchenUi } from "./ui/kitchen.js";
import { createInventoryUi } from "./ui/inventory.js";
import { createDashboardUi } from "./ui/dashboard.js";
import { createOrderBuilderUi } from "./ui/order-builder.js";
import { createOrderCardsUi } from "./ui/order-cards.js";
import { qrCodeSvg } from "./shared/qr.js";

const views = [
  { id: "dashboard", label: "Command", icon: "CM" },
  { id: "orders", label: "Orders", icon: "OR" },
  { id: "kitchen", label: "Kitchen", icon: "KT" },
  { id: "inventory", label: "Inventory", icon: "IN" },
  { id: "procedures", label: "Procedures", icon: "PR" },
  { id: "team", label: "Team", icon: "TM" },
  { id: "settings", label: "Settings", icon: "SE" },
  { id: "reservations", label: "Bookings", icon: "BK" }
];

function money(value) {
  return formatMoney(value, state?.restaurantSettings?.currency || "EUR");
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

function ingredientById(id) {
  return state.ingredients.find((ingredient) => ingredient.id === id);
}

function getAllInventoryLocations() {
  const locations = [
    ...DEFAULT_INVENTORY_LOCATIONS,
    ...(state.customInventoryLocations || [])
  ];
  state.ingredients.forEach((ingredient) => {
    Object.keys(ingredient.locationStock || {}).forEach((location) => locations.push(location));
    if (ingredient.location) locations.push(ingredient.location);
  });
  return sortInventoryLocations(locations);
}

function getIngredientLocationRows(ingredient, includeEmpty = false) {
  const locations = includeEmpty ? getAllInventoryLocations() : Object.keys(ingredient.locationStock || {});
  return sortInventoryLocations(locations)
    .map((location) => ({
      location,
      quantity: normalizeStockQuantity(ingredient.locationStock?.[location] || 0)
    }))
    .filter((row) => includeEmpty || row.quantity > 0);
}

function formatLocationOptionLabel(ingredient, location) {
  const quantity = ingredient ? normalizeStockQuantity(ingredient.locationStock?.[location] || 0) : 0;
  return ingredient ? `${location} (${formatStockAmount(quantity, ingredient.unit)})` : location;
}

function inventoryActionLabel(type) {
  return INVENTORY_ACTIONS.find((action) => action.id === type)?.label || "Stock action";
}

function orderById(id) {
  return state.orders.find((order) => order.id === id);
}

function customerById(id) {
  return state.customers.find((customer) => customer.id === id);
}

function findCustomerByPhone(phone) {
  return findCustomerByPhoneInList(state.customers, phone);
}

function getCustomerPrimaryAddress(customer) {
  return getCustomerPrimaryAddressFromRecord(customer);
}

function getCustomerOptionLabel(customer) {
  return getCustomerOptionLabelFromRecord(customer);
}

function findCustomerBySearchValue(value) {
  return findCustomerBySearchValueInList(state.customers, value);
}

function getOrdersForCustomer(customer) {
  return getOrdersForCustomerFromList(customer, state.orders);
}

function getFavoriteItemsForCustomer(customer) {
  return getFavoriteItemsForCustomerFromOrders(customer, state.orders, productById, normalizeOrderItems);
}

function getAddressHistoryForCustomer(customer) {
  return getAddressHistoryForCustomerFromOrders(customer, state.orders);
}

function getManualOrderCustomerDetails(formData, channel) {
  return getManualOrderCustomerDetailsFromForm(formData, channel, customerById);
}

function upsertCustomerFromOrderDetails(details) {
  return upsertCustomerRecordFromOrderDetails(state.customers, details);
}

function productAvailabilityLabel(product) {
  return productAvailabilityLabelForProduct(product);
}

function getOrderableProducts(channel) {
  return state.products.filter((product) => productCanBeOrdered(product, channel));
}

function getOrderableProductsForContext(orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return state.products.filter((product) => productCanBeOrderedForOrderContext(product, orderContext));
}

function tableById(id) {
  return state.tables.find((table) => table.id === id);
}

function normalizeQrCodeStatus(status) {
  return QR_CODE_STATUSES.includes(status) ? status : "Active";
}

function createQrToken(tableId, existingTokens = new Set()) {
  const base = `${slugify(tableId, "table")}-${Date.now().toString(36).slice(-5)}-${Math.random().toString(36).slice(2, 7)}`;
  let token = base;
  let suffix = 2;
  while (existingTokens.has(token)) {
    token = `${base}-${suffix}`;
    suffix += 1;
  }
  existingTokens.add(token);
  return token;
}

function createDefaultTableQrCodes(tables) {
  return tables.map((table) => ({
    id: `qr-${table.id}`,
    tableId: table.id,
    area: table.zone || "Dining room",
    token: `libabite-${table.id}`,
    status: "Active",
    createdAt: "09:00",
    regeneratedAt: ""
  }));
}

function normalizeTableQrCodes(codes, tables) {
  const tableIds = new Set(tables.map((table) => table.id));
  const tokens = new Set();
  const source = Array.isArray(codes) && codes.length ? codes : createDefaultTableQrCodes(tables);
  const normalized = source
    .map((code, index) => {
      const fallbackTable = tables[index % Math.max(1, tables.length)];
      const tableId = tableIds.has(code.tableId) ? code.tableId : fallbackTable?.id || "";
      if (!tableId) return null;
      const rawToken = String(code.token || "").trim();
      const token = rawToken && !tokens.has(rawToken) ? rawToken : createQrToken(tableId, tokens);
      tokens.add(token);
      const table = tables.find((item) => item.id === tableId);
      return {
        id: code.id || `qr-${tableId}-${index + 1}`,
        tableId,
        area: String(code.area || table?.zone || "Dining room").trim(),
        token,
        status: normalizeQrCodeStatus(code.status),
        createdAt: code.createdAt || timeNow(),
        regeneratedAt: code.regeneratedAt || ""
      };
    })
    .filter(Boolean);

  tables.forEach((table) => {
    if (normalized.some((code) => code.tableId === table.id)) return;
    const token = createQrToken(table.id, tokens);
    normalized.push({
      id: `qr-${table.id}`,
      tableId: table.id,
      area: table.zone || "Dining room",
      token,
      status: "Active",
      createdAt: timeNow(),
      regeneratedAt: ""
    });
  });

  return normalized;
}

function qrCodeById(id) {
  return state.tableQrCodes.find((code) => code.id === id);
}

function qrCodeByToken(token) {
  return state.tableQrCodes.find((code) => code.token === token);
}

function getActiveQrCodeForTable(tableId) {
  return state.tableQrCodes.find((code) => code.tableId === tableId && code.status === "Active") || null;
}

function getQrBaseUrl() {
  const base = `${window.location.origin}${window.location.pathname}`;
  return window.location.protocol === "file:" ? window.location.pathname : base;
}

function getQrOrderUrl(code) {
  const separator = getQrBaseUrl().includes("?") ? "&" : "?";
  return `${getQrBaseUrl()}${separator}qr=${encodeURIComponent(code.token)}`;
}

function getStaffUrl() {
  return getQrBaseUrl();
}

function getWebsiteOrderingUrl() {
  const separator = getQrBaseUrl().includes("?") ? "&" : "?";
  return `${getQrBaseUrl()}${separator}order=website`;
}

function getCustomerQrSession() {
  const params = new URLSearchParams(window.location.search);
  const token = String(params.get("qr") || "").trim();
  const tableParam = String(params.get("table") || "").trim();
  if (!token && !tableParam) return null;

  if (token) {
    const code = qrCodeByToken(token);
    if (!code) return { error: "This QR code is not recognized.", code: null, table: null };
    const table = tableById(code.tableId);
    if (!table) return { error: "This QR code is not assigned to a table.", code, table: null };
    if (code.status !== "Active") return { error: `${table.name} ordering is disabled.`, code, table };
    return { error: "", code, table };
  }

  const table = tableById(tableParam);
  if (!table) return { error: "This table link is not recognized.", code: null, table: null };
  const code = getActiveQrCodeForTable(table.id);
  if (!code) return { error: `${table.name} does not have an active QR code.`, code: null, table };
  return { error: "", code, table };
}

function getWebsiteOrderSession() {
  const params = new URLSearchParams(window.location.search);
  const route = String(params.get("order") || params.get("website") || params.get("channel") || "").trim().toLowerCase();
  if (route !== "website" && route !== "online" && route !== "web") return null;
  return { error: "", mode: "website" };
}

function getCustomerOrderingSession() {
  const qrSession = getCustomerQrSession();
  if (qrSession) return { ...qrSession, mode: "qr" };
  return getWebsiteOrderSession();
}

function getReservationConflicts(candidate, reservations = state.reservations) {
  return getReservationConflictsFromList(candidate, reservations);
}

function getAvailableReservationTable(candidate, tables = state.tables, reservations = state.reservations) {
  return getAvailableReservationTableFromList(candidate, tables, reservations);
}

function getReservationIssues(reservation) {
  return getReservationIssuesFromList(reservation, state.tables, state.reservations);
}

function getReservationValidation(candidate) {
  return getReservationValidationFromList(candidate, state.tables, state.reservations);
}

function getOrderTotal(order) {
  return calculateOrderTotal(order, (productId) => productById(productId));
}

function getVatRate(product) {
  return VAT_RATES[product?.vatSetting] ?? VAT_RATES.standard;
}

function getVatLabel(vatSetting) {
  return VAT_OPTIONS.find((option) => option.id === vatSetting)?.label || "Standard VAT";
}

function getOrderSubtotalExcludingVat(order) {
  return normalizeOrderItems(order.items || []).reduce((sum, item) => {
    const product = productById(item.productId);
    if (!product) return sum;
    const lineTotal = product.price * item.quantity;
    return sum + (lineTotal / (1 + getVatRate(product)));
  }, 0);
}

function getOrderVatTotal(order) {
  return Math.max(0, getOrderTotal(order) - getOrderSubtotalExcludingVat(order));
}

function getOrderVatBreakdown(order) {
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

function getCurrentOrderContext() {
  const form: any = document.querySelector("#orderForm");
  const channel = normalizeOrderType(form?.elements.channel.value || DEFAULT_RECIPE_ORDER_CONTEXT.channel);
  return {
    channel,
    fulfillment: normalizeOrderFulfillment(channel, form?.elements.fulfillment?.value || DEFAULT_RECIPE_ORDER_CONTEXT.fulfillment)
  };
}

function isTakeawayDeliveryContext(orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return isTakeawayDeliveryOrderContext(orderContext);
}

function recipeLineAppliesToOrder(line, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return recipeLineAppliesToOrderContext(line, orderContext);
}

function getRecipeLineWasteMultiplier(line) {
  return getRecipeLineWasteMultiplierFromRecipe(line);
}

function getLineCost(line, orderContext = null) {
  if (orderContext && !recipeLineAppliesToOrder(line, orderContext)) return 0;
  const ingredient = ingredientById(line.ingredientId);
  if (!ingredient) return 0;
  return convertRecipeLineToStockUnits(line) * ingredient.purchasePrice;
}

function getProductCost(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductCostFromRecipe(product, getLineCost, orderContext);
}

function getProductGrossMargin(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductGrossMarginFromRecipe(product, getLineCost, orderContext);
}

function getProductMargin(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductMarginFromRecipe(product, getLineCost, orderContext);
}

function productHasConditionalRecipeLines(product) {
  return productHasConditionalRecipeLinesForProduct(product);
}

function getProductMarginProfile(product) {
  return getProductMarginProfileFromRecipe(product, getLineCost);
}

function getRecipeUsageLabel(line) {
  return getRecipeUsageLabelFromRecipe(line);
}

function getRecipeMeasure(line) {
  return getRecipeMeasureFromRecipe(line);
}

function getRecipeLineQuantity(line) {
  return getRecipeLineQuantityFromRecipe(line);
}

function getProductionFieldName(line, index) {
  return `actual-${index}-${line.ingredientId}`;
}

function formatActualUsageLabel(actualUsage, measure) {
  return measure.key === "units" ? `${actualUsage} ${measure.shortLabel}` : `${actualUsage}${measure.shortLabel}`;
}

function convertRecipeLineToStockUnits(line) {
  return convertRecipeLineToStockUnitsForRecipe(line, ingredientById(line.ingredientId), unitTypeDefinition);
}

function convertActualUsageToStockUnits(line, actualUsage) {
  return convertActualUsageToStockUnitsForRecipe(line, actualUsage, ingredientById(line.ingredientId), unitTypeDefinition);
}

function roundMoneyValue(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function formatSignedAmount(value, suffix = "") {
  const numericValue = Number(value) || 0;
  const sign = numericValue > 0 ? "+" : "";
  return `${sign}${numericValue.toFixed(1)}${suffix}`;
}

function getProductionProducts() {
  return state.products.filter((product) => product.recipe?.length);
}

function getDefaultProductionProductId(selectedProductId = "") {
  const products = getProductionProducts();
  if (products.some((product) => product.id === selectedProductId)) return selectedProductId;
  return products.find((product) => product.batchOutput)?.id || products[0]?.id || "";
}

function getProductionOutputDefault(product) {
  return product?.batchOutput || {
    ingredientId: "",
    quantity: 0,
    unitType: "",
    location: ""
  };
}

function getProductionFormValue(form, name, fallback = "") {
  const field = form?.elements?.[name];
  return field ? field.value : fallback;
}

function getProductionOutputUnitType(ingredient, requestedUnitType, fallbackUnitType = "") {
  if (!ingredient) return "";
  const allowedUnits = getWasteUnitOptionsForIngredient(ingredient);
  const requested = unitTypeDefinition(requestedUnitType).id;
  if (allowedUnits.some((unit) => unit.id === requested)) return requested;
  const fallback = unitTypeDefinition(fallbackUnitType || ingredient.unitType).id;
  if (allowedUnits.some((unit) => unit.id === fallback)) return fallback;
  return allowedUnits[0]?.id || ingredient.unitType;
}

function getProductionStepCheckboxes(form: any = document.querySelector("#productionForm")) {
  return Array.from(form?.querySelectorAll("[data-production-step]") || []) as any[];
}

function productionStepsComplete(form: any = document.querySelector("#productionForm")) {
  const steps = getProductionStepCheckboxes(form);
  return steps.length ? steps.every((step) => step.checked) : false;
}

function productionMarkedComplete(form: any = document.querySelector("#productionForm")) {
  return Boolean(form?.elements?.prepComplete?.checked);
}

function getProductionLineDraft(line, index, form) {
  const ingredient = ingredientById(line.ingredientId);
  if (!ingredient) return null;
  const measure = getRecipeMeasure(line);
  const plannedUsage = normalizeStockQuantity(getRecipeLineQuantity(line) * getRecipeLineWasteMultiplier(line));
  const actualFieldName = getProductionFieldName(line, index);
  const rawActualUsage = getProductionFormValue(form, actualFieldName, String(plannedUsage));
  const actualUsage = normalizeStockQuantity(rawActualUsage);
  const plannedStockQuantity = normalizeStockQuantity(convertRecipeLineToStockUnits(line));
  const actualStockQuantity = normalizeStockQuantity(convertActualUsageToStockUnits(line, actualUsage));
  const plannedCost = roundMoneyValue(plannedStockQuantity * ingredient.purchasePrice);
  const actualCost = roundMoneyValue(actualStockQuantity * ingredient.purchasePrice);
  const shortage = ingredient.active ? Math.max(0, actualStockQuantity - ingredient.stock) : actualStockQuantity;
  return {
    index,
    sourceLine: line,
    ingredient,
    measure,
    plannedUsage,
    actualUsage,
    plannedStockQuantity,
    actualStockQuantity,
    plannedCost,
    actualCost,
    shortage: normalizeStockQuantity(shortage)
  };
}

function getProductionExecutionDraft(form = document.querySelector("#productionForm")) {
  const product = productById(getProductionFormValue(form, "productId"));
  const outputDefault = getProductionOutputDefault(product);
  const lines = (product?.recipe || [])
    .map((line, index) => getProductionLineDraft(line, index, form))
    .filter(Boolean);
  const plannedCost = roundMoneyValue(lines.reduce((sum, line) => sum + line.plannedCost, 0));
  const actualCost = roundMoneyValue(lines.reduce((sum, line) => sum + line.actualCost, 0));
  const price = Number(product?.price) || 0;
  const plannedMargin = price ? ((price - plannedCost) / price) * 100 : null;
  const actualMargin = price ? ((price - actualCost) / price) * 100 : null;
  const outputIngredientId = getProductionFormValue(form, "outputIngredientId", outputDefault.ingredientId || "");
  const outputIngredient = ingredientById(outputIngredientId);
  const outputQuantity = outputIngredient
    ? normalizeStockQuantity(getProductionFormValue(form, "outputQuantity", outputDefault.quantity || ""))
    : 0;
  const outputUnitType = outputIngredient
    ? getProductionOutputUnitType(outputIngredient, getProductionFormValue(form, "outputUnitType", outputDefault.unitType), outputDefault.unitType)
    : "";
  const outputStockQuantity = outputIngredient && outputQuantity > 0
    ? convertWasteQuantityToStockUnits(outputIngredient, outputQuantity, outputUnitType)
    : 0;
  const outputUnitCost = outputStockQuantity > 0 ? roundMoneyValue(actualCost / outputStockQuantity) : 0;
  const outputLocation = outputIngredient
    ? normalizeInventoryLocationName(getProductionFormValue(form, "outputLocation", outputDefault.location || outputIngredient.location), outputIngredient.location)
    : "";

  return {
    product,
    lines,
    plannedCost,
    actualCost,
    costDelta: roundMoneyValue(actualCost - plannedCost),
    plannedMargin,
    actualMargin,
    marginDelta: plannedMargin === null || actualMargin === null ? null : actualMargin - plannedMargin,
    outputIngredient,
    outputQuantity,
    outputUnitType,
    outputStockQuantity,
    outputUnitCost,
    outputLocation
  };
}

function getProductionReadiness(draft, form = document.querySelector("#productionForm")) {
  const shortages = draft.lines.filter((line) => line.shortage > 0);
  const zeroActuals = draft.lines.filter((line) => line.actualUsage <= 0);
  const needsOutputQuantity = Boolean(draft.outputIngredient && draft.outputStockQuantity <= 0);
  const stepsDone = productionStepsComplete(form);
  const markedDone = productionMarkedComplete(form);

  if (!draft.product || !draft.lines.length) return { ok: false, className: "warning", label: "No recipe", detail: "Select a recipe with ingredients." };
  if (zeroActuals.length) return { ok: false, className: "warning", label: "Actuals needed", detail: "Enter actual quantity for each ingredient." };
  if (shortages.length) return { ok: false, className: "danger", label: "Missing stock", detail: shortages.map((line) => `${line.ingredient.name} ${formatStockAmount(line.shortage, line.ingredient.unit)}`).join(", ") };
  if (needsOutputQuantity) return { ok: false, className: "warning", label: "Yield needed", detail: "Enter the prepared batch quantity." };
  if (!stepsDone || !markedDone) return { ok: false, className: "warning", label: "Steps pending", detail: "Complete the preparation checklist." };
  return { ok: true, className: "ok", label: "Ready", detail: "Batch result can be saved." };
}

function formatStockAmount(value, unit) {
  const safeValue = Math.max(0, Number(value) || 0);
  const wholeUnit = ["pcs", "boxes", "packages"].includes(unit);
  const amount = wholeUnit ? Math.floor(safeValue) : safeValue.toFixed(safeValue >= 10 ? 1 : 2);
  return `${amount} ${unit}`;
}

function formatDateTimeLocalInput(timestamp = Date.now()) {
  const date = new Date(normalizeOptionalTimestamp(timestamp) || Date.now());
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * MINUTE_MS);
  return localTime.toISOString().slice(0, 16);
}

function wasteUnitLabel(unitTypeId) {
  const unitType = UNIT_TYPES.find((type) => type.id === unitTypeId) || unitTypeDefinition(unitTypeId);
  return unitType.shortLabel;
}

function formatWasteQuantity(record) {
  return `${formatStockAmount(record.quantity, wasteUnitLabel(record.unitType))}`;
}

function getWasteReportSummary() {
  const totalCost = state.wasteRecords.reduce((sum, record) => sum + (Number(record.cost) || 0), 0);
  const totalStockQuantity = state.wasteRecords.reduce((sum, record) => sum + (Number(record.stockQuantity) || 0), 0);
  const todayKey = new Date().toDateString();
  const todayRecords = state.wasteRecords.filter((record) => new Date(record.occurredAtMs).toDateString() === todayKey);
  const todayCost = todayRecords.reduce((sum, record) => sum + (Number(record.cost) || 0), 0);
  const reasonCounts = state.wasteRecords.reduce((counts, record) => {
    counts[record.reason] = (counts[record.reason] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  const topReason = (Object.entries(reasonCounts) as [string, number][])
    .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0]?.[0] || "No waste";

  return {
    totalCost,
    totalStockQuantity,
    todayCost,
    todayCount: todayRecords.length,
    topReason,
    count: state.wasteRecords.length
  };
}

function normalizeOrderItems(items) {
  return normalizeOrderItemsForProducts(items, productById);
}

function getInventoryRecipeDeps() {
  return {
    convertRecipeLineToStockUnits,
    ingredientById,
    normalizeOrderItems,
    productById,
    recipeLineAppliesToOrder
  };
}

function getStockRequirementsForItems(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getStockRequirementsForItemsFromInventory(items, getInventoryRecipeDeps(), orderContext);
}

function getProductAvailability(product, reservedItems = state.orderDraft, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductAvailabilityFromInventory(product, reservedItems, getInventoryRecipeDeps(), orderContext);
}

function getStockShortages(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getStockShortagesFromInventory(items, getInventoryRecipeDeps(), orderContext);
}

function getItemsTotal(items) {
  return calculateItemsTotal(normalizeOrderItems(items), (productId) => productById(productId));
}

function getItemCount(items) {
  return countOrderItems(normalizeOrderItems(items));
}

function getIngredientStatus(ingredient) {
  if (!ingredient.active) return "inactive";
  if (ingredient.stock <= ingredient.min) return "danger";
  if (ingredient.max > 0 && ingredient.stock > ingredient.max) return "over";
  if (ingredient.stock <= ingredient.min * 1.25) return "warning";
  return "ok";
}

function getLowStockIngredients() {
  return state.ingredients.filter((ingredient) => ingredient.active && ingredient.stock <= ingredient.min);
}

function getOverStockIngredients() {
  return state.ingredients.filter((ingredient) => ingredient.active && ingredient.max > 0 && ingredient.stock > ingredient.max);
}

function getSupplierKey(supplier) {
  return String(supplier || "supplier").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "supplier";
}

function getSupplierOrderQuantity(ingredient) {
  return Math.max(0, Number((ingredient.max - ingredient.stock).toFixed(3)));
}

function getActiveSupplierOrder(supplier) {
  return state.supplierOrders.find((order) => order.supplier === supplier && order.status !== "Received");
}

function getSupplierOrderTotal(order) {
  return order.items.reduce((sum, item) => {
    const ingredient = ingredientById(item.ingredientId);
    return sum + (ingredient ? ingredient.purchasePrice * item.quantity : 0);
  }, 0);
}

function getSupplierOrderDrafts() {
  const activeOrders = state.supplierOrders
    .filter((order) => order.status !== "Received")
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => ingredientById(item.ingredientId))
    }))
    .filter((order) => order.items.length);
  const bySupplier = new Map<string, any>(activeOrders.map((order) => [order.supplier, order]));

  getLowStockIngredients().forEach((ingredient) => {
    const existing = bySupplier.get(ingredient.supplier);
    if (existing?.status === "Ordered") return;

    const item = {
      ingredientId: ingredient.id,
      quantity: getSupplierOrderQuantity(ingredient)
    };

    if (existing) {
      const nextItems = existing.items.filter((line) => line.ingredientId !== ingredient.id);
      nextItems.push(item);
      existing.items = nextItems;
      return;
    }

    bySupplier.set(ingredient.supplier, {
      id: `SUP-${getSupplierKey(ingredient.supplier)}`,
      supplier: ingredient.supplier,
      status: "Draft",
      createdAt: timeNow(),
      orderedAt: "",
      receivedAt: "",
      items: [item]
    });
  });

  return [...bySupplier.values()].sort((a, b) => a.supplier.localeCompare(b.supplier));
}

function getStationNames() {
  const stations = new Set(KITCHEN_STATIONS);
  state.products.filter((product) => product.active).forEach((product) => stations.add(normalizeKitchenStation(product.station)));
  getOpenTickets().forEach((ticket) => stations.add(normalizeKitchenStation(ticket.station)));
  const knownStations = KITCHEN_STATIONS.filter((station) => stations.has(station));
  const customStations = [...stations]
    .filter((station) => !KITCHEN_STATIONS.includes(station))
    .sort((first, second) => first.localeCompare(second));
  return ["All", ...knownStations, ...customStations];
}

function getOpenTickets() {
  return state.tickets.filter((ticket) => ticket.status !== "Done");
}

function getTicketTargetMinutes(ticket) {
  return Number(ticket.slaMinutes) || TICKET_SLA_MINUTES[ticket.station] || TICKET_SLA_MINUTES.default;
}

function getTicketAgeMinutes(ticket, now = Date.now()) {
  const endTime = ticket.readyAtMs || ticket.completedAtMs || now;
  return Math.max(0, Math.floor((endTime - ticket.createdAtMs) / MINUTE_MS));
}

function getTicketOrderAgeMinutes(ticket, now = Date.now()) {
  const order = orderById(ticket.orderId);
  const startedAt = order?.createdAtMs || ticket.createdAtMs;
  const endTime = ticket.completedAtMs || now;
  return Math.max(0, Math.floor((endTime - startedAt) / MINUTE_MS));
}

function getTicketSla(ticket, now = Date.now()) {
  const targetMinutes = getTicketTargetMinutes(ticket);
  const ageMinutes = getTicketAgeMinutes(ticket, now);
  const remainingMinutes = targetMinutes - ageMinutes;
  const progress = Math.min(100, Math.max(4, Math.round((ageMinutes / targetMinutes) * 100)));

  if (ticket.status === "Delayed") {
    return {
      state: "delayed",
      label: "Delayed",
      pillClass: "danger",
      cardClass: "sla-delayed",
      detail: ticket.issueNote ? `Issue: ${ticket.issueNote}` : "Issue needs manager attention",
      ageMinutes,
      targetMinutes,
      progress: 100
    };
  }

  if (ticket.status === "Ready" || ticket.status === "Done") {
    return {
      state: "ready",
      label: "Ready",
      pillClass: "ok",
      cardClass: "sla-ready",
      detail: `Ready in ${formatDuration(ageMinutes)}`,
      ageMinutes,
      targetMinutes,
      progress
    };
  }

  if (remainingMinutes <= 0) {
    return {
      state: "escalated",
      label: "Escalated",
      pillClass: "danger",
      cardClass: "sla-escalated",
      detail: `${formatDuration(Math.abs(remainingMinutes))} over target`,
      ageMinutes,
      targetMinutes,
      progress: 100
    };
  }

  if (remainingMinutes <= SLA_WARNING_WINDOW_MINUTES) {
    return {
      state: "warning",
      label: "Warn",
      pillClass: "warning",
      cardClass: "sla-warning",
      detail: `${formatDuration(remainingMinutes)} to target`,
      ageMinutes,
      targetMinutes,
      progress
    };
  }

  return {
    state: "aging",
    label: "Aging",
    pillClass: "info",
    cardClass: "sla-aging",
    detail: `${formatDuration(remainingMinutes)} to target`,
    ageMinutes,
    targetMinutes,
    progress
  };
}

function getTicketPriority(ticket, now = Date.now()) {
  const order = orderById(ticket.orderId);
  const sla = getTicketSla(ticket, now);
  if (ticket.status === "Delayed" || sla.state === "escalated") return { label: "Urgent", className: "danger" };
  if (sla.state === "warning" || order?.fulfillment === "Delivery") return { label: "High", className: "warning" };
  if (order?.fulfillment === "Pickup" || normalizeOrderType(order?.channel) === "External delivery app order") {
    return { label: "High", className: "warning" };
  }
  return { label: "Normal", className: "info" };
}

function getTicketStatusLabel(status) {
  if (status === "Queued") return "New";
  if (status === "Done") return "Complete";
  return status;
}

function ticketStatusClass(status) {
  if (status === "Ready" || status === "Done") return "ok";
  if (status === "Preparing" || status === "Accepted") return "info";
  if (status === "Delayed") return "danger";
  return "warning";
}

function getKitchenSlaSummary(tickets = getOpenTickets(), now = Date.now()) {
  return tickets.reduce((summary, ticket) => {
    const sla = getTicketSla(ticket, now);
    summary.total += 1;
    summary[sla.state] = (summary[sla.state] || 0) + 1;
    return summary;
  }, { total: 0, aging: 0, warning: 0, escalated: 0, delayed: 0, ready: 0 });
}

function getSlaSummaryLabel(summary) {
  const issues = [];
  if (summary.delayed) issues.push(`${summary.delayed} delayed`);
  if (summary.escalated) issues.push(`${summary.escalated} escalated`);
  if (summary.warning) issues.push(`${summary.warning} warning`);
  if (issues.length) return issues.join(", ");
  if (summary.total) return "All within SLA";
  return "Kitchen clear";
}

function createNode(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function roleDefinition(role) {
  return getRoleDefinition(role, ROLE_DEFINITIONS);
}

function currentUser() {
  return getCurrentUser(state.users, state.currentUserId);
}

function currentRoleKey() {
  return getCurrentRoleKey(currentUser());
}

function currentRole() {
  return roleDefinition(currentRoleKey());
}

function can(permission) {
  return Boolean(currentUser() && roleCan(currentRole(), permission));
}

function visibleViews() {
  const user = currentUser();
  if (!user) return [];
  return visibleViewsForRole(views, currentRole());
}

function canView(viewId) {
  return canViewFromList(visibleViews(), viewId);
}

function ensureActiveViewAccess() {
  if (!currentUser()) return;
  if (canView(state.activeView)) return;
  state.activeView = currentRole().homeView;
  if (!canView(state.activeView)) state.activeView = visibleViews()[0]?.id || "dashboard";
  saveState();
}

function getCustomerModeFromContext(orderContext = CUSTOMER_QR_ORDER_CONTEXT) {
  return orderContext.channel === WEBSITE_ORDER_CHANNEL ? "website" : "qr";
}

function getCustomerCartStateKey(mode = getCustomerOrderingSession()?.mode || "qr") {
  return mode === "website" ? "websiteCart" : "customerCart";
}

function getCustomerLastOrderStateKey(mode = getCustomerOrderingSession()?.mode || "qr") {
  return mode === "website" ? "websiteLastOrderId" : "customerLastOrderId";
}

function getCustomerOrderContext(mode = getCustomerOrderingSession()?.mode || "qr") {
  if (mode === "website") {
    return {
      channel: WEBSITE_ORDER_CHANNEL,
      fulfillment: normalizeWebsiteFulfillment(state.websiteFulfillment)
    };
  }
  return CUSTOMER_QR_ORDER_CONTEXT;
}

function getCustomerCartItems(orderContext = getCustomerOrderContext()) {
  const key = getCustomerCartStateKey(getCustomerModeFromContext(orderContext));
  state[key] = normalizeOrderItems(state[key] || [])
    .filter((item) => productCanBeOrderedForOrderContext(productById(item.productId), orderContext));
  return state[key];
}

function getCustomerCartTotal(orderContext = getCustomerOrderContext()) {
  return getItemsTotal(getCustomerCartItems(orderContext));
}

const { renderCustomerQrScreen, renderWebsiteOrderScreen } = createPublicOrderingUi({
  emptyState,
  fulfillmentLabel,
  formatStockAmount,
  getCustomerCartItems,
  getCustomerOrderContext,
  getItemCount,
  getItemsTotal,
  getOrderPaymentSummary,
  getOrderTotal,
  getOrderableProductsForContext,
  getProductAvailability,
  getStaffUrl,
  getStockShortages,
  getCustomerQrSession,
  getWebsiteOrderSession,
  money,
  orderById,
  orderLocationLabel,
  productById
});

const {
  alertCard,
  getSelectedPaymentMethodFromAction,
  orderCard,
  orderItemDetailText,
  paymentCaptureHtml
} = createOrderCardsUi({
  can,
  formatStockAmount,
  fulfillmentLabel,
  getActiveSupplierOrder,
  getOrderProgressSummary: getKitchenOrderProgressSummary,
  getOrderFulfillmentMeta,
  getOrderPaymentSummary,
  getOrderStaffName,
  getOrderTotal,
  getSupplierOrderQuantity,
  money,
  orderLocationLabel,
  orderStatusClass,
  orderTypeLabel,
  productById
});

const { renderDashboard, renderMetrics } = createDashboardUi({
  alertCard,
  emptyState,
  formatStockAmount,
  getIngredientStatus,
  getKitchenSlaSummary,
  getLowStockIngredients,
  getOpenTickets,
  getOrderTotal,
  getProductCost,
  getProductMarginProfile,
  getRecipeUsageLabel,
  getSlaSummaryLabel,
  getStationNames,
  getStockRequirementsForItems,
  ingredientById,
  isActiveDelivery,
  money,
  normalizeOrderItems,
  normalizeStockQuantity,
  orderCard,
  productById
});

function orderStatusClass(status) {
  if (status === "Paid" || status === "Served") return "ok";
  if (status === "Cancelled" || status === "Delayed") return "danger";
  if (status === "New") return "warning";
  return "info";
}

function orderTypeLabel(order) {
  return orderTypeDefinition(order.orderType || order.channel).label;
}

function fulfillmentLabel(order) {
  if (order.fulfillment === "Delivery") return "Delivery";
  if (order.fulfillment === "Pickup") return "Takeaway";
  return order.fulfillment || "Kitchen";
}

function orderLocationLabel(order) {
  const table = tableById(order.tableId);
  if (table) return table.name;
  return order.customer || "Walk-in";
}

function driverById(driverId) {
  return state.drivers.find((driver) => driver.id === driverId);
}

function driverMatchesUser(driver, user = currentUser()) {
  if (!driver || !user) return false;
  return driver.id === user.id || driver.name.split(" ")[0].toLowerCase() === user.name.split(" ")[0].toLowerCase();
}

function currentDriverRecord() {
  const user = currentUser();
  return state.drivers.find((driver) => driverMatchesUser(driver, user)) || null;
}

function canManageDeliveryOperations() {
  return ["owner_admin", "manager"].includes(currentRoleKey());
}

function currentUserCanUpdateDelivery(order) {
  if (!order || !isDeliveryOrder(order)) return false;
  if (canManageDeliveryOperations()) return true;
  const driver = driverById(order.assignedDriver);
  return currentRoleKey() === "driver" && driverMatchesUser(driver);
}

function getOrderFulfillmentMeta(order) {
  const details = [];
  if (order.requestedTime) details.push(`${fulfillmentLabel(order)} ${order.requestedTime}`);
  if (order.customerPhone) details.push(`Phone: ${order.customerPhone}`);
  if (order.deliveryAddress) details.push(`Address: ${order.deliveryAddress}`);
  const driver = driverById(order.assignedDriver);
  if (driver) details.push(`Driver: ${driver.name}`);
  const deliveryStatus = getDeliveryStatus(order);
  if (deliveryStatus) details.push(`Delivery: ${deliveryStatus}`);
  if (order.paymentReference) details.push(`Payment ref: ${order.paymentReference}`);
  return details;
}

function userNameById(userId) {
  return state.users.find((user) => user.id === userId)?.name || "";
}

function getOrderStaffName(order) {
  return userNameById(order.staffId) || order.staffName || "Staff";
}

function getOrderPaidByName(order) {
  return userNameById(order.paidByUserId) || order.paidByName || getOrderStaffName(order);
}

function isOrderPaid(order) {
  return order.paymentStatus === "Paid" || isPaidPaymentMethod(order.paymentMethod);
}

function getOrderPaymentSummary(order) {
  const paid = isOrderPaid(order);
  const paymentMethod = normalizePaymentMethod(order.paymentMethod, order.paymentStatus);
  return {
    paid,
    method: paid ? paymentMethod : UNPAID_PAYMENT_METHOD,
    statusLabel: paid ? "Paid" : "Unpaid",
    className: paid ? "ok" : "warning"
  };
}

function getKitchenOrderProgressSummary(order) {
  return summarizeOrderProgress(order, state.tickets);
}

const { renderOrders, renderReceipt } = createOrdersUi({
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
});

const { renderKitchen, renderKitchenOrderProgress } = createKitchenUi({
  can,
  emptyState,
  getKitchenSlaSummary,
  getOpenTickets,
  getStationNames,
  getTicketOrderAgeMinutes,
  getTicketPriority,
  getTicketSla,
  getTicketStatusLabel,
  orderById,
  orderLocationLabel,
  orderTypeLabel,
  productById,
  ticketStatusClass
});

function getRecipeMeasureOptionsForIngredient(ingredient) {
  const measure = unitTypeDefinition(ingredient?.unitType).recipeMeasure;
  if (measure === "grams") return [{ id: "grams", label: "grams" }];
  if (measure === "milliliters") return [{ id: "milliliters", label: "milliliters" }];
  return [{ id: "units", label: unitTypeDefinition(ingredient?.unitType).label }];
}

function buildRecipeLine(ingredientId, quantity, measureKey, station, wastePercent = 0, appliesTo = "all", notes = "") {
  const amount = Math.max(0, Number(quantity) || 0);
  const base = {
    ingredientId,
    wastePercent: normalizeRecipeWastePercent(wastePercent),
    station: normalizeKitchenStation(station || "Main kitchen"),
    appliesTo: normalizeRecipeAppliesTo(appliesTo),
    notes: String(notes || "").trim()
  };
  if (measureKey === "grams") return { ...base, grams: amount };
  if (measureKey === "milliliters") return { ...base, milliliters: amount };
  return { ...base, units: amount };
}

const {
  renderInventory,
  renderInventoryActionForm,
  renderProductManagement,
  renderPurchasedProductForm,
  renderSellableProductForm,
  renderSellableRecipeCostPreview,
  renderWasteForms,
  renderWasteReport,
  renderWasteTracking
} = createInventoryUi({
  can,
  alertCard,
  convertActualUsageToStockUnits,
  convertRecipeLineToStockUnits,
  convertWasteQuantityToStockUnits,
  emptyState,
  formatLocationOptionLabel,
  formatDateTimeLocalInput,
  formatSignedAmount,
  formatStockAmount,
  formatWasteQuantity,
  getActiveSupplierOrder,
  getAllInventoryLocations,
  getDefaultProductionProductId,
  getIngredientLocationRows,
  getIngredientPrimaryLocation,
  getIngredientStatus,
  getItemsTotal,
  getLineCost,
  getLowStockIngredients,
  getOverStockIngredients,
  getProductCost,
  getProductGrossMargin,
  getProductMargin,
  getProductMarginProfile,
  getRecipeMeasure,
  getRecipeMeasureOptionsForIngredient,
  getRecipeUsageLabel,
  getSupplierOrderDrafts,
  getSupplierOrderQuantity,
  getSupplierOrderTotal,
  getWasteCost,
  getWasteReportSummary,
  getWasteUnitOptionsForIngredient,
  ingredientById,
  inventoryActionLabel,
  money,
  currentUser,
  normalizeInventoryLocationName,
  normalizeKitchenStation,
  normalizeMarginPercent,
  normalizeRecipeAppliesTo,
  normalizeWasteReason,
  normalizeWasteUnitType,
  normalizeStockQuantity,
  productAvailabilityLabel,
  productById,
  productHasConditionalRecipeLines,
  roundMoneyValue,
  unitTypeDefinition,
  wasteUnitLabel
});

const {
  getCurrentUserProcedures,
  getProcedureStepProgress,
  procedureAssignedToUser,
  procedureById,
  procedurePeriodStatus,
  procedureStepsComplete,
  renderProcedureFormControls,
  renderProcedures,
  renderProductionRecipeFields,
  updateProductionCostPreview
} = createProceduresUi({
  can,
  currentRole,
  currentUser,
  emptyState,
  formatActualUsageLabel,
  formatSignedAmount,
  formatStockAmount,
  getAllInventoryLocations,
  getDefaultProductionProductId,
  getLineCost,
  getProductMargin,
  getProductionExecutionDraft,
  getProductionFieldName,
  getProductionOutputDefault,
  getProductionOutputUnitType,
  getProductionProducts,
  getProductionReadiness,
  getRecipeLineQuantity,
  getRecipeLineWasteMultiplier,
  getRecipeMeasure,
  getRecipeUsageLabel,
  getWasteUnitOptionsForIngredient,
  ingredientById,
  money,
  productById,
  roleDefinition,
  unitTypeDefinition
});

const {
  loadCustomerIntoManualOrder,
  renderManualOrderControls,
  renderOrderBuilder,
  renderProductsInSelects
} = createOrderBuilderUi({
  can,
  customerById,
  emptyState,
  findCustomerByPhone,
  findCustomerBySearchValue,
  formatStockAmount,
  fulfillmentLabel,
  getAddressHistoryForCustomer,
  getCurrentOrderContext,
  getCustomerOptionLabel,
  getCustomerPrimaryAddress,
  getDefaultProductionProductId,
  getFavoriteItemsForCustomer,
  getItemCount,
  getItemsTotal,
  getOrderTotal,
  getOrderableProductsForContext,
  getOrdersForCustomer,
  getProductAvailability,
  getProductionProducts,
  getStockShortages,
  money,
  normalizeOrderItems,
  productById,
  renderProductionRecipeFields
});

const {
  getCurrentDriverDeliveryOrders,
  getDeliveryOrders,
  getDriverDeliveryOrders,
  renderDeliveryManager,
  renderDriverApp,
  renderTeam
} = createTeamUi({
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
});

const {
  renderQrCodeManagement,
  renderReservationPlanner,
  renderReservations,
  renderSettings
} = createSettingsUi({
  can,
  emptyState,
  getAvailableReservationTable,
  getQrOrderUrl,
  getReservationIssues,
  getReservationValidation,
  getReservationWindowLabel,
  tableById
});

const { render, renderNav, updateView } = createAppRenderer({
  can,
  createNode,
  currentUser,
  ensureActiveViewAccess,
  getCurrentUserProcedures,
  getCustomerOrderingSession,
  getLowStockIngredients,
  getOpenTickets,
  isActiveDelivery,
  procedurePeriodStatus,
  renderCustomerQrScreen,
  renderDashboard,
  renderInventory,
  renderKitchen,
  renderMetrics,
  renderOrderBuilder,
  renderOrders,
  renderProductManagement,
  renderProductsInSelects,
  renderProcedures,
  renderReservationPlanner,
  renderReservations,
  renderSettings,
  renderTeam,
  renderWasteTracking,
  renderWebsiteOrderScreen,
  roleDefinition,
  visibleViews
});

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout((showToast as any).timeout);
  (showToast as any).timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function login(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const user = state.users.find((account) => account.email === email && account.status === "Active");

  if (!user || user.password !== password) {
    showToast("Email or password is not correct.");
    return;
  }

  state.currentUserId = user.id;
  state.activeView = roleDefinition(user.role).homeView;
  saveState();
  render();
  showToast(`Logged in as ${roleDefinition(user.role).label}.`);
}

function logout() {
  state.currentUserId = "";
  saveState();
  render();
  showToast("Signed out.");
}

function addSellableRecipeLine(ingredientId, quantity, measureKey, station, wastePercent, appliesTo, notes) {
  if (!can("canManageProducts")) {
    showToast("Only Owner/Admin can manage products.");
    return;
  }

  const ingredient = ingredientById(ingredientId);
  const amount = Math.max(0, Number(quantity) || 0);
  if (!ingredient || !ingredient.active || amount <= 0) {
    showToast("Choose an active purchased product and a usage amount.");
    return;
  }

  const line = buildRecipeLine(ingredient.id, amount, measureKey, station, wastePercent, appliesTo, notes);
  const normalizedLine = normalizeRecipeLine(line, new Set(state.ingredients.map((item) => item.id)));
  if (!normalizedLine) {
    showToast("Choose a valid recipe amount.");
    return;
  }

  const measure = getRecipeMeasure(normalizedLine);
  const existing = state.productRecipeDraft.find((draftLine) => {
    return draftLine.ingredientId === normalizedLine.ingredientId
      && getRecipeMeasure(draftLine).key === measure.key
      && draftLine.appliesTo === normalizedLine.appliesTo
      && draftLine.station === normalizedLine.station
      && normalizeRecipeWastePercent(draftLine.wastePercent) === normalizeRecipeWastePercent(normalizedLine.wastePercent)
      && String(draftLine.notes || "") === String(normalizedLine.notes || "");
  });

  if (existing) {
    existing[measure.key] = Number((getRecipeLineQuantity(existing) + getRecipeLineQuantity(normalizedLine)).toFixed(3));
  } else {
    state.productRecipeDraft.push(normalizedLine);
  }

  saveState();
  render();
  showToast(`${ingredient.name} linked to the recipe.`);
}

function removeSellableRecipeLine(index) {
  if (!can("canManageProducts")) return;
  state.productRecipeDraft.splice(Number(index), 1);
  saveState();
  render();
}

function createSellableProduct(formData) {
  if (!can("canManageProducts")) {
    showToast("Only Owner/Admin can create products.");
    return;
  }

  const name = String(formData.get("name") || "").trim();
  const code = String(formData.get("code") || "").trim();
  const category = String(formData.get("category") || "Other");
  const station = normalizeKitchenStation(formData.get("station") || "Main kitchen");
  const price = Math.max(0, Number(formData.get("price")) || 0);
  const vatSetting = String(formData.get("vatSetting") || "standard");
  const active = formData.get("active") === "true";
  const targetMargin = normalizeMarginPercent(formData.get("targetMargin"), DEFAULT_MARGIN_TARGET);
  const minMargin = Math.min(targetMargin, normalizeMarginPercent(formData.get("minMargin"), DEFAULT_MARGIN_MINIMUM));
  const selectedAvailability = new Set(formData.getAll("availability"));
  const recipe = normalizeRecipeLines(state.productRecipeDraft, new Set(state.ingredients.map((ingredient) => ingredient.id)));

  if (!name || !code || !station || price <= 0) {
    showToast("Add product name, SKU, station, and selling price.");
    return;
  }

  if (state.products.some((product) => product.code.toLowerCase() === code.toLowerCase())) {
    showToast("A sellable product with that SKU already exists.");
    return;
  }

  if (!selectedAvailability.size) {
    showToast("Select at least one ordering channel.");
    return;
  }

  if (!recipe.length) {
    showToast("Link at least one purchased product to the recipe.");
    return;
  }

  const availability = AVAILABILITY_OPTIONS.reduce((nextAvailability, option) => {
    nextAvailability[option.id] = selectedAvailability.has(option.id);
    return nextAvailability;
  }, {});

  state.products.push({
    id: uniqueRecordId(name, [state.products, state.ingredients]),
    name,
    code,
    category: PRODUCT_CATEGORIES.includes(category) ? category : "Other",
    station,
    price,
    vatSetting: VAT_OPTIONS.some((option) => option.id === vatSetting) ? vatSetting : "standard",
    active,
    availability,
    targetMargin,
    minMargin,
    recipe
  });
  state.productRecipeDraft = [];
  saveState();
  render();
  showToast(`${name} added to sellable products.`);
}

function createPurchasedProduct(formData) {
  if (!can("canManageProducts")) {
    showToast("Only Owner/Admin can create purchased products.");
    return;
  }

  const name = String(formData.get("name") || "").trim();
  const supplier = String(formData.get("supplier") || "").trim();
  const purchasePrice = Math.max(0, Number(formData.get("purchasePrice")) || 0);
  const unitType = unitTypeDefinition(formData.get("unitType"));
  const stock = Math.max(0, Number(formData.get("stock")) || 0);
  const min = Math.max(0, Number(formData.get("min")) || 0);
  const requestedMax = Math.max(0, Number(formData.get("max")) || 0);
  const max = requestedMax;
  const location = getSelectedInventoryLocation(formData, "location", "customLocation");
  const expiryDate = String(formData.get("expiryDate") || "").trim();
  const barcode = String(formData.get("barcode") || "").trim();
  const active = formData.get("active") === "true";

  if (!name || !supplier || !location || purchasePrice <= 0 || requestedMax <= 0) {
    showToast("Add ingredient name, supplier, purchase price, stock limits, and storage location.");
    return;
  }

  if (min > requestedMax) {
    showToast("Minimum stock cannot be higher than maximum stock.");
    return;
  }

  state.ingredients.push({
    id: uniqueRecordId(name, [state.ingredients, state.products]),
    name,
    supplier,
    purchasePrice,
    unitType: unitType.id,
    unit: unitType.shortLabel,
    stock,
    min,
    max,
    location,
    locationStock: { [rememberInventoryLocation(location)]: stock },
    expiryDate,
    barcode,
    active
  });
  pushInventoryHistory({
    ingredient: state.ingredients[state.ingredients.length - 1],
    type: "add",
    quantity: stock,
    toLocation: location,
    detail: `Opening stock entered for ${name}.`
  });

  saveState();
  render();
  showToast(`${name} added to purchased products.`);
}

function toggleSellableProduct(productId) {
  if (!can("canManageProducts")) {
    showToast("Only Owner/Admin can manage products.");
    return;
  }

  const product = productById(productId);
  if (!product) return;
  product.active = !product.active;
  if (!product.active) state.orderDraft = state.orderDraft.filter((item) => item.productId !== product.id);
  saveState();
  render();
  showToast(`${product.name} marked ${product.active ? "active" : "inactive"}.`);
}

function togglePurchasedProduct(ingredientId) {
  if (!can("canManageProducts")) {
    showToast("Only Owner/Admin can manage products.");
    return;
  }

  const ingredient = ingredientById(ingredientId);
  if (!ingredient) return;
  ingredient.active = !ingredient.active;
  if (!ingredient.active) state.productRecipeDraft = state.productRecipeDraft.filter((line) => line.ingredientId !== ingredient.id);
  saveState();
  render();
  showToast(`${ingredient.name} marked ${ingredient.active ? "active" : "inactive"}.`);
}

function updateIngredientPurchasePrice(ingredientId, value) {
  if (!can("canManageProducts")) {
    showToast("Only Owner/Admin can update purchase prices.");
    return;
  }

  const ingredient = ingredientById(ingredientId);
  const purchasePrice = Math.max(0, Number(value) || 0);
  if (!ingredient || purchasePrice <= 0) {
    showToast("Enter a purchase price above zero.");
    return;
  }

  ingredient.purchasePrice = Number(purchasePrice.toFixed(2));
  saveState();
  render();
  showToast(`${ingredient.name} price updated; product costs recalculated.`);
}

function getSelectedInventoryLocation(formData, selectName, customName = "") {
  const customLocation = customName ? normalizeInventoryLocationName(formData.get(customName), "") : "";
  return customLocation || normalizeInventoryLocationName(formData.get(selectName), "");
}

function getFormDateTimeTimestamp(value) {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function pushWasteRecord({ ingredient, quantity, unitType, stockQuantity, reason, staffId, occurredAtMs, notes = "", fromLocation = "" }) {
  const staff = state.users.find((user) => user.id === staffId) || currentUser();
  const normalizedUnitType = normalizeWasteUnitType(unitType, ingredient);
  const normalizedQuantity = normalizeStockQuantity(quantity);
  const normalizedStockQuantity = normalizeStockQuantity(stockQuantity);
  const cost = getWasteCost(ingredient, normalizedStockQuantity);
  const record = {
    id: `WST-${Date.now()}-${state.wasteRecords.length + 1}`,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    quantity: normalizedQuantity,
    unitType: normalizedUnitType,
    stockQuantity: normalizedStockQuantity,
    stockUnit: ingredient.unit,
    reason: normalizeWasteReason(reason),
    staffId: staff?.id || "",
    staffName: staff?.name || "Staff",
    occurredAtMs: normalizeOptionalTimestamp(occurredAtMs) || Date.now(),
    notes: String(notes || "").trim(),
    fromLocation: normalizeInventoryLocationName(fromLocation, ""),
    cost
  };
  const detailParts = [
    `${record.reason} waste recorded by ${record.staffName}: ${formatWasteQuantity(record)} ${ingredient.name}`,
    `${money(cost)} cost`
  ];
  if (record.notes) detailParts.push(record.notes);

  state.wasteRecords.push(record);
  state.wasteRecords = state.wasteRecords.slice(-120);
  pushInventoryHistory({
    ingredient,
    type: "waste",
    quantity: normalizedStockQuantity,
    fromLocation: record.fromLocation,
    detail: detailParts.join(". ")
  });
  state.productionLog.push({
    id: `LOG-${Date.now()}`,
    time: timeNow(),
    text: `Waste logged: ${formatWasteQuantity(record)} ${ingredient.name} (${record.reason}) cost ${money(cost)}.`
  });
  return record;
}

function recordWaste(formData, form = null) {
  if (!can("canRecordWaste")) {
    showToast("This role cannot record waste.");
    return;
  }

  const ingredient = ingredientById(formData.get("ingredientId"));
  if (!ingredient) {
    showToast("Choose a product before recording waste.");
    return;
  }

  const quantity = normalizeStockQuantity(formData.get("quantity"));
  const unitType = normalizeWasteUnitType(formData.get("unitType"), ingredient);
  const stockQuantity = convertWasteQuantityToStockUnits(ingredient, quantity, unitType);
  if (quantity <= 0 || stockQuantity <= 0) {
    showToast("Enter a waste quantity above zero.");
    return;
  }
  if (stockQuantity > ingredient.stock) {
    showToast(`Only ${formatStockAmount(ingredient.stock, ingredient.unit)} ${ingredient.name} is available.`);
    return;
  }

  const result = deductIngredientStock(ingredient, stockQuantity);
  const fromLocation = result.removals.map((removal) => removal.location).join(", ");
  const record = pushWasteRecord({
    ingredient,
    quantity,
    unitType,
    stockQuantity: result.removed,
    reason: formData.get("reason"),
    staffId: formData.get("staffId"),
    occurredAtMs: getFormDateTimeTimestamp(formData.get("occurredAt")),
    notes: formData.get("notes"),
    fromLocation
  });

  saveState();
  render();
  if (form) {
    form.elements.notes.value = "";
    form.elements.occurredAt.value = formatDateTimeLocalInput();
  }

  let toastText = `${formatWasteQuantity(record)} ${ingredient.name} waste recorded; ${formatStockAmount(ingredient.stock, ingredient.unit)} remains.`;
  if (getIngredientStatus(ingredient) === "danger") {
    toastText += ` Low-stock alert: reorder ${formatStockAmount(getSupplierOrderQuantity(ingredient), ingredient.unit)}.`;
  }
  showToast(toastText);
}

function applyInventoryAction(formData) {
  if (!can("canManageInventory")) {
    showToast("This role cannot change inventory.");
    return;
  }

  const ingredient = ingredientById(formData.get("ingredientId"));
  const action = String(formData.get("action") || "");
  const quantity = normalizeStockQuantity(formData.get("quantity"));
  const actionDefinition = INVENTORY_ACTIONS.find((item) => item.id === action);
  if (!ingredient || !actionDefinition) {
    showToast("Choose a purchased product and inventory action.");
    return;
  }

  const fromLocation = getSelectedInventoryLocation(formData, "fromLocation");
  const toLocation = getSelectedInventoryLocation(formData, "toLocation", "customLocation");
  const fromQuantity = normalizeStockQuantity(ingredient.locationStock?.[fromLocation] || 0);
  let toastText = "";

  if (action !== "correct" && quantity <= 0) {
    showToast("Enter a quantity above zero.");
    return;
  }

  if (action === "add") {
    if (!toLocation) {
      showToast("Choose the location receiving stock.");
      return;
    }
    addStockToLocation(ingredient, toLocation, quantity);
    pushInventoryHistory({
      ingredient,
      type: action,
      quantity,
      toLocation,
      detail: `Added ${formatStockAmount(quantity, ingredient.unit)} to ${toLocation}.`
    });
    toastText = `${formatStockAmount(quantity, ingredient.unit)} added to ${ingredient.name}.`;
  }

  if (action === "remove" || action === "waste") {
    if (!fromLocation) {
      showToast("Choose the location to reduce.");
      return;
    }
    if (quantity > fromQuantity) {
      showToast(`Only ${formatStockAmount(fromQuantity, ingredient.unit)} is in ${fromLocation}.`);
      return;
    }
    const removed = removeStockFromLocation(ingredient, fromLocation, quantity);
    if (action === "waste") {
      pushWasteRecord({
        ingredient,
        quantity: removed,
        unitType: ingredient.unitType,
        stockQuantity: removed,
        reason: "Other",
        staffId: currentUser()?.id,
        occurredAtMs: Date.now(),
        notes: "Marked wasted from stock action.",
        fromLocation
      });
    } else {
      pushInventoryHistory({
        ingredient,
        type: action,
        quantity: removed,
        fromLocation,
        detail: `Removed ${formatStockAmount(removed, ingredient.unit)} from ${fromLocation}.`
      });
    }
    toastText = `${ingredient.name} ${action === "waste" ? "waste" : "stock"} updated.`;
  }

  if (action === "transfer") {
    if (!fromLocation || !toLocation) {
      showToast("Choose both transfer locations.");
      return;
    }
    if (fromLocation === toLocation) {
      showToast("Choose two different locations for a transfer.");
      return;
    }
    if (quantity > fromQuantity) {
      showToast(`Only ${formatStockAmount(fromQuantity, ingredient.unit)} is in ${fromLocation}.`);
      return;
    }
    const removed = removeStockFromLocation(ingredient, fromLocation, quantity);
    addStockToLocation(ingredient, toLocation, removed);
    pushInventoryHistory({
      ingredient,
      type: action,
      quantity: removed,
      fromLocation,
      toLocation,
      detail: `Transferred ${formatStockAmount(removed, ingredient.unit)} from ${fromLocation} to ${toLocation}.`
    });
    toastText = `${ingredient.name} transferred to ${toLocation}.`;
  }

  if (action === "correct") {
    if (!toLocation) {
      showToast("Choose the location to correct.");
      return;
    }
    const previousQuantity = normalizeStockQuantity(ingredient.locationStock?.[toLocation] || 0);
    setIngredientLocationStock(ingredient, toLocation, quantity);
    pushInventoryHistory({
      ingredient,
      type: action,
      quantity,
      toLocation,
      detail: `Manual correction set ${toLocation} from ${formatStockAmount(previousQuantity, ingredient.unit)} to ${formatStockAmount(quantity, ingredient.unit)}.`
    });
    toastText = `${ingredient.name} count corrected.`;
  }

  saveState();
  render();
  const stockStatus = getIngredientStatus(ingredient);
  if (stockStatus === "danger") toastText += ` Low-stock alert: reorder ${formatStockAmount(getSupplierOrderQuantity(ingredient), ingredient.unit)}.`;
  if (stockStatus === "over") toastText += " Over-stock warning.";
  showToast(toastText);
}

function createStaffUser(formData) {
  if (!can("canCreateUsers")) {
    showToast("Only Owner/Admin can create staff users.");
    return;
  }

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");
  const password = String(formData.get("password") || "").trim();
  const planned = String(formData.get("planned") || "12:00-20:00").trim();

  if (!name || !email || !ROLE_DEFINITIONS[role] || role === "owner_admin" || password.length < 4) {
    showToast("Add a name, email, staff role, and password of at least 4 characters.");
    return;
  }

  if (state.users.some((user) => user.email === email)) {
    showToast("A user with that email already exists.");
    return;
  }

  const id = uniqueRecordId(email.split("@")[0], [state.users, state.staff, state.drivers]);
  const roleInfo = roleDefinition(role);
  state.users.push({ id, name, email, role, password, status: "Active" });
  state.staff.push({
    id,
    name,
    role: roleInfo.operationalRole,
    planned,
    clocked: "-",
    status: "Starts soon"
  });

  if (role === "driver") {
    state.drivers.push({
      id,
      name,
      status: "Available",
      eta: "-",
      orderId: null,
      location: "Restaurant"
    });
  }

  saveState();
  render();
  showToast(`${name} can now log in as ${roleInfo.label}.`);
}

function saveRestaurantSettings(formData) {
  if (!can("canEditSettings")) {
    showToast("This role cannot edit restaurant settings.");
    return;
  }

  const defaultLanguage = String(formData.get("defaultLanguage") || DEFAULT_RESTAURANT_SETTINGS.defaultLanguage);
  const supportedLanguages = formData.getAll("supportedLanguages").filter((language) => {
    return LANGUAGE_OPTIONS.some((option) => option.id === language);
  });
  if (!supportedLanguages.includes(defaultLanguage)) supportedLanguages.push(defaultLanguage);

  state.restaurantSettings = normalizeRestaurantSettings({
    restaurantName: String(formData.get("restaurantName") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    currency: "EUR",
    opensAt: String(formData.get("opensAt") || ""),
    closesAt: String(formData.get("closesAt") || ""),
    defaultLanguage,
    supportedLanguages
  });

  saveState();
  render();
  showToast("Restaurant settings saved.");
}

function createTableQrCode(formData) {
  if (!can("canEditSettings")) {
    showToast("This role cannot manage QR codes.");
    return;
  }

  const table = tableById(formData.get("tableId"));
  if (!table) {
    showToast("Choose a table before creating a QR code.");
    return;
  }

  state.tableQrCodes
    .filter((code) => code.tableId === table.id && code.status === "Active")
    .forEach((code) => {
      code.status = "Disabled";
    });

  const token = createQrToken(table.id, new Set(state.tableQrCodes.map((code) => code.token)));
  state.tableQrCodes.push({
    id: `qr-${table.id}-${Date.now()}`,
    tableId: table.id,
    area: String(formData.get("area") || table.zone || "Dining room").trim(),
    token,
    status: "Active",
    createdAt: timeNow(),
    regeneratedAt: ""
  });
  saveState();
  render();
  showToast(`${table.name} QR code created.`);
}

function assignQrCode(qrCodeId) {
  if (!can("canEditSettings")) {
    showToast("This role cannot manage QR codes.");
    return;
  }

  const code = qrCodeById(qrCodeId);
  const tableSelect = document.querySelector(`[data-qr-table="${qrCodeId}"]`) as HTMLSelectElement | null;
  const areaInput = document.querySelector(`[data-qr-area="${qrCodeId}"]`) as HTMLInputElement | null;
  const table = tableById(tableSelect?.value);
  if (!code || !table) {
    showToast("Choose a valid table for that QR code.");
    return;
  }

  code.tableId = table.id;
  code.area = String(areaInput?.value || table.zone || "Dining room").trim();
  if (code.status === "Active") {
    state.tableQrCodes
      .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
      .forEach((item) => {
        item.status = "Disabled";
      });
  }
  saveState();
  render();
  showToast(`${code.token} assigned to ${table.name}.`);
}

function toggleQrCode(qrCodeId) {
  if (!can("canEditSettings")) {
    showToast("This role cannot manage QR codes.");
    return;
  }

  const code = qrCodeById(qrCodeId);
  if (!code) return;
  code.status = code.status === "Active" ? "Disabled" : "Active";
  if (code.status === "Active") {
    state.tableQrCodes
      .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
      .forEach((item) => {
        item.status = "Disabled";
      });
  }
  saveState();
  render();
  showToast(`QR code ${code.status.toLowerCase()}.`);
}

function regenerateQrCode(qrCodeId) {
  if (!can("canEditSettings")) {
    showToast("This role cannot manage QR codes.");
    return;
  }

  const code = qrCodeById(qrCodeId);
  if (!code) return;
  code.token = createQrToken(code.tableId, new Set(state.tableQrCodes.filter((item) => item.id !== code.id).map((item) => item.token)));
  code.status = "Active";
  code.regeneratedAt = timeNow();
  state.tableQrCodes
    .filter((item) => item.id !== code.id && item.tableId === code.tableId && item.status === "Active")
    .forEach((item) => {
      item.status = "Disabled";
    });
  saveState();
  render();
  showToast("QR code regenerated; the previous link is disabled.");
}

function openQrCustomerUrl(qrCodeId) {
  const code = qrCodeById(qrCodeId);
  if (!code) return;
  window.open(getQrOrderUrl(code), "_blank", "noopener");
}

function setView(view) {
  if (!canView(view)) {
    showToast("That page is not available for this role.");
    return;
  }
  state.activeView = view;
  saveState();
  render();
}

function rememberInventoryLocation(location) {
  const normalizedLocation = normalizeInventoryLocationName(location, "");
  if (!normalizedLocation || isDefaultInventoryLocation(normalizedLocation)) return normalizedLocation;
  if (!state.customInventoryLocations.includes(normalizedLocation)) {
    state.customInventoryLocations = sortInventoryLocations([...state.customInventoryLocations, normalizedLocation])
      .filter((item) => !isDefaultInventoryLocation(item));
  }
  return normalizedLocation;
}

function setIngredientLocationStock(ingredient, location, quantity) {
  const normalizedLocation = rememberInventoryLocation(location);
  if (!normalizedLocation) return;
  const normalizedQuantity = normalizeStockQuantity(quantity);
  ingredient.locationStock = ingredient.locationStock || {};
  if (normalizedQuantity <= 0) delete ingredient.locationStock[normalizedLocation];
  else ingredient.locationStock[normalizedLocation] = normalizedQuantity;
  syncIngredientStock(ingredient);
}

function addStockToLocation(ingredient, location, quantity) {
  const normalizedLocation = rememberInventoryLocation(location);
  if (!normalizedLocation) return;
  const currentQuantity = normalizeStockQuantity(ingredient.locationStock?.[normalizedLocation] || 0);
  setIngredientLocationStock(ingredient, normalizedLocation, currentQuantity + normalizeStockQuantity(quantity));
}

function removeStockFromLocation(ingredient, location, quantity) {
  const normalizedLocation = normalizeInventoryLocationName(location, "");
  const requestedQuantity = normalizeStockQuantity(quantity);
  const currentQuantity = normalizeStockQuantity(ingredient.locationStock?.[normalizedLocation] || 0);
  const removedQuantity = Math.min(currentQuantity, requestedQuantity);
  setIngredientLocationStock(ingredient, normalizedLocation, currentQuantity - removedQuantity);
  return removedQuantity;
}

function deductIngredientStock(ingredient, quantity, preferredLocation = "") {
  const preferred = normalizeInventoryLocationName(preferredLocation, "");
  const result = planStockDeduction(getIngredientLocationRows(ingredient), quantity, preferred);
  result.removals.forEach((removal) => {
    removeStockFromLocation(ingredient, removal.location, removal.quantity);
  });

  return result;
}

function pushInventoryHistory({ ingredient, type, quantity, fromLocation = "", toLocation = "", detail = "" }) {
  state.inventoryHistory.push({
    id: `INV-${Date.now()}-${state.inventoryHistory.length + 1}`,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    type,
    quantity: normalizeStockQuantity(quantity),
    fromLocation: normalizeInventoryLocationName(fromLocation, ""),
    toLocation: normalizeInventoryLocationName(toLocation, ""),
    resultingStock: getIngredientTotalStock(ingredient),
    time: timeNow(),
    detail
  });
  state.inventoryHistory = state.inventoryHistory.slice(-80);
}

function deductInventoryForItems(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  const changes = [];
  getStockRequirementsForItems(items, orderContext).forEach((required, ingredientId) => {
    const ingredient = ingredientById(ingredientId);
    if (!ingredient) return;
    const result = deductIngredientStock(ingredient, required);
    pushInventoryHistory({
      ingredient,
      type: "remove",
      quantity: result.removed,
      fromLocation: result.removals.map((removal) => removal.location).join(", "),
      detail: `Order used ${formatStockAmount(result.removed, ingredient.unit)} ${ingredient.name}.`
    });
    changes.push({
      ingredient,
      required,
      removed: result.removed,
      resultingStock: ingredient.stock
    });
  });
  return changes;
}

function getOrderCompletionToast(number, stations, stockChanges, items, orderContext) {
  const stationText = stations.length === 1 ? stations[0] : `${stations.length} stations`;
  const product = items.length === 1 ? productById(items[0].productId) : null;
  const primaryChange = stockChanges.length === 1 ? stockChanges[0] : null;
  let message = `Order #${number} sent to ${stationText}; inventory updated automatically.`;

  if (product && primaryChange) {
    message = `Order #${number} sent to ${stationText}; ${primaryChange.ingredient.name} stock is now ${formatStockAmount(primaryChange.resultingStock, primaryChange.ingredient.unit)}. ${product.name} margin ${getProductMargin(product, orderContext).toFixed(1)}%.`;
  }

  const lowStockChanges = stockChanges.filter((change) => getIngredientStatus(change.ingredient) === "danger");
  if (lowStockChanges.length) {
    const lowStockText = lowStockChanges
      .map((change) => `${change.ingredient.name} ${formatStockAmount(change.resultingStock, change.ingredient.unit)}`)
      .join(", ");
    message += ` Low-stock alert: ${lowStockText}.`;
  }

  return message;
}

function markSupplierOrderOrdered(supplier) {
  if (!can("canManageInventory")) {
    showToast("This role cannot manage supplier orders.");
    return;
  }

  const draft = getSupplierOrderDrafts().find((order) => order.supplier === supplier);
  if (!draft || !draft.items.length) {
    showToast("No supplier draft is ready for that supplier.");
    return;
  }

  const activeOrder = getActiveSupplierOrder(supplier);
  const orderedOrder = {
    id: activeOrder?.id || `SUP-${getSupplierKey(supplier)}-${Date.now()}`,
    supplier,
    status: "Ordered",
    createdAt: activeOrder?.createdAt || draft.createdAt || timeNow(),
    orderedAt: timeNow(),
    receivedAt: "",
    items: draft.items.map((item) => ({ ...item }))
  };

  if (activeOrder) {
    Object.assign(activeOrder, orderedOrder);
  } else {
    state.supplierOrders.push(orderedOrder);
  }

  saveState();
  render();
  showToast(`${supplier} supplier order marked ordered.`);
}

function receiveSupplierOrder(supplier) {
  if (!can("canManageInventory")) {
    showToast("This role cannot receive supplier orders.");
    return;
  }

  const order = getActiveSupplierOrder(supplier);
  if (!order || order.status !== "Ordered") {
    showToast("Mark the supplier order as ordered before receiving it.");
    return;
  }

  const receivedLines = order.items.map((item) => {
    const ingredient = ingredientById(item.ingredientId);
    if (!ingredient) return null;
    const location = getIngredientPrimaryLocation(ingredient);
    addStockToLocation(ingredient, location, item.quantity);
    pushInventoryHistory({
      ingredient,
      type: "add",
      quantity: item.quantity,
      toLocation: location,
      detail: `Supplier delivery received from ${supplier}.`
    });
    return `${formatStockAmount(item.quantity, ingredient.unit)} ${ingredient.name}`;
  }).filter(Boolean);

  order.status = "Received";
  order.receivedAt = timeNow();
  state.productionLog.push({
    id: `LOG-${Date.now()}`,
    time: timeNow(),
    text: `Supplier delivery received from ${supplier}: ${receivedLines.join(", ")} added to stock.`
  });

  saveState();
  render();
  showToast(`${supplier} delivery received and inventory updated.`);
}

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
  const availability = getProductAvailability(product, state.orderDraft, orderContext);

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

function assignDriverToDeliveryOrder(order) {
  if (order.fulfillment !== "Delivery") return null;
  const requestedDriver = driverById(order.assignedDriver);
  const driver = requestedDriver && (requestedDriver.status === "Available" || requestedDriver.orderId === order.id)
    ? requestedDriver
    : state.drivers.find((candidate) => candidate.status === "Available");
  if (!driver) {
    order.assignedDriver = "";
    return null;
  }

  state.drivers.forEach((candidate) => {
    if (candidate.orderId === order.id && candidate.id !== driver.id) {
      candidate.status = "Available";
      candidate.orderId = null;
      candidate.eta = "-";
      candidate.location = "Restaurant";
    }
  });
  order.deliveryStatus = getDeliveryStatus(order) || "Assigned";
  order.pickupStatus = normalizePickupStatus(order.pickupStatus, order.deliveryStatus);
  order.deliveryAssignedAtMs = order.deliveryAssignedAtMs || Date.now();
  order.deliveryStatusUpdatedAtMs = order.deliveryStatusUpdatedAtMs || order.deliveryAssignedAtMs;
  order.assignedDriver = driver.id;
  syncDriverWithDeliveryOrder(driver, order);
  return driver;
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
  const tickets = createKitchenTicketsForOrder(order);
  const stations = [...new Set(tickets.map((ticket) => ticket.station))];
  const stockChanges = order.inventoryDeducted ? [] : deductInventoryForItems(order.items, validation.orderContext);
  order.inventoryDeducted = true;

  assignDriverToDeliveryOrder(order);

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
  const orderContext = {
    channel,
    fulfillment
  };
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
    createdAt,
    createdAtMs,
    sentAt: "",
    paidAt: paymentStatus === "Paid" ? createdAt : "",
    paidAtMs: paymentStatus === "Paid" ? createdAtMs : "",
    staffId: staff?.id || "",
    staffName: staff?.name || "",
    paidByUserId: paymentStatus === "Paid" ? staff?.id || "" : "",
    paidByName: paymentStatus === "Paid" ? staff?.name || "" : "",
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

  if (mode === "kitchen") {
    sendOrderToKitchen(order.id);
    return;
  }

  saveState();
  render();
  showToast(`Order #${number} saved as New.`);
}

function addCustomerCartItem(productId) {
  const session = getCustomerOrderingSession();
  if (!session || session.error) return;
  const orderContext = getCustomerOrderContext(session.mode);
  const product = productById(productId);
  if (!product || !productCanBeOrderedForOrderContext(product, orderContext)) {
    showToast("That item is not available for this order type.");
    return;
  }

  const cartItems = getCustomerCartItems(orderContext);
  const availability = getProductAvailability(product, cartItems, orderContext);
  if (availability.maxQuantity < 1) {
    showToast(`${product.name} is not available with current stock.`);
    render();
    return;
  }

  state[getCustomerCartStateKey(session.mode)] = normalizeOrderItems([...cartItems, { productId: product.id, quantity: 1, note: "", modifiers: [] }]);
  state[getCustomerLastOrderStateKey(session.mode)] = "";
  saveState();
  render();
  showToast(`${product.name} added.`);
}

function adjustCustomerCartItem(index, delta) {
  const session = getCustomerOrderingSession();
  const orderContext = getCustomerOrderContext(session?.mode || "qr");
  const cartItems = getCustomerCartItems(orderContext);
  const item = cartItems[Number(index)];
  if (!item) return;
  const product = productById(item.productId);
  if (!product) return;

  if (delta > 0) {
    const otherItems = cartItems.filter((_, itemIndex) => itemIndex !== Number(index));
    const availability = getProductAvailability(product, otherItems, orderContext);
    if (item.quantity + 1 > availability.maxQuantity) {
      showToast(`Only ${availability.maxQuantity} ${product.name} can be ordered with current stock.`);
      return;
    }
  }

  item.quantity += delta;
  state[getCustomerCartStateKey(getCustomerModeFromContext(orderContext))] = normalizeOrderItems(cartItems.filter((line) => line.quantity > 0));
  saveState();
  render();
}

function removeCustomerCartItem(index) {
  const session = getCustomerOrderingSession();
  const orderContext = getCustomerOrderContext(session?.mode || "qr");
  state[getCustomerCartStateKey(getCustomerModeFromContext(orderContext))] = getCustomerCartItems(orderContext).filter((_, itemIndex) => itemIndex !== Number(index));
  saveState();
  render();
}

function startNewCustomerOrder() {
  const session = getCustomerOrderingSession();
  const mode = session?.mode || "qr";
  state[getCustomerCartStateKey(mode)] = [];
  state[getCustomerLastOrderStateKey(mode)] = "";
  saveState();
  render();
}

function setWebsiteFulfillment(value) {
  state.websiteFulfillment = normalizeWebsiteFulfillment(value);
  state.websiteCart = getCustomerCartItems(getCustomerOrderContext("website"));
  state.websiteLastOrderId = "";
  saveState();
  render();
}

function submitCustomerQrOrder(formData) {
  const session = getCustomerQrSession();
  if (!session || session.error || !session.table) {
    showToast("Ask staff for an active table QR code.");
    renderCustomerQrScreen();
    return;
  }

  const items = getCustomerCartItems(CUSTOMER_QR_ORDER_CONTEXT);
  if (!items.length) {
    showToast("Add an item before placing the order.");
    return;
  }

  const paymentOption = String(formData.get("paymentOption") || "online");
  const paymentMethod = paymentOption === "later" ? UNPAID_PAYMENT_METHOD : "Online payment";
  const paymentStatus = getPaymentStatusForMethod(paymentMethod);
  const number = state.nextOrderNumber;
  const orderId = `ORD-${number}`;
  const createdAt = timeNow();
  const createdAtMs = Date.now();
  const order: any = {
    id: orderId,
    number,
    channel: CUSTOMER_QR_CHANNEL,
    orderType: CUSTOMER_QR_CHANNEL,
    tableId: session.table.id,
    customer: session.table.name,
    paymentStatus,
    paymentMethod,
    fulfillment: "Kitchen",
    status: "New",
    createdAt,
    createdAtMs,
    sentAt: "",
    paidAt: paymentStatus === "Paid" ? createdAt : "",
    paidAtMs: paymentStatus === "Paid" ? createdAtMs : "",
    staffId: "",
    staffName: "QR guest",
    paidByUserId: "",
    paidByName: paymentStatus === "Paid" ? "QR online checkout" : "",
    inventoryDeducted: false,
    notes: String(formData.get("notes") || "").trim(),
    qrCodeId: session.code?.id || "",
    items: items.map((item) => ({ ...item }))
  };
  const validation = validateOrderForKitchen(order);
  if (!validation.ok) {
    showToast(validation.message);
    renderCustomerQrScreen();
    return;
  }

  state.orders.push(order);
  state.nextOrderNumber += 1;
  state.customerCart = [];
  state.customerLastOrderId = order.id;
  state.receiptOrderId = order.id;
  sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
  showToast(`Order #${number} sent to the kitchen.`);
}

function normalizeCardDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function processWebsiteOnlinePayment(formData, amount) {
  const cardName = String(formData.get("cardName") || "").trim();
  const cardNumber = normalizeCardDigits(formData.get("cardNumber"));
  const expiry = String(formData.get("cardExpiry") || "").replace(/\s+/g, "").trim();
  const cvc = normalizeCardDigits(formData.get("cardCvc"));

  if (amount <= 0) return { ok: false, message: "Add a paid item before checkout." };
  if (cardName.length < 2) return { ok: false, message: "Enter the cardholder name." };
  if (cardNumber.length < 12 || cardNumber.length > 19) return { ok: false, message: "Enter a valid card number." };
  if (!/^\d{2}\/?\d{2}$/.test(expiry)) return { ok: false, message: "Enter the card expiry as MM/YY." };
  if (cvc.length < 3 || cvc.length > 4) return { ok: false, message: "Enter a valid CVC." };

  return {
    ok: true,
    reference: `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    processor: WEBSITE_PAYMENT_PROCESSOR
  };
}

function submitWebsiteOrder(formData) {
  if (!getWebsiteOrderSession()) return;

  const fulfillment = normalizeWebsiteFulfillment(formData.get("fulfillment") || state.websiteFulfillment);
  state.websiteFulfillment = fulfillment;
  const orderContext = getCustomerOrderContext("website");
  const items = getCustomerCartItems(orderContext);
  if (!items.length) {
    showToast("Add an item before checkout.");
    return;
  }

  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").trim();
  const customerEmail = String(formData.get("customerEmail") || "").trim();
  const requestedTime = String(formData.get("requestedTime") || "").trim();
  const deliveryAddress = fulfillment === "Delivery" ? String(formData.get("deliveryAddress") || "").trim() : "";

  if (!customerName || !customerPhone) {
    showToast("Enter your name and phone number.");
    return;
  }
  if (!isReservationTime(requestedTime)) {
    showToast("Choose a valid pickup or delivery time.");
    return;
  }
  if (fulfillment === "Delivery" && !deliveryAddress) {
    showToast("Enter a delivery address.");
    return;
  }

  const payment = processWebsiteOnlinePayment(formData, getItemsTotal(items));
  if (!payment.ok) {
    showToast(payment.message);
    return;
  }

  const number = state.nextOrderNumber;
  const orderId = `ORD-${number}`;
  const createdAt = timeNow();
  const createdAtMs = Date.now();
  const order: any = {
    id: orderId,
    number,
    channel: WEBSITE_ORDER_CHANNEL,
    orderType: WEBSITE_ORDER_CHANNEL,
    tableId: "",
    customer: customerName,
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    requestedTime,
    paymentStatus: "Paid",
    paymentMethod: "Online payment",
    paymentReference: payment.reference,
    paymentProcessor: payment.processor,
    fulfillment,
    status: "New",
    createdAt,
    createdAtMs,
    sentAt: "",
    paidAt: createdAt,
    paidAtMs: createdAtMs,
    staffId: "",
    staffName: "Website checkout",
    paidByUserId: "",
    paidByName: "Website checkout",
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
    notes: String(formData.get("notes") || "").trim(),
    items: items.map((item) => ({ ...item }))
  };
  const validation = validateOrderForKitchen(order);
  if (!validation.ok) {
    showToast(validation.message);
    renderWebsiteOrderScreen();
    return;
  }

  const customerRecord = upsertCustomerFromOrderDetails({
    name: customerName,
    phone: customerPhone,
    email: customerEmail,
    deliveryAddress
  });
  if (customerRecord) order.customerId = customerRecord.id;
  state.orders.push(order);
  state.nextOrderNumber += 1;
  state.websiteCart = [];
  state.websiteLastOrderId = order.id;
  state.receiptOrderId = order.id;
  sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
  showToast(`Order #${number} confirmed.`);
}

function syncOrderStatus(orderId) {
  const tickets = state.tickets.filter((ticket) => ticket.orderId === orderId);
  const order = orderById(orderId);
  if (!order || !tickets.length) return;
  if (order.status === "Paid" || order.status === "Cancelled") return;
  if (tickets.every((ticket) => ticket.status === "Done")) order.status = isOrderPaid(order) ? "Paid" : "Served";
  else if (tickets.every((ticket) => ticket.status === "Ready" || ticket.status === "Done")) order.status = "Ready";
  else if (tickets.some((ticket) => ticket.status === "Delayed")) order.status = "Delayed";
  else if (tickets.some((ticket) => ["Accepted", "Preparing"].includes(ticket.status))) order.status = "Preparing";
  else order.status = "Sent to kitchen";
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
  showToast(`Kitchen task marked ${getTicketStatusLabel(ticket.status).toLowerCase()}.`);
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
  state.tickets
    .filter((ticket) => ticket.orderId === orderId)
    .forEach((ticket) => setTicketStatus(ticket, "Done"));
  order.status = isOrderPaid(order) ? "Paid" : "Served";
  saveState();
  render();
  showToast(`Order #${order.number} marked served.`);
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
  order.paymentStatus = "Paid";
  order.paymentMethod = isPaidPaymentMethod(method) ? method : DEFAULT_PAID_PAYMENT_METHOD;
  if (order.status === "Served") order.status = "Paid";
  order.paidAt = order.paidAt || timeNow();
  order.paidAtMs = order.paidAtMs || Date.now();
  order.paidByUserId = staff?.id || order.paidByUserId || "";
  order.paidByName = staff?.name || order.paidByName || "";
  state.receiptOrderId = order.id;
  saveState();
  render();
  showToast(`Payment recorded for order #${order.number}.`);
}

function assignDeliveryOrderToDriver(orderId) {
  if (!canManageDeliveryOperations()) {
    showToast("Only managers can assign deliveries.");
    return;
  }

  const order = orderById(orderId);
  if (!order || !isDeliveryOrder(order)) {
    showToast("Choose a delivery order to assign.");
    return;
  }

  const select = document.querySelector(`[data-delivery-driver-select="${orderId}"]`) as HTMLSelectElement | null;
  const driver = driverById(select?.value);
  if (!driver) {
    showToast("Choose a driver for this delivery.");
    return;
  }

  if (driver.status !== DRIVER_IDLE_STATUS && driver.orderId !== order.id) {
    showToast(`${driver.name} already has an active delivery.`);
    return;
  }

  state.drivers.forEach((candidate) => {
    if (candidate.orderId === order.id && candidate.id !== driver.id) setDriverIdle(candidate);
  });
  order.assignedDriver = driver.id;
  order.deliveryStatus = getDeliveryStatus(order) || "Assigned";
  order.pickupStatus = normalizePickupStatus(order.pickupStatus, order.deliveryStatus);
  order.deliveryAssignedAtMs = order.deliveryAssignedAtMs || Date.now();
  order.deliveryStatusUpdatedAtMs = Date.now();
  syncDriverWithDeliveryOrder(driver, order);
  saveState();
  render();
  showToast(`Order #${order.number} assigned to ${driver.name}.`);
}

function updateDeliveryStatus(orderId, status) {
  const order = orderById(orderId);
  const nextStatus = normalizeDriverDeliveryStatus(status);
  if (!order || !nextStatus || !currentUserCanUpdateDelivery(order)) {
    showToast("This role cannot update that delivery.");
    return;
  }

  const wasLate = deliveryIsLate(order);
  const now = Date.now();
  const nowText = timeNow();
  order.deliveryStatus = nextStatus;
  order.deliveryStatusUpdatedAtMs = now;
  order.deliveryAssignedAtMs = order.deliveryAssignedAtMs || now;
  order.pickupStatus = normalizePickupStatus(order.pickupStatus, nextStatus);

  if (nextStatus === "At restaurant") order.pickupStatus = "At restaurant";
  if (["Picked up", "On the way", "Delivered", "Failed delivery"].includes(nextStatus)) order.pickupStatus = "Picked up";
  if (nextStatus === "Delivered") {
    order.deliveredAt = nowText;
    order.deliveredAtMs = now;
    order.deliveryWasLate = order.deliveryWasLate || wasLate;
    state.tickets
      .filter((ticket) => ticket.orderId === order.id)
      .forEach((ticket) => setTicketStatus(ticket, "Done"));
    order.status = isOrderPaid(order) ? "Paid" : "Served";
  }
  if (nextStatus === "Failed delivery") {
    order.failedAt = nowText;
    order.failedAtMs = now;
  }
  if (nextStatus === "Returned") {
    order.returnedAt = nowText;
    order.returnedAtMs = now;
    order.deliveryWasLate = order.deliveryWasLate || wasLate;
    order.pickupStatus = "Returned";
    if (!isOrderPaid(order)) order.status = "Cancelled";
  }

  const driver = driverById(order.assignedDriver);
  syncDriverWithDeliveryOrder(driver, order);
  saveState();
  render();
  showToast(`Delivery #${order.number} marked ${nextStatus.toLowerCase()}.`);
}

function markDeliveryCashCollected(orderId) {
  const order = orderById(orderId);
  if (!order || !currentUserCanUpdateDelivery(order)) {
    showToast("This role cannot record delivery cash.");
    return;
  }
  if (isOrderPaid(order)) {
    showToast(`Order #${order.number} is already paid.`);
    return;
  }

  const user = currentUser();
  const now = Date.now();
  const nowText = timeNow();
  order.cashCollected = true;
  order.cashCollectedAt = nowText;
  order.cashCollectedAtMs = now;
  order.cashCollectedByName = user?.name || "Driver";
  order.paymentStatus = "Paid";
  order.paymentMethod = "Cash";
  order.paidAt = order.paidAt || nowText;
  order.paidAtMs = order.paidAtMs || now;
  order.paidByUserId = user?.id || order.paidByUserId || "";
  order.paidByName = user?.name || order.paidByName || "Driver";
  if (order.status === "Served" || getDeliveryStatus(order) === "Delivered") order.status = "Paid";
  saveState();
  render();
  showToast(`Cash collected for order #${order.number}.`);
}

function addDeliveryNote(orderId) {
  const order = orderById(orderId);
  if (!order || !currentUserCanUpdateDelivery(order)) {
    showToast("This role cannot add a delivery note.");
    return;
  }

  const input = document.querySelector(`[data-delivery-note-input="${orderId}"]`) as HTMLInputElement | null;
  const text = String(input?.value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    showToast("Add a note before saving.");
    return;
  }

  const user = currentUser();
  order.deliveryNotes = [
    ...(order.deliveryNotes || []),
    {
      id: `DLV-NOTE-${Date.now()}`,
      text,
      authorId: user?.id || "",
      authorName: user?.name || "Driver",
      at: timeNow(),
      atMs: Date.now()
    }
  ].slice(-12);
  saveState();
  render();
  showToast("Delivery note added.");
}

function uploadDeliveryProof(orderId) {
  const order = orderById(orderId);
  if (!order || !currentUserCanUpdateDelivery(order)) {
    showToast("This role cannot upload delivery proof.");
    return;
  }

  const input = document.querySelector(`[data-delivery-proof-input="${orderId}"]`) as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    showToast("Choose a photo before uploading.");
    return;
  }

  order.deliveryProofPhotoName = file.name;
  order.deliveryProofAtMs = Date.now();
  order.deliveryProofByName = currentUser()?.name || "Driver";
  saveState();
  render();
  showToast("Delivery proof saved.");
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
  showOrderReceipt(orderId);
  window.setTimeout(() => window.print(), 50);
}

function logWaste() {
  if (!can("canRecordWaste")) {
    showToast("This role cannot record waste.");
    return;
  }

  const ingredient = ingredientById("kefta");
  if (!ingredient) return;
  const location = getIngredientPrimaryLocation(ingredient);
  if (ingredient.stock < 0.25) {
    showToast(`Only ${formatStockAmount(ingredient.stock, ingredient.unit)} Kefta is available.`);
    return;
  }
  const result = deductIngredientStock(ingredient, 0.25, location);
  pushWasteRecord({
    ingredient,
    quantity: result.removed,
    unitType: "kilograms",
    stockQuantity: result.removed,
    reason: "Dropped",
    staffId: currentUser()?.id,
    occurredAtMs: Date.now(),
    notes: "Quick kefta waste shortcut.",
    fromLocation: location,
  });
  saveState();
  render();
  showToast("Waste logged and stock recalculated.");
}

function recordProduction(form) {
  if (!can("canManageProcedures")) {
    showToast("This role cannot record production.");
    return;
  }

  const draft = getProductionExecutionDraft(form);
  const readiness = getProductionReadiness(draft, form);
  const product = draft.product;

  if (!readiness.ok) {
    showToast(readiness.detail);
    updateProductionCostPreview();
    return;
  }

  const batchId = `BAT-${Date.now()}-${state.productionBatches.length + 1}`;
  const completedAt = timeNow();
  const completedAtMs = Date.now();
  const staff = currentUser();
  const actualUsages = draft.lines.map((line) => {
    const result = deductIngredientStock(line.ingredient, line.actualStockQuantity, getIngredientPrimaryLocation(line.ingredient));
    pushInventoryHistory({
      ingredient: line.ingredient,
      type: "remove",
      quantity: result.removed,
      fromLocation: result.removals.map((removal) => removal.location).join(", "),
      detail: `${product.name} batch ${batchId} used ${formatActualUsageLabel(line.actualUsage, line.measure)} ${line.ingredient.name} (${money(line.actualCost)} actual cost).`
    });

    return `${formatActualUsageLabel(line.actualUsage, line.measure)} ${line.ingredient.name}`;
  });

  if (draft.outputIngredient && draft.outputStockQuantity > 0) {
    addStockToLocation(draft.outputIngredient, draft.outputLocation, draft.outputStockQuantity);
    if (draft.outputUnitCost > 0) draft.outputIngredient.purchasePrice = draft.outputUnitCost;
    pushInventoryHistory({
      ingredient: draft.outputIngredient,
      type: "add",
      quantity: draft.outputStockQuantity,
      toLocation: draft.outputLocation,
      detail: `${product.name} batch ${batchId} produced ${formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit)} at ${money(draft.outputUnitCost)} per ${draft.outputIngredient.unit}.`
    });
  }

  product.lastProductionCost = draft.actualCost;
  product.lastProductionPlannedCost = draft.plannedCost;
  product.lastProductionMargin = draft.actualMargin;
  product.lastProductionCostDelta = draft.costDelta;
  product.lastProductionAt = completedAt;
  product.lastProductionAtMs = completedAtMs;

  state.productionBatches.push({
    id: batchId,
    productId: product.id,
    productName: product.name,
    completedById: staff?.id || "",
    completedByName: staff?.name || "Staff",
    completedAt,
    completedAtMs,
    plannedCost: draft.plannedCost,
    actualCost: draft.actualCost,
    costDelta: draft.costDelta,
    plannedMargin: draft.plannedMargin,
    actualMargin: draft.actualMargin,
    marginDelta: draft.marginDelta,
    outputIngredientId: draft.outputIngredient?.id || "",
    outputIngredientName: draft.outputIngredient?.name || "",
    outputQuantity: draft.outputQuantity,
    outputUnitType: draft.outputUnitType,
    outputStockQuantity: draft.outputStockQuantity,
    outputUnitCost: draft.outputUnitCost,
    outputLocation: draft.outputLocation,
    lines: draft.lines.map((line) => ({
      ingredientId: line.ingredient.id,
      ingredientName: line.ingredient.name,
      measure: line.measure,
      plannedUsage: line.plannedUsage,
      actualUsage: line.actualUsage,
      plannedStockQuantity: line.plannedStockQuantity,
      actualStockQuantity: line.actualStockQuantity,
      plannedCost: line.plannedCost,
      actualCost: line.actualCost
    }))
  });
  state.productionBatches = state.productionBatches.slice(-80);

  const outputText = draft.outputIngredient
    ? ` Added ${formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit)} ${draft.outputIngredient.name} at ${money(draft.outputUnitCost)} per ${draft.outputIngredient.unit}.`
    : "";
  const marginText = draft.actualMargin === null ? "" : ` Margin ${draft.actualMargin.toFixed(1)}% (${formatSignedAmount(draft.marginDelta, " pts")}).`;

  state.productionLog.push({
    id: `LOG-${Date.now()}`,
    time: completedAt,
    text: `${product.name} batch complete: ${actualUsages.join(", ")}. Actual cost ${money(draft.actualCost)} (${money(draft.costDelta)} vs planned).${marginText}${outputText}`
  });
  saveState();
  render();
  renderProductionRecipeFields({ reset: true });
  const productionForm: any = document.querySelector("#productionForm");
  if (productionForm?.elements?.prepComplete) productionForm.elements.prepComplete.checked = false;
  updateProductionCostPreview();
  showToast("Batch result saved; inventory and actual cost updated.");
}

function createProcedure(formData) {
  if (!can("canCreateProcedures")) {
    showToast("Only Owner/Admin can create procedures.");
    return false;
  }

  const title = String(formData.get("title") || "").trim();
  const department = normalizeProcedureDepartment(formData.get("department"));
  const language = normalizeProcedureLanguage(formData.get("language"));
  const frequency = normalizeProcedureFrequency(formData.get("frequency"));
  const assignedRole = normalizeProcedureAssignedRole(formData.get("assignedRole"), department);
  const steps = normalizeProcedureSteps(String(formData.get("steps") || "").split(/\n/));
  const requiredTools = normalizeListInput(formData.get("requiredTools"));
  const requiredProducts = normalizeListInput(formData.get("requiredProducts"));
  const media = normalizeProcedureMedia(formData.get("media"));
  const user = currentUser();

  if (!title || !steps.length) {
    showToast("Add a procedure title and at least one step.");
    return false;
  }

  state.procedures.push({
    id: uniqueRecordId(title, [state.procedures]),
    title,
    department,
    language,
    steps,
    requiredTools,
    requiredProducts,
    media,
    frequency,
    assignedRole,
    active: true,
    createdById: user?.id || "",
    createdByName: user?.name || "",
    createdAtMs: Date.now()
  });

  saveState();
  render();
  showToast(`${title} procedure created.`);
  return true;
}

function procedureProgressKey(procedureId, userId = currentUser()?.id || "") {
  return `${userId}:${procedureId}`;
}

function setProcedureStepProgress(procedureId, stepIndex, checked) {
  const procedure = procedureById(procedureId);
  if (!procedure || !can("canCompleteProcedures") || !procedureAssignedToUser(procedure)) {
    showToast("This role cannot update that procedure.");
    return;
  }

  const index = Math.floor(Number(stepIndex) || 0);
  if (index < 0 || index >= procedure.steps.length) return;

  state.procedureProgress = state.procedureProgress || {};
  const key = procedureProgressKey(procedure.id);
  const progress = getProcedureStepProgress(procedure.id);
  if (checked) progress.add(index);
  else progress.delete(index);

  const nextProgress = [...progress].map(Number).sort((first, second) => first - second);
  if (nextProgress.length) state.procedureProgress[key] = nextProgress;
  else delete state.procedureProgress[key];

  saveState();
  render();
}

function recordProcedureCompletion(procedureId, status = "Done", notes = "") {
  const procedure = procedureById(procedureId);
  const user = currentUser();
  if (!procedure || !user || !can("canCompleteProcedures") || !procedureAssignedToUser(procedure)) {
    showToast("This role cannot complete that procedure.");
    return false;
  }

  const normalizedStatus = PROCEDURE_COMPLETION_STATUSES.includes(status) ? status : "Done";
  const normalizedNotes = String(notes || "").trim();
  if (normalizedStatus === "Done" && !procedureStepsComplete(procedure)) {
    showToast("Check each step before marking the procedure done.");
    return false;
  }
  if (normalizedStatus !== "Done" && !normalizedNotes) {
    showToast("Add a reason before saving this procedure status.");
    return false;
  }

  const checkedSteps = [...getProcedureStepProgress(procedure.id)].map(Number).sort((first, second) => first - second);
  const roleInfo = roleDefinition(user.role);
  state.procedureCompletions.push({
    id: `PROC-CMP-${Date.now()}-${state.procedureCompletions.length + 1}`,
    procedureId: procedure.id,
    status: normalizedStatus,
    completedById: user.id,
    completedByName: user.name,
    assignedRole: normalizeProcedureAssignedRole(procedure.assignedRole, roleInfo.operationalRole),
    completedAtMs: Date.now(),
    completedAt: timeNow(),
    checkedSteps,
    notes: normalizedNotes
  });
  state.procedureCompletions = state.procedureCompletions.slice(-180);
  delete state.procedureProgress?.[procedureProgressKey(procedure.id)];

  saveState();
  render();
  showToast(`${procedure.title} marked ${normalizedStatus.toLowerCase()}.`);
  return true;
}

function promptAndRecordProcedureStatus(procedureId, status) {
  const procedure = procedureById(procedureId);
  if (!procedure) return;
  const promptText = status === "Problem"
    ? `What problem happened with ${procedure.title}?`
    : `Why are you skipping ${procedure.title}?`;
  const note = window.prompt(promptText, "");
  if (note === null) return;
  recordProcedureCompletion(procedureId, status, note);
}

function addReservation(formData) {
  if (!can("canManageReservations")) {
    showToast("This role cannot create reservations.");
    return;
  }

  const guests = Math.max(1, Math.floor(Number(formData.get("guests")) || 1));
  const time = formData.get("time") || "";
  const tableId = formData.get("tableId");
  const validation = getReservationValidation({ guests, time, tableId });

  if (!validation.ok) {
    showToast(validation.detail);
    renderReservationPlanner();
    return;
  }

  const reservation = {
    id: `RES-${Date.now()}`,
    name: formData.get("name") || "Guest",
    guests,
    time,
    tableId,
    source: formData.get("source"),
    status: "Confirmed"
  };
  state.reservations.push(reservation);
  saveState();
  render();
  showToast(`Reservation booked for ${reservation.name} at ${tableById(tableId).name}.`);
}

function renderTimingSurfaces() {
  if (getCustomerQrSession()) {
    renderCustomerQrScreen();
    return;
  }
  if (!currentUser()) return;
  ensureActiveViewAccess();
  renderNav();
  renderMetrics();
  renderDashboard();
  renderKitchen();
  renderProcedures();
  renderTeam();
}


export function createAppRuntime() {
  return {
    handlers: {
      addCustomerCartItem,
      addDeliveryNote,
      addOrderDraftLine,
      addReservation,
      addSellableRecipeLine,
      adjustCustomerCartItem,
      advanceOrder,
      advanceTicket,
      addTicketIssueNote,
      applyInventoryAction,
      assignDeliveryOrderToDriver,
      assignQrCode,
      cancelOrder,
      can,
      clearOrderDraft,
      createOrder,
      createProcedure,
      createPurchasedProduct,
      createSellableProduct,
      createStaffUser,
      createTableQrCode,
      findCustomerBySearchValue,
      getCustomerOrderingSession,
      getSelectedLineModifiers,
      getSelectedPaymentMethodFromAction,
      loadCustomerIntoManualOrder,
      logWaste,
      login,
      logout,
      markDeliveryCashCollected,
      markOrderPaid,
      markOrderServed,
      markSupplierOrderOrdered,
      markTicketDelayed,
      openQrCustomerUrl,
      printOrderReceipt,
      promptAndRecordProcedureStatus,
      receiveSupplierOrder,
      recordProcedureCompletion,
      recordProduction,
      recordWaste,
      regenerateQrCode,
      removeCustomerCartItem,
      removeOrderDraftLine,
      removeSellableRecipeLine,
      render,
      renderInventoryActionForm,
      renderManualOrderControls,
      renderOrderBuilder,
      renderProcedureFormControls,
      renderProductionRecipeFields,
      renderProductsInSelects,
      renderReservationPlanner,
      renderSellableProductForm,
      renderSellableRecipeCostPreview,
      renderWasteForms,
      saveRestaurantSettings,
      sendOrderToKitchen,
      setProcedureStepProgress,
      setView,
      setWebsiteFulfillment,
      showOrderReceipt,
      showToast,
      startNewCustomerOrder,
      submitCustomerQrOrder,
      submitWebsiteOrder,
      tableById,
      togglePurchasedProduct,
      toggleQrCode,
      toggleSellableProduct,
      updateDeliveryStatus,
      updateIngredientPurchasePrice,
      updateProductionCostPreview,
      updateTicketStatus,
      uploadDeliveryProof
    },
    render,
    renderTimingSurfaces
  };
}

  
