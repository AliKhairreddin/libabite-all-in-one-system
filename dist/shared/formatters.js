export function formatStockAmount(value, unit) {
    const safeValue = Math.max(0, Number(value) || 0);
    const wholeUnit = ["pcs", "boxes", "packages"].includes(unit);
    const amount = wholeUnit ? Math.floor(safeValue) : safeValue.toFixed(safeValue >= 10 ? 1 : 2);
    return `${amount} ${unit}`;
}
export function formatActualUsageLabel(actualUsage, measure) {
    return measure.key === "units" ? `${actualUsage} ${measure.shortLabel}` : `${actualUsage}${measure.shortLabel}`;
}
export function formatSignedAmount(value, suffix = "") {
    const numericValue = Number(value) || 0;
    const sign = numericValue > 0 ? "+" : "";
    return `${sign}${numericValue.toFixed(1)}${suffix}`;
}
//# sourceMappingURL=formatters.js.map