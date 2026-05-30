// This is the TypeScript port of the original static prototype.
// New work should move into focused modules; core.ts remains the legacy app shell
// while domain, data, and utility code are extracted incrementally.

import {
  MINUTE_MS,
  UNPAID_PAYMENT_METHOD,
  VAT_RATES,
  TICKET_SLA_MINUTES,
  SLA_WARNING_WINDOW_MINUTES,
  KITCHEN_STATIONS,
  KITCHEN_STATION_ALIASES,
  VAT_OPTIONS,
  DEFAULT_PRODUCT_AVAILABILITY,
  UNIT_TYPES,
  DEFAULT_INVENTORY_LOCATIONS,
  INVENTORY_ACTIONS,
  WASTE_REASONS,
  RECIPE_APPLIES_OPTIONS,
  DEFAULT_RECIPE_ORDER_CONTEXT,
  PHASE_11_SEED_INGREDIENT_IDS,
  PHASE_11_SEED_PRODUCT_IDS,
  ROLE_ORDER,
  ROLE_DEFINITIONS,
  DATA_MODEL
} from "./shared/constants.js";
import { resetState, saveState, state } from "./app/state.js";
import { createAppRenderer } from "./app/render.js";
import { createQrRuntime } from "./app/qr.js";
import { createCustomerOrderingRuntime } from "./app/customer-ordering.js";
import { createStaffOrderRuntime } from "./app/staff-orders.js";
import { createDeliveryRuntime } from "./app/delivery-actions.js";
import { createProductActionsRuntime } from "./app/product-actions.js";
import { createProcedureActionsRuntime } from "./app/procedure-actions.js";
import { createReservationActionsRuntime } from "./app/reservation-actions.js";
import { createInventoryActionsRuntime } from "./app/inventory-actions.js";
import { createAdminActionsRuntime } from "./app/admin-actions.js";
import { createSessionActionsRuntime } from "./app/session-actions.js";
import {
  normalizeKitchenStation,
  unitTypeDefinition,
  normalizeProductAvailability,
  normalizeMarginPercent,
  normalizeRecipeAppliesTo,
  normalizeBatchOutput,
  normalizeStockQuantity,
  normalizeInventoryLocationName,
  sortInventoryLocations,
  normalizeLocationStock,
  getIngredientPrimaryLocation,
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
  normalizeUsers,
  normalizeDrivers,
  normalizeProcedureRecord,
  normalizeProcedures,
  isLegacyProcedureList,
  mergeDefaultProcedures,
  normalizeProcedureCompletions,
  normalizeProcedureProgress,
  normalizeOrderStatus,
  normalizePaymentStatus,
  normalizeDeliveryNotes,
  normalizeOrderLineItem,
  normalizeCustomerRecord,
  normalizeCustomers
} from "./data/normalize.js";
import {
  getDeliveryStatus,
  isActiveDelivery
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
  getStockShortages as getStockShortagesFromInventory
} from "./domain/inventory.js";
import { getOrderProgressSummary as summarizeOrderProgress } from "./domain/kitchen.js";
import {
  calculateItemsTotal,
  calculateOrderTotal,
  countOrderItems,
  isPhoneMessageOrder,
  normalizeOrderItems as normalizeOrderItemsForProducts,
  normalizeOrderFulfillment,
  normalizeOrderType,
  orderTypeDefinition,
  phoneMessageFulfillmentOption,
  productCanBeOrdered,
  productCanBeOrderedForOrderContext,
  websiteFulfillmentOption
} from "./domain/orders.js";
import { isPaidPaymentMethod, normalizePaymentMethod } from "./domain/payments.js";
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
  getDefaultProductionProductId as getDefaultProductionProductIdFromList,
  getProductionExecutionDraft as getProductionExecutionDraftFromValues,
  getProductionFieldName,
  getProductionOutputDefault,
  getProductionOutputUnitType as getProductionOutputUnitTypeForIngredient,
  getProductionProducts as getProductionProductsFromList,
  getProductionReadiness as getProductionReadinessForDraft,
  roundMoneyValue
} from "./domain/production.js";
import {
  formatReservationMinutes,
  getAvailableReservationTable as getAvailableReservationTableFromList,
  getReservationConflicts as getReservationConflictsFromList,
  getReservationIssues as getReservationIssuesFromList,
  getReservationMinutes,
  getReservationValidation as getReservationValidationFromList,
  getReservationWindow,
  getReservationWindowLabel
} from "./domain/reservations.js";
import {
  canView as canViewFromList,
  getCurrentRoleKey,
  getCurrentUser,
  roleCan,
  roleDefinition as getRoleDefinition,
  visibleViewsForRole
} from "./domain/users.js";
import { formatDateTime, formatDateTimeLocalInput, formatDuration, normalizeTimestamp, timeNow } from "./shared/dates.js";
import { formatActualUsageLabel, formatSignedAmount, formatStockAmount } from "./shared/formatters.js";
import { escapeHtml } from "./shared/html.js";
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

