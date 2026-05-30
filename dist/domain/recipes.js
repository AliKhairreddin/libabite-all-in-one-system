import { DEFAULT_RECIPE_ORDER_CONTEXT } from "../shared/constants.js";
import { normalizeRecipeWastePercent } from "../data/normalize.js";
export function isTakeawayDeliveryContext(orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    const channel = String(orderContext.channel || "");
    const fulfillment = String(orderContext.fulfillment || "");
    return fulfillment === "Delivery"
        || fulfillment === "Pickup"
        || channel === "Takeaway"
        || channel === "Uber Eats";
}
export function recipeLineAppliesToOrder(line, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    if (line.appliesTo !== "takeawayDelivery")
        return true;
    return isTakeawayDeliveryContext(orderContext);
}
export function getRecipeLineWasteMultiplier(line) {
    return 1 + (normalizeRecipeWastePercent(line.wastePercent) / 100);
}
export function getRecipeUsageLabel(line) {
    const wasteLabel = line.wastePercent ? ` +${normalizeRecipeWastePercent(line.wastePercent)}% waste` : "";
    if (line.grams)
        return `${line.grams}g${wasteLabel}`;
    if (line.milliliters)
        return `${line.milliliters}ml${wasteLabel}`;
    return `${line.units} pcs${wasteLabel}`;
}
export function getRecipeMeasure(line) {
    if (line.grams !== undefined)
        return { key: "grams", label: "grams", shortLabel: "g", step: 5 };
    if (line.milliliters !== undefined)
        return { key: "milliliters", label: "milliliters", shortLabel: "ml", step: 5 };
    return { key: "units", label: "pieces", shortLabel: "pcs", step: 1 };
}
export function getRecipeLineQuantity(line) {
    const measure = getRecipeMeasure(line);
    return Number(line[measure.key]) || 0;
}
export function convertRecipeLineToStockUnits(line, ingredient, unitTypeDefinition) {
    const unitType = unitTypeDefinition(ingredient?.unitType || ingredient?.unit);
    const multiplier = getRecipeLineWasteMultiplier(line);
    if (line.grams)
        return (unitType.id === "kilograms" ? line.grams / 1000 : line.grams) * multiplier;
    if (line.milliliters)
        return (unitType.id === "liters" ? line.milliliters / 1000 : line.milliliters) * multiplier;
    return (line.units || 0) * multiplier;
}
export function convertActualUsageToStockUnits(line, actualUsage, ingredient, unitTypeDefinition) {
    const measure = getRecipeMeasure(line);
    return convertRecipeLineToStockUnits({
        ingredientId: line.ingredientId,
        [measure.key]: actualUsage
    }, ingredient, unitTypeDefinition);
}
//# sourceMappingURL=recipes.js.map