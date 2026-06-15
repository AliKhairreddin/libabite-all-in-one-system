import { AVAILABILITY_OPTIONS, DEFAULT_INVENTORY_LOCATIONS, DEFAULT_MARGIN_MINIMUM, DEFAULT_MARGIN_TARGET, DEFAULT_PAID_PAYMENT_METHOD, DEFAULT_PRODUCT_AVAILABILITY, DEFAULT_RESTAURANT_SETTINGS, EXTERNAL_DELIVERY_ORDER_CHANNEL, EXTERNAL_DELIVERY_PLATFORMS, INVENTORY_ACTIONS, KITCHEN_STATION_ALIASES, LANGUAGE_OPTIONS, ORDER_STATUSES, PHASE_11_SEED_INGREDIENT_IDS, PHASE_11_SEED_PRODUCT_IDS, PHASE_18_SEED_PRODUCT_IDS, PROCEDURE_ASSIGNED_ROLES, PROCEDURE_COMPLETION_STATUSES, PROCEDURE_FREQUENCIES, PRODUCT_CATEGORIES, QR_CODE_STATUSES, RECIPE_APPLIES_OPTIONS, RESERVATION_SOURCES, ROLE_DEFINITIONS, SUPPLIER_INTEGRATION_METHODS, SUPPLIER_ORDER_STATUSES, TICKET_STATUSES, UNIT_TYPES, WASTE_REASONS } from "../shared/constants.js";
import { normalizeOptionalTimestamp, normalizeTimestamp, timeNow } from "../shared/dates.js";
import { normalizePrecautionaryAllergenStatus, normalizeProductAllergens, normalizeVatSetting } from "../domain/commerce.js";
import { normalizeDeliveryLocationHistory, normalizeDeliveryLocationSample, normalizeDeliveryRoute, normalizeDriverDeliveryStatus, normalizeDriverStatus, normalizePickupStatus, reconcileDeliveryAssignments } from "../domain/delivery.js";
import { externalPlatformName, normalizeExternalCommissionRate, normalizeExternalImportMethod, normalizeExternalPlatformId, normalizeExternalPlatformStatus } from "../domain/external-delivery.js";
import { normalizeFulfillmentStatus, normalizeOrderFulfillment, normalizeOrderOperationalStatus, normalizeOrderType, normalizeWebsiteFulfillment, orderTypeDefinition } from "../domain/orders.js";
import { buildPaymentLedgerRecord, getPaymentStatusForMethod, isPaidPaymentMethod, normalizePaymentMethod, normalizePaymentStatus as normalizeLedgerPaymentStatus, upsertPaymentLedgerRecord } from "../domain/payments.js";
import { getAvailableReservationTable, getReservationConflicts, isReservationDate, isReservationTime, normalizeReservationStatus } from "../domain/reservations.js";
import { getWeekStartDate, normalizeScheduleRole, normalizeScheduleStation, normalizeShiftDate, normalizeShiftTime, sortShiftsByDateTime, toDateInputString } from "../domain/scheduling.js";
import { getFreshSeedState, seedState } from "./seed.js";
import { slugify } from "../shared/ids.js";
import { getSupplierKey } from "../domain/suppliers.js";
export function normalizeKitchenStation(value) {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    const mapped = KITCHEN_STATION_ALIASES[cleaned.toLowerCase()];
    return mapped || cleaned || "Main kitchen";
}
export function unitTypeDefinition(unitType) {
    const legacyMap = {
        g: "grams",
        gram: "grams",
        grams: "grams",
        kg: "kilograms",
        kilogram: "kilograms",
        kilograms: "kilograms",
        ml: "milliliters",
        milliliter: "milliliters",
        milliliters: "milliliters",
        l: "liters",
        liter: "liters",
        liters: "liters",
        pcs: "pieces",
        piece: "pieces",
        pieces: "pieces",
        box: "boxes",
        boxes: "boxes",
        package: "packages",
        packages: "packages"
    };
    const id = legacyMap[String(unitType || "").toLowerCase()] || "pieces";
    return UNIT_TYPES.find((type) => type.id === id) || UNIT_TYPES.find((type) => type.id === "pieces");
}
export function normalizeProductAvailability(availability) {
    const source = availability && typeof availability === "object" ? availability : {};
    return AVAILABILITY_OPTIONS.reduce((nextAvailability, option) => {
        nextAvailability[option.id] = source[option.id] === undefined
            ? DEFAULT_PRODUCT_AVAILABILITY[option.id]
            : Boolean(source[option.id]);
        return nextAvailability;
    }, {});
}
export function normalizeMarginPercent(value, fallback = 0) {
    const percent = Number(value);
    return Number.isFinite(percent) ? Math.min(100, Math.max(0, Number(percent.toFixed(1)))) : fallback;
}
export function normalizeRecipeWastePercent(value) {
    return normalizeMarginPercent(value, 0);
}
export function normalizeRecipeAppliesTo(value) {
    return RECIPE_APPLIES_OPTIONS.some((option) => option.id === value) ? value : "all";
}
export function normalizeRecipeLine(line, ingredientIds) {
    if (!line || !ingredientIds.has(line.ingredientId))
        return null;
    const base = {
        ingredientId: line.ingredientId,
        wastePercent: normalizeRecipeWastePercent(line.wastePercent),
        station: normalizeKitchenStation(line.station || line.preparationStation),
        notes: String(line.notes || "").trim(),
        appliesTo: normalizeRecipeAppliesTo(line.appliesTo || (line.onlyForTakeawayDelivery ? "takeawayDelivery" : "all"))
    };
    const grams = Number(line.grams);
    const milliliters = Number(line.milliliters);
    const units = Number(line.units);
    if (Number.isFinite(grams) && grams > 0)
        return { ...base, grams };
    if (Number.isFinite(milliliters) && milliliters > 0)
        return { ...base, milliliters };
    if (Number.isFinite(units) && units > 0)
        return { ...base, units };
    return null;
}
export function normalizeRecipeLines(recipe, ingredientIds) {
    return Array.isArray(recipe)
        ? recipe.map((line) => normalizeRecipeLine(line, ingredientIds)).filter(Boolean)
        : [];
}
export function normalizeBatchOutput(output, ingredientIds) {
    if (!output || typeof output !== "object")
        return null;
    const ingredientId = String(output.ingredientId || output.productId || "").trim();
    if (!ingredientIds.has(ingredientId))
        return null;
    const quantity = normalizeStockQuantity(output.quantity ?? output.outputQuantity);
    if (quantity <= 0)
        return null;
    return {
        ingredientId,
        quantity,
        unitType: unitTypeDefinition(output.unitType || output.unit || "kilograms").id,
        location: normalizeInventoryLocationName(output.location || output.toLocation, "Fridge")
    };
}
export function normalizeStockQuantity(value) {
    const quantity = Number(value);
    return Number.isFinite(quantity) ? Math.max(0, Number(quantity.toFixed(3))) : 0;
}
export function normalizeInventoryLocationName(value, fallback = "Dry storage") {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    return cleaned || fallback;
}
export function isDefaultInventoryLocation(location) {
    return DEFAULT_INVENTORY_LOCATIONS.includes(location);
}
export function sortInventoryLocations(locations) {
    const defaultOrder = new Map(DEFAULT_INVENTORY_LOCATIONS.map((location, index) => [location, index]));
    return [...new Set(locations.map((location) => normalizeInventoryLocationName(location, "")).filter(Boolean))]
        .sort((first, second) => {
        const firstIndex = defaultOrder.has(first) ? defaultOrder.get(first) : Number.MAX_SAFE_INTEGER;
        const secondIndex = defaultOrder.has(second) ? defaultOrder.get(second) : Number.MAX_SAFE_INTEGER;
        return (firstIndex ?? Number.MAX_SAFE_INTEGER) - (secondIndex ?? Number.MAX_SAFE_INTEGER) || first.localeCompare(second);
    });
}
export function normalizeLocationStock(locationStock, fallbackLocation, fallbackStock) {
    const rows = [];
    if (Array.isArray(locationStock)) {
        locationStock.forEach((row) => {
            rows.push([row.location || row.name, row.quantity ?? row.stock]);
        });
    }
    else if (locationStock && typeof locationStock === "object") {
        Object.entries(locationStock).forEach(([location, quantity]) => rows.push([location, quantity]));
    }
    const nextLocationStock = {};
    rows.forEach(([location, quantity]) => {
        const normalizedLocation = normalizeInventoryLocationName(location, "");
        const normalizedQuantity = normalizeStockQuantity(quantity);
        if (!normalizedLocation || normalizedQuantity <= 0)
            return;
        nextLocationStock[normalizedLocation] = normalizeStockQuantity((nextLocationStock[normalizedLocation] || 0) + normalizedQuantity);
    });
    if (!Object.keys(nextLocationStock).length && normalizeStockQuantity(fallbackStock) > 0) {
        nextLocationStock[normalizeInventoryLocationName(fallbackLocation)] = normalizeStockQuantity(fallbackStock);
    }
    return Object.fromEntries(sortInventoryLocations(Object.keys(nextLocationStock)).map((location) => [location, nextLocationStock[location]]));
}
export function getIngredientTotalStock(ingredient) {
    return normalizeStockQuantity(Object.values(ingredient?.locationStock || {}).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0));
}
export function getIngredientPrimaryLocation(ingredient) {
    const entries = Object.entries(ingredient?.locationStock || {}).filter(([, quantity]) => Number(quantity) > 0);
    if (!entries.length)
        return normalizeInventoryLocationName(ingredient?.location, "Dry storage");
    return entries.sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))[0][0];
}
export function syncIngredientStock(ingredient) {
    const hasLocationStock = ingredient.locationStock && typeof ingredient.locationStock === "object";
    ingredient.locationStock = normalizeLocationStock(ingredient.locationStock, ingredient.location, hasLocationStock ? 0 : ingredient.stock);
    ingredient.stock = getIngredientTotalStock(ingredient);
    ingredient.location = getIngredientPrimaryLocation(ingredient);
    return ingredient.stock;
}
export function normalizeCustomInventoryLocations(locations, ingredients = []) {
    const customLocations = Array.isArray(locations) ? locations : [];
    ingredients.forEach((ingredient) => {
        Object.keys(ingredient.locationStock || {}).forEach((location) => customLocations.push(location));
    });
    return sortInventoryLocations(customLocations).filter((location) => !isDefaultInventoryLocation(location));
}
export function normalizeInventoryHistory(history, ingredientIds) {
    return (Array.isArray(history) ? history : [])
        .map((entry, index) => {
        const ingredientId = String(entry.ingredientId || "").trim();
        if (!ingredientIds.has(ingredientId))
            return null;
        const action = INVENTORY_ACTIONS.some((item) => item.id === entry.type) ? entry.type : "correct";
        return {
            id: entry.id || `INV-${Date.now()}-${index + 1}`,
            ingredientId,
            ingredientName: String(entry.ingredientName || "").trim(),
            type: action,
            quantity: normalizeStockQuantity(entry.quantity),
            fromLocation: normalizeInventoryLocationName(entry.fromLocation, ""),
            toLocation: normalizeInventoryLocationName(entry.toLocation, ""),
            resultingStock: normalizeStockQuantity(entry.resultingStock),
            time: entry.time || timeNow(),
            detail: String(entry.detail || "").trim()
        };
    })
        .filter(Boolean)
        .slice(-80);
}
export function normalizeWasteReason(reason) {
    const candidate = String(reason || "").trim();
    return WASTE_REASONS.some((item) => item.id === candidate) ? candidate : "Other";
}
export function getWasteUnitOptionsForIngredient(ingredient) {
    const unitType = unitTypeDefinition(ingredient?.unitType || ingredient?.unit);
    if (unitType.recipeMeasure === "grams") {
        return UNIT_TYPES.filter((option) => option.id === "grams" || option.id === "kilograms");
    }
    if (unitType.recipeMeasure === "milliliters") {
        return UNIT_TYPES.filter((option) => option.id === "milliliters" || option.id === "liters");
    }
    return UNIT_TYPES.filter((option) => option.id === unitType.id);
}
export function normalizeWasteUnitType(unitType, ingredient) {
    const candidate = unitTypeDefinition(unitType).id;
    const allowedUnits = getWasteUnitOptionsForIngredient(ingredient).map((option) => option.id);
    return allowedUnits.includes(candidate) ? candidate : unitTypeDefinition(ingredient?.unitType || ingredient?.unit).id;
}
export function convertWasteQuantityToStockUnits(ingredient, quantity, unitTypeId) {
    const amount = normalizeStockQuantity(quantity);
    const stockUnitType = unitTypeDefinition(ingredient?.unitType || ingredient?.unit);
    const wasteUnitType = unitTypeDefinition(unitTypeId);
    const stockMeasure = stockUnitType.recipeMeasure;
    const wasteMeasure = wasteUnitType.recipeMeasure;
    if (stockMeasure === "grams" && wasteMeasure === "grams") {
        const grams = wasteUnitType.id === "kilograms" ? amount * 1000 : amount;
        return normalizeStockQuantity(stockUnitType.id === "kilograms" ? grams / 1000 : grams);
    }
    if (stockMeasure === "milliliters" && wasteMeasure === "milliliters") {
        const milliliters = wasteUnitType.id === "liters" ? amount * 1000 : amount;
        return normalizeStockQuantity(stockUnitType.id === "liters" ? milliliters / 1000 : milliliters);
    }
    return amount;
}
export function getWasteCost(ingredient, stockQuantity) {
    return Math.max(0, Number(((Number(stockQuantity) || 0) * (Number(ingredient?.purchasePrice) || 0)).toFixed(2)));
}
export function normalizeWasteTimestamp(record) {
    const timestamp = normalizeOptionalTimestamp(record?.occurredAtMs)
        || normalizeOptionalTimestamp(record?.dateTimeMs)
        || Date.parse(record?.occurredAt || record?.dateTime || "");
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : normalizeTimestamp(record?.timeMs, record?.time);
}
export function normalizeWasteRecords(records, ingredients, users) {
    const ingredientByIdLookup = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const userByIdLookup = new Map(users.map((user) => [user.id, user]));
    return (Array.isArray(records) ? records : [])
        .map((record, index) => {
        const ingredientId = String(record.ingredientId || record.productId || "").trim();
        const ingredient = ingredientByIdLookup.get(ingredientId);
        if (!ingredient)
            return null;
        const quantity = normalizeStockQuantity(record.quantity ?? record.displayQuantity ?? record.stockQuantity);
        const unitType = normalizeWasteUnitType(record.unitType || record.unit, ingredient);
        const stockQuantity = normalizeStockQuantity(record.stockQuantity ?? convertWasteQuantityToStockUnits(ingredient, quantity, unitType));
        if (stockQuantity <= 0)
            return null;
        const staffId = String(record.staffId || record.userId || "").trim();
        const staff = userByIdLookup.get(staffId);
        const occurredAtMs = normalizeWasteTimestamp(record);
        const cost = Number(record.cost);
        return {
            id: record.id || `WST-${Date.now()}-${index + 1}`,
            ingredientId,
            ingredientName: String(record.ingredientName || record.productName || ingredient.name).trim(),
            quantity,
            unitType,
            stockQuantity,
            stockUnit: ingredient.unit,
            reason: normalizeWasteReason(record.reason),
            staffId: staff?.id || "",
            staffName: String(record.staffName || record.staffMember || staff?.name || "Staff").trim(),
            occurredAtMs,
            notes: String(record.notes || "").trim(),
            fromLocation: normalizeInventoryLocationName(record.fromLocation || record.location, ""),
            cost: Number.isFinite(cost) ? Math.max(0, Number(cost.toFixed(2))) : getWasteCost(ingredient, stockQuantity)
        };
    })
        .filter(Boolean)
        .slice(-120);
}
export function normalizeIngredients(ingredients) {
    const seenIds = new Set();
    return ingredients
        .map((ingredient, index) => {
        const name = String(ingredient.name || ingredient.ingredientName || "").trim();
        if (!name)
            return null;
        const id = slugify(ingredient.id || name, `ingredient-${index + 1}`);
        if (seenIds.has(id))
            return null;
        seenIds.add(id);
        const unitType = unitTypeDefinition(ingredient.unitType || ingredient.unit);
        const stock = normalizeStockQuantity(ingredient.stock ?? ingredient.currentStock);
        const min = Math.max(0, Number(ingredient.min ?? ingredient.minimumStock) || 0);
        const max = Math.max(min, Number(ingredient.max ?? ingredient.maximumStock) || Math.max(min, stock));
        const locationStock = normalizeLocationStock(ingredient.locationStock || ingredient.locations, ingredient.location || ingredient.storageLocation, stock);
        const normalizedIngredient = {
            id,
            name,
            supplier: String(ingredient.supplier || "Default supplier").trim(),
            purchasePrice: Math.max(0, Number(ingredient.purchasePrice) || 0),
            unitType: unitType.id,
            unit: unitType.shortLabel,
            stock,
            min,
            max,
            location: normalizeInventoryLocationName(ingredient.location || ingredient.storageLocation, "Dry storage"),
            locationStock,
            expiryDate: String(ingredient.expiryDate || "").trim(),
            barcode: String(ingredient.barcode || ingredient.qrCode || "").trim(),
            active: ingredient.active === undefined ? ingredient.status !== "Inactive" : Boolean(ingredient.active)
        };
        syncIngredientStock(normalizedIngredient);
        return normalizedIngredient;
    })
        .filter(Boolean);
}
export function normalizeActiveScan(scan) {
    if (!scan || typeof scan !== "object")
        return null;
    return {
        code: String(scan.code || "").trim(),
        scanType: String(scan.scanType || "unknown").trim() || "unknown",
        targetKind: String(scan.targetKind || "").trim(),
        targetId: String(scan.targetId || "").trim(),
        label: String(scan.label || "").trim(),
        message: String(scan.message || "").trim(),
        status: scan.status === "error" ? "error" : "ok",
        scannedAt: String(scan.scannedAt || "").trim()
    };
}
export function normalizeSupplierIntegrationMethod(method) {
    const candidate = String(method || "").trim();
    return SUPPLIER_INTEGRATION_METHODS.some((item) => item.id === candidate) ? candidate : "manual";
}
export function normalizeSupplierOrderStatus(status) {
    const candidate = String(status || "").trim();
    return SUPPLIER_ORDER_STATUSES.includes(candidate) ? candidate : "Draft";
}
export function normalizeSuppliers(suppliers, ingredients = []) {
    const ingredientIds = new Set(ingredients.map((ingredient) => ingredient.id));
    const byId = new Map();
    const byName = new Map();
    function upsertSupplier(source, index = 0) {
        const name = String(source?.name || source?.supplierName || source || "").replace(/\s+/g, " ").trim();
        if (!name)
            return null;
        const id = slugify(source?.id || name, `supplier-${index + 1}`);
        const existing = byId.get(id) || byName.get(name.toLowerCase());
        const productIds = new Set([
            ...(existing?.productsSupplied || []),
            ...(Array.isArray(source?.productsSupplied) ? source.productsSupplied : []),
            ...(Array.isArray(source?.productIds) ? source.productIds : [])
        ].map((value) => String(value || "").trim()).filter((value) => ingredientIds.has(value)));
        const nextSupplier = {
            id: existing?.id || id,
            name,
            contactPerson: String(source?.contactPerson || source?.contact || existing?.contactPerson || "").replace(/\s+/g, " ").trim(),
            email: String(source?.email || existing?.email || "").trim(),
            phone: String(source?.phone || existing?.phone || "").trim(),
            apiDetails: String(source?.apiDetails || source?.api || existing?.apiDetails || "").trim(),
            deliveryDays: Math.max(0, Math.floor(Number(source?.deliveryDays ?? existing?.deliveryDays) || 0)),
            minimumOrderAmount: Math.max(0, Number(source?.minimumOrderAmount ?? source?.minOrderAmount ?? existing?.minimumOrderAmount) || 0),
            productsSupplied: [...productIds],
            integrationMethod: normalizeSupplierIntegrationMethod(source?.integrationMethod || source?.method || existing?.integrationMethod),
            autoSendAfterApproval: Boolean(source?.autoSendAfterApproval ?? existing?.autoSendAfterApproval)
        };
        byId.set(nextSupplier.id, nextSupplier);
        byName.set(nextSupplier.name.toLowerCase(), nextSupplier);
        return nextSupplier;
    }
    (Array.isArray(suppliers) ? suppliers : []).forEach(upsertSupplier);
    ingredients.forEach((ingredient, index) => {
        const supplierName = String(ingredient.supplier || "Default supplier").replace(/\s+/g, " ").trim() || "Default supplier";
        const supplier = upsertSupplier({ id: getSupplierKey(supplierName), name: supplierName }, index);
        if (supplier && !supplier.productsSupplied.includes(ingredient.id))
            supplier.productsSupplied.push(ingredient.id);
    });
    return [...byId.values()]
        .map((supplier) => ({
        ...supplier,
        productsSupplied: [...new Set(supplier.productsSupplied)].filter((id) => ingredientIds.has(id))
    }))
        .sort((first, second) => first.name.localeCompare(second.name));
}
export function normalizeSupplierOrders(orders, ingredientIds, suppliers = []) {
    const supplierIds = new Set(suppliers.map((supplier) => supplier.id));
    const supplierByName = new Map(suppliers.map((supplier) => [supplier.name.toLowerCase(), supplier]));
    return (Array.isArray(orders) ? orders : [])
        .map((order, index) => {
        const supplierName = String(order.supplier || order.supplierName || "").replace(/\s+/g, " ").trim();
        const supplier = suppliers.find((item) => item.id === order.supplierId)
            || supplierByName.get(supplierName.toLowerCase())
            || null;
        const resolvedSupplier = supplier || (supplierName ? { id: getSupplierKey(supplierName), name: supplierName } : null);
        if (!resolvedSupplier)
            return null;
        const status = normalizeSupplierOrderStatus(order.status);
        return {
            id: order.id || `SUP-${Date.now()}-${index + 1}`,
            supplierId: supplierIds.has(resolvedSupplier.id) ? resolvedSupplier.id : getSupplierKey(resolvedSupplier.name),
            supplier: resolvedSupplier.name,
            status,
            createdAt: order.createdAt || timeNow(),
            approvedAt: status === "Draft" ? "" : order.approvedAt || order.orderedAt || "",
            sentAt: (status === "Sent" || status === "Ordered" || status === "Received") ? order.sentAt || order.orderedAt || "" : "",
            orderedAt: order.orderedAt || order.sentAt || "",
            receivedAt: status === "Received" ? order.receivedAt || timeNow() : "",
            integrationMethod: normalizeSupplierIntegrationMethod(order.integrationMethod || supplier?.integrationMethod),
            integrationReference: String(order.integrationReference || "").trim(),
            items: Array.isArray(order.items)
                ? order.items
                    .map((item) => {
                    const ingredientId = String(item.ingredientId || "").trim();
                    const quantity = normalizeStockQuantity(item.quantity);
                    const receivedQuantity = item.receivedQuantity === undefined || item.receivedQuantity === ""
                        ? ""
                        : normalizeStockQuantity(item.receivedQuantity);
                    return {
                        ingredientId,
                        quantity,
                        suggestedQuantity: normalizeStockQuantity(item.suggestedQuantity ?? item.quantity),
                        receivedQuantity
                    };
                })
                    .filter((item) => ingredientIds.has(item.ingredientId) && item.quantity > 0)
                : []
        };
    })
        .filter((order) => order.supplier && order.items.length)
        .slice(-80);
}
function normalizeExternalText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}
export function normalizeExternalPlatforms(platforms) {
    const byId = new Map();
    function upsertPlatform(source = {}) {
        const platformId = normalizeExternalPlatformId(source.id || source.platformId || source.name);
        const defaultOption = EXTERNAL_DELIVERY_PLATFORMS.find((platform) => platform.id === platformId);
        const existing = byId.get(platformId) || {};
        byId.set(platformId, {
            id: platformId,
            name: defaultOption?.name || normalizeExternalText(source.name) || externalPlatformName(platformId),
            status: normalizeExternalPlatformStatus(source.status),
            integrationMethod: normalizeExternalImportMethod(source.integrationMethod || source.method),
            commissionRate: normalizeExternalCommissionRate(source.commissionRate ?? source.commission),
            apiDetails: normalizeExternalText(source.apiDetails || source.instructions),
            lastMenuPushedAt: normalizeExternalText(source.lastMenuPushedAt),
            lastMenuPushedAtMs: normalizeOptionalTimestamp(source.lastMenuPushedAtMs),
            lastMenuPayload: source.lastMenuPayload && typeof source.lastMenuPayload === "object"
                ? source.lastMenuPayload
                : existing.lastMenuPayload || null
        });
    }
    seedState.externalPlatforms.forEach(upsertPlatform);
    (Array.isArray(platforms) ? platforms : []).forEach(upsertPlatform);
    const order = new Map(EXTERNAL_DELIVERY_PLATFORMS.map((platform, index) => [platform.id, index]));
    return [...byId.values()].sort((first, second) => (order.get(first.id) ?? 99) - (order.get(second.id) ?? 99));
}
export function normalizeExternalProductMappings(mappings, productIds, platforms = []) {
    const platformIds = new Set(platforms.map((platform) => platform.id));
    const byId = new Map();
    function upsertMapping(mapping = {}, index = 0) {
        const platformId = normalizeExternalPlatformId(mapping.platformId || mapping.platform || mapping.source);
        if (!platformIds.has(platformId))
            return;
        const externalName = normalizeExternalText(mapping.externalName || mapping.name || mapping.productName);
        const externalCode = normalizeExternalText(mapping.externalCode || mapping.platformCode || mapping.code || mapping.sku);
        const productId = String(mapping.productId || mapping.internalProductId || "").trim();
        if (!productIds.has(productId) || (!externalName && !externalCode))
            return;
        const id = normalizeExternalText(mapping.id) || `MAP-${platformId}-${slugify(externalCode || externalName || `mapping-${index + 1}`)}`;
        byId.set(id, {
            id,
            platformId,
            externalName,
            externalCode,
            productId,
            commissionRate: mapping.commissionRate === "" || mapping.commissionRate === undefined
                ? ""
                : normalizeExternalCommissionRate(mapping.commissionRate),
            active: mapping.active === undefined ? true : Boolean(mapping.active),
            lastPushedAt: normalizeExternalText(mapping.lastPushedAt),
            lastPushedAtMs: normalizeOptionalTimestamp(mapping.lastPushedAtMs)
        });
    }
    seedState.externalProductMappings.forEach(upsertMapping);
    (Array.isArray(mappings) ? mappings : []).forEach(upsertMapping);
    return [...byId.values()]
        .sort((first, second) => first.platformId.localeCompare(second.platformId) || first.externalName.localeCompare(second.externalName));
}
export function normalizeExternalOrderImports(imports, productIds, platforms = []) {
    const platformIds = new Set(platforms.map((platform) => platform.id));
    return (Array.isArray(imports) ? imports : [])
        .map((record, index) => {
        const platformId = normalizeExternalPlatformId(record.platformId || record.platform);
        if (!platformIds.has(platformId))
            return null;
        return {
            id: normalizeExternalText(record.id) || `EXT-IMP-${Date.now()}-${index + 1}`,
            platformId,
            platformName: externalPlatformName(platformId),
            externalOrderId: normalizeExternalText(record.externalOrderId || record.platformOrderId || record.orderCode),
            importMethod: normalizeExternalImportMethod(record.importMethod || record.method),
            orderId: normalizeExternalText(record.orderId || record.internalOrderId),
            importedAt: normalizeExternalText(record.importedAt) || timeNow(),
            importedAtMs: normalizeOptionalTimestamp(record.importedAtMs) || normalizeTimestamp(record.timeMs, record.importedAt || timeNow()),
            status: normalizeExternalText(record.status) || "Imported",
            matchedItems: (Array.isArray(record.matchedItems) ? record.matchedItems : [])
                .map((item) => ({
                productId: productIds.has(item.productId) ? item.productId : "",
                quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
                externalCode: normalizeExternalText(item.externalCode),
                externalName: normalizeExternalText(item.externalName)
            }))
                .filter((item) => item.productId),
            unmatchedItems: (Array.isArray(record.unmatchedItems) ? record.unmatchedItems : [])
                .map((item) => ({
                externalCode: normalizeExternalText(item.externalCode),
                externalName: normalizeExternalText(item.externalName),
                quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
                reason: normalizeExternalText(item.reason)
            }))
                .filter((item) => item.externalCode || item.externalName),
            rawText: String(record.rawText || record.rawOrder || "").trim(),
            lastPushedStatus: normalizeExternalText(record.lastPushedStatus),
            statusPushedAt: normalizeExternalText(record.statusPushedAt),
            statusPushedAtMs: normalizeOptionalTimestamp(record.statusPushedAtMs)
        };
    })
        .filter(Boolean)
        .slice(-80);
}
export function normalizeProducts(products, ingredientIds) {
    const seenIds = new Set();
    return products
        .map((product, index) => {
        const name = String(product.name || product.productName || "").trim();
        if (!name)
            return null;
        const id = slugify(product.id || name, `product-${index + 1}`);
        if (seenIds.has(id))
            return null;
        seenIds.add(id);
        const category = PRODUCT_CATEGORIES.includes(product.category)
            ? product.category
            : PRODUCT_CATEGORIES.includes(product.station)
                ? product.station
                : "Other";
        const station = normalizeKitchenStation(product.station || product.kitchenStation || "Main kitchen");
        const vatSetting = normalizeVatSetting(product.vatSetting, "reduced");
        const targetMargin = normalizeMarginPercent(product.targetMargin, DEFAULT_MARGIN_TARGET);
        const minMargin = Math.min(targetMargin, normalizeMarginPercent(product.minMargin ?? product.minimumMargin, DEFAULT_MARGIN_MINIMUM));
        return {
            id,
            name,
            description: String(product.description || product.productDescription || "").replace(/\s+/g, " ").trim(),
            code: String(product.code || product.sku || product.SKU || "").trim() || id.toUpperCase(),
            category,
            station,
            price: Math.max(0, Number(product.price ?? product.sellingPrice) || 0),
            vatSetting,
            allergens: normalizeProductAllergens(product.allergens),
            precautionaryAllergenStatus: normalizePrecautionaryAllergenStatus(product.precautionaryAllergenStatus),
            precautionaryAllergenNote: String(product.precautionaryAllergenNote || product.allergenNote || "").trim(),
            active: product.active === undefined ? product.status !== "Inactive" && !product.soldOut : Boolean(product.active),
            soldOut: Boolean(product.soldOut),
            isNew: Boolean(product.isNew),
            imageUrl: String(product.imageUrl || product.image || "").trim(),
            externalSource: String(product.externalSource || "").trim(),
            externalCode: String(product.externalCode || "").trim(),
            availability: normalizeProductAvailability(product.availability),
            targetMargin,
            minMargin,
            recipe: normalizeRecipeLines(product.recipe, ingredientIds)
                .map((line) => ({ ...line, station: normalizeKitchenStation(line.station || station) })),
            batchOutput: normalizeBatchOutput(product.batchOutput || product.output, ingredientIds),
            lastProductionCost: Math.max(0, Number(product.lastProductionCost) || 0),
            lastProductionPlannedCost: Math.max(0, Number(product.lastProductionPlannedCost) || 0),
            lastProductionMargin: product.lastProductionMargin === null || product.lastProductionMargin === undefined || product.lastProductionMargin === ""
                ? null
                : Number.isFinite(Number(product.lastProductionMargin)) ? Number(product.lastProductionMargin) : null,
            lastProductionCostDelta: Number.isFinite(Number(product.lastProductionCostDelta)) ? Number(product.lastProductionCostDelta) : 0,
            lastProductionAt: String(product.lastProductionAt || "").trim(),
            lastProductionAtMs: normalizeOptionalTimestamp(product.lastProductionAtMs)
        };
    })
        .filter(Boolean);
}
export function normalizeProductionBatchLines(lines, ingredientIds) {
    return (Array.isArray(lines) ? lines : [])
        .map((line) => {
        const ingredientId = String(line.ingredientId || "").trim();
        if (!ingredientIds.has(ingredientId))
            return null;
        const measure = line.measure && typeof line.measure === "object"
            ? {
                key: ["grams", "milliliters", "units"].includes(line.measure.key) ? line.measure.key : "units",
                label: String(line.measure.label || "pieces"),
                shortLabel: String(line.measure.shortLabel || "pcs")
            }
            : { key: "units", label: "pieces", shortLabel: "pcs" };
        return {
            ingredientId,
            ingredientName: String(line.ingredientName || "").trim(),
            measure,
            plannedUsage: normalizeStockQuantity(line.plannedUsage),
            actualUsage: normalizeStockQuantity(line.actualUsage),
            plannedStockQuantity: normalizeStockQuantity(line.plannedStockQuantity),
            actualStockQuantity: normalizeStockQuantity(line.actualStockQuantity),
            plannedCost: Math.max(0, Number(line.plannedCost) || 0),
            actualCost: Math.max(0, Number(line.actualCost) || 0)
        };
    })
        .filter(Boolean);
}
export function normalizeProductionBatches(records, productIds, ingredientIds, users) {
    const userByIdLookup = new Map(users.map((user) => [user.id, user]));
    return (Array.isArray(records) ? records : [])
        .map((record, index) => {
        const productId = String(record.productId || "").trim();
        if (!productIds.has(productId))
            return null;
        const outputIngredientId = String(record.outputIngredientId || "").trim();
        const completedById = String(record.completedById || record.userId || "").trim();
        const completedBy = userByIdLookup.get(completedById);
        const completedAt = record.completedAt || record.time || timeNow();
        return {
            id: record.id || `BAT-${Date.now()}-${index + 1}`,
            productId,
            productName: String(record.productName || "").trim(),
            completedById: completedBy?.id || completedById,
            completedByName: String(record.completedByName || record.staffName || completedBy?.name || "Staff").trim(),
            completedAt,
            completedAtMs: normalizeOptionalTimestamp(record.completedAtMs) || normalizeTimestamp(record.timeMs, completedAt),
            plannedCost: Math.max(0, Number(record.plannedCost) || 0),
            actualCost: Math.max(0, Number(record.actualCost) || 0),
            costDelta: Number.isFinite(Number(record.costDelta)) ? Number(record.costDelta) : 0,
            plannedMargin: record.plannedMargin === null || record.plannedMargin === undefined || record.plannedMargin === ""
                ? null
                : Number.isFinite(Number(record.plannedMargin)) ? Number(record.plannedMargin) : null,
            actualMargin: record.actualMargin === null || record.actualMargin === undefined || record.actualMargin === ""
                ? null
                : Number.isFinite(Number(record.actualMargin)) ? Number(record.actualMargin) : null,
            marginDelta: record.marginDelta === null || record.marginDelta === undefined || record.marginDelta === ""
                ? null
                : Number.isFinite(Number(record.marginDelta)) ? Number(record.marginDelta) : null,
            outputIngredientId: ingredientIds.has(outputIngredientId) ? outputIngredientId : "",
            outputIngredientName: String(record.outputIngredientName || "").trim(),
            outputQuantity: normalizeStockQuantity(record.outputQuantity),
            outputUnitType: unitTypeDefinition(record.outputUnitType || record.unitType).id,
            outputStockQuantity: normalizeStockQuantity(record.outputStockQuantity),
            outputUnitCost: Math.max(0, Number(record.outputUnitCost) || 0),
            outputLocation: normalizeInventoryLocationName(record.outputLocation, ""),
            lines: normalizeProductionBatchLines(record.lines, ingredientIds)
        };
    })
        .filter(Boolean)
        .slice(-80);
}
export function normalizeRestaurantSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const supportedLanguageIds = new Set(LANGUAGE_OPTIONS.map((language) => language.id));
    const supportedLanguages = Array.isArray(source.supportedLanguages)
        ? source.supportedLanguages.filter((language) => supportedLanguageIds.has(language))
        : DEFAULT_RESTAURANT_SETTINGS.supportedLanguages;
    const defaultLanguage = supportedLanguageIds.has(source.defaultLanguage)
        ? source.defaultLanguage
        : DEFAULT_RESTAURANT_SETTINGS.defaultLanguage;
    if (!supportedLanguages.includes(defaultLanguage))
        supportedLanguages.unshift(defaultLanguage);
    return {
        restaurantName: source.restaurantName || DEFAULT_RESTAURANT_SETTINGS.restaurantName,
        location: source.location || DEFAULT_RESTAURANT_SETTINGS.location,
        currency: source.currency === "EUR" ? "EUR" : DEFAULT_RESTAURANT_SETTINGS.currency,
        currencyLabel: DEFAULT_RESTAURANT_SETTINGS.currencyLabel,
        opensAt: isReservationTime(source.opensAt) ? source.opensAt : DEFAULT_RESTAURANT_SETTINGS.opensAt,
        closesAt: isReservationTime(source.closesAt) ? source.closesAt : DEFAULT_RESTAURANT_SETTINGS.closesAt,
        defaultLanguage,
        supportedLanguages: supportedLanguages.length ? supportedLanguages : [...DEFAULT_RESTAURANT_SETTINGS.supportedLanguages]
    };
}
export function normalizeUsers(users) {
    const seenEmails = new Set();
    return users
        .map((user, index) => {
        const email = String(user.email || "").trim().toLowerCase();
        const role = ROLE_DEFINITIONS[user.role] ? user.role : "waiter_cashier";
        if (!email || seenEmails.has(email))
            return null;
        seenEmails.add(email);
        return {
            id: user.id || `${slugify(email.split("@")[0], "user")}-${index + 1}`,
            name: user.name || email,
            email,
            role,
            password: String(user.password || "demo123"),
            status: user.status === "Inactive" ? "Inactive" : "Active"
        };
    })
        .filter(Boolean);
}
export function normalizeDrivers(drivers, users = []) {
    const seenIds = new Set();
    const driverUserNames = new Map(users
        .filter((user) => user.role === "driver")
        .map((user) => [user.id, user.name]));
    return (Array.isArray(drivers) ? drivers : [])
        .map((driver, index) => {
        const fallbackName = driverUserNames.get(driver.id) || `Driver ${index + 1}`;
        const name = String(driver.name || fallbackName).replace(/\s+/g, " ").trim();
        const id = slugify(driver.id || name, `driver-${index + 1}`);
        if (!id || seenIds.has(id))
            return null;
        seenIds.add(id);
        return {
            id,
            name: name || fallbackName,
            status: normalizeDriverStatus(driver.status),
            eta: String(driver.eta || "-").trim() || "-",
            orderId: driver.orderId || null,
            location: String(driver.location || "Restaurant").replace(/\s+/g, " ").trim() || "Restaurant",
            lastLocation: normalizeDeliveryLocationSample(driver.lastLocation),
            locationUpdatedAtMs: normalizeOptionalTimestamp(driver.locationUpdatedAtMs)
        };
    })
        .filter(Boolean);
}
function getDefaultScheduleStation(role) {
    if (role === "Driver")
        return "Delivery";
    if (role === "Kitchen")
        return "Main kitchen";
    if (role === "Cashier")
        return "Cashier";
    if (role === "Grill")
        return "Grill station";
    if (role === "Sweets")
        return "Sweets station";
    if (role === "Packaging")
        return "Packaging station";
    return "Restaurant floor";
}
function getDefaultScheduleRoleForUser(user) {
    const operationalRole = ROLE_DEFINITIONS[user?.role]?.operationalRole || "Front";
    return operationalRole === "Owner/Admin" ? "Manager" : operationalRole;
}
export function normalizeStaffShifts(shifts, users = []) {
    const seenIds = new Set();
    const userById = new Map(users.map((user) => [user.id, user]));
    const today = toDateInputString();
    const normalized = (Array.isArray(shifts) ? shifts : [])
        .map((shift, index) => {
        const staffId = String(shift.staffId || shift.userId || shift.id || "").trim();
        const user = userById.get(staffId);
        if (!user || user.status !== "Active")
            return null;
        const id = slugify(shift.id || `shift-${staffId}-${shift.date || today}-${index + 1}`, `shift-${index + 1}`);
        if (!id || seenIds.has(id))
            return null;
        seenIds.add(id);
        const fallbackRole = getDefaultScheduleRoleForUser(user);
        const role = normalizeScheduleRole(shift.role || shift.assignedRole, fallbackRole);
        const date = normalizeShiftDate(shift.date || shift.shiftDate, today);
        const startTime = normalizeShiftTime(shift.startTime || shift.startsAt || shift.start || "09:00");
        const endTime = normalizeShiftTime(shift.endTime || shift.endsAt || shift.end || "17:00");
        const clockInAtMs = normalizeOptionalTimestamp(shift.clockInAtMs);
        const clockOutAtMs = clockInAtMs ? normalizeOptionalTimestamp(shift.clockOutAtMs) : "";
        const breakStartedAtMs = clockInAtMs && !clockOutAtMs ? normalizeOptionalTimestamp(shift.breakStartedAtMs) : "";
        const breakMinutes = Math.max(0, Math.round(Number(shift.breakMinutes) || 0));
        return {
            id,
            staffId: user.id,
            staffName: String(shift.staffName || shift.userName || user.name).replace(/\s+/g, " ").trim(),
            role,
            station: normalizeScheduleStation(shift.station || shift.assignedStation, getDefaultScheduleStation(role)),
            date,
            startTime,
            endTime,
            notifiedAtMs: normalizeOptionalTimestamp(shift.notifiedAtMs),
            notifiedAt: String(shift.notifiedAt || "").trim(),
            clockInAtMs,
            clockInAt: String(shift.clockInAt || "").trim(),
            clockOutAtMs,
            clockOutAt: String(shift.clockOutAt || "").trim(),
            breakStartedAtMs,
            breakStartedAt: breakStartedAtMs ? String(shift.breakStartedAt || "").trim() : "",
            breakMinutes,
            status: String(shift.status || "Scheduled").trim() || "Scheduled",
            notes: String(shift.notes || "").trim(),
            createdAtMs: normalizeOptionalTimestamp(shift.createdAtMs),
            updatedAtMs: normalizeOptionalTimestamp(shift.updatedAtMs)
        };
    })
        .filter(Boolean);
    return sortShiftsByDateTime(normalized);
}
export function normalizeProcedureLanguage(language) {
    const candidate = String(language || "").trim();
    return LANGUAGE_OPTIONS.some((option) => option.id === candidate) ? candidate : DEFAULT_RESTAURANT_SETTINGS.defaultLanguage;
}
export function normalizeProcedureFrequency(frequency) {
    const candidate = String(frequency || "").trim();
    return PROCEDURE_FREQUENCIES.includes(candidate) ? candidate : "Daily";
}
export function normalizeProcedureAssignedRole(role, fallbackDepartment = "") {
    const candidate = String(role || "").trim();
    if (PROCEDURE_ASSIGNED_ROLES.includes(candidate))
        return candidate;
    const department = String(fallbackDepartment || "").toLowerCase();
    if (department.includes("cashier"))
        return "Cashier";
    if (department.includes("driver") || department.includes("delivery"))
        return "Driver";
    if (department.includes("kitchen") || department.includes("food") || department.includes("clean"))
        return "Kitchen";
    if (department.includes("manager") || department.includes("management"))
        return "Manager";
    if (department.includes("front"))
        return "Front";
    return "All staff";
}
export function normalizeProcedureDepartment(department) {
    const candidate = String(department || "").trim();
    return candidate || "Management";
}
export function normalizeListInput(value) {
    const values = Array.isArray(value)
        ? value
        : String(value || "")
            .split(/\n|,/)
            .map((item) => item.trim());
    return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}
