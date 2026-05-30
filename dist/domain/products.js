import { AVAILABILITY_OPTIONS, DEFAULT_RECIPE_ORDER_CONTEXT, TAKEAWAY_DELIVERY_RECIPE_CONTEXT } from "../shared/constants.js";
export function productAvailabilityLabel(product) {
    return AVAILABILITY_OPTIONS
        .filter((option) => product.availability?.[option.id])
        .map((option) => option.label)
        .join(", ") || "No channels";
}
export function getProductCost(product, getLineCost, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    return (product.recipe || []).reduce((sum, line) => sum + getLineCost(line, orderContext), 0);
}
export function getProductGrossMargin(product, getLineCost, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    return Math.max(0, (Number(product.price) || 0) - getProductCost(product, getLineCost, orderContext));
}
export function getProductMargin(product, getLineCost, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
    if (!product.price)
        return 0;
    return ((product.price - getProductCost(product, getLineCost, orderContext)) / product.price) * 100;
}
export function productHasConditionalRecipeLines(product) {
    return (product.recipe || []).some((line) => line.appliesTo === "takeawayDelivery");
}
export function getProductMarginProfile(product, getLineCost) {
    const baseMargin = getProductMargin(product, getLineCost, DEFAULT_RECIPE_ORDER_CONTEXT);
    const takeawayMargin = getProductMargin(product, getLineCost, TAKEAWAY_DELIVERY_RECIPE_CONTEXT);
    const margin = productHasConditionalRecipeLines(product) ? Math.min(baseMargin, takeawayMargin) : baseMargin;
    const className = margin < product.minMargin ? "danger" : margin < product.targetMargin ? "warning" : "ok";
    const label = margin < product.minMargin ? "Below minimum" : margin < product.targetMargin ? "Below target" : "On target";
    return { baseMargin, takeawayMargin, margin, className, label };
}
//# sourceMappingURL=products.js.map