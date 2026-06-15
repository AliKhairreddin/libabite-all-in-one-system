import test from "node:test";
import assert from "node:assert/strict";

import { convertWasteQuantityToStockUnits, getWasteUnitOptionsForIngredient, normalizeReceiptPrinterSettings, unitTypeDefinition } from "../dist/data/normalize.js";
import {
  findCustomerBySearchValue,
  getAddressHistoryForCustomer,
  getFavoriteItemsForCustomer,
  upsertCustomerFromOrderDetails
} from "../dist/domain/customers.js";
import { getProductAvailability, getStockRequirementsForItems, getStockShortages, planStockDeduction } from "../dist/domain/inventory.js";
import { advanceStatus, getOrderProgressSummary, resolveOrderStatusFromTickets, setTicketStatus } from "../dist/domain/kitchen.js";
import { calculateItemsTotal, calculateOrderTotal, countOrderItems, normalizeOrderFulfillment, normalizeOrderItems } from "../dist/domain/orders.js";
import { normalizeProductAllergens, productAllergenSummary, vatRateForSetting } from "../dist/domain/commerce.js";
import {
  buildExternalMenuPayload,
  calculateExternalCommission,
  findExternalProductMapping,
  mapInternalOrderStatusToExternalStatus,
  matchExternalOrderItems,
  parseExternalOrderLines
} from "../dist/domain/external-delivery.js";
import { formatCustomerDeliveryEta, formatDeliveryDistance, getDeliveryRouteProgress, normalizeDeliveryLocationHistory } from "../dist/domain/delivery.js";
import { externalPlatformRequiredSecrets, getExternalPlatformReadiness } from "../dist/domain/external-platform-adapters.js";
import { buildPaymentLedgerRecord, getPaymentStatusForMethod, isPaidPaymentMethod, normalizePaymentMethod, normalizePaymentStatus } from "../dist/domain/payments.js";
import {
  getProductionExecutionDraft,
  getProductionFieldName,
  getProductionOutputUnitType,
  getProductionReadiness
} from "../dist/domain/production.js";
import { createReceiptPdfBlob } from "../dist/domain/receipt-pdf.js";
import { getProductMarginProfile, productAvailabilityLabel } from "../dist/domain/products.js";
import { procedureAssignedToUser, procedureFrequencyWindowMs, procedureStatusClass } from "../dist/domain/procedures.js";
import { convertActualUsageToStockUnits, convertRecipeLineToStockUnits, getRecipeUsageLabel, recipeLineAppliesToOrder } from "../dist/domain/recipes.js";
import { normalizeScanCode, resolveScanCode } from "../dist/domain/scanning.js";
import {
  getAvailableReservationTable,
  getReservationBlockConflicts,
  getReservationCapacityIssue,
  getReservationConflicts,
  getReservationIssues,
  getReservationMergeOptions,
  getReservationRequestValidation,
  getReservationSeatingRecommendation,
  getReservationValidation
} from "../dist/domain/reservations.js";
import { formatShiftHours, getShiftMetrics, getWeekDates, getWeekStartDate } from "../dist/domain/scheduling.js";
import {
  buildSupplierOrderDrafts,
  buildSupplierOrderPayload,
  getLowStockReorderSuggestions,
  getSupplierMinimumOrderGap,
  getSupplierOrderQuantity,
  groupReorderSuggestionsBySupplier
} from "../dist/domain/suppliers.js";
import { getCurrentUser, roleCan, roleDefinition, visibleViewsForRole } from "../dist/domain/users.js";
import { formatActualUsageLabel, formatSignedAmount, formatStockAmount } from "../dist/shared/formatters.js";
import { slugify, uniqueRecordId } from "../dist/shared/ids.js";
import { formatMoney } from "../dist/shared/money.js";
import { ROLE_DEFINITIONS } from "../dist/shared/constants.js";

test("payment methods normalize into paid and pay-later states", () => {
  assert.equal(normalizePaymentMethod("Paid"), "Cash");
  assert.equal(normalizePaymentMethod("Pay later"), "Unpaid / pay later");
  assert.equal(isPaidPaymentMethod("Card"), true);
  assert.equal(isPaidPaymentMethod("Unpaid / pay later"), false);
  assert.equal(getPaymentStatusForMethod("Online payment"), "Paid");
  assert.equal(getPaymentStatusForMethod("Online payment", "Unpaid"), "Unpaid");
  assert.equal(getPaymentStatusForMethod("Online payment", "Pending"), "Pending");
  assert.equal(getPaymentStatusForMethod("Unpaid / pay later", "Paid"), "Pay later");
  assert.equal(normalizePaymentStatus("partially_refunded"), "Partially refunded");
  assert.equal(buildPaymentLedgerRecord({
    orderId: "ORD-1",
    amountCents: 1450,
    provider: "stripe",
    paymentMethod: "Online payment",
    status: "Paid",
    checkoutSessionId: "cs_test_123"
  }, { nowMs: 1000 }).externalId, "cs_test_123");
});