export function normalizeProcedureSteps(steps, fallbackText = "") {
    const normalizedSteps = normalizeListInput(Array.isArray(steps) ? steps : String(steps || "").split(/\n/));
    if (normalizedSteps.length)
        return normalizedSteps;
    const fallback = String(fallbackText || "").trim();
    return fallback ? [fallback] : [];
}
export function normalizeProcedureMedia(media) {
    return normalizeListInput(media).filter((url) => /^https?:\/\//i.test(url));
}
export function normalizeProcedureRecord(procedure, index = 0) {
    const title = String(procedure.title || procedure.name || procedure.text || "").trim() || `Procedure ${index + 1}`;
    const department = normalizeProcedureDepartment(procedure.department || procedure.owner);
    return {
        id: slugify(procedure.id || title, `procedure-${index + 1}`),
        title,
        department,
        language: normalizeProcedureLanguage(procedure.language),
        steps: normalizeProcedureSteps(procedure.steps, procedure.text),
        requiredTools: normalizeListInput(procedure.requiredTools || procedure.tools),
        requiredProducts: normalizeListInput(procedure.requiredProducts || procedure.products),
        media: normalizeProcedureMedia(procedure.media || procedure.mediaUrls || procedure.attachments),
        frequency: normalizeProcedureFrequency(procedure.frequency),
        assignedRole: normalizeProcedureAssignedRole(procedure.assignedRole || procedure.owner, department),
        active: procedure.active === undefined ? true : Boolean(procedure.active),
        createdById: String(procedure.createdById || "").trim(),
        createdByName: String(procedure.createdByName || "").trim(),
        createdAtMs: normalizeOptionalTimestamp(procedure.createdAtMs) || Date.now()
    };
}
export function normalizeProcedures(procedures) {
    const seenIds = new Set();
    return (Array.isArray(procedures) ? procedures : [])
        .map((procedure, index) => normalizeProcedureRecord(procedure, index))
        .filter((procedure) => {
        if (!procedure.title || seenIds.has(procedure.id))
            return false;
        seenIds.add(procedure.id);
        return true;
    });
}
export function isLegacyProcedureList(procedures) {
    return Array.isArray(procedures)
        && procedures.length > 0
        && procedures.every((procedure) => procedure && procedure.text && !procedure.title);
}
export function mergeDefaultProcedures(procedures) {
    const byId = new Map(procedures.map((procedure) => [procedure.id, procedure]));
    normalizeProcedures(seedState.procedures).forEach((procedure) => {
        if (!byId.has(procedure.id))
            byId.set(procedure.id, procedure);
    });
    return [...byId.values()];
}
export function normalizeProcedureCompletions(records, procedureIds, users) {
    const userById = new Map(users.map((user) => [user.id, user]));
    return (Array.isArray(records) ? records : [])
        .map((record, index) => {
        const procedureId = String(record.procedureId || "").trim();
        if (!procedureIds.has(procedureId))
            return null;
        const status = PROCEDURE_COMPLETION_STATUSES.includes(record.status) ? record.status : "Done";
        const completedById = String(record.completedById || record.userId || "").trim();
        const completedBy = userById.get(completedById);
        const completedAtMs = normalizeOptionalTimestamp(record.completedAtMs)
            || normalizeOptionalTimestamp(record.timeMs)
            || Date.parse(record.completedAt || record.time || "")
            || Date.now();
        return {
            id: record.id || `PROC-CMP-${Date.now()}-${index + 1}`,
            procedureId,
            status,
            completedById: completedBy?.id || completedById,
            completedByName: String(record.completedByName || record.staffName || completedBy?.name || "Staff").trim(),
            assignedRole: normalizeProcedureAssignedRole(record.assignedRole, completedBy ? (ROLE_DEFINITIONS[completedBy.role] || ROLE_DEFINITIONS.waiter_cashier).operationalRole : ""),
            completedAtMs,
            completedAt: record.completedAt || timeNow(),
            checkedSteps: Array.isArray(record.checkedSteps)
                ? record.checkedSteps.map((step) => Math.max(0, Math.floor(Number(step) || 0)))
                : [],
            notes: String(record.notes || record.issue || record.reason || "").trim()
        };
    })
        .filter(Boolean)
        .slice(-180);
}
export function normalizeProcedureProgress(progress, procedureIds, users) {
    if (!progress || typeof progress !== "object" || Array.isArray(progress))
        return {};
    const userIds = new Set(users.map((user) => user.id));
    return Object.entries(progress).reduce((nextProgress, [key, value]) => {
        const [userId, procedureId] = String(key).split(":");
        if (!userIds.has(userId) || !procedureIds.has(procedureId))
            return nextProgress;
        const steps = Array.isArray(value)
            ? [...new Set(value.map((step) => Math.max(0, Math.floor(Number(step) || 0))))]
            : [];
        if (steps.length)
            nextProgress[key] = steps;
        return nextProgress;
    }, {});
}
export function normalizeOrderStatus(status, paymentStatus = "") {
    const legacyMap = {
        Queued: "Sent to kitchen",
        Done: "Served"
    };
    const candidate = legacyMap[status] || status;
    if (ORDER_STATUSES.includes(candidate))
        return candidate;
    if (paymentStatus === "Paid")
        return "Paid";
    return "New";
}
export function normalizePaymentStatus(status) {
    return normalizeLedgerPaymentStatus(status);
}
export function normalizeDeliveryNotes(notes) {
    const source = Array.isArray(notes)
        ? notes
        : String(notes || "").trim()
            ? [{ text: String(notes).trim() }]
            : [];
    return source
        .map((note, index) => {
        const text = String(note.text || note.note || note.message || "").replace(/\s+/g, " ").trim();
        if (!text)
            return null;
        const at = note.at || note.createdAt || timeNow();
        return {
            id: note.id || `DLV-NOTE-${Date.now()}-${index + 1}`,
            text,
            authorId: String(note.authorId || note.userId || "").trim(),
            authorName: String(note.authorName || note.userName || note.staffName || "Driver").trim(),
            at,
            atMs: normalizeOptionalTimestamp(note.atMs) || normalizeOptionalTimestamp(note.createdAtMs) || normalizeTimestamp(note.timeMs, at)
        };
    })
        .filter(Boolean)
        .slice(-12);
}
export function normalizeWaiterPickupStatus(status, orderStatus = "New", isTableService = false) {
    const candidate = String(status || "").trim();
    if (["Ready for pickup", "Picked up", "Served"].includes(candidate))
        return candidate;
    if (!isTableService)
        return "";
    if (orderStatus === "Ready")
        return "Ready for pickup";
    if (orderStatus === "Served" || orderStatus === "Paid")
        return "Served";
    return "";
}
export function normalizeLineModifiers(modifiers) {
    const source = Array.isArray(modifiers)
        ? modifiers
        : String(modifiers || "")
            .split(",")
            .map((modifier) => modifier.trim());
    return [...new Set(source.map((modifier) => String(modifier || "").trim()).filter(Boolean))];
}
export function normalizeOrderLineItem(item, productIds) {
    const productId = item.productId;
    const quantity = Math.floor(Number(item.quantity) || 0);
    if (!productIds.has(productId) || quantity < 1)
        return null;
    return {
        productId,
        quantity,
        note: String(item.note || item.notes || "").trim(),
        modifiers: normalizeLineModifiers(item.modifiers)
    };
}
export function normalizeCustomerPhone(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}
export function customerPhoneKey(value) {
    return normalizeCustomerPhone(value).replace(/[^\d+]/g, "");
}
export function normalizeAddressHistory(addresses) {
    const source = Array.isArray(addresses)
        ? addresses
        : String(addresses || "")
            .split("\n")
            .map((address) => address.trim());
    return [...new Set(source.map((address) => String(address || "").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 8);
}
export function normalizeCustomerRecord(customer, index, seenIds = new Set()) {
    const name = String(customer.name || customer.customerName || customer.customer || "").replace(/\s+/g, " ").trim();
    const phone = normalizeCustomerPhone(customer.phone || customer.customerPhone || customer.phoneNumber);
    const fallbackId = name || phone || `customer-${index + 1}`;
    let id = slugify(customer.id || fallbackId, `customer-${index + 1}`);
    let suffix = 2;
    while (seenIds.has(id)) {
        id = `${slugify(customer.id || fallbackId, `customer-${index + 1}`)}-${suffix}`;
        suffix += 1;
    }
    seenIds.add(id);
    return {
        id,
        name: name || phone || `Customer ${index + 1}`,
        phone,
        email: String(customer.email || customer.customerEmail || "").trim(),
        addresses: normalizeAddressHistory(customer.addresses || customer.addressHistory || customer.deliveryAddress || customer.address),
        notes: String(customer.notes || customer.customerNotes || "").trim(),
        createdAt: customer.createdAt || timeNow(),
        updatedAt: customer.updatedAt || customer.createdAt || timeNow()
    };
}
export function normalizeCustomers(customers) {
    const seenIds = new Set();
    const byPhone = new Map();
    const normalized = (Array.isArray(customers) ? customers : [])
        .map((customer, index) => normalizeCustomerRecord(customer, index, seenIds))
        .filter((customer) => customer.name || customer.phone);
    normalized.forEach((customer) => {
        const phoneKey = customerPhoneKey(customer.phone);
        if (!phoneKey || !byPhone.has(phoneKey)) {
            if (phoneKey)
                byPhone.set(phoneKey, customer);
            return;
        }
        const existing = byPhone.get(phoneKey);
        existing.name = existing.name || customer.name;
        existing.email = existing.email || customer.email;
        existing.addresses = normalizeAddressHistory([...existing.addresses, ...customer.addresses]);
        existing.notes = existing.notes || customer.notes;
        existing.updatedAt = customer.updatedAt || existing.updatedAt;
        customer.mergedInto = existing.id;
    });
    return normalized.filter((customer) => !customer.mergedInto);
}
export function normalizeQrCodeStatus(status) {
    return QR_CODE_STATUSES.includes(status) ? status : "Active";
}
export function createQrToken(tableId, existingTokens = new Set()) {
    const base = slugify(tableId || "table", "table");
    let token = `libabite-${base}`;
    let suffix = 2;
    while (existingTokens.has(token)) {
        token = `libabite-${base}-${suffix}`;
        suffix += 1;
    }
    existingTokens.add(token);
    return token;
}
export function createDefaultTableQrCodes(tables) {
    const existingTokens = new Set();
    return tables.map((table, index) => ({
        id: `qr-${table.id || index + 1}`,
        tableId: table.id,
        area: table.zone || "Dining room",
        token: createQrToken(table.id, existingTokens),
        status: "Active",
        createdAt: timeNow(),
        regeneratedAt: ""
    }));
}
export function normalizeTableQrCodes(codes, tables) {
    const tableIds = new Set(tables.map((table) => table.id));
    const existingTokens = new Set();
    const normalized = (Array.isArray(codes) ? codes : [])
        .map((code, index) => {
        const tableId = String(code.tableId || "").trim();
        if (!tableIds.has(tableId))
            return null;
        const rawToken = String(code.token || "").trim();
        const token = rawToken && !existingTokens.has(rawToken)
            ? rawToken
            : createQrToken(tableId, existingTokens);
        existingTokens.add(token);
        return {
            id: code.id || `qr-${tableId}-${index + 1}`,
            tableId,
            area: String(code.area || tables.find((table) => table.id === tableId)?.zone || "Dining room").trim(),
            token,
            status: normalizeQrCodeStatus(code.status),
            createdAt: code.createdAt || timeNow(),
            regeneratedAt: code.regeneratedAt || ""
        };
    })
        .filter(Boolean);
    tables.forEach((table) => {
        if (normalized.some((code) => code.tableId === table.id))
            return;
        normalized.push({
            id: `qr-${table.id}`,
            tableId: table.id,
            area: table.zone || "Dining room",
            token: createQrToken(table.id, existingTokens),
            status: "Active",
            createdAt: timeNow(),
            regeneratedAt: ""
        });
    });
    return normalized;
}
export function normalizeReservationSource(source) {
    const candidate = String(source || "").trim();
    return RESERVATION_SOURCES.includes(candidate) ? candidate : "Website";
}
export function normalizeReservationBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : [])
        .map((block, index) => {
        const startTime = isReservationTime(block.startTime) ? block.startTime : "";
        const endTime = isReservationTime(block.endTime) ? block.endTime : "";
        if (!startTime || !endTime)
            return null;
        return {
            id: block.id || `RB-${Date.now()}-${index + 1}`,
            date: isReservationDate(block.date) ? block.date : "",
            startTime,
            endTime,
            reason: String(block.reason || "Unavailable").trim(),
            active: block.active !== false
        };
    })
        .filter(Boolean);
}
export function normalizeReservationCapacityRules(rules) {
    return (Array.isArray(rules) ? rules : [])
        .map((rule, index) => {
        const startTime = isReservationTime(rule.startTime) ? rule.startTime : "";
        const endTime = isReservationTime(rule.endTime) ? rule.endTime : "";
        if (!startTime || !endTime)
            return null;
        return {
            id: rule.id || `RC-${Date.now()}-${index + 1}`,
            date: isReservationDate(rule.date) ? rule.date : "",
            startTime,
            endTime,
            maxGuests: Math.max(0, Math.floor(Number(rule.maxGuests) || 0)),
            maxReservations: Math.max(0, Math.floor(Number(rule.maxReservations) || 0)),
            note: String(rule.note || "").trim(),
            active: rule.active !== false
        };
    })
        .filter(Boolean)
        .filter((rule) => rule.maxGuests > 0 || rule.maxReservations > 0);
}
export function normalizePaymentLedger(records) {
    const normalized = [];
    (Array.isArray(records) ? records : []).forEach((record) => {
        normalized.push(buildPaymentLedgerRecord(record, {
            nowMs: normalizeOptionalTimestamp(record?.createdAtMs || record?.updatedAtMs) || Date.now()
        }));
    });
    return normalized.slice(-250);
}
function orderPaymentLedgerInput(order, productById) {
    const paymentStatus = normalizeLedgerPaymentStatus(order.paymentStatus);
    const hasPaymentEvidence = paymentStatus !== "Unpaid"
        || order.paymentReference
        || order.paymentProcessor
        || order.stripeCheckoutSessionId
        || order.stripePaymentIntentId;
    if (!hasPaymentEvidence)
        return null;
    const amount = (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => {
        const product = productById.get(item.productId);
        return sum + ((Number(product?.price) || 0) * (Number(item.quantity) || 0));
    }, 0);
    return {
        id: `PAY-order-${order.id}`,
        externalId: `order-summary:${order.id}`,
        kind: "order",
        provider: order.paymentProcessor || order.externalPlatformId || "",
        status: paymentStatus,
        currency: "eur",
        amountCents: Math.round(amount * 100),
        orderId: order.id,
        paymentMethod: order.paymentMethod,
        providerPaymentId: order.paymentReference,
        checkoutSessionId: order.stripeCheckoutSessionId,
        paymentIntentId: order.stripePaymentIntentId,
        customerName: order.customerName || order.customer,
        customerEmail: order.customerEmail,
        captureMode: order.externalPlatformId ? "external_platform" : order.paymentMethod === "Online payment" ? "online_checkout" : "staff_recorded",
        sourceChannel: order.channel,
        paidAt: order.paidAt,
        paidAtMs: order.paidAtMs,
        raw: {
            orderId: order.id,
            orderNumber: order.number,
            channel: order.channel,
            externalPlatformId: order.externalPlatformId,
            externalOrderId: order.externalOrderId
        }
    };
}
function reservationPaymentLedgerInput(reservation) {
    const paymentStatus = normalizeLedgerPaymentStatus(reservation.paymentStatus);
    const amountCents = Math.round((Number(reservation.depositAmount) || 0) * 100);
    const hasPaymentEvidence = paymentStatus !== "Unpaid"
        || amountCents > 0
        || reservation.paymentReference
        || reservation.paymentProcessor;
    if (!hasPaymentEvidence)
        return null;
    return {
        id: `PAY-reservation-${reservation.id}`,
        externalId: `reservation-deposit:${reservation.id}`,
        kind: "reservation_deposit",
        provider: reservation.paymentProcessor || "",
        status: paymentStatus,
        currency: "eur",
        amountCents,
        reservationId: reservation.id,
        paymentMethod: reservation.paymentMethod || "Online payment",
        providerPaymentId: reservation.paymentReference,
        customerName: reservation.name,
        customerEmail: reservation.email,
        captureMode: "online_checkout",
        sourceChannel: reservation.source,
        paidAt: reservation.paidAt,
        paidAtMs: reservation.paidAtMs,
        raw: {
            reservationId: reservation.id,
            date: reservation.date,
            time: reservation.time,
            guests: reservation.guests
        }
    };
}
export function normalizeState(candidate) {
    const source = candidate ? structuredClone(candidate) : {};
    const next = { ...getFreshSeedState(), ...source };
    const collectionKeys = [
        "products",
        "ingredients",
        "orders",
        "payments",
        "tickets",
        "tables",
        "tableQrCodes",
        "customerCart",
        "websiteCart",
        "customers",
        "suppliers",
        "supplierOrders",
        "externalPlatforms",
        "externalProductMappings",
        "externalOrderImports",
        "procedures",
        "procedureCompletions",
        "staff",
        "staffShifts",
        "drivers",
        "reservations",
        "reservationBlocks",
        "reservationCapacityRules",
        "productionLog",
        "productionBatches",
        "users",
        "customInventoryLocations",
        "inventoryHistory",
        "wasteRecords",
        "productRecipeDraft"
    ];
    collectionKeys.forEach((key) => {
        if (!Array.isArray(next[key]))
            next[key] = structuredClone(seedState[key]);
    });
    if (Array.isArray(candidate?.orders) && candidate.orders.length === 0 && !candidate?.websiteLastOrderId && seedState.orders?.length) {
        next.orders = structuredClone(seedState.orders);
        next.tickets = structuredClone(seedState.tickets);
        next.websiteLastOrderId = seedState.websiteLastOrderId;
        next.receiptOrderId = seedState.websiteLastOrderId;
        next.nextOrderNumber = Math.max(Number(next.nextOrderNumber) || 0, Number(seedState.nextOrderNumber) || 0);
    }
    next.restaurantSettings = normalizeRestaurantSettings(source.restaurantSettings);
    next.users = normalizeUsers(next.users);
    if (!next.users.some((user) => user.id === next.currentUserId))
        next.currentUserId = "";
    next.scheduleWeekStart = getWeekStartDate(normalizeShiftDate(source.scheduleWeekStart, toDateInputString()));
    next.staffShifts = normalizeStaffShifts(next.staffShifts, next.users);
    next.drivers = normalizeDrivers(next.drivers, next.users);
    next.customers = normalizeCustomers(next.customers);
    const rawProcedures = Array.isArray(source.procedures) ? source.procedures : seedState.procedures;
    next.procedures = mergeDefaultProcedures(normalizeProcedures(isLegacyProcedureList(rawProcedures) ? seedState.procedures : rawProcedures));
    const procedureIds = new Set(next.procedures.map((procedure) => procedure.id));
    next.procedureCompletions = normalizeProcedureCompletions(next.procedureCompletions, procedureIds, next.users);
    next.procedureProgress = normalizeProcedureProgress(source.procedureProgress, procedureIds, next.users);
    const normalizedSeedIngredients = normalizeIngredients(seedState.ingredients);
    const seedIngredientById = new Map(normalizedSeedIngredients.map((ingredient) => [ingredient.id, ingredient]));
    next.ingredients = normalizeIngredients(next.ingredients);
    next.ingredients.forEach((ingredient) => {
        const seedIngredient = seedIngredientById.get(ingredient.id);
        if (!ingredient.barcode && seedIngredient?.barcode)
            ingredient.barcode = seedIngredient.barcode;
    });
    const existingIngredientIds = new Set(next.ingredients.map((ingredient) => ingredient.id));
    normalizedSeedIngredients
        .filter((ingredient) => PHASE_11_SEED_INGREDIENT_IDS.includes(ingredient.id) && !existingIngredientIds.has(ingredient.id))
        .forEach((ingredient) => {
        next.ingredients.push(ingredient);
        existingIngredientIds.add(ingredient.id);
    });
    const ingredientIds = new Set(next.ingredients.map((ingredient) => ingredient.id));
    next.suppliers = normalizeSuppliers(next.suppliers, next.ingredients);
    if (!next.suppliers.some((supplier) => supplier.id === next.supplierFormSupplierId))
        next.supplierFormSupplierId = "";
    next.customInventoryLocations = normalizeCustomInventoryLocations(next.customInventoryLocations, next.ingredients);
    next.inventoryHistory = normalizeInventoryHistory(next.inventoryHistory, ingredientIds);
    next.wasteRecords = normalizeWasteRecords(next.wasteRecords, next.ingredients, next.users);
    const existingProductIds = new Set((Array.isArray(next.products) ? next.products : []).map((product) => slugify(product.id || product.name || "", "")));
    seedState.products
        .filter((product) => [...PHASE_11_SEED_PRODUCT_IDS, ...PHASE_18_SEED_PRODUCT_IDS].includes(product.id) && !existingProductIds.has(product.id))
        .forEach((product) => next.products.push(structuredClone(product)));
    next.products = normalizeProducts(next.products, ingredientIds);
    const productIds = new Set(next.products.map((product) => product.id));
    next.externalPlatforms = normalizeExternalPlatforms(next.externalPlatforms);
    next.externalProductMappings = normalizeExternalProductMappings(next.externalProductMappings, productIds, next.externalPlatforms);
    next.externalOrderImports = normalizeExternalOrderImports(candidate?.externalOrderImports, productIds, next.externalPlatforms);
    next.productionBatches = normalizeProductionBatches(next.productionBatches, productIds, ingredientIds, next.users);
    next.orderDraft = Array.isArray(candidate?.orderDraft)
        ? candidate.orderDraft
            .map((item) => normalizeOrderLineItem(item, productIds))
            .filter(Boolean)
        : [];
    next.receiptOrderId = String(candidate?.receiptOrderId || "");
    next.productRecipeDraft = normalizeRecipeLines(candidate?.productRecipeDraft, ingredientIds);
    next.tables = next.tables
        .map((table, index) => ({
        id: table.id || `table-${index + 1}`,
        name: table.name || `Table ${index + 1}`,
        capacity: Math.max(1, Math.floor(Number(table.capacity) || 2)),
        zone: table.zone || "Dining room"
    }))
        .filter((table) => table.id);
    if (!next.tables.length)
        next.tables = structuredClone(seedState.tables);
    next.tableQrCodes = normalizeTableQrCodes(next.tableQrCodes, next.tables);
    next.customerCart = Array.isArray(candidate?.customerCart)
        ? candidate.customerCart
            .map((item) => normalizeOrderLineItem(item, productIds))
            .filter(Boolean)
        : [];
    next.customerCartOpen = Boolean(candidate?.customerCartOpen);
    next.customerUpsellProductId = productIds.has(candidate?.customerUpsellProductId)
        ? candidate.customerUpsellProductId
        : "";
    next.customerUpsellStep = next.customerUpsellProductId
        ? Math.max(0, Math.floor(Number(candidate?.customerUpsellStep) || 0))
        : 0;
    next.websiteCart = Array.isArray(candidate?.websiteCart)
        ? candidate.websiteCart
            .map((item) => normalizeOrderLineItem(item, productIds))
            .filter(Boolean)
        : [];
    next.websiteFulfillment = normalizeWebsiteFulfillment(candidate?.websiteFulfillment);
    next.websiteLastReservationId = String(candidate?.websiteLastReservationId || "");
    next.reservationEditingId = String(candidate?.reservationEditingId || "");
    next.activeScan = normalizeActiveScan(candidate?.activeScan);
    const tableIds = new Set(next.tables.map((table) => table.id));
    next.reservationBlocks = normalizeReservationBlocks(next.reservationBlocks);
    next.reservationCapacityRules = normalizeReservationCapacityRules(next.reservationCapacityRules);
    const normalizedReservations = [];
    next.reservations.forEach((reservation, index) => {
        const id = reservation.id || `RES-${Date.now()}-${index + 1}`;
        const guests = Math.max(1, Math.floor(Number(reservation.guests) || 1));
        const date = isReservationDate(reservation.date) ? reservation.date : toDateInputString();
        const time = isReservationTime(reservation.time) ? reservation.time : "19:00";
        const status = normalizeReservationStatus(reservation.status, normalizeReservationSource(reservation.source) === "Website" ? "Pending" : "Confirmed");
        const source = normalizeReservationSource(reservation.source);
        const requestedTable = tableIds.has(reservation.tableId)
            ? next.tables.find((table) => table.id === reservation.tableId)
            : null;
        const shouldAssignTable = status === "Pending" || status === "Confirmed" || status === "Arrived";
        const assignedTable = shouldAssignTable && requestedTable
            && requestedTable.capacity >= guests
            && !getReservationConflicts({ id, date, tableId: requestedTable.id, time }, normalizedReservations).length
            ? requestedTable
            : shouldAssignTable
                ? getAvailableReservationTable({ id, date, guests, time }, next.tables, normalizedReservations)
                : requestedTable;
        const paymentStatus = normalizePaymentStatus(reservation.paymentStatus);
        normalizedReservations.push({
            id,
            date,
            name: String(reservation.name || "Guest").trim(),
            guests,
            time,
            tableId: assignedTable?.id || requestedTable?.id || next.tables[0]?.id || "",
            phone: String(reservation.phone || "").trim(),
            email: String(reservation.email || "").trim(),
            notes: String(reservation.notes || "").trim(),
            source,
            status,
            createdAt: reservation.createdAt || timeNow(),
            updatedAt: reservation.updatedAt || "",
            paymentStatus,
            paymentMethod: normalizePaymentMethod(reservation.paymentMethod || "Unpaid / pay later", reservation.paymentStatus),
            paymentReference: String(reservation.paymentReference || "").trim(),
            paymentProcessor: String(reservation.paymentProcessor || "").trim(),
            depositAmount: Math.max(0, Number(reservation.depositAmount) || 0),
            paidAt: paymentStatus === "Paid" ? reservation.paidAt || reservation.createdAt || timeNow() : String(reservation.paidAt || "").trim(),
            paidAtMs: paymentStatus === "Paid" ? normalizeOptionalTimestamp(reservation.paidAtMs) || normalizeTimestamp(reservation.createdAtMs, reservation.paidAt || reservation.createdAt || timeNow()) : normalizeOptionalTimestamp(reservation.paidAtMs)
        });
    });
    next.reservations = normalizedReservations;
    if (!next.reservations.some((reservation) => reservation.id === next.websiteLastReservationId))
        next.websiteLastReservationId = "";
    if (!next.reservations.some((reservation) => reservation.id === next.reservationEditingId))
        next.reservationEditingId = "";
    next.supplierOrders = normalizeSupplierOrders(candidate?.supplierOrders, ingredientIds, next.suppliers);
    next.orders = next.orders
        .map((order) => {
        const channel = normalizeOrderType(order.orderType || order.channel);
        const typeDefinition = orderTypeDefinition(channel);
        const rawPaymentStatus = normalizePaymentStatus(order.status === "Paid" ? "Paid" : order.paymentStatus);
        let paymentMethod = normalizePaymentMethod(order.paymentMethod || order.paymentMethodName || order.payment || rawPaymentStatus, rawPaymentStatus);
        if (rawPaymentStatus === "Paid" && !isPaidPaymentMethod(paymentMethod))
            paymentMethod = DEFAULT_PAID_PAYMENT_METHOD;
        const paymentStatus = getPaymentStatusForMethod(paymentMethod, rawPaymentStatus);
        const createdAt = order.createdAt || timeNow();
        const items = Array.isArray(order.items)
            ? order.items.map((item) => normalizeOrderLineItem(item, productIds)).filter(Boolean)
            : [];
        const requestedTableId = String(order.tableId || "").trim();
        const tableId = tableIds.has(requestedTableId) ? requestedTableId : "";
        const staffIdCandidate = String(order.staffId || order.createdByUserId || order.userId || "").trim();
        const staffUser = next.users.find((user) => user.id === staffIdCandidate);
        const staffId = staffUser?.id || "";
        const staffName = String(order.staffName || order.staffMember || order.createdByName || staffUser?.name || "").trim();
        const paidByIdCandidate = String(order.paidByUserId || order.paidById || "").trim();
        const paidByUser = next.users.find((user) => user.id === paidByIdCandidate) || staffUser;
        const customerIdCandidate = String(order.customerId || "").trim();
        const customerRecord = next.customers.find((customer) => customer.id === customerIdCandidate);
        const fulfillment = normalizeOrderFulfillment(channel, order.fulfillment || typeDefinition.fulfillment);
        const assignedDriverId = String(order.assignedDriver || order.driverId || "").trim();
        const deliveryStatus = fulfillment === "Delivery"
            ? normalizeDriverDeliveryStatus(order.deliveryStatus || order.driverStatus) || (assignedDriverId ? "Assigned" : "")
            : "";
        const deliveryAssignedAtMs = deliveryStatus
            ? normalizeOptionalTimestamp(order.deliveryAssignedAtMs)
                || normalizeOptionalTimestamp(order.assignedAtMs)
                || normalizeTimestamp(order.sentAtMs, order.sentAt || createdAt)
            : "";
        const deliveryStatusUpdatedAtMs = deliveryStatus
            ? normalizeOptionalTimestamp(order.deliveryStatusUpdatedAtMs)
                || normalizeOptionalTimestamp(order.deliveryUpdatedAtMs)
                || deliveryAssignedAtMs
            : "";
        const isExternalOrder = channel === EXTERNAL_DELIVERY_ORDER_CHANNEL
            || Boolean(order.externalPlatformId || order.platformId || order.externalOrderId);
        const externalPlatformId = isExternalOrder
            ? normalizeExternalPlatformId(order.externalPlatformId || order.platformId || order.externalPlatform || order.platform)
            : "";
        const externalPlatform = next.externalPlatforms.find((platform) => platform.id === externalPlatformId);
        const externalCommissionRate = isExternalOrder
            ? normalizeExternalCommissionRate(order.externalCommissionRate, externalPlatform?.commissionRate)
            : 0;
        const status = normalizeOrderStatus(order.status, paymentStatus);
        const isTableService = typeDefinition.requiresTable && fulfillment === "Kitchen";
        return {
            ...order,
            orderType: channel,
            channel,
            tableId,
            customerId: customerRecord?.id || "",
            customer: String(order.customer || (tableId ? next.tables.find((table) => table.id === tableId)?.name : "") || "Walk-in").trim(),
            paymentStatus,
            paymentMethod,
            fulfillment,
            operationalStatus: normalizeOrderOperationalStatus(order.operationalStatus || order.lifecycleStatus || order.status),
            fulfillmentStatus: normalizeFulfillmentStatus(order.fulfillmentStatus || order.status),
            status,
            createdAt,
            createdAtMs: normalizeTimestamp(order.createdAtMs, createdAt),
            sentAt: order.sentAt || (order.status && order.status !== "New" ? createdAt : ""),
            paidAt: paymentStatus === "Paid" ? order.paidAt || createdAt : "",
            paidAtMs: paymentStatus === "Paid" ? normalizeTimestamp(order.paidAtMs, order.paidAt || createdAt) : "",
            staffId,
            staffName,
            paidByUserId: paymentStatus === "Paid" ? paidByUser?.id || "" : "",
            paidByName: paymentStatus === "Paid" ? String(order.paidByName || paidByUser?.name || staffName || "").trim() : "",
            waiterPickupStatus: normalizeWaiterPickupStatus(order.waiterPickupStatus, status, isTableService),
            waiterNotifiedAt: String(order.waiterNotifiedAt || "").trim(),
            waiterNotifiedAtMs: normalizeOptionalTimestamp(order.waiterNotifiedAtMs),
            waiterPickedUpAt: String(order.waiterPickedUpAt || "").trim(),
            waiterPickedUpAtMs: normalizeOptionalTimestamp(order.waiterPickedUpAtMs),
            waiterPickedUpByUserId: String(order.waiterPickedUpByUserId || "").trim(),
            waiterPickedUpByName: String(order.waiterPickedUpByName || "").trim(),
            servedAt: String(order.servedAt || "").trim(),
            servedAtMs: normalizeOptionalTimestamp(order.servedAtMs),
            servedByUserId: String(order.servedByUserId || "").trim(),
            servedByName: String(order.servedByName || "").trim(),
            inventoryDeducted: order.inventoryDeducted === undefined ? order.status && order.status !== "New" : Boolean(order.inventoryDeducted),
            requestedTime: String(order.requestedTime || "").trim(),
            customerName: String(order.customerName || "").trim(),
            customerPhone: String(order.customerPhone || "").trim(),
            customerEmail: String(order.customerEmail || "").trim(),
            deliveryAddress: String(order.deliveryAddress || order.address || "").trim(),
            paymentReference: String(order.paymentReference || "").trim(),
            paymentProcessor: String(order.paymentProcessor || "").trim(),
            externalPlatformId,
            externalPlatformName: externalPlatformId ? externalPlatform?.name || externalPlatformName(externalPlatformId) : "",
            externalOrderId: isExternalOrder ? String(order.externalOrderId || order.platformOrderId || "").trim() : "",
            externalImportMethod: isExternalOrder ? normalizeExternalImportMethod(order.externalImportMethod || order.importMethod) : "",
            externalCommissionRate,
            externalCommissionAmount: isExternalOrder ? Math.max(0, Number(order.externalCommissionAmount) || 0) : 0,
            externalStatus: isExternalOrder ? String(order.externalStatus || "").trim() : "",
            externalStatusPushedAt: isExternalOrder ? String(order.externalStatusPushedAt || "").trim() : "",
            externalStatusPushedAtMs: isExternalOrder ? normalizeOptionalTimestamp(order.externalStatusPushedAtMs) : "",
            customerNotes: String(order.customerNotes || "").trim(),
            assignedDriver: fulfillment === "Delivery" ? assignedDriverId : "",
            pickupStatus: normalizePickupStatus(order.pickupStatus, deliveryStatus),
            deliveryStatus,
            deliveryAssignedAtMs,
            deliveryStatusUpdatedAtMs,
            deliveryTripStartedAt: String(order.deliveryTripStartedAt || "").trim(),
            deliveryTripStartedAtMs: normalizeOptionalTimestamp(order.deliveryTripStartedAtMs),
            deliveryTripEndedAt: String(order.deliveryTripEndedAt || "").trim(),
            deliveryTripEndedAtMs: normalizeOptionalTimestamp(order.deliveryTripEndedAtMs),
            deliveryTrackingStatus: String(order.deliveryTrackingStatus || "").replace(/\s+/g, " ").trim(),
            deliveryLastLocation: normalizeDeliveryLocationSample(order.deliveryLastLocation),
            deliveryLocationHistory: normalizeDeliveryLocationHistory(order.deliveryLocationHistory),
            deliveryRoute: normalizeDeliveryRoute(order.deliveryRoute),
            deliveryRouteProgress: Math.max(0, Math.min(100, Math.round(Number(order.deliveryRouteProgress) || 0))),
            deliveryDistanceTraveledMeters: Math.max(0, Math.round(Number(order.deliveryDistanceTraveledMeters) || 0)),
            deliveryDistanceRemainingMeters: Math.max(0, Math.round(Number(order.deliveryDistanceRemainingMeters) || 0)),
            deliveryEtaSeconds: Math.max(0, Math.round(Number(order.deliveryEtaSeconds) || 0)),
            deliveredAt: String(order.deliveredAt || "").trim(),
            deliveredAtMs: normalizeOptionalTimestamp(order.deliveredAtMs),
            failedAt: String(order.failedAt || "").trim(),
            failedAtMs: normalizeOptionalTimestamp(order.failedAtMs),
            returnedAt: String(order.returnedAt || "").trim(),
            returnedAtMs: normalizeOptionalTimestamp(order.returnedAtMs),
            deliveryWasLate: Boolean(order.deliveryWasLate),
            deliveryNotes: normalizeDeliveryNotes(order.deliveryNotes || order.deliveryNote),
            deliveryProofPhotoName: String(order.deliveryProofPhotoName || order.proofPhotoName || "").trim(),
            deliveryProofAtMs: normalizeOptionalTimestamp(order.deliveryProofAtMs),
            deliveryProofByName: String(order.deliveryProofByName || "").trim(),
            cashCollected: Boolean(order.cashCollected),
            cashCollectedAt: String(order.cashCollectedAt || "").trim(),
            cashCollectedAtMs: normalizeOptionalTimestamp(order.cashCollectedAtMs),
            cashCollectedByName: String(order.cashCollectedByName || "").trim(),
            notes: String(order.notes || "").trim(),
            items
        };
    })
        .filter((order) => order.id && order.items.length);
    if (!next.orders.some((order) => order.id === next.receiptOrderId))
        next.receiptOrderId = "";
    next.customerLastOrderId = String(candidate?.customerLastOrderId || "");
    if (next.customerLastOrderId && !next.orders.some((order) => order.id === next.customerLastOrderId))
        next.customerLastOrderId = "";
    next.websiteLastOrderId = String(candidate?.websiteLastOrderId || "");
    if (next.websiteLastOrderId && !next.orders.some((order) => order.id === next.websiteLastOrderId))
        next.websiteLastOrderId = "";
    const productByIdForPayments = new Map(next.products.map((product) => [product.id, product]));
    next.payments = normalizePaymentLedger(candidate?.payments || next.payments);
    next.orders.forEach((order) => {
        const ledgerInput = orderPaymentLedgerInput(order, productByIdForPayments);
        if (ledgerInput)
            next.payments = upsertPaymentLedgerRecord(next.payments, ledgerInput);
    });
    next.reservations.forEach((reservation) => {
        const ledgerInput = reservationPaymentLedgerInput(reservation);
        if (ledgerInput)
            next.payments = upsertPaymentLedgerRecord(next.payments, ledgerInput);
    });
    next.payments = normalizePaymentLedger(next.payments);
    const orderIds = new Set(next.orders.map((order) => order.id));
    next.tickets = next.tickets
        .map((ticket, index) => {
        const product = next.products.find((item) => item.id === ticket.productId);
        const order = next.orders.find((item) => item.id === ticket.orderId);
        const status = TICKET_STATUSES.includes(ticket.status) ? ticket.status : "Queued";
        const createdAt = ticket.createdAt || order?.createdAt || timeNow();
        const createdAtMs = normalizeTimestamp(ticket.createdAtMs, createdAt);
        const acceptedAtMs = normalizeOptionalTimestamp(ticket.acceptedAtMs)
            || (["Accepted", "Preparing", "Delayed", "Ready", "Done"].includes(status) ? createdAtMs : "");
        const startedAtMs = normalizeOptionalTimestamp(ticket.startedAtMs)
            || (["Preparing", "Delayed", "Ready", "Done"].includes(status) ? acceptedAtMs || createdAtMs : "");
        const delayedAtMs = normalizeOptionalTimestamp(ticket.delayedAtMs)
            || (status === "Delayed" ? Date.now() : "");
        const readyAtMs = normalizeOptionalTimestamp(ticket.readyAtMs)
            || ((status === "Ready" || status === "Done") ? Date.now() : "");
        const completedAtMs = normalizeOptionalTimestamp(ticket.completedAtMs)
            || (status === "Done" ? readyAtMs || Date.now() : "");
        return {
            id: ticket.id || `TCK-${order?.number || Date.now()}-${index + 1}`,
            orderId: ticket.orderId,
            productId: ticket.productId,
            quantity: Math.max(1, Math.floor(Number(ticket.quantity) || 1)),
            station: normalizeKitchenStation(ticket.station || product?.station || "Main kitchen"),
            status,
            createdAt,
            createdAtMs,
            acceptedAtMs,
            startedAtMs,
            delayedAtMs,
            readyAtMs,
            completedAtMs,
            notes: ticket.notes || "",
            issueNote: String(ticket.issueNote || ticket.delayReason || "").trim()
        };
    })
        .filter((ticket) => orderIds.has(ticket.orderId) && productIds.has(ticket.productId));
    const highestOrderNumber = next.orders.reduce((highest, order) => Math.max(highest, Number(order.number) || 0), 0);
    if (!Number.isFinite(next.nextOrderNumber) || next.nextOrderNumber <= highestOrderNumber) {
        next.nextOrderNumber = highestOrderNumber + 1;
    }
    reconcileDeliveryAssignments(next);
    return next;
}
//# sourceMappingURL=normalize.js.map