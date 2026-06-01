import { SUPPLIER_INTEGRATION_METHODS } from "../shared/constants.js";

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.max(0, Number(quantity.toFixed(3))) : 0;
}

function normalizeMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function supplierName(value) {
  return String(value?.name || value || "Default supplier").replace(/\s+/g, " ").trim() || "Default supplier";
}

export function getSupplierKey(value) {
  return supplierName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "supplier";
}

export function supplierIntegrationLabel(method) {
  return SUPPLIER_INTEGRATION_METHODS.find((item) => item.id === method)?.label || "Manual order";
}

export function getSupplierOrderQuantity(ingredient) {
  if (!ingredient || ingredient.active === false) return 0;
  const stock = normalizeQuantity(ingredient.stock);
  const minimum = normalizeQuantity(ingredient.min);
  const maximum = normalizeQuantity(ingredient.max);
  if (stock > minimum) return 0;
  const target = maximum > minimum ? maximum : minimum;
  return normalizeQuantity(target - stock);
}

export function getSupplierForIngredient(ingredient, suppliers = []) {
  if (!ingredient) return null;
  const ingredientId = String(ingredient.id || "");
  const linkedSupplier = suppliers.find((supplier) => {
    return Array.isArray(supplier.productsSupplied) && supplier.productsSupplied.includes(ingredientId);
  });
  if (linkedSupplier) return linkedSupplier;

  const ingredientSupplierName = supplierName(ingredient.supplier);
  return suppliers.find((supplier) => supplierName(supplier).toLowerCase() === ingredientSupplierName.toLowerCase())
    || {
      id: getSupplierKey(ingredientSupplierName),
      name: ingredientSupplierName,
      contactPerson: "",
      email: "",
      phone: "",
      apiDetails: "",
      deliveryDays: 0,
      minimumOrderAmount: 0,
      productsSupplied: [ingredientId],
      integrationMethod: "manual",
      autoSendAfterApproval: false
    };
}

export function getLowStockReorderSuggestions(ingredients = [], suppliers = []) {
  return ingredients
    .filter((ingredient) => ingredient?.active !== false && normalizeQuantity(ingredient.stock) <= normalizeQuantity(ingredient.min))
    .map((ingredient) => {
      const supplier = getSupplierForIngredient(ingredient, suppliers);
      const quantity = getSupplierOrderQuantity(ingredient);
      return {
        ingredientId: ingredient.id,
        supplierId: supplier?.id || getSupplierKey(ingredient.supplier),
        supplierName: supplierName(supplier || ingredient.supplier),
        currentStock: normalizeQuantity(ingredient.stock),
        minimumStock: normalizeQuantity(ingredient.min),
        maximumStock: normalizeQuantity(ingredient.max),
        suggestedQuantity: quantity,
        estimatedCost: normalizeMoney(quantity * (Number(ingredient.purchasePrice) || 0))
      };
    })
    .filter((suggestion) => suggestion.suggestedQuantity > 0);
}

export function groupReorderSuggestionsBySupplier(suggestions = []) {
  const groups = new Map();
  suggestions.forEach((suggestion) => {
    const key = suggestion.supplierId || getSupplierKey(suggestion.supplierName);
    if (!groups.has(key)) {
      groups.set(key, {
        supplierId: suggestion.supplierId || key,
        supplier: supplierName(suggestion.supplierName),
        suggestions: [],
        estimatedTotal: 0
      });
    }
    const group = groups.get(key);
    group.suggestions.push(suggestion);
    group.estimatedTotal = normalizeMoney(group.estimatedTotal + suggestion.estimatedCost);
  });
  return [...groups.values()].sort((first, second) => first.supplier.localeCompare(second.supplier));
}

function cleanOrderItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      ingredientId: String(item.ingredientId || ""),
      quantity: normalizeQuantity(item.quantity),
      suggestedQuantity: normalizeQuantity(item.suggestedQuantity ?? item.quantity),
      receivedQuantity: item.receivedQuantity === undefined || item.receivedQuantity === ""
        ? ""
        : normalizeQuantity(item.receivedQuantity)
    }))
    .filter((item) => item.ingredientId && item.quantity > 0);
}

function orderSupplierKey(order) {
  return order.supplierId || getSupplierKey(order.supplier);
}