test("commerce helpers normalize Netherlands VAT and allergen metadata", () => {
  assert.equal(vatRateForSetting("reduced"), 0.09);
  assert.deepEqual(normalizeProductAllergens(["sesame", "unknown", "milk", "sesame"]), ["sesame", "milk"]);
  assert.equal(
    productAllergenSummary({ allergens: ["sesame"], precautionaryAllergenStatus: "may_contain" }),
    "Contains Sesame. May contain traces of other allergens"
  );
});

test("user role helpers resolve active users and permissions", () => {
  const roleDefinitions = {
    waiter_cashier: { views: ["orders"], canCreateOrders: true },
    manager: { views: ["dashboard", "orders"], canCreateOrders: true, canEditSettings: true }
  };
  const views = [{ id: "dashboard" }, { id: "orders" }, { id: "settings" }];
  const user = getCurrentUser([
    { id: "u1", role: "manager", status: "Active" },
    { id: "u2", role: "waiter_cashier", status: "Inactive" }
  ], "u1");

  assert.equal(user.role, "manager");
  assert.equal(roleDefinition("missing", roleDefinitions), roleDefinitions.waiter_cashier);
  assert.equal(roleCan(roleDefinition(user.role, roleDefinitions), "canEditSettings"), true);
  assert.deepEqual(visibleViewsForRole(views, roleDefinition(user.role, roleDefinitions)).map((view) => view.id), ["dashboard", "orders"]);
});

test("staff role matrix keeps command access to management roles", () => {
  const rolesWithCommand = Object.entries(ROLE_DEFINITIONS)
    .filter(([, definition]) => definition.views.includes("dashboard"))
    .map(([role]) => role);

  assert.deepEqual(rolesWithCommand, ["owner_admin", "manager"]);
  assert.deepEqual(ROLE_DEFINITIONS.waiter_cashier.views, ["orders", "procedures", "team", "reservations"]);
  assert.deepEqual(ROLE_DEFINITIONS.kitchen_staff.views, ["kitchen", "procedures", "team"]);
  assert.deepEqual(ROLE_DEFINITIONS.driver.views, ["procedures", "team"]);
  assert.equal(ROLE_DEFINITIONS.driver.canCreateOrders, undefined);
});

test("procedure helpers classify status and role assignments", () => {
  const roleDefinition = (role) => ({
    waiter_cashier: { label: "Waiter/Cashier", operationalRole: "Front" },
    manager: { label: "Manager", operationalRole: "Manager" }
  })[role];

  assert.equal(procedureStatusClass("Problem"), "danger");
  assert.equal(procedureFrequencyWindowMs("Per shift"), 12 * 60 * 60 * 1000);
  assert.equal(procedureAssignedToUser(
    { assignedRole: "Front" },
    { role: "waiter_cashier" },
    { canReviewProcedures: false, roleDefinition }
  ), true);
  assert.equal(procedureAssignedToUser(
    { assignedRole: "Kitchen" },
    { role: "manager" },
    { canReviewProcedures: true, roleDefinition }
  ), true);
});

test("order totals ignore missing products and multiply quantities", () => {
  const products = new Map([
    ["kefta-plate", { id: "kefta-plate", price: 12.5 }],
    ["mint-tea", { id: "mint-tea", price: 3 }]
  ]);
  const productById = (id) => products.get(id);

  assert.equal(calculateItemsTotal([
    { productId: "kefta-plate", quantity: 2 },
    { productId: "missing", quantity: 99 }
  ], productById), 25);
  assert.equal(calculateOrderTotal({
    items: [
      { productId: "kefta-plate", quantity: 2 },
      { productId: "mint-tea", quantity: 1 }
    ]
  }, productById), 28);

  const normalized = normalizeOrderItems([
    { productId: "kefta-plate", quantity: "1", note: "hot", modifiers: ["Extra sauce"] },
    { productId: "kefta-plate", quantity: 2, notes: "hot", modifiers: ["Extra sauce"] },
    { productId: "missing", quantity: 5 }
  ], productById);
  assert.deepEqual(normalized, [{ productId: "kefta-plate", quantity: 3, note: "hot", modifiers: ["Extra sauce"] }]);
  assert.equal(countOrderItems(normalized), 3);
});

