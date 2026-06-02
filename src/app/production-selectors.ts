import { formatStockAmount } from "../shared/formatters.js";
import {
  convertWasteQuantityToStockUnits,
  getWasteUnitOptionsForIngredient,
  unitTypeDefinition
} from "../data/normalize.js";
import {
  getDefaultProductionProductId as getDefaultProductionProductIdFromList,
  getProductionExecutionDraft as getProductionExecutionDraftFromValues,
  getProductionOutputUnitType as getProductionOutputUnitTypeForIngredient,
  getProductionProducts as getProductionProductsFromList,
  getProductionReadiness as getProductionReadinessForDraft
} from "../domain/production.js";
import { state } from "./state.js";
import { ingredientById, productById } from "./entities.js";
import {
  convertActualUsageToStockUnits,
  convertRecipeLineToStockUnits
} from "./recipe-selectors.js";

export function getProductionProducts() {
  return getProductionProductsFromList(state.products);
}

export function getDefaultProductionProductId(selectedProductId = "") {
  return getDefaultProductionProductIdFromList(state.products, selectedProductId);
}

export function getProductionFormValue(form, name, fallback = "") {
  const field = form?.elements?.[name];
  return field ? field.value : fallback;
}

export function getProductionOutputUnitType(ingredient, requestedUnitType, fallbackUnitType = "") {
  return getProductionOutputUnitTypeForIngredient(ingredient, requestedUnitType, fallbackUnitType, {
    getWasteUnitOptionsForIngredient,
    unitTypeDefinition
  });
}

export function getProductionStepCheckboxes(form: any = document.querySelector("#productionForm")) {
  return Array.from(form?.querySelectorAll("[data-production-step]") || []) as any[];
}

export function productionStepsComplete(form: any = document.querySelector("#productionForm")) {
  const steps = getProductionStepCheckboxes(form);
  return steps.length ? steps.every((step) => step.checked) : false;
}

export function productionMarkedComplete(form: any = document.querySelector("#productionForm")) {
  return Boolean(form?.elements?.prepComplete?.checked);
}

export function getProductionExecutionDraft(form = document.querySelector("#productionForm")) {
  return getProductionExecutionDraftFromValues((name, fallback) => getProductionFormValue(form, name, fallback), {
    convertActualUsageToStockUnits,
    convertRecipeLineToStockUnits,
    convertWasteQuantityToStockUnits,
    getProductionOutputUnitType,
    ingredientById,
    productById
  });
}

export function getProductionReadiness(draft, form = document.querySelector("#productionForm")) {
  return getProductionReadinessForDraft(draft, {
    formatStockAmount,
    markedDone: productionMarkedComplete(form),
    stepsDone: productionStepsComplete(form)
  });
}
