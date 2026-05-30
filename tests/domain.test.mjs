import test from "node:test";
import assert from "node:assert/strict";

import { convertWasteQuantityToStockUnits, getWasteUnitOptionsForIngredient, unitTypeDefinition } from "../dist/data/normalize.js";
import {
  findCustomerBySearchValue,
  getAddressHistoryForCustomer,
  getFavoriteItemsForCustomer,
  upsertCustomerFromOrderDetails
} from "../dist/domain/customers.js";
import { getProductAvailability, getStockRequirementsForItems, getStockShortages, planStockDeduction } from "../dist/domain/inventory.js";
import { advanceStatus, getOrderProgressSummary, setTicketStatus } from "../dist/domain/kitchen.js";
import { calculateItemsTotal, calculateOrderTotal, countOrderItems, normalizeOrderItems } from "../dist/domain/orders.js";
import { getPaymentStatusForMethod, isPaidPaymentMethod, normalizePaymentMethod } from "../dist/domain/payments.js";
import {
  getProductionExecutionDraft,
  getProductionFieldName,
  getProductionOutputUnitType,
  getProductionReadiness
} from "../dist/domain/production.js";
import { getProductMarginProfile, productAvailabilityLabel } from "../dist/domain/products.js";
import { procedureAssignedToUser, procedureFrequencyWindowMs, procedureStatusClass } from "../dist/domain/procedures.js";
import { convertActualUsageToStockUnits, convertRecipeLineToStockUnits, getRecipeUsageLabel, recipeLineAppliesToOrder } from "../dist/domain/recipes.js";
import { getAvailableReservationTable, getReservationConflicts, getReservationIssues, getReservationValidation } from "../dist/domain/reservations.js";
import { getCurrentUser, roleCan, roleDefinition, visibleViewsForRole } from "../dist/domain/users.js";
import { formatActualUsageLabel, formatSignedAmount, formatStockAmount } from "../dist/shared/formatters.js";
import { slugify, uniqueRecordId } from "../dist/shared/ids.js";
import { formatMoney } from "../dist/shared/money.js";

test("payment methods normalize into paid and pay-later states", () => {
  assert.equal(normalizePaymentMethod("Paid"), "Cash");
  assert.equal(normalizePaymentMethod("Pay later"), "Unpaid / pay later");
  assert.equal(isPaidPaymentMethod("Card"), true);
  assert.equal(isPaidPaymentMethod("Unpaid / pay later"), false);
  assert.equal(getPaymentStatusForMethod("Online payment"), "Paid");
  assert.equal(getPaymentStatusForMethod("Unpaid / pay later", "Paid"), "Pay later");
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
    { id: "r1", tableId: "table-1", time: "19:00", status: "Confirmed", name: "Nour" },
    { id: "r2", tableId: "table-2", time: "19:30", status: "Confirmed", name: "Dijk" },
    { id: "r3", tableId: "table-1", time: "19:45", status: "Cancelled", name: "Cancelled" }
  ];

  assert.deepEqual(
    getReservationConflicts({ id: "new", tableId: "table-1", time: "19:30" }, reservations).map((item) => item.id),
    ["r1"]
  );
  assert.equal(getReservationConflicts({ id: "new", tableId: "table-1", time: "20:30" }, reservations).length, 0);

  const tables = [
    { id: "table-1", name: "Table 1", capacity: 4 },
    { id: "table-2", name: "Table 2", capacity: 2 },
    { id: "table-3", name: "Table 3", capacity: 6 }
  ];
  assert.equal(getAvailableReservationTable({ guests: 4, time: "19:30" }, tables, reservations).id, "table-3");
  assert.deepEqual(getReservationIssues({ id: "new", tableId: "table-1", guests: 5, time: "19:30", status: "Confirmed" }, tables, reservations), [
    "Over capacity by 1",
    "Overlaps 19:00 Nour"
  ]);
  assert.equal(getReservationValidation({ tableId: "table-3", guests: 4, time: "19:30" }, tables, reservations).ok, true);
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
  assert.equal(getStockShortages([{ productId: "kefta", quantity: 3 }], deps, {})[0].shortage, 1);
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