test("website order fulfillment preserves delivery checkout choice", () => {
  assert.equal(normalizeOrderFulfillment("Website order", "Delivery"), "Delivery");
  assert.equal(normalizeOrderFulfillment("Website order", "Pickup"), "Pickup");
  assert.equal(normalizeOrderFulfillment("Website order", "Unknown"), "Pickup");
});

test("table-service orders stay ready until a waiter serves them", () => {
  const tableOrder = { id: "ORD-1", status: "Ready", servedAtMs: "" };
  const doneTickets = [
    { orderId: "ORD-1", status: "Done" },
    { orderId: "ORD-1", status: "Done" }
  ];

  assert.equal(resolveOrderStatusFromTickets(tableOrder, doneTickets, { isTableService: true }), "Ready");
  assert.equal(resolveOrderStatusFromTickets({ ...tableOrder, servedAtMs: 1000 }, doneTickets, { isTableService: true }), "Served");
  assert.equal(resolveOrderStatusFromTickets({ ...tableOrder, status: "Preparing" }, [
    { orderId: "ORD-1", status: "Ready" },
    { orderId: "ORD-1", status: "Preparing" }
  ], { isTableService: true }), "Preparing");
  assert.equal(resolveOrderStatusFromTickets({ id: "ORD-2", status: "Ready" }, [
    { orderId: "ORD-2", status: "Done" }
  ], { isPaid: true }), "Paid");
});

test("receipt PDF generator returns a PDF blob payload", async () => {
  const blob = createReceiptPdfBlob({
    restaurantName: "Libabite",
    location: "Roermond",
    orderNumber: 42,
    createdAt: "2026-06-14 12:00",
    orderType: "Dine-in",
    locationLabel: "Table 1",
    fulfillment: "Kitchen",
    staffName: "Yusuf",
    items: [
      { name: "Shish Taouk", quantity: 2, unitPrice: "€ 22,00", total: "€ 44,00", detail: "No onion" }
    ],
    totals: [
      { label: "Subtotal excl. VAT", value: "€ 40,37" },
      { label: "Total", value: "€ 44,00" }
    ],
    paymentRows: ["Payment: Unpaid"],
    footerRows: ["Thanks"]
  });
  const payload = await blob.text();

  assert.equal(blob.type, "application/pdf");
  assert.equal(payload.startsWith("%PDF-1.4"), true);
  assert.equal(payload.includes("Order #42"), true);
  assert.equal(payload.includes("EUR 44,00"), true);
});

test("receipt printer settings normalize hardware options", () => {
  const settings = normalizeReceiptPrinterSettings({
    enabled: false,
    printerId: " front ",
    printerName: " Front Printer ",
    host: " 192.168.1.50 ",
    port: 999999,
    paperWidth: 12,
    copies: 20,
    maxAttempts: 0,
    printOnPaid: false,
    cutPaper: false,
    openCashDrawer: true
  });

  assert.equal(settings.enabled, false);
  assert.equal(settings.printerId, "front");
  assert.equal(settings.printerName, "Front Printer");
  assert.equal(settings.host, "192.168.1.50");
  assert.equal(settings.port, 65535);
  assert.equal(settings.paperWidth, 32);
  assert.equal(settings.copies, 5);
  assert.equal(settings.maxAttempts, 3);
  assert.equal(settings.printOnPaid, false);
  assert.equal(settings.cutPaper, false);
  assert.equal(settings.openCashDrawer, true);
});

test("external delivery helpers parse, map, and prepare platform payloads", () => {
  const products = new Map([
    ["kefta-sandwich", { id: "kefta-sandwich", name: "Kefta Sandwich", code: "SW-KEFTA", station: "Grill station", price: 9.5, active: true }],
    ["burger", { id: "burger", name: "Burger", code: "BG-001", station: "Burger station", price: 12.5, active: true }]
  ]);
  const productById = (id) => products.get(id);
  const mappings = [
    { id: "map-1", platformId: "uber-eats", externalName: "Sandwich Kefta", externalCode: "99301", productId: "kefta-sandwich", active: true },
    { id: "map-2", platformId: "uber-eats", externalName: "Burger Libabite", externalCode: "99302", productId: "burger", active: true }
  ];

  assert.equal(findExternalProductMapping({ platformId: "Uber Eats", externalCode: "99301" }, mappings).productId, "kefta-sandwich");
  assert.deepEqual(parseExternalOrderLines("code,qty\n99301,2,No onion\nBurger Libabite x1"), [
    { externalCode: "99301", externalName: "99301", quantity: 2, note: "No onion" },
    { externalCode: "Burger Libabite", externalName: "Burger Libabite", quantity: 1, note: "" }
  ]);

  const result = matchExternalOrderItems(parseExternalOrderLines("99301,2\nmissing,1"), {
    platformId: "uber-eats",
    mappings,
    productById
  });
  assert.equal(result.matched[0].productId, "kefta-sandwich");
  assert.equal(result.unmatched[0].reason, "No mapping");

  const payload = buildExternalMenuPayload({ id: "uber-eats", name: "Uber Eats", commissionRate: 30 }, mappings, productById, { generatedAt: "2026-06-01T10:00:00.000Z" });
  assert.deepEqual(payload.items.map((item) => [item.externalCode, item.internalProductName, item.kitchenStation]), [
    ["99301", "Kefta Sandwich", "Grill station"],
    ["99302", "Burger", "Burger station"]
  ]);
  assert.equal(calculateExternalCommission(19, 30), 5.7);
  assert.equal(mapInternalOrderStatusToExternalStatus({ status: "Ready" }), "ready");
  assert.deepEqual(externalPlatformRequiredSecrets("Uber Eats"), ["UBER_EATS_CLIENT_ID", "UBER_EATS_CLIENT_SECRET", "UBER_EATS_STORE_ID"]);
  assert.equal(getExternalPlatformReadiness({ id: "thuisbezorgd", status: "Approval pending", integrationMethod: "api" }).apiReady, false);
});

