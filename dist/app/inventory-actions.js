import { DEFAULT_RECIPE_ORDER_CONTEXT, INVENTORY_ACTIONS, SUPPLIER_INTEGRATION_METHODS } from "../shared/constants.js";
import { convertWasteQuantityToStockUnits, getIngredientTotalStock, getWasteCost, isDefaultInventoryLocation, normalizeInventoryLocationName, normalizeStockQuantity, normalizeWasteReason, normalizeWasteUnitType, sortInventoryLocations, syncIngredientStock } from "../data/normalize.js";
import { planStockDeduction } from "../domain/inventory.js";
import { normalizeOptionalTimestamp, timeNow } from "../shared/dates.js";
import { uniqueRecordId } from "../shared/ids.js";
import { saveState, state } from "./state.js";
export function createInventoryActionsRuntime(deps) {
    const document = window.document;
    const { can, currentUser, formatActualUsageLabel, formatDateTimeLocalInput, formatSignedAmount, formatStockAmount, formatWasteQuantity, getActiveSupplierOrder, getIngredientLocationRows, getIngredientPrimaryLocation, getIngredientStatus, getProductionExecutionDraft, getProductionReadiness, getStockRequirementsForItems, getSupplierKey, getSupplierOrderDrafts, getSupplierOrderQuantity, ingredientById, money, productById, render, renderProductionRecipeFields, showToast, supplierById, supplierForIngredient, updateProductionCostPreview } = deps;
    function getSelectedInventoryLocation(formData, selectName, customName = "") {
        const customLocation = customName ? normalizeInventoryLocationName(formData.get(customName), "") : "";
        return customLocation || normalizeInventoryLocationName(formData.get(selectName), "");
    }
    function getFormDateTimeTimestamp(value) {
        const timestamp = Date.parse(String(value || ""));
        return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
    }
    function rememberInventoryLocation(location) {
        const normalizedLocation = normalizeInventoryLocationName(location, "");
        if (!normalizedLocation || isDefaultInventoryLocation(normalizedLocation))
            return normalizedLocation;
        if (!state.customInventoryLocations.includes(normalizedLocation)) {
            state.customInventoryLocations = sortInventoryLocations([...state.customInventoryLocations, normalizedLocation])
                .filter((item) => !isDefaultInventoryLocation(item));
        }
        return normalizedLocation;
    }
    function setIngredientLocationStock(ingredient, location, quantity) {
        const normalizedLocation = rememberInventoryLocation(location);
        if (!normalizedLocation)
            return;
        const normalizedQuantity = normalizeStockQuantity(quantity);
        ingredient.locationStock = ingredient.locationStock || {};
        if (normalizedQuantity <= 0)
            delete ingredient.locationStock[normalizedLocation];
        else
            ingredient.locationStock[normalizedLocation] = normalizedQuantity;
        syncIngredientStock(ingredient);
    }
    function addStockToLocation(ingredient, location, quantity) {
        const normalizedLocation = rememberInventoryLocation(location);
        if (!normalizedLocation)
            return;
        const currentQuantity = normalizeStockQuantity(ingredient.locationStock?.[normalizedLocation] || 0);
        setIngredientLocationStock(ingredient, normalizedLocation, currentQuantity + normalizeStockQuantity(quantity));
    }
    function removeStockFromLocation(ingredient, location, quantity) {
        const normalizedLocation = normalizeInventoryLocationName(location, "");
        const requestedQuantity = normalizeStockQuantity(quantity);
        const currentQuantity = normalizeStockQuantity(ingredient.locationStock?.[normalizedLocation] || 0);
        const removedQuantity = Math.min(currentQuantity, requestedQuantity);
        setIngredientLocationStock(ingredient, normalizedLocation, currentQuantity - removedQuantity);
        return removedQuantity;
    }
    function deductIngredientStock(ingredient, quantity, preferredLocation = "") {
        const preferred = normalizeInventoryLocationName(preferredLocation, "");
        const result = planStockDeduction(getIngredientLocationRows(ingredient), quantity, preferred);
        result.removals.forEach((removal) => {
            removeStockFromLocation(ingredient, removal.location, removal.quantity);
        });
        return result;
    }
    function pushInventoryHistory({ ingredient, type, quantity, fromLocation = "", toLocation = "", detail = "" }) {
        state.inventoryHistory.push({
            id: `INV-${Date.now()}-${state.inventoryHistory.length + 1}`,
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            type,
            quantity: normalizeStockQuantity(quantity),
            fromLocation: normalizeInventoryLocationName(fromLocation, ""),
            toLocation: normalizeInventoryLocationName(toLocation, ""),
            resultingStock: getIngredientTotalStock(ingredient),
            time: timeNow(),
            detail
        });
        state.inventoryHistory = state.inventoryHistory.slice(-80);
    }
    function pushWasteRecord({ ingredient, quantity, unitType, stockQuantity, reason, staffId, occurredAtMs, notes = "", fromLocation = "" }) {
        const staff = state.users.find((user) => user.id === staffId) || currentUser();
        const normalizedUnitType = normalizeWasteUnitType(unitType, ingredient);
        const normalizedQuantity = normalizeStockQuantity(quantity);
        const normalizedStockQuantity = normalizeStockQuantity(stockQuantity);
        const cost = getWasteCost(ingredient, normalizedStockQuantity);
        const record = {
            id: `WST-${Date.now()}-${state.wasteRecords.length + 1}`,
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            quantity: normalizedQuantity,
            unitType: normalizedUnitType,
            stockQuantity: normalizedStockQuantity,
            stockUnit: ingredient.unit,
            reason: normalizeWasteReason(reason),
            staffId: staff?.id || "",
            staffName: staff?.name || "Staff",
            occurredAtMs: normalizeOptionalTimestamp(occurredAtMs) || Date.now(),
            notes: String(notes || "").trim(),
            fromLocation: normalizeInventoryLocationName(fromLocation, ""),
            cost
        };
        const detailParts = [
            `${record.reason} waste recorded by ${record.staffName}: ${formatWasteQuantity(record)} ${ingredient.name}`,
            `${money(cost)} cost`
        ];
        if (record.notes)
            detailParts.push(record.notes);
        state.wasteRecords.push(record);
        state.wasteRecords = state.wasteRecords.slice(-120);
        pushInventoryHistory({
            ingredient,
            type: "waste",
            quantity: normalizedStockQuantity,
            fromLocation: record.fromLocation,
            detail: detailParts.join(". ")
        });
        state.productionLog.push({
            id: `LOG-${Date.now()}`,
            time: timeNow(),
            text: `Waste logged: ${formatWasteQuantity(record)} ${ingredient.name} (${record.reason}) cost ${money(cost)}.`
        });
        return record;
    }
    function recordWaste(formData, form = null) {
        if (!can("canRecordWaste")) {
            showToast("This role cannot record waste.");
            return;
        }
        const ingredient = ingredientById(formData.get("ingredientId"));
        if (!ingredient) {
            showToast("Choose a product before recording waste.");
            return;
        }
        const quantity = normalizeStockQuantity(formData.get("quantity"));
        const unitType = normalizeWasteUnitType(formData.get("unitType"), ingredient);
        const stockQuantity = convertWasteQuantityToStockUnits(ingredient, quantity, unitType);
        if (quantity <= 0 || stockQuantity <= 0) {
            showToast("Enter a waste quantity above zero.");
            return;
        }
        if (stockQuantity > ingredient.stock) {
            showToast(`Only ${formatStockAmount(ingredient.stock, ingredient.unit)} ${ingredient.name} is available.`);
            return;
        }
        const result = deductIngredientStock(ingredient, stockQuantity);
        const fromLocation = result.removals.map((removal) => removal.location).join(", ");
        const record = pushWasteRecord({
            ingredient,
            quantity,
            unitType,
            stockQuantity: result.removed,
            reason: formData.get("reason"),
            staffId: formData.get("staffId"),
            occurredAtMs: getFormDateTimeTimestamp(formData.get("occurredAt")),
            notes: formData.get("notes"),
            fromLocation
        });
        saveState();
        render();
        if (form) {
            form.elements.notes.value = "";
            form.elements.occurredAt.value = formatDateTimeLocalInput();
        }
        let toastText = `${formatWasteQuantity(record)} ${ingredient.name} waste recorded; ${formatStockAmount(ingredient.stock, ingredient.unit)} remains.`;
        if (getIngredientStatus(ingredient) === "danger") {
            toastText += ` Low-stock alert: reorder ${formatStockAmount(getSupplierOrderQuantity(ingredient), ingredient.unit)}.`;
        }
        showToast(toastText);
    }
    function applyInventoryAction(formData) {
        if (!can("canManageInventory")) {
            showToast("This role cannot change inventory.");
            return;
        }
        const ingredient = ingredientById(formData.get("ingredientId"));
        const action = String(formData.get("action") || "");
        const quantity = normalizeStockQuantity(formData.get("quantity"));
        const actionDefinition = INVENTORY_ACTIONS.find((item) => item.id === action);
        if (!ingredient || !actionDefinition) {
            showToast("Choose a purchased product and inventory action.");
            return;
        }
        const fromLocation = getSelectedInventoryLocation(formData, "fromLocation");
        const toLocation = getSelectedInventoryLocation(formData, "toLocation", "customLocation");
        const fromQuantity = normalizeStockQuantity(ingredient.locationStock?.[fromLocation] || 0);
        let toastText = "";
        if (action !== "correct" && quantity <= 0) {
            showToast("Enter a quantity above zero.");
            return;
        }
        if (action === "add") {
            if (!toLocation) {
                showToast("Choose the location receiving stock.");
                return;
            }
            addStockToLocation(ingredient, toLocation, quantity);
            pushInventoryHistory({
                ingredient,
                type: action,
                quantity,
                toLocation,
                detail: `Added ${formatStockAmount(quantity, ingredient.unit)} to ${toLocation}.`
            });
            toastText = `${formatStockAmount(quantity, ingredient.unit)} added to ${ingredient.name}.`;
        }
        if (action === "remove" || action === "waste") {
            if (!fromLocation) {
                showToast("Choose the location to reduce.");
                return;
            }
            if (quantity > fromQuantity) {
                showToast(`Only ${formatStockAmount(fromQuantity, ingredient.unit)} is in ${fromLocation}.`);
                return;
            }
            const removed = removeStockFromLocation(ingredient, fromLocation, quantity);
            if (action === "waste") {
                pushWasteRecord({
                    ingredient,
                    quantity: removed,
                    unitType: ingredient.unitType,
                    stockQuantity: removed,
                    reason: "Other",
                    staffId: currentUser()?.id,
                    occurredAtMs: Date.now(),
                    notes: "Marked wasted from stock action.",
                    fromLocation
                });
            }
            else {
                pushInventoryHistory({
                    ingredient,
                    type: action,
                    quantity: removed,
                    fromLocation,
                    detail: `Removed ${formatStockAmount(removed, ingredient.unit)} from ${fromLocation}.`
                });
            }
            toastText = `${ingredient.name} ${action === "waste" ? "waste" : "stock"} updated.`;
        }
        if (action === "transfer") {
            if (!fromLocation || !toLocation) {
                showToast("Choose both transfer locations.");
                return;
            }
            if (fromLocation === toLocation) {
                showToast("Choose two different locations for a transfer.");
                return;
            }
            if (quantity > fromQuantity) {
                showToast(`Only ${formatStockAmount(fromQuantity, ingredient.unit)} is in ${fromLocation}.`);
                return;
            }
            const removed = removeStockFromLocation(ingredient, fromLocation, quantity);
            addStockToLocation(ingredient, toLocation, removed);
            pushInventoryHistory({
                ingredient,
                type: action,
                quantity: removed,
                fromLocation,
                toLocation,
                detail: `Transferred ${formatStockAmount(removed, ingredient.unit)} from ${fromLocation} to ${toLocation}.`
            });
            toastText = `${ingredient.name} transferred to ${toLocation}.`;
        }
        if (action === "correct") {
            if (!toLocation) {
                showToast("Choose the location to correct.");
                return;
            }
            const previousQuantity = normalizeStockQuantity(ingredient.locationStock?.[toLocation] || 0);
            setIngredientLocationStock(ingredient, toLocation, quantity);
            pushInventoryHistory({
                ingredient,
                type: action,
                quantity,
                toLocation,
                detail: `Manual correction set ${toLocation} from ${formatStockAmount(previousQuantity, ingredient.unit)} to ${formatStockAmount(quantity, ingredient.unit)}.`
            });
            toastText = `${ingredient.name} count corrected.`;
        }
        saveState();
        render();
        const stockStatus = getIngredientStatus(ingredient);
        if (stockStatus === "danger")
            toastText += ` Low-stock alert: reorder ${formatStockAmount(getSupplierOrderQuantity(ingredient), ingredient.unit)}.`;
        if (stockStatus === "over")
            toastText += " Over-stock warning.";
        showToast(toastText);
    }
    function deductInventoryForItems(items, orderContext = DEFAULT_RECIPE_ORDER_CONTEXT) {
        const changes = [];
        getStockRequirementsForItems(items, orderContext).forEach((required, ingredientId) => {
            const ingredient = ingredientById(ingredientId);
            if (!ingredient)
                return;
            const result = deductIngredientStock(ingredient, required);
            pushInventoryHistory({
                ingredient,
                type: "remove",
                quantity: result.removed,
                fromLocation: result.removals.map((removal) => removal.location).join(", "),
                detail: `Order used ${formatStockAmount(result.removed, ingredient.unit)} ${ingredient.name}.`
            });
            changes.push({
                ingredient,
                required,
                removed: result.removed,
                resultingStock: ingredient.stock
            });
        });
        return changes;
    }
    function normalizeSupplierIntegrationMethod(method) {
        const candidate = String(method || "").trim();
        return SUPPLIER_INTEGRATION_METHODS.some((item) => item.id === candidate) ? candidate : "manual";
    }
    function supplierIntegrationLabel(method) {
        return SUPPLIER_INTEGRATION_METHODS.find((item) => item.id === method)?.label || "Manual order";
    }
    function selectSupplierForEdit(supplierId) {
        if (!can("canManageInventory"))
            return;
        const supplier = supplierById(supplierId);
        if (!supplier) {
            showToast("Supplier not found.");
            return;
        }
        state.supplierFormSupplierId = supplier.id;
        saveState();
        render();
    }
    function clearSupplierForm() {
        state.supplierFormSupplierId = "";
        const form = document.querySelector("#supplierForm");
        if (form) {
            form.reset();
            form.elements.supplierId.value = "";
        }
        saveState();
        render();
    }
    function saveSupplierRecord(formData) {
        if (!can("canManageInventory")) {
            showToast("This role cannot manage suppliers.");
            return;
        }
        const supplierId = String(formData.get("supplierId") || state.supplierFormSupplierId || "").trim();
        const name = String(formData.get("name") || "").replace(/\s+/g, " ").trim();
        const productsSupplied = [...new Set(formData.getAll("productsSupplied")
                .map((value) => String(value || "").trim())
                .filter((ingredientId) => ingredientById(ingredientId)))];
        const integrationMethod = normalizeSupplierIntegrationMethod(formData.get("integrationMethod"));
        const minimumOrderAmount = Math.max(0, Number(formData.get("minimumOrderAmount")) || 0);
        const deliveryDays = Math.max(0, Math.floor(Number(formData.get("deliveryDays")) || 0));
        if (!name) {
            showToast("Add a supplier name.");
            return;
        }
        const existing = supplierById(supplierId) || state.suppliers.find((supplier) => supplier.name.toLowerCase() === name.toLowerCase());
        const oldName = existing?.name || "";
        const nextSupplier = {
            id: existing?.id || uniqueRecordId(name, [state.suppliers]),
            name,
            contactPerson: String(formData.get("contactPerson") || "").replace(/\s+/g, " ").trim(),
            email: String(formData.get("email") || "").trim(),
            phone: String(formData.get("phone") || "").trim(),
            apiDetails: String(formData.get("apiDetails") || "").trim(),
            deliveryDays,
            minimumOrderAmount,
            productsSupplied,
            integrationMethod,
            autoSendAfterApproval: formData.get("autoSendAfterApproval") === "on"
        };
        if (existing) {
            Object.assign(existing, nextSupplier);
            if (oldName && oldName !== name) {
                state.ingredients
                    .filter((ingredient) => ingredient.supplier === oldName)
                    .forEach((ingredient) => {
                    ingredient.supplier = name;
                });
            }
        }
        else {
            state.suppliers.push(nextSupplier);
        }
        productsSupplied.forEach((ingredientId) => {
            const ingredient = ingredientById(ingredientId);
            if (ingredient)
                ingredient.supplier = name;
        });
        state.supplierFormSupplierId = "";
        saveState();
        render();
        showToast(`${name} supplier saved.`);
    }
    function getSupplierOrderQuantityInput(orderId, ingredientId, fallback) {
        const key = `${orderId}::${ingredientId}`;
        const input = [...document.querySelectorAll("[data-supplier-order-quantity]")]
            .find((element) => element.dataset.supplierOrderQuantity === key);
        return normalizeStockQuantity(input?.value ?? fallback);
    }
    function getSupplierReceivedQuantityInput(orderId, ingredientId, fallback) {
        const key = `${orderId}::${ingredientId}`;
        const input = [...document.querySelectorAll("[data-supplier-received-quantity]")]
            .find((element) => element.dataset.supplierReceivedQuantity === key);
        return normalizeStockQuantity(input?.value ?? fallback);
    }
    function findSupplierOrderByIdOrSupplier(value) {
        return state.supplierOrders.find((order) => order.id === value && order.status !== "Received")
            || getActiveSupplierOrder(value);
    }
    function markSupplierOrderSent(order) {
        const supplier = supplierById(order.supplierId) || state.suppliers.find((item) => item.name === order.supplier);
        const sentAt = timeNow();
        const method = normalizeSupplierIntegrationMethod(order.integrationMethod || supplier?.integrationMethod);
        order.status = "Sent";
        order.sentAt = sentAt;
        order.orderedAt = sentAt;
        order.integrationMethod = method;
        order.integrationReference = `${method.toUpperCase()}-${Date.now()}`;
        state.productionLog.push({
            id: `LOG-${Date.now()}`,
            time: sentAt,
            text: `Purchase order ${order.id} sent to ${order.supplier} using ${supplierIntegrationLabel(method)}.`
        });
    }
    function approveSupplierOrder(orderId) {
        if (!can("canManageInventory")) {
            showToast("This role cannot approve purchase orders.");
            return;
        }
        const draft = getSupplierOrderDrafts().find((order) => order.id === orderId);
        if (!draft || !draft.items.length) {
            showToast("No purchase order draft is ready.");
            return;
        }
        const supplier = supplierById(draft.supplierId) || state.suppliers.find((item) => item.name === draft.supplier);
        const activeOrder = state.supplierOrders.find((order) => order.id === draft.id && order.status !== "Received");
        const approvedAt = timeNow();
        const approvedOrder = {
            id: activeOrder?.id || `PO-${getSupplierKey(draft.supplier)}-${Date.now()}`,
            supplierId: supplier?.id || draft.supplierId || getSupplierKey(draft.supplier),
            supplier: draft.supplier,
            status: "Approved",
            createdAt: activeOrder?.createdAt || draft.createdAt || approvedAt,
            approvedAt,
            sentAt: "",
            orderedAt: "",
            receivedAt: "",
            integrationMethod: normalizeSupplierIntegrationMethod(draft.integrationMethod || supplier?.integrationMethod),
            integrationReference: "",
            items: draft.items
                .map((item) => {
                const quantity = getSupplierOrderQuantityInput(draft.id, item.ingredientId, item.quantity);
                return {
                    ingredientId: item.ingredientId,
                    quantity,
                    suggestedQuantity: normalizeStockQuantity(item.suggestedQuantity || item.quantity),
                    receivedQuantity: ""
                };
            })
                .filter((item) => item.quantity > 0)
        };
        if (!approvedOrder.items.length) {
            showToast("Enter at least one order quantity above zero.");
            return;
        }
        if (activeOrder) {
            Object.assign(activeOrder, approvedOrder);
        }
        else {
            state.supplierOrders.push(approvedOrder);
        }
        const order = activeOrder || approvedOrder;
        if (supplier?.autoSendAfterApproval)
            markSupplierOrderSent(order);
        saveState();
        render();
        showToast(`${approvedOrder.supplier} purchase order ${order.status === "Sent" ? "approved and sent" : "approved"}.`);
    }
    function sendSupplierOrder(orderId) {
        if (!can("canManageInventory")) {
            showToast("This role cannot send purchase orders.");
            return;
        }
        const order = findSupplierOrderByIdOrSupplier(orderId);
        if (!order || order.status !== "Approved") {
            showToast("Approve the purchase order before sending it.");
            return;
        }
        markSupplierOrderSent(order);
        saveState();
        render();
        showToast(`${order.supplier} purchase order sent using ${supplierIntegrationLabel(order.integrationMethod)}.`);
    }
    function markSupplierOrderOrdered(supplier) {
        const order = getSupplierOrderDrafts().find((item) => item.id === supplier || item.supplier === supplier || item.supplierId === supplier);
        if (!order) {
            showToast("No supplier order is ready.");
            return;
        }
        if (order.status === "Draft") {
            approveSupplierOrder(order.id);
            return;
        }
        if (order.status === "Approved")
            sendSupplierOrder(order.id);
    }
    function receiveSupplierOrder(orderId) {
        if (!can("canManageInventory")) {
            showToast("This role cannot receive purchase orders.");
            return;
        }
        const order = findSupplierOrderByIdOrSupplier(orderId);
        if (!order || (order.status !== "Sent" && order.status !== "Ordered")) {
            showToast("Send the purchase order before receiving it.");
            return;
        }
        const receivedLines = order.items.map((item) => {
            const ingredient = ingredientById(item.ingredientId);
            if (!ingredient)
                return null;
            const receivedQuantity = getSupplierReceivedQuantityInput(order.id, item.ingredientId, item.quantity);
            item.receivedQuantity = receivedQuantity;
            if (receivedQuantity <= 0)
                return null;
            const location = getIngredientPrimaryLocation(ingredient);
            addStockToLocation(ingredient, location, receivedQuantity);
            pushInventoryHistory({
                ingredient,
                type: "add",
                quantity: receivedQuantity,
                toLocation: location,
                detail: `Purchase order ${order.id} received from ${order.supplier}.`
            });
            return `${formatStockAmount(receivedQuantity, ingredient.unit)} ${ingredient.name}`;
        }).filter(Boolean);
        if (!receivedLines.length) {
            showToast("Enter at least one received quantity above zero.");
            return;
        }
        order.status = "Received";
        order.receivedAt = timeNow();
        state.productionLog.push({
            id: `LOG-${Date.now()}`,
            time: timeNow(),
            text: `Purchase order ${order.id} received from ${order.supplier}: ${receivedLines.join(", ")} added to stock.`
        });
        saveState();
        render();
        showToast(`${order.supplier} delivery received and inventory updated.`);
    }
    function logWaste() {
        if (!can("canRecordWaste")) {
            showToast("This role cannot record waste.");
            return;
        }
        const ingredient = ingredientById("kefta");
        if (!ingredient)
            return;
        const location = getIngredientPrimaryLocation(ingredient);
        if (ingredient.stock < 0.25) {
            showToast(`Only ${formatStockAmount(ingredient.stock, ingredient.unit)} Kefta is available.`);
            return;
        }
        const result = deductIngredientStock(ingredient, 0.25, location);
        pushWasteRecord({
            ingredient,
            quantity: result.removed,
            unitType: "kilograms",
            stockQuantity: result.removed,
            reason: "Dropped",
            staffId: currentUser()?.id,
            occurredAtMs: Date.now(),
            notes: "Quick kefta waste shortcut.",
            fromLocation: location
        });
        saveState();
        render();
        showToast("Waste logged and stock recalculated.");
    }
    function recordProduction(form) {
        if (!can("canManageProcedures")) {
            showToast("This role cannot record production.");
            return;
        }
        const draft = getProductionExecutionDraft(form);
        const readiness = getProductionReadiness(draft, form);
        const product = draft.product;
        if (!readiness.ok) {
            showToast(readiness.detail);
            updateProductionCostPreview();
            return;
        }
        const batchId = `BAT-${Date.now()}-${state.productionBatches.length + 1}`;
        const completedAt = timeNow();
        const completedAtMs = Date.now();
        const staff = currentUser();
        const actualUsages = draft.lines.map((line) => {
            const result = deductIngredientStock(line.ingredient, line.actualStockQuantity, getIngredientPrimaryLocation(line.ingredient));
            pushInventoryHistory({
                ingredient: line.ingredient,
                type: "remove",
                quantity: result.removed,
                fromLocation: result.removals.map((removal) => removal.location).join(", "),
                detail: `${product.name} batch ${batchId} used ${formatActualUsageLabel(line.actualUsage, line.measure)} ${line.ingredient.name} (${money(line.actualCost)} actual cost).`
            });
            return `${formatActualUsageLabel(line.actualUsage, line.measure)} ${line.ingredient.name}`;
        });
        if (draft.outputIngredient && draft.outputStockQuantity > 0) {
            addStockToLocation(draft.outputIngredient, draft.outputLocation, draft.outputStockQuantity);
            if (draft.outputUnitCost > 0)
                draft.outputIngredient.purchasePrice = draft.outputUnitCost;
            pushInventoryHistory({
                ingredient: draft.outputIngredient,
                type: "add",
                quantity: draft.outputStockQuantity,
                toLocation: draft.outputLocation,
                detail: `${product.name} batch ${batchId} produced ${formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit)} at ${money(draft.outputUnitCost)} per ${draft.outputIngredient.unit}.`
            });
        }
        product.lastProductionCost = draft.actualCost;
        product.lastProductionPlannedCost = draft.plannedCost;
        product.lastProductionMargin = draft.actualMargin;
        product.lastProductionCostDelta = draft.costDelta;
        product.lastProductionAt = completedAt;
        product.lastProductionAtMs = completedAtMs;
        state.productionBatches.push({
            id: batchId,
            productId: product.id,
            productName: product.name,
            completedById: staff?.id || "",
            completedByName: staff?.name || "Staff",
            completedAt,
            completedAtMs,
            plannedCost: draft.plannedCost,
            actualCost: draft.actualCost,
            costDelta: draft.costDelta,
            plannedMargin: draft.plannedMargin,
            actualMargin: draft.actualMargin,
            marginDelta: draft.marginDelta,
            outputIngredientId: draft.outputIngredient?.id || "",
            outputIngredientName: draft.outputIngredient?.name || "",
            outputQuantity: draft.outputQuantity,
            outputUnitType: draft.outputUnitType,
            outputStockQuantity: draft.outputStockQuantity,
            outputUnitCost: draft.outputUnitCost,
            outputLocation: draft.outputLocation,
            lines: draft.lines.map((line) => ({
                ingredientId: line.ingredient.id,
                ingredientName: line.ingredient.name,
                measure: line.measure,
                plannedUsage: line.plannedUsage,
                actualUsage: line.actualUsage,
                plannedStockQuantity: line.plannedStockQuantity,
                actualStockQuantity: line.actualStockQuantity,
                plannedCost: line.plannedCost,
                actualCost: line.actualCost
            }))
        });
        state.productionBatches = state.productionBatches.slice(-80);
        const outputText = draft.outputIngredient
            ? ` Added ${formatStockAmount(draft.outputStockQuantity, draft.outputIngredient.unit)} ${draft.outputIngredient.name} at ${money(draft.outputUnitCost)} per ${draft.outputIngredient.unit}.`
            : "";
        const marginText = draft.actualMargin === null ? "" : ` Margin ${draft.actualMargin.toFixed(1)}% (${formatSignedAmount(draft.marginDelta, " pts")}).`;
        state.productionLog.push({
            id: `LOG-${Date.now()}`,
            time: completedAt,
            text: `${product.name} batch complete: ${actualUsages.join(", ")}. Actual cost ${money(draft.actualCost)} (${money(draft.costDelta)} vs planned).${marginText}${outputText}`
        });
        saveState();
        render();
        renderProductionRecipeFields({ reset: true });
        const productionForm = document.querySelector("#productionForm");
        if (productionForm?.elements?.prepComplete)
            productionForm.elements.prepComplete.checked = false;
        updateProductionCostPreview();
        showToast("Batch result saved; inventory and actual cost updated.");
    }
    return {
        approveSupplierOrder,
        applyInventoryAction,
        clearSupplierForm,
        deductInventoryForItems,
        getSelectedInventoryLocation,
        logWaste,
        markSupplierOrderOrdered,
        pushInventoryHistory,
        receiveSupplierOrder,
        recordProduction,
        recordWaste,
        rememberInventoryLocation,
        saveSupplierRecord,
        selectSupplierForEdit,
        sendSupplierOrder
    };
}
//# sourceMappingURL=inventory-actions.js.map