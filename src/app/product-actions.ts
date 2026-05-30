import {
  AVAILABILITY_OPTIONS,
  DEFAULT_MARGIN_MINIMUM,
  DEFAULT_MARGIN_TARGET,
  PRODUCT_CATEGORIES,
  VAT_OPTIONS
} from "../shared/constants.js";
import {
  normalizeKitchenStation,
  normalizeMarginPercent,
  normalizeRecipeAppliesTo,
  normalizeRecipeLine,
  normalizeRecipeLines,
  normalizeRecipeWastePercent,
  unitTypeDefinition
} from "../data/normalize.js";
import { uniqueRecordId } from "../shared/ids.js";
import { saveState, state } from "./state.js";

export function createProductActionsRuntime(deps) {
  const {
    can,
    getRecipeLineQuantity,
    getRecipeMeasure,
    getSelectedInventoryLocation,
    ingredientById,
    productById,
    pushInventoryHistory,
    rememberInventoryLocation,
    render,
    showToast
  } = deps;

  function buildRecipeLine(ingredientId, quantity, measureKey, station, wastePercent = 0, appliesTo = "all", notes = "") {
    const amount = Math.max(0, Number(quantity) || 0);
    const base = {
      ingredientId,
      wastePercent: normalizeRecipeWastePercent(wastePercent),
      station: normalizeKitchenStation(station || "Main kitchen"),
      appliesTo: normalizeRecipeAppliesTo(appliesTo),
      notes: String(notes || "").trim()
    };
    if (measureKey === "grams") return { ...base, grams: amount };
    if (measureKey === "milliliters") return { ...base, milliliters: amount };
    return { ...base, units: amount };
  }

  function addSellableRecipeLine(ingredientId, quantity, measureKey, station, wastePercent, appliesTo, notes) {
    if (!can("canManageProducts")) {
      showToast("Only Owner/Admin can manage products.");
      return;
    }

    const ingredient = ingredientById(ingredientId);
    const amount = Math.max(0, Number(quantity) || 0);
    if (!ingredient || !ingredient.active || amount <= 0) {
      showToast("Choose an active purchased product and a usage amount.");
      return;
    }

    const line = buildRecipeLine(ingredient.id, amount, measureKey, station, wastePercent, appliesTo, notes);
    const normalizedLine = normalizeRecipeLine(line, new Set(state.ingredients.map((item) => item.id)));
    if (!normalizedLine) {
      showToast("Choose a valid recipe amount.");
      return;
    }

    const measure = getRecipeMeasure(normalizedLine);
    const existing = state.productRecipeDraft.find((draftLine) => {
      return draftLine.ingredientId === normalizedLine.ingredientId
        && getRecipeMeasure(draftLine).key === measure.key
        && draftLine.appliesTo === normalizedLine.appliesTo
        && draftLine.station === normalizedLine.station
        && normalizeRecipeWastePercent(draftLine.wastePercent) === normalizeRecipeWastePercent(normalizedLine.wastePercent)
        && String(draftLine.notes || "") === String(normalizedLine.notes || "");
    });

    if (existing) {
      existing[measure.key] = Number((getRecipeLineQuantity(existing) + getRecipeLineQuantity(normalizedLine)).toFixed(3));
    } else {
      state.productRecipeDraft.push(normalizedLine);
    }

    saveState();
    render();
    showToast(`${ingredient.name} linked to the recipe.`);
  }

  function removeSellableRecipeLine(index) {
    if (!can("canManageProducts")) return;
    state.productRecipeDraft.splice(Number(index), 1);
    saveState();
    render();
  }

  function createSellableProduct(formData) {
    if (!can("canManageProducts")) {
      showToast("Only Owner/Admin can create products.");
      return;
    }

    const name = String(formData.get("name") || "").trim();
    const code = String(formData.get("code") || "").trim();
    const category = String(formData.get("category") || "Other");
    const station = normalizeKitchenStation(formData.get("station") || "Main kitchen");
    const price = Math.max(0, Number(formData.get("price")) || 0);
    const vatSetting = String(formData.get("vatSetting") || "standard");
    const active = formData.get("active") === "true";
    const targetMargin = normalizeMarginPercent(formData.get("targetMargin"), DEFAULT_MARGIN_TARGET);
    const minMargin = Math.min(targetMargin, normalizeMarginPercent(formData.get("minMargin"), DEFAULT_MARGIN_MINIMUM));
    const selectedAvailability = new Set(formData.getAll("availability"));
    const recipe = normalizeRecipeLines(state.productRecipeDraft, new Set(state.ingredients.map((ingredient) => ingredient.id)));

    if (!name || !code || !station || price <= 0) {
      showToast("Add product name, SKU, station, and selling price.");
      return;
    }

    if (state.products.some((product) => product.code.toLowerCase() === code.toLowerCase())) {
      showToast("A sellable product with that SKU already exists.");
      return;
    }

    if (!selectedAvailability.size) {
      showToast("Select at least one ordering channel.");
      return;
    }

    if (!recipe.length) {
      showToast("Link at least one purchased product to the recipe.");
      return;
    }

    const availability = AVAILABILITY_OPTIONS.reduce((nextAvailability, option) => {
      nextAvailability[option.id] = selectedAvailability.has(option.id);
      return nextAvailability;
    }, {});

    state.products.push({
      id: uniqueRecordId(name, [state.products, state.ingredients]),
      name,
      code,
      category: PRODUCT_CATEGORIES.includes(category) ? category : "Other",
      station,
      price,
      vatSetting: VAT_OPTIONS.some((option) => option.id === vatSetting) ? vatSetting : "standard",
      active,
      availability,
      targetMargin,
      minMargin,
      recipe
    });
    state.productRecipeDraft = [];
    saveState();
    render();
    showToast(`${name} added to sellable products.`);
  }

  function createPurchasedProduct(formData) {
    if (!can("canManageProducts")) {
      showToast("Only Owner/Admin can create purchased products.");
      return;
    }

    const name = String(formData.get("name") || "").trim();
    const supplier = String(formData.get("supplier") || "").trim();
    const purchasePrice = Math.max(0, Number(formData.get("purchasePrice")) || 0);
    const unitType = unitTypeDefinition(formData.get("unitType"));
    const stock = Math.max(0, Number(formData.get("stock")) || 0);
    const min = Math.max(0, Number(formData.get("min")) || 0);
    const requestedMax = Math.max(0, Number(formData.get("max")) || 0);
    const max = requestedMax;
    const location = getSelectedInventoryLocation(formData, "location", "customLocation");
    const expiryDate = String(formData.get("expiryDate") || "").trim();
    const barcode = String(formData.get("barcode") || "").trim();
    const active = formData.get("active") === "true";

    if (!name || !supplier || !location || purchasePrice <= 0 || requestedMax <= 0) {
      showToast("Add ingredient name, supplier, purchase price, stock limits, and storage location.");
      return;
    }

    if (min > requestedMax) {
      showToast("Minimum stock cannot be higher than maximum stock.");
      return;
    }

    state.ingredients.push({
      id: uniqueRecordId(name, [state.ingredients, state.products]),
      name,
      supplier,
      purchasePrice,
      unitType: unitType.id,
      unit: unitType.shortLabel,
      stock,
      min,
      max,
      location,
      locationStock: { [rememberInventoryLocation(location)]: stock },
      expiryDate,
      barcode,
      active
    });
    pushInventoryHistory({
      ingredient: state.ingredients[state.ingredients.length - 1],
      type: "add",
      quantity: stock,
      toLocation: location,
      detail: `Opening stock entered for ${name}.`
    });

    saveState();
    render();
    showToast(`${name} added to purchased products.`);
  }

  function toggleSellableProduct(productId) {
    if (!can("canManageProducts")) {
      showToast("Only Owner/Admin can manage products.");
      return;
    }

    const product = productById(productId);
    if (!product) return;
    product.active = !product.active;
    if (!product.active) state.orderDraft = state.orderDraft.filter((item) => item.productId !== product.id);
    saveState();
    render();
    showToast(`${product.name} marked ${product.active ? "active" : "inactive"}.`);
  }

  function togglePurchasedProduct(ingredientId) {
    if (!can("canManageProducts")) {
      showToast("Only Owner/Admin can manage products.");
      return;
    }

    const ingredient = ingredientById(ingredientId);
    if (!ingredient) return;
    ingredient.active = !ingredient.active;
    if (!ingredient.active) state.productRecipeDraft = state.productRecipeDraft.filter((line) => line.ingredientId !== ingredient.id);
    saveState();
    render();
    showToast(`${ingredient.name} marked ${ingredient.active ? "active" : "inactive"}.`);
  }

  function updateIngredientPurchasePrice(ingredientId, value) {
    if (!can("canManageProducts")) {
      showToast("Only Owner/Admin can update purchase prices.");
      return;
    }

    const ingredient = ingredientById(ingredientId);
    const purchasePrice = Math.max(0, Number(value) || 0);
    if (!ingredient || purchasePrice <= 0) {
      showToast("Enter a purchase price above zero.");
      return;
    }

    ingredient.purchasePrice = Number(purchasePrice.toFixed(2));
    saveState();
    render();
    showToast(`${ingredient.name} price updated; product costs recalculated.`);
  }

  return {
    addSellableRecipeLine,
    createPurchasedProduct,
    createSellableProduct,
    removeSellableRecipeLine,
    togglePurchasedProduct,
    toggleSellableProduct,
    updateIngredientPurchasePrice
  };
}
