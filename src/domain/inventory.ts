function normalizeQuantity(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 1000) / 1000);
}

export function planStockDeduction(locationRows, quantity, preferredLocation = "") {
  const requested = normalizeQuantity(quantity);
  let remaining = requested;
  const preferred = String(preferredLocation || "").trim();
  const rows = (Array.isArray(locationRows) ? locationRows : [])
    .map((row) => ({
      location: String(row.location || "").trim(),
      quantity: normalizeQuantity(row.quantity)
    }))
    .filter((row) => row.location && row.quantity > 0);
  const orderedRows = [
    ...rows.filter((row) => row.location === preferred),
    ...rows.filter((row) => row.location !== preferred).sort((first, second) => second.quantity - first.quantity)
  ];
  const removals = [];

  orderedRows.forEach((row) => {
    if (remaining <= 0) return;
    const removedQuantity = Math.min(row.quantity, remaining);
    if (removedQuantity <= 0) return;
    remaining = normalizeQuantity(remaining - removedQuantity);
    removals.push({ location: row.location, quantity: removedQuantity });
  });

  return {
    requested,
    removed: normalizeQuantity(requested - remaining),
    remaining,
    removals
  };
}

export function getStockRequirementsForItems(items, deps, orderContext) {
  const requirements = new Map();
  deps.normalizeOrderItems(items).forEach((item) => {
    const product = deps.productById(item.productId);
    (product?.recipe || []).forEach((line) => {
      if (!deps.recipeLineAppliesToOrder(line, orderContext)) return;
      const ingredient = deps.ingredientById(line.ingredientId);
      if (!ingredient) return;
      const stockUnits = deps.convertRecipeLineToStockUnits(line) * item.quantity;
      requirements.set(ingredient.id, (requirements.get(ingredient.id) || 0) + stockUnits);
    });
  });
  return requirements;
}

export function getProductAvailability(product, reservedItems, deps, orderContext) {
  if (!product || !product.active) return { maxQuantity: 0, limiting: null, details: [] };

  const reservedStock = getStockRequirementsForItems(reservedItems, deps, orderContext);
  const details = (product.recipe || [])
    .filter((line) => deps.recipeLineAppliesToOrder(line, orderContext))
    .map((line) => {
      const ingredient = deps.ingredientById(line.ingredientId);
      if (!ingredient) return null;
      const perItem = deps.convertRecipeLineToStockUnits(line);
      const reserved = reservedStock.get(ingredient.id) || 0;
      const remaining = ingredient.active ? Math.max(0, ingredient.stock - reserved) : 0;
      const maxQuantity = ingredient.active && perItem > 0 ? Math.floor((remaining + Number.EPSILON) / perItem) : 0;
      return { ingredient, remaining, maxQuantity };
    })
    .filter(Boolean);

  const maxQuantity = details.length ? Math.min(...details.map((detail) => detail.maxQuantity)) : 0;
  const limiting = details.slice().sort((a, b) => a.maxQuantity - b.maxQuantity)[0] || null;
  return { maxQuantity: Math.max(0, maxQuantity), limiting, details };
}

export function getStockShortages(items, deps, orderContext) {
  return [...getStockRequirementsForItems(items, deps, orderContext).entries()]
    .map(([ingredientId, required]) => {
      const ingredient = deps.ingredientById(ingredientId);
      const shortage = ingredient?.active ? required - (ingredient.stock || 0) : required;
      return { ingredient, required, shortage };
    })
    .filter((item) => item.ingredient && item.shortage > 0.0001);
}