test("scan helpers resolve product barcodes, URL QR codes, and table tokens", () => {
  const context = {
    ingredients: [
      { id: "kefta", name: "Kefta", barcode: "KEFTA-001" }
    ],
    products: [
      { id: "kefta-plate", name: "Kefta Plate", code: "KP-001" }
    ],
    tables: [
      { id: "table-1", name: "Table 1" }
    ],
    tableQrCodes: [
      { id: "qr-table-1", tableId: "table-1", token: "libabite-table-1" }
    ],
    users: [],
    locations: ["Fridge"]
  };

  assert.equal(normalizeScanCode("https://demo.local/?qr=libabite-table-1"), "libabite-table-1");
  assert.deepEqual(
    resolveScanCode("KEFTA-001", context),
    {
      ok: true,
      code: "KEFTA-001",
      scanType: "product_barcode",
      targetKind: "ingredient",
      targetId: "kefta",
      label: "Kefta",
      message: "Kefta inventory opened."
    }
  );
  assert.equal(resolveScanCode("recipe:KP-001", context).targetId, "kefta-plate");
  assert.equal(resolveScanCode("https://demo.local/?qr=libabite-table-1", context).targetId, "table-1");
});

test("customer helpers find history, favorites, and upsert records", () => {
  const customers = [
    { id: "cust-1", name: "Nour", phone: "+33 6 12 34 56", addresses: ["1 Rue A"], notes: "" }
  ];
  const orders = [
    { customerId: "cust-1", customerPhone: "+336123456", deliveryAddress: "2 Rue B", createdAtMs: 2000, items: [{ productId: "tea", quantity: 2 }] },
    { customerId: "", customerName: "Nour", customerPhone: "+33 6 12 34 56", deliveryAddress: "1 Rue A", createdAtMs: 1000, items: [{ productId: "kefta", quantity: 1 }] }
  ];
  const products = new Map([
    ["tea", { id: "tea", name: "Mint Tea" }],
    ["kefta", { id: "kefta", name: "Kefta" }]
  ]);

  assert.equal(findCustomerBySearchValue(customers, "+336123456").id, "cust-1");
  assert.deepEqual(getAddressHistoryForCustomer(customers[0], orders), ["1 Rue A", "2 Rue B"]);
  assert.equal(getFavoriteItemsForCustomer(customers[0], orders, (id) => products.get(id), (items) => items)[0].product.name, "Mint Tea");

  const customer = upsertCustomerFromOrderDetails(customers, {
    name: "Nour Z",
    phone: "+33 6 12 34 56",
    deliveryAddress: "3 Rue C",
    notes: "No onions"
  });
  assert.equal(customer.id, "cust-1");
  assert.equal(customer.name, "Nour Z");
  assert.deepEqual(customer.addresses, ["3 Rue C", "1 Rue A"]);
});

test("delivery route helpers normalize GPS samples and estimate route progress", () => {
  const route = [
    { lat: 51.1949, lng: 5.9878 },
    { lat: 51.1949, lng: 5.9978 },
    { lat: 51.1949, lng: 6.0078 }
  ];
  const progress = getDeliveryRouteProgress(route, { lat: 51.1949, lng: 5.9978 });

  assert.equal(progress.percent, 50);
  assert.ok(progress.distanceRemainingMeters > 650);
  assert.ok(progress.distanceRemainingMeters < 750);
  assert.equal(formatDeliveryDistance(42), "<50 m");
  assert.equal(normalizeDeliveryLocationHistory([{ lat: "bad", lng: 5 }, { lat: 51.2, lng: 6, atMs: 1000 }]).length, 1);
});

