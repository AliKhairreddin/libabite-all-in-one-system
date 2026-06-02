import { DEFAULT_RECIPE_ORDER_CONTEXT } from "../shared/constants.js";
import { ingredientById } from "./entities.js";
import { unitTypeDefinition } from "../data/normalize.js";
import {
  convertActualUsageToStockUnits as convertActualUsageToStockUnitsForRecipe,
  convertRecipeLineToStockUnits as convertRecipeLineToStockUnitsForRecipe,
  getRecipeLineQuantity as getRecipeLineQuantityFromRecipe,
  getRecipeLineWasteMultiplier as getRecipeLineWasteMultiplierFromRecipe,
  getRecipeMeasure as getRecipeMeasureFromRecipe,
  getRecipeUsageLabel as getRecipeUsageLabelFromRecipe,
  isTakeawayDeliveryContext as isTakeawayDeliveryOrderContext,
  recipeLineAppliesToOrder as recipeLineAppliesToOrderContext
} from "../domain/recipes.js";
import {
  getProductCost as getProductCostFromRecipe,
  getProductGrossMargin as getProductGrossMarginFromRecipe,
  getProductMargin as getProductMarginFromRecipe,
  getProductMarginProfile as getProductMarginProfileFromRecipe,
  productAvailabilityLabel as productAvailabilityLabelForProduct,
  productHasConditionalRecipeLines as productHasConditionalRecipeLinesForProduct
} from "../domain/products.js";

export function productAvailabilityLabel(product) {
  return productAvailabilityLabelForProduct(product);
}

export function isTakeawayDeliveryContext(orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return isTakeawayDeliveryOrderContext(orderContext);
}

export function recipeLineAppliesToOrder(line, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return recipeLineAppliesToOrderContext(line, orderContext);
}

export function getRecipeLineWasteMultiplier(line) {
  return getRecipeLineWasteMultiplierFromRecipe(line);
}

export function getLineCost(line, orderContext = null) {
  if (orderContext && !recipeLineAppliesToOrder(line, orderContext)) return 0;
  const ingredient = ingredientById(line.ingredientId);
  if (!ingredient) return 0;
  return convertRecipeLineToStockUnits(line) * ingredient.purchasePrice;
}

export function getProductCost(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductCostFromRecipe(product, getLineCost, orderContext);
}

export function getProductGrossMargin(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductGrossMarginFromRecipe(product, getLineCost, orderContext);
}

export function getProductMargin(product, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
  return getProductMarginFromRecipe(product, getLineCost, orderContext);
}

export function productHasConditionalRecipeLines(product) {
  return productHasConditionalRecipeLinesForProduct(product);
}

export function getProductMarginProfile(product) {
  return getProductMarginProfileFromRecipe(product, getLineCost);
}

export function getRecipeUsageLabel(line) {
  return getRecipeUsageLabelFromRecipe(line);
}

export function getRecipeMeasure(line) {
  return getRecipeMeasureFromRecipe(line);
}

export function getRecipeLineQuantity(line) {
  return getRecipeLineQuantityFromRecipe(line);
}

export function convertRecipeLineToStockUnits(line) {
  return convertRecipeLineToStockUnitsForRecipe(line, ingredientById(line.ingredientId), unitTypeDefinition);
}

export function convertActualUsageToStockUnits(line, actualUsage) {
  return convertActualUsageToStockUnitsForRecipe(line, actualUsage, ingredientById(line.ingredientId), unitTypeDefinition);
}

export function getRecipeMeasureOptionsForIngredient(ingredient) {
  const measure = unitTypeDefinition(ingredient?.unitType).recipeMeasure;
  if (measure === "grams") return [{ id: "grams", label: "grams" }];
  if (measure === "milliliters") return [{ id: "milliliters", label: "milliliters" }];
  return [{ id: "units", label: unitTypeDefinition(ingredient?.unitType).label }];
}
