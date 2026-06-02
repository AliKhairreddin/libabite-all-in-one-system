import { resolveScanCode } from "../domain/scanning.js";
import { CUSTOMER_QR_CHANNEL } from "../shared/constants.js";
import { timeNow } from "../shared/dates.js";
import { saveState, state } from "./state.js";

const INVENTORY_SCAN_ACTION_LABELS = {
  add: "add stock",
  remove: "remove stock",
  transfer: "transfer stock",
  correct: "correct count",
  waste: "record waste"
};

export function createScanningRuntime(deps) {
  const document: any = window.document;
  const {
    can,
    canView,
    getAllInventoryLocations,
    ingredientById,
    productById,
    render,
    renderInventoryActionForm,
    renderOrderBuilder,
    renderProductsInSelects,
    renderWasteForms,
    showToast,
    tableById
  } = deps;

  function setActiveScan(result, status = "ok") {
    state.activeScan = {
      code: result.code || "",
      scanType: result.scanType || "unknown",
      targetKind: result.targetKind || "",
      targetId: result.targetId || "",
      label: result.label || "",
      message: result.message || "",
      status,
      scannedAt: timeNow()
    };
  }

  function scrollToElement(selector) {
    const element = document.querySelector(selector);
    element?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    return element;
  }

  function focusQuietly(element) {
    element?.focus?.({ preventScroll: true });
  }

  function selectInventoryActionProduct(ingredientId, action = "add") {
    const ingredientSelect: any = document.querySelector("#inventoryActionIngredient");
    if (ingredientSelect) ingredientSelect.value = ingredientId;

    const actionSelect: any = document.querySelector("#inventoryActionType");
    if (actionSelect && action !== "waste") actionSelect.value = action;

    renderInventoryActionForm();
    scrollToElement("#inventoryActionPanel");
    focusQuietly(document.querySelector("#inventoryActionQuantity"));
  }

  function selectWasteProduct(ingredientId) {
    const wasteForm: any = [...document.querySelectorAll("[data-waste-form]")][0];
    const productSelect: any = wasteForm?.querySelector("[data-waste-product]");
    if (productSelect) productSelect.value = ingredientId;
    renderWasteForms();
    scrollToElement(".staff-waste-panel");
    focusQuietly(wasteForm?.querySelector("[name='quantity']"));
  }

  function openIngredientInventory(result, action = "add") {
    if (!ingredientById(result.targetId)) {
      showToast("Scanned product is no longer in inventory.");
      return false;
    }

    setActiveScan(result);

    if (!canView("inventory")) {
      saveState();
      render();
      showToast(`${result.label} recognized, but this role cannot open inventory.`);
      return false;
    }

    state.activeView = "inventory";
    saveState();
    render();

    if (action === "waste") selectWasteProduct(result.targetId);
    else selectInventoryActionProduct(result.targetId, action);

    showToast(result.message);
    return true;
  }

  function openRecipe(result) {
    const product = productById(result.targetId);
    if (!product) {
      showToast("Scanned recipe is no longer available.");
      return false;
    }

    setActiveScan(result);
    if (canView("inventory")) state.activeView = "inventory";
    saveState();
    render();
    scrollToElement("#recipeList");
    showToast(result.message);
    return true;
  }

  function openTableOrder(result) {
    const table = tableById(result.targetId);
    if (!table) {
      showToast("Scanned table is no longer available.");
      return false;
    }

    setActiveScan(result);
    if (!canView("orders") || !can("canCreateOrders")) {
      saveState();
      render();
      showToast(`${table.name} recognized, but this role cannot create table orders.`);
      return false;
    }

    state.activeView = "orders";
    saveState();
    render();

    const orderForm: any = document.querySelector("#orderForm");
    if (orderForm?.elements.channel) orderForm.elements.channel.value = CUSTOMER_QR_CHANNEL;
    renderProductsInSelects();
    if (orderForm?.elements.tableId) orderForm.elements.tableId.value = table.id;
    renderOrderBuilder();
    scrollToElement("#orderForm");
    showToast(result.message);
    return true;
  }

  function openStorageLocation(result) {
    setActiveScan(result);
    if (canView("inventory")) state.activeView = "inventory";
    saveState();
    render();
    scrollToElement("#ingredientRows");
    showToast(result.message);
    return true;
  }

  function openGenericScan(result) {
    setActiveScan(result);
    saveState();
    render();
    showToast(result.message);
    return true;
  }

  function scanCode(formData) {
    const result = resolveScanCode(formData.get("code"), {
      ingredients: state.ingredients,
      products: state.products,
      tableQrCodes: state.tableQrCodes,
      tables: state.tables,
      users: state.users,
      locations: getAllInventoryLocations()
    });

    if (!result.ok) {
      setActiveScan(result, "error");
      saveState();
      render();
      showToast(result.message);
      return false;
    }

    if (result.targetKind === "ingredient") return openIngredientInventory(result);
    if (result.targetKind === "product") return openRecipe(result);
    if (result.targetKind === "table") return openTableOrder(result);
    if (result.targetKind === "location") return openStorageLocation(result);
    return openGenericScan(result);
  }

  function applyScannedInventoryAction(action) {
    const scan = state.activeScan || {};
    if (scan.targetKind !== "ingredient" || !ingredientById(scan.targetId)) {
      showToast("Scan a purchased product first.");
      return;
    }

    const actionId = INVENTORY_SCAN_ACTION_LABELS[action] ? action : "add";
    if (!canView("inventory")) {
      showToast("This role cannot open inventory.");
      return;
    }

    state.activeView = "inventory";
    saveState();
    render();

    if (actionId === "waste") selectWasteProduct(scan.targetId);
    else selectInventoryActionProduct(scan.targetId, actionId);

    showToast(`${scan.label || "Product"} ready to ${INVENTORY_SCAN_ACTION_LABELS[actionId]}.`);
  }

  return {
    applyScannedInventoryAction,
    scanCode
  };
}