test("customer delivery ETA avoids internal assignment language", () => {
  assert.equal(formatCustomerDeliveryEta({ fulfillment: "Delivery", assignedDriver: "", deliveryStatus: "" }), "ETA after confirmation");
  assert.equal(formatCustomerDeliveryEta({ fulfillment: "Delivery", assignedDriver: "driver-1", deliveryStatus: "Assigned", deliveryStatusUpdatedAtMs: Date.now() }), "18 min");
  assert.equal(formatCustomerDeliveryEta({ fulfillment: "Delivery", assignedDriver: "", deliveryStatus: "Delivered" }), "Delivered");
});

test("kitchen status flow advances and stamps status milestones", () => {
  assert.equal(advanceStatus("Queued"), "Accepted");
  assert.equal(advanceStatus("Delayed"), "Preparing");
  assert.equal(advanceStatus("Done"), "Done");
  assert.equal(advanceStatus("Unknown"), "Queued");

  const ticket = {};
  assert.equal(setTicketStatus(ticket, "Ready", { now: 1000 }), true);
  assert.equal(ticket.status, "Ready");
  assert.equal(ticket.acceptedAtMs, 1000);
  assert.equal(ticket.startedAtMs, 1000);
  assert.equal(ticket.readyAtMs, 1000);
  assert.equal(ticket.completedAtMs, undefined);

  assert.equal(setTicketStatus(ticket, "Done", { now: 2000 }), true);
  assert.equal(ticket.readyAtMs, 1000);
  assert.equal(ticket.completedAtMs, 2000);
});