export function buildSupplierOrderDrafts({ ingredients = [], suppliers = [], activeOrders = [], now = "" } = {}) {
  const active = (Array.isArray(activeOrders) ? activeOrders : [])
    .filter((order) => order && order.status !== "Received")
    .map((order) => ({
      ...order,
      supplierId: order.supplierId || getSupplierKey(order.supplier),
      supplier: supplierName(order.supplier),
      status: order.status || "Draft",
      items: cleanOrderItems(order.items)
    }))
    .filter((order) => order.supplier && order.items.length);

  const nonDraftOrders = active.filter((order) => order.status !== "Draft");
  const draftOrders = new Map(active.filter((order) => order.status === "Draft").map((order) => [orderSupplierKey(order), order]));
  const lockedIngredientIds = new Set(nonDraftOrders.flatMap((order) => order.items.map((item) => item.ingredientId)));

  getLowStockReorderSuggestions(ingredients, suppliers).forEach((suggestion) => {
    if (lockedIngredientIds.has(suggestion.ingredientId)) return;
    const supplier = suppliers.find((item) => item.id === suggestion.supplierId)
      || suppliers.find((item) => supplierName(item).toLowerCase() === suggestion.supplierName.toLowerCase());
    const supplierId = supplier?.id || suggestion.supplierId || getSupplierKey(suggestion.supplierName);
    const key = supplierId || getSupplierKey(suggestion.supplierName);
    const draft = draftOrders.get(key) || {
      id: `SUP-${key}`,
      supplierId,
      supplier: suggestion.supplierName,
      status: "Draft",
      createdAt: now,
      approvedAt: "",
      sentAt: "",
      orderedAt: "",
      receivedAt: "",
      integrationMethod: supplier?.integrationMethod || "manual",
      integrationReference: "",
      items: []
    };
    const nextItems = draft.items.filter((item) => item.ingredientId !== suggestion.ingredientId);
    nextItems.push({
      ingredientId: suggestion.ingredientId,
      quantity: suggestion.suggestedQuantity,
      suggestedQuantity: suggestion.suggestedQuantity,
      receivedQuantity: ""
    });
    draft.items = nextItems;
    draftOrders.set(key, draft);
  });

  return [...nonDraftOrders, ...draftOrders.values()]
    .filter((order) => order.items.length)
    .sort((first, second) => first.supplier.localeCompare(second.supplier) || first.status.localeCompare(second.status));
}

export function getSupplierOrderTotal(order, ingredientById) {
  return cleanOrderItems(order?.items).reduce((sum, item) => {
    const ingredient = ingredientById(item.ingredientId);
    return normalizeMoney(sum + (ingredient ? (Number(ingredient.purchasePrice) || 0) * item.quantity : 0));
  }, 0);
}

export function getSupplierMinimumOrderGap(order, supplier, ingredientById) {
  const minimum = normalizeMoney(supplier?.minimumOrderAmount);
  if (minimum <= 0) return 0;
  return normalizeMoney(Math.max(0, minimum - getSupplierOrderTotal(order, ingredientById)));
}

function getOrderLineRows(order, ingredientById) {
  return cleanOrderItems(order?.items).map((item) => {
    const ingredient = ingredientById(item.ingredientId);
    const unitPrice = normalizeMoney(ingredient?.purchasePrice);
    const lineTotal = normalizeMoney(item.quantity * unitPrice);
    return {
      item,
      ingredient,
      name: ingredient?.name || "Purchased product",
      unit: ingredient?.unit || "",
      unitPrice,
      lineTotal
    };
  });
}

export function buildSupplierOrderPayload(order, supplier, ingredientById, options: any = {}) {
  const method = order?.integrationMethod || supplier?.integrationMethod || "manual";
  const label = supplierIntegrationLabel(method);
  const restaurantName = options.restaurantName || "Libabite";
  const rows = getOrderLineRows(order, ingredientById);
  const total = getSupplierOrderTotal(order, ingredientById);
  const subject = `${restaurantName} purchase order ${order?.id || ""}`.trim();
  const target = method === "email"
    ? supplier?.email || ""
    : method === "whatsapp"
      ? supplier?.phone || ""
      : supplier?.apiDetails || "";

  if (method === "csv") {
    return {
      method,
      label,
      subject,
      target,
      body: [
        "purchase_order_id,supplier,product,quantity,unit,unit_price,line_total",
        ...rows.map((row) => [
          order?.id || "",
          supplierName(supplier || order?.supplier),
          row.name,
          row.item.quantity,
          row.unit,
          row.unitPrice.toFixed(2),
          row.lineTotal.toFixed(2)
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      ].join("\n")
    };
  }

  if (method === "api") {
    return {
      method,
      label,
      subject,
      target,
      body: JSON.stringify({
        purchaseOrderId: order?.id || "",
        supplierId: supplier?.id || order?.supplierId || "",
        supplierName: supplierName(supplier || order?.supplier),
        requestedBy: restaurantName,
        total,
        lines: rows.map((row) => ({
          productId: row.item.ingredientId,
          productName: row.name,
          quantity: row.item.quantity,
          unit: row.unit,
          unitPrice: row.unitPrice,
          lineTotal: row.lineTotal
        }))
      }, null, 2)
    };
  }

  const lineText = rows.map((row) => {
    return `- ${row.name}: ${row.item.quantity} ${row.unit} at EUR ${row.unitPrice.toFixed(2)} = EUR ${row.lineTotal.toFixed(2)}`;
  }).join("\n");
  const contactLine = method === "email" && supplier?.email
    ? `To: ${supplier.email}\n`
    : method === "whatsapp" && supplier?.phone
      ? `Message to: ${supplier.phone}\n`
      : "";
  const deliveryLine = Number(supplier?.deliveryDays) > 0
    ? `Expected delivery window: ${supplier.deliveryDays} days\n`
    : "";

  return {
    method,
    label,
    subject,
    target,
    body: `${contactLine}${subject}\nSupplier: ${supplierName(supplier || order?.supplier)}\n${deliveryLine}\nItems\n${lineText || "- No lines"}\n\nEstimated total: EUR ${total.toFixed(2)}`
  };
}
