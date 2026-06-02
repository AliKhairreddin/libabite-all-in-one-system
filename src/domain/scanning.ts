export const SCAN_TYPES = [
  { id: "product_barcode", label: "Product barcode" },
  { id: "ingredient_qr", label: "Ingredient QR code" },
  { id: "staff_qr", label: "Staff QR code" },
  { id: "storage_location_qr", label: "Storage location QR code" },
  { id: "equipment_qr", label: "Equipment QR code" },
  { id: "delivery_bag_qr", label: "Delivery bag QR code" },
  { id: "table_qr", label: "Table QR code" },
  { id: "recipe_qr", label: "Recipe QR code" }
];

const SCAN_QUERY_KEYS = ["scan", "code", "barcode", "qr", "ingredient", "product", "recipe", "table", "staff", "location"];

function compactScanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function textScanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function scanMatches(value, code) {
  if (!value || !code) return false;
  return textScanKey(value) === textScanKey(code) || compactScanKey(value) === compactScanKey(code);
}

function extractScanValueFromUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value || !/[?#/]/.test(value)) return "";

  try {
    const url = new URL(value, "https://scan.local");
    for (const key of SCAN_QUERY_KEYS) {
      const found = url.searchParams.get(key);
      if (found) return found.trim();
    }

    const hashParams = new URLSearchParams(url.hash.replace(/^#\??/, ""));
    for (const key of SCAN_QUERY_KEYS) {
      const found = hashParams.get(key);
      if (found) return found.trim();
    }

    const pathValue = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").trim();
    return pathValue && pathValue !== value ? pathValue : "";
  } catch {
    return "";
  }
}

export function normalizeScanCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return extractScanValueFromUrl(raw) || raw;
}

export function scanTypeLabel(type) {
  return SCAN_TYPES.find((item) => item.id === type)?.label || "Unknown scan";
}

function prefixedValue(code) {
  const match = String(code || "").trim().match(/^([a-z][a-z0-9_-]*)\s*[:=|]\s*(.+)$/i);
  if (!match) return null;
  return {
    prefix: match[1].toLowerCase().replace(/_/g, "-"),
    value: match[2].trim()
  };
}

function scanResult({ code, scanType, targetKind, targetId, label, message }) {
  return {
    ok: true,
    code,
    scanType,
    targetKind,
    targetId,
    label,
    message
  };
}

function matchIngredientByValue(ingredients, value) {
  return (ingredients || []).find((ingredient) => (
    scanMatches(ingredient.id, value)
    || scanMatches(ingredient.name, value)
    || scanMatches(ingredient.barcode, value)
  ));
}

function matchIngredientBarcode(ingredients, value) {
  return (ingredients || []).find((ingredient) => scanMatches(ingredient.barcode, value));
}

function matchProductByValue(products, value) {
  return (products || []).find((product) => (
    scanMatches(product.id, value)
    || scanMatches(product.name, value)
    || scanMatches(product.code, value)
  ));
}

function matchTableByValue(tables, tableQrCodes, value) {
  const qrCode = (tableQrCodes || []).find((code) => (
    scanMatches(code.token, value)
    || scanMatches(code.id, value)
    || scanMatches(code.tableId, value)
  ));
  if (qrCode) {
    const table = (tables || []).find((item) => item.id === qrCode.tableId);
    if (table) return table;
  }
  return (tables || []).find((table) => scanMatches(table.id, value) || scanMatches(table.name, value));
}

function matchUserByValue(users, value) {
  return (users || []).find((user) => (
    scanMatches(user.id, value)
    || scanMatches(user.email, value)
    || scanMatches(user.name, value)
  ));
}

function matchLocationByValue(locations, value) {
  return (locations || []).find((location) => scanMatches(location, value));
}

export function resolveScanCode(rawCode, context = {}) {
  const code = normalizeScanCode(rawCode);
  if (!code) {
    return {
      ok: false,
      code: "",
      scanType: "unknown",
      targetKind: "",
      targetId: "",
      label: "",
      message: "Scan a barcode or QR code."
    };
  }

  const {
    ingredients = [],
    products = [],
    tableQrCodes = [],
    tables = [],
    users = [],
    locations = []
  } = context as any;
  const prefixed = prefixedValue(code);

  if (prefixed) {
    const { prefix, value } = prefixed;
    if (["ingredient", "item", "stock", "purchased-product", "purchased"].includes(prefix)) {
      const ingredient = matchIngredientByValue(ingredients, value);
      if (ingredient) {
        return scanResult({
          code,
          scanType: "ingredient_qr",
          targetKind: "ingredient",
          targetId: ingredient.id,
          label: ingredient.name,
          message: `${ingredient.name} inventory opened.`
        });
      }
    }

    if (["product", "menu", "recipe"].includes(prefix)) {
      const product = matchProductByValue(products, value);
      if (product) {
        return scanResult({
          code,
          scanType: prefix === "recipe" ? "recipe_qr" : "product_barcode",
          targetKind: "product",
          targetId: product.id,
          label: product.name,
          message: `${product.name} recipe opened.`
        });
      }
      const ingredient = matchIngredientByValue(ingredients, value);
      if (ingredient) {
        return scanResult({
          code,
          scanType: "ingredient_qr",
          targetKind: "ingredient",
          targetId: ingredient.id,
          label: ingredient.name,
          message: `${ingredient.name} inventory opened.`
        });
      }
    }

    if (["table", "qr-table"].includes(prefix)) {
      const table = matchTableByValue(tables, tableQrCodes, value);
      if (table) {
        return scanResult({
          code,
          scanType: "table_qr",
          targetKind: "table",
          targetId: table.id,
          label: table.name,
          message: `${table.name} order opened.`
        });
      }
    }

    if (["staff", "badge", "user"].includes(prefix)) {
      const user = matchUserByValue(users, value);
      if (user) {
        return scanResult({
          code,
          scanType: "staff_qr",
          targetKind: "staff",
          targetId: user.id,
          label: user.name,
          message: `${user.name} badge recognized.`
        });
      }
    }

    if (["location", "storage", "shelf"].includes(prefix)) {
      const location = matchLocationByValue(locations, value);
      if (location) {
        return scanResult({
          code,
          scanType: "storage_location_qr",
          targetKind: "location",
          targetId: location,
          label: location,
          message: `${location} storage opened.`
        });
      }
    }

    if (["equipment", "machine"].includes(prefix)) {
      return scanResult({
        code,
        scanType: "equipment_qr",
        targetKind: "equipment",
        targetId: value,
        label: value,
        message: `${value} equipment recognized.`
      });
    }

    if (["bag", "delivery-bag", "delivery"].includes(prefix)) {
      return scanResult({
        code,
        scanType: "delivery_bag_qr",
        targetKind: "deliveryBag",
        targetId: value,
        label: value,
        message: `${value} delivery bag recognized.`
      });
    }
  }

  const ingredientByBarcode = matchIngredientBarcode(ingredients, code);
  if (ingredientByBarcode) {
    return scanResult({
      code,
      scanType: "product_barcode",
      targetKind: "ingredient",
      targetId: ingredientByBarcode.id,
      label: ingredientByBarcode.name,
      message: `${ingredientByBarcode.name} inventory opened.`
    });
  }

  const table = matchTableByValue(tables, tableQrCodes, code);
  if (table) {
    return scanResult({
      code,
      scanType: "table_qr",
      targetKind: "table",
      targetId: table.id,
      label: table.name,
      message: `${table.name} order opened.`
    });
  }

  const product = matchProductByValue(products, code);
  if (product) {
    return scanResult({
      code,
      scanType: "recipe_qr",
      targetKind: "product",
      targetId: product.id,
      label: product.name,
      message: `${product.name} recipe opened.`
    });
  }

  const ingredient = matchIngredientByValue(ingredients, code);
  if (ingredient) {
    return scanResult({
      code,
      scanType: "ingredient_qr",
      targetKind: "ingredient",
      targetId: ingredient.id,
      label: ingredient.name,
      message: `${ingredient.name} inventory opened.`
    });
  }

  const user = matchUserByValue(users, code);
  if (user) {
    return scanResult({
      code,
      scanType: "staff_qr",
      targetKind: "staff",
      targetId: user.id,
      label: user.name,
      message: `${user.name} badge recognized.`
    });
  }

  const location = matchLocationByValue(locations, code);
  if (location) {
    return scanResult({
      code,
      scanType: "storage_location_qr",
      targetKind: "location",
      targetId: location,
      label: location,
      message: `${location} storage opened.`
    });
  }

  return {
    ok: false,
    code,
    scanType: "unknown",
    targetKind: "",
    targetId: "",
    label: "",
    message: `No record matched ${code}.`
  };
}