test("kitchen order progress summary reflects ticket readiness", () => {
  const order = { id: "order-1", status: "Sent to kitchen" };
  const summary = getOrderProgressSummary(order, [
    { orderId: "order-1", status: "Ready" },
    { orderId: "order-1", status: "Preparing" },
    { orderId: "other-order", status: "Done" }
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.finished, 1);
  assert.equal(summary.percent, 50);
  assert.equal(summary.status, "Preparing");
  assert.equal(summary.className, "info");
});

test("reservation conflicts respect table, status, and turnover window", () => {
  const reservations = [
    { id: "r1", date: "2026-06-01", tableId: "table-1", time: "19:00", status: "Confirmed", name: "Nour" },
    { id: "r2", date: "2026-06-01", tableId: "table-2", time: "19:30", status: "Confirmed", name: "Dijk" },
    { id: "r3", date: "2026-06-01", tableId: "table-1", time: "19:45", status: "Cancelled", name: "Cancelled" },
    { id: "r4", date: "2026-06-02", tableId: "table-1", time: "19:30", status: "Confirmed", name: "Tomorrow" }
  ];

  assert.deepEqual(
    getReservationConflicts({ id: "new", date: "2026-06-01", tableId: "table-1", time: "19:30" }, reservations).map((item) => item.id),
    ["r1"]
  );
  assert.equal(getReservationConflicts({ id: "new", date: "2026-06-01", tableId: "table-1", time: "20:30" }, reservations).length, 0);

  const tables = [
    { id: "table-1", name: "Table 1", capacity: 4 },
    { id: "table-2", name: "Table 2", capacity: 2 },
    { id: "table-3", name: "Table 3", capacity: 6 }
  ];
  assert.equal(getAvailableReservationTable({ date: "2026-06-01", guests: 4, time: "19:30" }, tables, reservations).id, "table-3");
  assert.deepEqual(getReservationIssues({ id: "new", date: "2026-06-01", tableId: "table-1", guests: 5, time: "19:30", status: "Confirmed" }, tables, reservations), [
    "Over capacity by 1",
    "Overlaps 19:00 Nour"
  ]);
  assert.equal(getReservationValidation({ date: "2026-06-01", tableId: "table-3", guests: 4, time: "19:30" }, tables, reservations).ok, true);
});

test("reservation seating recommendations prefer two-tops and joined tables", () => {
  const date = "2026-06-01";
  const time = "18:00";
  const tables = [
    { id: "table-1", name: "Table 1", capacity: 4, zone: "Dining room" },
    { id: "table-2", name: "Table 2", capacity: 2, zone: "Window" },
    { id: "table-3", name: "Table 3", capacity: 4, zone: "Dining room" },
    { id: "table-4", name: "Table 4", capacity: 4, zone: "Dining room" }
  ];

  assert.equal(getAvailableReservationTable({ date, guests: 2, time }, tables, []).id, "table-2");
  assert.equal(getAvailableReservationTable({ date, guests: 2, time }, tables, [
    { id: "r1", date, tableId: "table-2", time, status: "Confirmed", name: "Sofia" }
  ]).id, "table-1");

  const mergeOptions = getReservationMergeOptions({ date, guests: 5, time }, tables.slice(1), []);
  assert.deepEqual(mergeOptions[0].tables.map((table) => table.id), ["table-3", "table-4"]);

  const recommendation = getReservationSeatingRecommendation({ date, guests: 5, time }, tables.slice(1), []);
  assert.equal(recommendation.kind, "merge");
  assert.equal(recommendation.capacity, 8);
});

test("reservation requests honor blocked windows and capacity rules", () => {
  const tables = [
    { id: "table-1", name: "Table 1", capacity: 4 },
    { id: "table-2", name: "Table 2", capacity: 6 }
  ];
  const reservations = [
    { id: "r1", date: "2026-06-01", tableId: "table-1", guests: 4, time: "18:30", status: "Confirmed", name: "Nour" }
  ];
  const blocks = [
    { id: "b1", date: "2026-06-01", startTime: "19:00", endTime: "20:00", reason: "Private event", active: true }
  ];
  const rules = [
    { id: "c1", date: "", startTime: "18:00", endTime: "21:00", maxGuests: 6, maxReservations: 3, active: true }
  ];

  assert.equal(getReservationBlockConflicts({ date: "2026-06-01", time: "19:15" }, blocks).length, 1);
  assert.equal(getReservationRequestValidation({
    date: "2026-06-01",
    time: "19:15",
    guests: 2,
    name: "Sofia",
    phone: "+31 6"
  }, tables, reservations, blocks, rules).ok, false);
  assert.equal(getReservationCapacityIssue({
    date: "2026-06-01",
    time: "18:45",
    guests: 3,
    name: "Sofia",
    phone: "+31 6"
  }, reservations, rules).title, "Capacity limit");
  assert.equal(getReservationRequestValidation({
    date: "2026-06-02",
    time: "18:45",
    guests: 3,
    name: "Sofia",
    phone: "+31 6"
  }, tables, reservations, blocks, rules).ok, true);
});

test("staff shift metrics compare planned time with actual punches", () => {
  const monday = getWeekStartDate("2026-05-30");
  assert.equal(monday, "2026-05-25");
  assert.deepEqual(getWeekDates(monday), [
    "2026-05-25",
    "2026-05-26",
    "2026-05-27",
    "2026-05-28",
    "2026-05-29",
    "2026-05-30",
    "2026-05-31"
  ]);

  const lateShift = {
    date: "2026-05-25",
    startTime: "10:00",
    endTime: "18:00",
    role: "Kitchen",
    clockInAtMs: new Date("2026-05-25T10:08:00").getTime(),
    clockOutAtMs: new Date("2026-05-25T16:50:00").getTime(),
    breakMinutes: 20
  };
  const lateMetrics = getShiftMetrics(lateShift, new Date("2026-05-25T19:00:00").getTime());
  assert.equal(lateMetrics.plannedMinutes, 480);
  assert.equal(lateMetrics.actualMinutes, 382);
  assert.equal(lateMetrics.lateMinutes, 8);
  assert.equal(lateMetrics.earlyOutMinutes, 70);
  assert.equal(lateMetrics.attendanceStatus, "Left early");

  const driverShift = {
    date: "2026-05-26",
    startTime: "10:00",
    endTime: "18:00",
    role: "Driver",
    clockInAtMs: new Date("2026-05-26T09:55:00").getTime(),
    clockOutAtMs: new Date("2026-05-26T18:45:00").getTime(),
    breakMinutes: 20
  };
  const driverMetrics = getShiftMetrics(driverShift, new Date("2026-05-26T19:00:00").getTime());
  assert.equal(driverMetrics.overtimeMinutes, 30);
  assert.equal(driverMetrics.driverOnTimeStatus, "On time");
  assert.equal(formatShiftHours(driverMetrics.actualMinutes), "8.5h");

  const missedMetrics = getShiftMetrics({
    date: "2026-05-27",
    startTime: "12:00",
    endTime: "14:00",
    role: "Front"
  }, new Date("2026-05-27T14:10:00").getTime());
  assert.equal(missedMetrics.missed, true);
  assert.equal(missedMetrics.attendanceStatus, "Missed");
});

test("inventory deduction planner prefers requested location then largest remaining stock", () => {
  const result = planStockDeduction([
    { location: "Fridge", quantity: 2 },
    { location: "Freezer", quantity: 5 },
    { location: "Dry storage", quantity: 1 }
  ], 4, "Fridge");

  assert.equal(result.removed, 4);
  assert.equal(result.remaining, 0);
  assert.deepEqual(result.removals, [
    { location: "Fridge", quantity: 2 },
    { location: "Freezer", quantity: 2 }
  ]);

  const short = planStockDeduction([{ location: "Fridge", quantity: 1.5 }], 2);
  assert.equal(short.removed, 1.5);
  assert.equal(short.remaining, 0.5);
});

test("inventory availability accounts for reserved basket stock", () => {
  const ingredients = new Map([
    ["beef", { id: "beef", name: "Beef", stock: 5, active: true }]
  ]);
  const products = new Map([
    ["kefta", { id: "kefta", active: true, recipe: [{ ingredientId: "beef", units: 2 }] }]
  ]);
  const deps = {
    convertRecipeLineToStockUnits: (line) => line.units,
    ingredientById: (id) => ingredients.get(id),
    normalizeOrderItems: (items) => items,
    productById: (id) => products.get(id),
    recipeLineAppliesToOrder: () => true
  };

  assert.equal(getStockRequirementsForItems([{ productId: "kefta", quantity: 2 }], deps, {}).get("beef"), 4);
  assert.equal(getProductAvailability(products.get("kefta"), [{ productId: "kefta", quantity: 1 }], deps, {}).maxQuantity, 1);
  assert.equal(getProductAvailability({ id: "imported-menu-item", active: true, recipe: [] }, [], deps, {}).maxQuantity, 99);
  assert.equal(getStockShortages([{ productId: "kefta", quantity: 3 }], deps, {})[0].shortage, 1);
});

test("supplier reorder drafts group low-stock products and preserve sent orders", () => {
  const ingredients = [
    { id: "beef", name: "Beef", supplier: "Butcher", stock: 2, min: 5, max: 20, purchasePrice: 8, unit: "kg", active: true },
    { id: "bun", name: "Bun", supplier: "Bakery", stock: 8, min: 10, max: 40, purchasePrice: 0.5, unit: "pcs", active: true },
    { id: "sauce", name: "Sauce", supplier: "Butcher", stock: 12, min: 5, max: 30, purchasePrice: 2, unit: "l", active: true }
  ];
  const suppliers = [
    { id: "butcher", name: "Butcher", productsSupplied: ["beef", "sauce"], minimumOrderAmount: 200, integrationMethod: "email" },
    { id: "bakery", name: "Bakery", productsSupplied: ["bun"], minimumOrderAmount: 20, integrationMethod: "csv" }
  ];
  const suggestions = getLowStockReorderSuggestions(ingredients, suppliers);
  const grouped = groupReorderSuggestionsBySupplier(suggestions);

  assert.equal(getSupplierOrderQuantity(ingredients[0]), 18);
  assert.deepEqual(grouped.map((group) => group.supplier), ["Bakery", "Butcher"]);
  assert.equal(grouped.find((group) => group.supplier === "Butcher").estimatedTotal, 144);

  const drafts = buildSupplierOrderDrafts({
    ingredients,
    suppliers,
    activeOrders: [{ id: "PO-bakery", supplierId: "bakery", supplier: "Bakery", status: "Sent", items: [{ ingredientId: "bun", quantity: 32 }] }],
    now: "09:00"
  });

  assert.deepEqual(drafts.map((order) => [order.supplier, order.status]), [["Bakery", "Sent"], ["Butcher", "Draft"]]);
  assert.equal(drafts.find((order) => order.supplier === "Butcher").items[0].quantity, 18);
  assert.equal(getSupplierMinimumOrderGap(drafts.find((order) => order.supplier === "Butcher"), suppliers[0], (id) => ingredients.find((item) => item.id === id)), 56);

  const payload = buildSupplierOrderPayload(drafts.find((order) => order.supplier === "Butcher"), suppliers[0], (id) => ingredients.find((item) => item.id === id), { restaurantName: "Libabite" });
  assert.equal(payload.method, "email");
  assert.match(payload.body, /Beef: 18 kg/);
});

test("recipe helpers handle route-specific lines and stock-unit conversion", () => {
  const unitTypeDefinition = (value) => ({ id: value || "units" });
  const line = { ingredientId: "flour", grams: 500, wastePercent: 10, appliesTo: "takeawayDelivery" };
  const ingredient = { unitType: "kilograms" };

  assert.equal(recipeLineAppliesToOrder(line, { channel: "Dine-in", fulfillment: "Table" }), false);
  assert.equal(recipeLineAppliesToOrder(line, { channel: "Takeaway", fulfillment: "Pickup" }), true);
  assert.equal(convertRecipeLineToStockUnits(line, ingredient, unitTypeDefinition), 0.55);
  assert.equal(convertActualUsageToStockUnits(line, 250, ingredient, unitTypeDefinition), 0.25);
  assert.equal(getRecipeUsageLabel(line), "500g +10% waste");
});

test("production draft helpers calculate actual cost, yield, and readiness", () => {
  const ingredients = new Map([
    ["beef", { id: "beef", name: "Beef", unit: "kg", unitType: "kilograms", stock: 2, purchasePrice: 8, active: true, location: "Fridge" }],
    ["spice", { id: "spice", name: "Spice", unit: "g", unitType: "grams", stock: 100, purchasePrice: 0.05, active: true, location: "Dry storage" }],
    ["prepared", { id: "prepared", name: "Prepared Kefta", unit: "pcs", unitType: "pieces", stock: 0, purchasePrice: 1, active: true, location: "Fridge" }]
  ]);
  const recipe = [
    { ingredientId: "beef", grams: 1000, wastePercent: 10 },
    { ingredientId: "spice", grams: 20 }
  ];
  const products = new Map([
    ["kefta-batch", {
      id: "kefta-batch",
      name: "Kefta Batch",
      price: 20,
      recipe,
      batchOutput: { ingredientId: "prepared", quantity: 10, unitType: "pieces", location: "Fridge" }
    }]
  ]);
  const resolveOutputUnitType = (ingredient, requested, fallback) => getProductionOutputUnitType(ingredient, requested, fallback, {
    getWasteUnitOptionsForIngredient,
    unitTypeDefinition
  });
  const deps = {
    convertActualUsageToStockUnits: (line, actualUsage) => convertActualUsageToStockUnits(line, actualUsage, ingredients.get(line.ingredientId), unitTypeDefinition),
    convertRecipeLineToStockUnits: (line) => convertRecipeLineToStockUnits(line, ingredients.get(line.ingredientId), unitTypeDefinition),
    convertWasteQuantityToStockUnits,
    getProductionOutputUnitType: resolveOutputUnitType,
    ingredientById: (id) => ingredients.get(id),
    productById: (id) => products.get(id)
  };

  const draft = getProductionExecutionDraft({
    productId: "kefta-batch",
    [getProductionFieldName(recipe[0], 0)]: 1200,
    [getProductionFieldName(recipe[1], 1)]: 30,
    outputIngredientId: "prepared",
    outputQuantity: 12,
    outputUnitType: "pieces",
    outputLocation: "Fridge"
  }, deps);

  assert.equal(draft.lines[0].plannedUsage, 1100);
  assert.equal(draft.lines[0].actualStockQuantity, 1.2);
  assert.equal(draft.plannedCost, 9.8);
  assert.equal(draft.actualCost, 11.1);
  assert.equal(draft.costDelta, 1.3);
  assert.equal(draft.outputStockQuantity, 12);
  assert.equal(draft.outputUnitCost, 0.92);
  assert.equal(draft.actualMargin, 44.5);
  assert.equal(draft.marginDelta, -6.5);
  assert.equal(getProductionReadiness(draft, { stepsDone: true, markedDone: true }).ok, true);
  assert.equal(resolveOutputUnitType(ingredients.get("beef"), "pieces", "kilograms"), "kilograms");
});

test("product helpers summarize availability and margin risk", () => {
  const product = {
    price: 10,
    targetMargin: 70,
    minMargin: 50,
    availability: { dineIn: true, takeaway: true },
    recipe: [{ cost: 2 }, { cost: 4, appliesTo: "takeawayDelivery" }]
  };
  const lineCost = (line, context) => line.appliesTo === "takeawayDelivery" && context.channel === "Dine-in" ? 0 : line.cost;
  const profile = getProductMarginProfile(product, lineCost);

  assert.equal(productAvailabilityLabel(product), "Dine-in, Takeaway");
  assert.equal(profile.baseMargin, 80);
  assert.equal(profile.takeawayMargin, 40);
  assert.equal(profile.className, "danger");
});

test("shared money and id helpers are deterministic", () => {
  assert.equal(formatMoney(12.5, "EUR"), "€ 12,50");
  assert.equal(formatStockAmount(12.345, "kg"), "12.3 kg");
  assert.equal(formatStockAmount(4.9, "pcs"), "4 pcs");
  assert.equal(formatActualUsageLabel(250, { key: "grams", shortLabel: "g" }), "250g");
  assert.equal(formatSignedAmount(-3.25, " pts"), "-3.3 pts");
  assert.equal(slugify("Table 12 / Window"), "table-12-window");
  assert.equal(uniqueRecordId("New User", [[{ id: "new-user" }]]), "new-user-2");
});