const {
  assignQrCode,
  createTableQrCode,
  getCustomerOrderingSession,
  getCustomerQrSession,
  getQrOrderUrl,
  getStaffUrl,
  getWebsiteOrderSession,
  openQrCustomerUrl,
  regenerateQrCode,
  toggleQrCode
} = createQrRuntime({
  can,
  render: () => render(),
  showToast,
  tableById
});

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

function convertRecipeLineToStockUnits(line) {
  return convertRecipeLineToStockUnitsForRecipe(line, ingredientById(line.ingredientId), unitTypeDefinition);
}

function convertActualUsageToStockUnits(line, actualUsage) {
  return convertActualUsageToStockUnitsForRecipe(line, actualUsage, ingredientById(line.ingredientId), unitTypeDefinition);
}

function getProductionProducts() {
  return getProductionProductsFromList(state.products);
}

function getDefaultProductionProductId(selectedProductId = "") {
  return getDefaultProductionProductIdFromList(state.products, selectedProductId);
}

function getProductionFormValue(form, name, fallback = "") {
  const field = form?.elements?.[name];
  return field ? field.value : fallback;
}

function getProductionOutputUnitType(ingredient, requestedUnitType, fallbackUnitType = "") {
  return getProductionOutputUnitTypeForIngredient(ingredient, requestedUnitType, fallbackUnitType, {
    getWasteUnitOptionsForIngredient,
    unitTypeDefinition
  });
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

function getProductionExecutionDraft(form = document.querySelector("#productionForm")) {
  return getProductionExecutionDraftFromValues((name, fallback) => getProductionFormValue(form, name, fallback), {
    convertActualUsageToStockUnits,
    convertRecipeLineToStockUnits,
    convertWasteQuantityToStockUnits,
    getProductionOutputUnitType,
    ingredientById,
    productById
  });
}

function getProductionReadiness(draft, form = document.querySelector("#productionForm")) {
  return getProductionReadinessForDraft(draft, {
    formatStockAmount,
    markedDone: productionMarkedComplete(form),
    stepsDone: productionStepsComplete(form)
  });
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

const {
  addDeliveryNote,
  assignDeliveryOrderToDriver,
  assignDriverToDeliveryOrder,
  canManageDeliveryOperations,
  currentDriverRecord,
  currentUserCanUpdateDelivery,
  driverById,
  markDeliveryCashCollected,
  updateDeliveryStatus,
  uploadDeliveryProof
} = createDeliveryRuntime({
  currentRoleKey,
  currentUser,
  isOrderPaid,
  orderById,
  render: () => render(),
  showToast
});

const {
  applyInventoryAction,
  deductInventoryForItems,
  getSelectedInventoryLocation,
  logWaste,
  markSupplierOrderOrdered,
  pushInventoryHistory,
  receiveSupplierOrder,
  recordProduction,
  recordWaste,
  rememberInventoryLocation
} = createInventoryActionsRuntime({
  can,
  currentUser,
  formatActualUsageLabel,
  formatDateTimeLocalInput,
  formatSignedAmount,
  formatStockAmount,
  formatWasteQuantity,
  getActiveSupplierOrder,
  getIngredientLocationRows,
  getIngredientPrimaryLocation,
  getIngredientStatus,
  getProductionExecutionDraft,
  getProductionReadiness,
  getStockRequirementsForItems,
  getSupplierKey,
  getSupplierOrderDrafts,
  getSupplierOrderQuantity,
  ingredientById,
  money,
  productById,
  render: () => render(),
  renderProductionRecipeFields: (options) => renderProductionRecipeFields(options),
  showToast,
  updateProductionCostPreview: () => updateProductionCostPreview()
});

const {
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
  markTicketDelayed,
  printOrderReceipt,
  removeOrderDraftLine,
  sendOrderToKitchen,
  showOrderReceipt,
  updateTicketStatus,
  validateOrderForKitchen
} = createStaffOrderRuntime({
  assignDriverToDeliveryOrder,
  can,
  canView,
  currentUser,
  deductInventoryForItems,
  formatStockAmount,
  getManualOrderCustomerDetails,
  getOrderCompletionToast,
  getOrderFulfillmentMeta,
  getOrderTotal,
  getProductAvailability,
  getStockShortages,
  getTicketStatusLabel,
  ingredientById,
  isOrderPaid,
  normalizeOrderItems,
  orderById,
  productById,
  recipeLineAppliesToOrder,
  render: () => render(),
  renderManualOrderControls: () => renderManualOrderControls(),
  renderOrderBuilder: () => renderOrderBuilder(),
  showToast,
  tableById,
  upsertCustomerFromOrderDetails
});

const {
  addCustomerCartItem,
  adjustCustomerCartItem,
  getCustomerCartItems,
  getCustomerCartTotal,
  getCustomerOrderContext,
  removeCustomerCartItem,
  setWebsiteFulfillment,
  startNewCustomerOrder,
  submitCustomerQrOrder,
  submitWebsiteOrder
} = createCustomerOrderingRuntime({
  getCustomerOrderingSession,
  getCustomerQrSession,
  getItemsTotal,
  getProductAvailability,
  getStockShortages,
  getWebsiteOrderSession,
  normalizeOrderItems,
  productById,
  render: () => render(),
  renderCustomerQrScreen: () => renderCustomerQrScreen(),
  renderWebsiteOrderScreen: () => renderWebsiteOrderScreen(),
  sendOrderToKitchen,
  showToast,
  upsertCustomerFromOrderDetails,
  validateOrderForKitchen
});

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
  addSellableRecipeLine,
  createPurchasedProduct,
  createSellableProduct,
  removeSellableRecipeLine,
  togglePurchasedProduct,
  toggleSellableProduct,
  updateIngredientPurchasePrice
} = createProductActionsRuntime({
  can,
  getRecipeLineQuantity,
  getRecipeMeasure,
  getSelectedInventoryLocation,
  ingredientById,
  productById,
  pushInventoryHistory,
  rememberInventoryLocation,
  render: () => render(),
  showToast
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
  createProcedure,
  promptAndRecordProcedureStatus,
  recordProcedureCompletion,
  setProcedureStepProgress
} = createProcedureActionsRuntime({
  can,
  currentUser,
  getProcedureStepProgress,
  procedureAssignedToUser,
  procedureById,
  procedureStepsComplete,
  render: () => render(),
  roleDefinition,
  showToast
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

const { addReservation } = createReservationActionsRuntime({
  can,
  getReservationValidation,
  render: () => render(),
  renderReservationPlanner,
  showToast,
  tableById
});

const {
  createStaffUser,
  saveRestaurantSettings
} = createAdminActionsRuntime({
  can,
  render: () => render(),
  roleDefinition,
  showToast
});

const {
  login,
  logout,
  setView
} = createSessionActionsRuntime({
  canView,
  render: () => render(),
  roleDefinition,
  showToast
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

  
