import { normalizeInventoryLocationName, normalizeStockQuantity } from "../data/normalize.js";
import { formatStockAmount } from "../shared/formatters.js";
import {
  getRecipeLineQuantity,
  getRecipeLineWasteMultiplier,
  getRecipeMeasure
} from "./recipes.js";

function getProductionValue(values, name, fallback = "") {
  if (typeof values === "function") return values(name, fallback);
  if (!values || !Object.prototype.hasOwnProperty.call(values, name)) return fallback;
  return values[name];
}

export function roundMoneyValue(value) {
  return Number((Number(value) || 0).toFixed(2));
}

export function getProductionFieldName(line, index) {
  return `actual-${index}-${line.ingredientId}`;
}

export function getProductionProducts(products) {
  return (products || []).filter((product) => product.recipe?.length);
}

export function getDefaultProductionProductId(products, selectedProductId = "") {
  const productionProducts = getProductionProducts(products);
  if (productionProducts.some((product) => product.id === selectedProductId)) return selectedProductId;
  return productionProducts.find((product) => product.batchOutput)?.id || productionProducts[0]?.id || "";
}

export function getProductionOutputDefault(product) {
  return product?.batchOutput || {
    ingredientId: "",
    quantity: 0,
    unitType: "",
    location: ""
  };
}

export function getProductionOutputUnitType(ingredient, requestedUnitType, fallbackUnitType = "", deps) {
  if (!ingredient) return "";
  const allowedUnits = deps.getWasteUnitOptionsForIngredient(ingredient);
  const requested = deps.unitTypeDefinition(requestedUnitType).id;
  if (allowedUnits.some((unit) => unit.id === requested)) return requested;
  const fallback = deps.unitTypeDefinition(fallbackUnitType || ingredient.unitType).id;
  if (allowedUnits.some((unit) => unit.id === fallback)) return fallback;
  return allowedUnits[0]?.id || ingredient.unitType;
}

export function getProductionLineDraft(line, index, values, deps) {
  const ingredient = deps.ingredientById(line.ingredientId);
  if (!ingredient) return null;
  const measure = getRecipeMeasure(line);
  const plannedUsage = normalizeStockQuantity(getRecipeLineQuantity(line) * getRecipeLineWasteMultiplier(line));
  const actualFieldName = getProductionFieldName(line, index);
  const rawActualUsage = getProductionValue(values, actualFieldName, String(plannedUsage));
  const actualUsage = normalizeStockQuantity(rawActualUsage);
  const plannedStockQuantity = normalizeStockQuantity(deps.convertRecipeLineToStockUnits(line));
  const actualStockQuantity = normalizeStockQuantity(deps.convertActualUsageToStockUnits(line, actualUsage));
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

export function getProductionExecutionDraft(values, deps) {
  const product = deps.productById(getProductionValue(values, "productId"));
  const outputDefault = getProductionOutputDefault(product);
  const lines = (product?.recipe || [])
    .map((line, index) => getProductionLineDraft(line, index, values, deps))
    .filter(Boolean);
  const plannedCost = roundMoneyValue(lines.reduce((sum, line) => sum + line.plannedCost, 0));
  const actualCost = roundMoneyValue(lines.reduce((sum, line) => sum + line.actualCost, 0));
  const price = Number(product?.price) || 0;
  const plannedMargin = price ? ((price - plannedCost) / price) * 100 : null;
  const actualMargin = price ? ((price - actualCost) / price) * 100 : null;
  const outputIngredientId = getProductionValue(values, "outputIngredientId", outputDefault.ingredientId || "");
  const outputIngredient = deps.ingredientById(outputIngredientId);
  const outputQuantity = outputIngredient
    ? normalizeStockQuantity(getProductionValue(values, "outputQuantity", outputDefault.quantity || ""))
    : 0;
  const outputUnitType = outputIngredient
    ? deps.getProductionOutputUnitType(outputIngredient, getProductionValue(values, "outputUnitType", outputDefault.unitType), outputDefault.unitType)
    : "";
  const outputStockQuantity = outputIngredient && outputQuantity > 0
    ? deps.convertWasteQuantityToStockUnits(outputIngredient, outputQuantity, outputUnitType)
    : 0;
  const outputUnitCost = outputStockQuantity > 0 ? roundMoneyValue(actualCost / outputStockQuantity) : 0;
  const outputLocation = outputIngredient
    ? normalizeInventoryLocationName(getProductionValue(values, "outputLocation", outputDefault.location || outputIngredient.location), outputIngredient.location)
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

export function getProductionReadiness(draft, options: any = {}) {
  const shortages = draft.lines.filter((line) => line.shortage > 0);
  const zeroActuals = draft.lines.filter((line) => line.actualUsage <= 0);
  const needsOutputQuantity = Boolean(draft.outputIngredient && draft.outputStockQuantity <= 0);
  const formatAmount = options.formatStockAmount || formatStockAmount;

  if (!draft.product || !draft.lines.length) return { ok: false, className: "warning", label: "No recipe", detail: "Select a recipe with ingredients." };
  if (zeroActuals.length) return { ok: false, className: "warning", label: "Actuals needed", detail: "Enter actual quantity for each ingredient." };
  if (shortages.length) return { ok: false, className: "danger", label: "Missing stock", detail: shortages.map((line) => `${line.ingredient.name} ${formatAmount(line.shortage, line.ingredient.unit)}`).join(", ") };
  if (needsOutputQuantity) return { ok: false, className: "warning", label: "Yield needed", detail: "Enter the prepared batch quantity." };
  if (!options.stepsDone || !options.markedDone) return { ok: false, className: "warning", label: "Steps pending", detail: "Complete the preparation checklist." };
  return { ok: true, className: "ok", label: "Ready", detail: "Batch result can be saved." };
}
