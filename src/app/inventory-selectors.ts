import {
  DEFAULT_INVENTORY_LOCATIONS,
  DEFAULT_RECIPE_ORDER_CONTEXT,
  INVENTORY_ACTIONS,
  UNIT_TYPES
} from "../shared/constants.js";
import { timeNow } from "../shared/dates.js";
import { formatStockAmount } from "../shared/formatters.js";
import {
  normalizeStockQuantity,
  sortInventoryLocations,
  unitTypeDefinition
} from "../data/normalize.js";
import {
  getProductAvailability as getProductAvailabilityFromInventory,
  getStockRequirementsForItems as getStockRequirementsForItemsFromInventory,
  getStockShortages as getStockShortagesFromInventory
} from "../domain/inventory.js";
import {
  buildSupplierOrderDrafts,
  buildSupplierOrderPayload as buildSupplierOrderPayloadFromDomain,
  getSupplierForIngredient as getSupplierForIngredientFromDomain,
  getSupplierKey as getSupplierKeyFromDomain,
  getSupplierMinimumOrderGap as getSupplierMinimumOrderGapFromDomain,
  getSupplierOrderQuantity as getSupplierOrderQuantityFromDomain,
  getSupplierOrderTotal as getSupplierOrderTotalFromDomain
} from "../domain/suppliers.js";
import { state } from "./state.js";
import {
  ingredientById,
  productById,
  supplierById
} from "./entities.js";
import { normalizeOrderItems } from "./order-selectors.js";
import {
  convertRecipeLineToStockUnits,
  recipeLineAppliesToOrder
} from "./recipe-selectors.js";

export function getAllInventoryLocations() {
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

export function getIngredientLocationRows(ingredient, includeEmpty = false) {
  const locations = includeEmpty ? getAllInventoryLocations() : Object.keys(ingredient.locationStock || {});
  return sortInventoryLocations(locations)
    .map((location) => ({
      location,
      quantity: normalizeStockQuantity(ingredient.locationStock?.[location] || 0)
    }))
    .filter((row) => includeEmpty || row.quantity > 0);
}

export function formatLocationOptionLabel(ingredient, location) {
  const quantity = ingredient ? normalizeStockQuantity(ingredient.locationStock?.[location] || 0) : 0;
  return ingredient ? `${location} (${formatStockAmount(quantity, ingredient.unit)})` : location;
}

export function inventoryActionLabel(type) {
  return INVENTORY_ACTIONS.find((action) => action.id === type)?.label || "Stock action";
}

export function wasteUnitLabel(unitTypeId) {
  const unitType = UNIT_TYPES.find((type) => type.id === unitTypeId) || unitTypeDefinition(unitTypeId);
  return unitType.shortLabel;
}

export function formatWasteQuantity(record) {
  return `${formatStockAmount(record.quantity, wasteUnitLabel(record.unitType))}`;
}

export function getWasteReportSummary() {
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

export function getInventoryRecipeDeps() {
  return {
    convertRecipeLineToStockUnits,
    ingredientById,
    normalizeOrderItems,
    productById,
    recipeLineAppliesToOrder
  };
}

export function getStockRequirementsForItems(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getStockRequirementsForItemsFromInventory(items, getInventoryRecipeDeps(), orderContext);
}

export function getProductAvailability(product, reservedItems = state.orderDraft, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductAvailabilityFromInventory(product, reservedItems, getInventoryRecipeDeps(), orderContext);
}

export function getStockShortages(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getStockShortagesFromInventory(items, getInventoryRecipeDeps(), orderContext);
}

export function getIngredientStatus(ingredient) {
  if (!ingredient.active) return "inactive";
  if (ingredient.stock <= ingredient.min) return "danger";
  if (ingredient.max > 0 && ingredient.stock > ingredient.max) return "over";
  if (ingredient.stock <= ingredient.min * 1.25) return "warning";
  return "ok";
}

export function getLowStockIngredients() {
  return state.ingredients.filter((ingredient) => ingredient.active && ingredient.stock <= ingredient.min);
}

export function getOverStockIngredients() {
  return state.ingredients.filter((ingredient) => ingredient.active && ingredient.max > 0 && ingredient.stock > ingredient.max);
}

export function supplierForIngredient(ingredient) {
  return getSupplierForIngredientFromDomain(ingredient, state.suppliers);
}

export function getSupplierKey(supplier) {
  return getSupplierKeyFromDomain(supplier);
}

export function getSupplierOrderQuantity(ingredient) {
  return getSupplierOrderQuantityFromDomain(ingredient);
}

export function getActiveSupplierOrder(supplierOrId) {
  const supplierKey = getSupplierKey(supplierOrId);
  return state.supplierOrders.find((order) => {
    if (order.status === "Received") return false;
    return order.supplierId === supplierOrId
      || order.supplier === supplierOrId
      || order.supplierId === supplierKey
      || getSupplierKey(order.supplier) === supplierKey;
  });
}

export function getSupplierOrderTotal(order) {
  return getSupplierOrderTotalFromDomain(order, ingredientById);
}

export function getSupplierMinimumOrderGap(order) {
  const supplier = supplierById(order?.supplierId) || state.suppliers.find((item) => item.name === order?.supplier);
  return getSupplierMinimumOrderGapFromDomain(order, supplier, ingredientById);
}

export function getSupplierOrderPayload(order) {
  const supplier = supplierById(order?.supplierId) || state.suppliers.find((item) => item.name === order?.supplier);
  return buildSupplierOrderPayloadFromDomain(order, supplier, ingredientById, {
    restaurantName: state.restaurantSettings.restaurantName
  });
}

export function getSupplierOrderDrafts() {
  return buildSupplierOrderDrafts({
    ingredients: state.ingredients,
    suppliers: state.suppliers,
    activeOrders: state.supplierOrders,
    now: timeNow()
  });
}
