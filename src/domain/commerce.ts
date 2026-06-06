import {
  PRECAUTIONARY_ALLERGEN_STATUSES,
  PRODUCT_ALLERGENS,
  VAT_OPTIONS,
  VAT_RATES
} from "../shared/constants.js";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeVatSetting(value, fallback = "reduced") {
  const candidate = cleanText(value);
  return VAT_OPTIONS.some((option) => option.id === candidate) ? candidate : fallback;
}

export function vatRateForSetting(value) {
  const setting = normalizeVatSetting(value, "standard");
  return VAT_RATES[setting] ?? VAT_RATES.standard;
}

export function vatLabelForSetting(value) {
  const setting = normalizeVatSetting(value, "standard");
  return VAT_OPTIONS.find((option) => option.id === setting)?.label || "Standard VAT (21%)";
}

export function normalizeProductAllergens(allergens) {
  const allowed = new Set(PRODUCT_ALLERGENS.map((allergen) => allergen.id));
  return [...new Set(Array.isArray(allergens) ? allergens : [])]
    .map((allergen) => cleanText(allergen))
    .filter((allergen) => allowed.has(allergen));
}

export function normalizePrecautionaryAllergenStatus(value) {
  const candidate = cleanText(value);
  return PRECAUTIONARY_ALLERGEN_STATUSES.includes(candidate) ? candidate : "none";
}

export function allergenLabels(allergens = []) {
  const labels = new Map(PRODUCT_ALLERGENS.map((allergen) => [allergen.id, allergen.label]));
  return normalizeProductAllergens(allergens)
    .map((allergen) => labels.get(allergen))
    .filter(Boolean);
}

export function productAllergenSummary(product: any = {}) {
  const labels = allergenLabels(product.allergens);
  const precautionaryStatus = normalizePrecautionaryAllergenStatus(product.precautionaryAllergenStatus);
  const precautionaryNote = cleanText(product.precautionaryAllergenNote);
  if (!labels.length && precautionaryStatus === "none" && !precautionaryNote) return "";
  const parts = [];
  if (labels.length) parts.push(`Contains ${labels.join(", ")}`);
  if (precautionaryStatus === "may_contain") parts.push(precautionaryNote || "May contain traces of other allergens");
  if (precautionaryStatus === "ask_staff") parts.push(precautionaryNote || "Ask staff for allergen details");
  return parts.join(". ");
}
