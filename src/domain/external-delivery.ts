import {
  EXTERNAL_DELIVERY_IMPORT_METHODS,
  EXTERNAL_DELIVERY_PLATFORM_STATUSES,
  EXTERNAL_DELIVERY_PLATFORMS
} from "../shared/constants.js";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function comparable(value) {
  return cleanText(value).toLowerCase();
}

function roundMoney(value) {
  return Math.max(0, Number((Number(value) || 0).toFixed(2)));
}

export function externalPlatformOption(value) {
  const key = comparable(value);
  return EXTERNAL_DELIVERY_PLATFORMS.find((platform) => platform.id === value || comparable(platform.name) === key)
    || EXTERNAL_DELIVERY_PLATFORMS[0];
}

export function normalizeExternalPlatformId(value) {
  return externalPlatformOption(value).id;
}

export function externalPlatformName(value) {
  return externalPlatformOption(value).name;
}

export function normalizeExternalPlatformStatus(value) {
  return EXTERNAL_DELIVERY_PLATFORM_STATUSES.includes(value) ? value : "Approval pending";
}

export function normalizeExternalImportMethod(value) {
  const candidate = String(value || "").trim();
  return EXTERNAL_DELIVERY_IMPORT_METHODS.some((method) => method.id === candidate) ? candidate : "manual";
}

export function externalImportMethodLabel(value) {
  const method = EXTERNAL_DELIVERY_IMPORT_METHODS.find((item) => item.id === normalizeExternalImportMethod(value));
  return method?.label || "Manual import";
}

export function normalizeExternalCommissionRate(value, fallback = 0) {
  const rate = Number(value);
  const normalizedFallback = Number(fallback);
  const candidate = Number.isFinite(rate) ? rate : (Number.isFinite(normalizedFallback) ? normalizedFallback : 0);
  return Math.min(100, Math.max(0, Number(candidate.toFixed(2))));
}

export function calculateExternalCommission(total, commissionRate = 0) {
  return roundMoney((Number(total) || 0) * (normalizeExternalCommissionRate(commissionRate) / 100));
}

export function findExternalProductMapping({ platformId, externalCode = "", externalName = "" }: any = {}, mappings = []) {
  const platform = normalizeExternalPlatformId(platformId);
  const code = comparable(externalCode);
  const name = comparable(externalName);
  const activeMappings = (Array.isArray(mappings) ? mappings : [])
    .filter((mapping) => normalizeExternalPlatformId(mapping.platformId) === platform && mapping.active !== false);

  if (code) {
    const byCode = activeMappings.find((mapping) => comparable(mapping.externalCode) === code);
    if (byCode) return byCode;
  }

  if (name) {
    const byName = activeMappings.find((mapping) => comparable(mapping.externalName) === name);
    if (byName) return byName;
  }

  if (code) {
    return activeMappings.find((mapping) => comparable(mapping.externalName) === code) || null;
  }

  return null;
}

function parseCsvRow(row) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const nextChar = row[index + 1];
    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cleanText(current));
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(cleanText(current));
  return cells;
}

function parseSingleLineOrder(line) {
  const leadingQuantity = line.match(/^(\d+)\s*[xX]\s+(.+)$/);
  if (leadingQuantity) {
    return {
      identifier: cleanText(leadingQuantity[2]),
      quantity: Math.max(1, Math.floor(Number(leadingQuantity[1]) || 1)),
      note: ""
    };
  }

  const trailingQuantity = line.match(/^(.+?)\s*[xX]\s*(\d+)$/);
  if (trailingQuantity) {
    return {
      identifier: cleanText(trailingQuantity[1]),
      quantity: Math.max(1, Math.floor(Number(trailingQuantity[2]) || 1)),
      note: ""
    };
  }

  return {
    identifier: cleanText(line),
    quantity: 1,
    note: ""
  };
}

export function parseExternalOrderLines(rawText) {
  return String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(code|sku|external|product)[,\s;]/i.test(line))
    .map((line) => {
      const row = parseCsvRow(line);
      const parsed = row.length > 1
        ? {
          identifier: cleanText(row[0]),
          quantity: Math.max(1, Math.floor(Number(row[1]) || 1)),
          note: cleanText(row.slice(2).join(", "))
        }
        : parseSingleLineOrder(line);
      return {
        externalCode: parsed.identifier,
        externalName: parsed.identifier,
        quantity: parsed.quantity,
        note: parsed.note
      };
    })
    .filter((line) => line.externalCode || line.externalName);
}

export function matchExternalOrderItems(rawItems = [], { platformId, mappings = [], productById }: any) {
  const matched = [];
  const unmatched = [];
  (Array.isArray(rawItems) ? rawItems : []).forEach((rawItem, index) => {
    const mapping = findExternalProductMapping({
      platformId,
      externalCode: rawItem.externalCode,
      externalName: rawItem.externalName
    }, mappings);
    const product = mapping ? productById(mapping.productId) : null;
    const quantity = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));

    if (!mapping || !product) {
      unmatched.push({
        index,
        externalCode: cleanText(rawItem.externalCode),
        externalName: cleanText(rawItem.externalName),
        quantity,
        reason: mapping ? "Internal product missing" : "No mapping"
      });
      return;
    }

    matched.push({
      productId: product.id,
      quantity,
      note: cleanText(rawItem.note),
      modifiers: [],
      externalCode: cleanText(rawItem.externalCode || mapping.externalCode),
      externalName: cleanText(rawItem.externalName || mapping.externalName),
      mappingId: mapping.id
    });
  });

  return { matched, unmatched };
}

export function buildExternalMenuPayload(platform, mappings = [], productById, options: any = {}) {
  const platformId = normalizeExternalPlatformId(platform?.id || platform?.platformId);
  const platformName = cleanText(platform?.name) || externalPlatformName(platformId);
  const items = (Array.isArray(mappings) ? mappings : [])
    .filter((mapping) => normalizeExternalPlatformId(mapping.platformId) === platformId && mapping.active !== false)
    .map((mapping) => {
      const product = productById(mapping.productId);
      if (!product || !product.active) return null;
      return {
        externalCode: cleanText(mapping.externalCode),
        externalName: cleanText(mapping.externalName || product.name),
        internalProductId: product.id,
        internalProductName: product.name,
        internalProductCode: product.code,
        internalRecipe: `${product.name} recipe`,
        kitchenStation: product.station,
        price: Number(product.price) || 0,
        commissionRate: normalizeExternalCommissionRate(mapping.commissionRate, platform?.commissionRate)
      };
    })
    .filter(Boolean);

  return {
    platformId,
    platformName,
    generatedAt: options.generatedAt || new Date().toISOString(),
    items
  };
}

export function mapInternalOrderStatusToExternalStatus(order) {
  if (!order || order.status === "Cancelled") return "cancelled";
  if (order.status === "Paid" || order.status === "Served") return "completed";
  if (order.status === "Ready") return "ready";
  if (["Preparing", "Delayed", "Sent to kitchen"].includes(order.status)) return "preparing";
  return "accepted";
}
