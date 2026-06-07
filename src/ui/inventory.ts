import { state } from "../app/state.js";
import {
  AVAILABILITY_OPTIONS,
  DEFAULT_MARGIN_MINIMUM,
  DEFAULT_MARGIN_TARGET,
  DEFAULT_PRODUCT_AVAILABILITY,
  DEFAULT_RECIPE_ORDER_CONTEXT,
  INVENTORY_ACTIONS,
  KITCHEN_STATIONS,
  PRECAUTIONARY_ALLERGEN_STATUSES,
  PRODUCT_CATEGORIES,
  PRODUCT_ALLERGENS,
  RECIPE_APPLIES_OPTIONS,
  SUPPLIER_INTEGRATION_METHODS,
  TAKEAWAY_DELIVERY_RECIPE_CONTEXT,
  UNIT_TYPES,
  VAT_OPTIONS,
  WASTE_REASONS
} from "../shared/constants.js";
import { formatDateTime } from "../shared/dates.js";
import { escapeHtml } from "../shared/html.js";
import { SCAN_TYPES, scanTypeLabel } from "../domain/scanning.js";

export function createInventoryUi(deps) {
  const document: any = window.document;
  const {
    can,
    alertCard,
    convertActualUsageToStockUnits,
    convertRecipeLineToStockUnits,
    convertWasteQuantityToStockUnits,
    emptyState,
    formatLocationOptionLabel,
    formatDateTimeLocalInput,
    formatSignedAmount,
    formatStockAmount,
    formatWasteQuantity,
    getActiveSupplierOrder,
    getAllInventoryLocations,
    getDefaultProductionProductId,
    getIngredientLocationRows,
    getIngredientPrimaryLocation,
    getIngredientStatus,
    getItemsTotal,
    getLineCost,
    getLowStockIngredients,
    getOverStockIngredients,
    getProductCost,
    getProductGrossMargin,
    getProductMargin,
    getProductMarginProfile,
    getRecipeMeasure,
    getRecipeMeasureOptionsForIngredient,
    getRecipeUsageLabel,
    getSupplierOrderDrafts,
    getSupplierMinimumOrderGap,
    getSupplierOrderPayload,
    getSupplierOrderQuantity,
    getSupplierOrderTotal,
    getWasteCost,
    getWasteReportSummary,
    getWasteUnitOptionsForIngredient,
    ingredientById,
    inventoryActionLabel,
    money,
    currentUser,
    normalizeInventoryLocationName,
    normalizeKitchenStation,
    normalizeMarginPercent,
    normalizeRecipeAppliesTo,
    normalizeWasteReason,
    normalizeWasteUnitType,
    normalizeStockQuantity,
    productAvailabilityLabel,
    productById,
    productHasConditionalRecipeLines,
    roundMoneyValue,
    supplierById,
    supplierForIngredient,
    unitTypeDefinition,
    wasteUnitLabel
  } = deps;

  function renderProductManagement() {
    document.querySelectorAll(".admin-product-only").forEach((panel) => {
      panel.hidden = !can("canManageProducts");
    });
  
    renderSellableProductForm();
    renderPurchasedProductForm();
  }
  
  function renderSellableRecipeCostPreview() {
    const form = document.querySelector("#sellableProductForm");
    const summary = document.querySelector("#sellableRecipeSummary");
    if (!form || !summary) return;
  
    const price = Math.max(0, Number(form.elements.price.value) || 0);
    const targetMargin = normalizeMarginPercent(form.elements.targetMargin?.value, DEFAULT_MARGIN_TARGET);
    const minMargin = Math.min(targetMargin, normalizeMarginPercent(form.elements.minMargin?.value, DEFAULT_MARGIN_MINIMUM));
    const draftProduct = {
      price,
      targetMargin,
      minMargin,
      recipe: state.productRecipeDraft
    };
    const baseCost = getProductCost(draftProduct, DEFAULT_RECIPE_ORDER_CONTEXT);
    const takeawayCost = getProductCost(draftProduct, TAKEAWAY_DELIVERY_RECIPE_CONTEXT);
    const baseMargin = price ? getProductMargin(draftProduct, DEFAULT_RECIPE_ORDER_CONTEXT) : 0;
    const takeawayMargin = price ? getProductMargin(draftProduct, TAKEAWAY_DELIVERY_RECIPE_CONTEXT) : 0;
    const hasConditionalLines = productHasConditionalRecipeLines(draftProduct);
    const worstMargin = hasConditionalLines ? Math.min(baseMargin, takeawayMargin) : baseMargin;
    const pillClass = !price || !state.productRecipeDraft.length
      ? "info"
      : worstMargin < minMargin
        ? "danger"
        : worstMargin < targetMargin
          ? "warning"
          : "ok";
    const pillText = !price || !state.productRecipeDraft.length
      ? "Waiting"
      : worstMargin < minMargin
        ? "Below minimum"
        : worstMargin < targetMargin
          ? "Below target"
          : "On target";
  
    summary.innerHTML = `
      <div class="cost-preview-title">
        <strong>Recipe cost preview</strong>
        <span class="pill ${pillClass}">${escapeHtml(pillText)}</span>
      </div>
      <div class="cost-grid">
        <span>Base cost</span><strong>${escapeHtml(money(baseCost))}</strong>
        <span>Gross margin</span><strong>${escapeHtml(money(Math.max(0, price - baseCost)))}</strong>
        <span>Margin %</span><strong>${baseMargin.toFixed(1)}%</strong>
        ${hasConditionalLines ? `
          <span>Takeaway/delivery cost</span><strong>${escapeHtml(money(takeawayCost))}</strong>
          <span>Takeaway/delivery margin</span><strong>${takeawayMargin.toFixed(1)}%</strong>
        ` : ""}
      </div>
    `;
  }
  
  function renderSellableProductForm() {
    const form = document.querySelector("#sellableProductForm");
    const categorySelect = document.querySelector("#sellableCategory");
    const stationSelect = document.querySelector("#sellableStation");
    const vatSelect = document.querySelector("#sellableVat");
    const allergenChecks = document.querySelector("#sellableAllergenChecks");
    const precautionaryAllergenStatusSelect: any = document.querySelector("#sellablePrecautionaryAllergenStatus");
    const availabilityChecks = document.querySelector("#sellableAvailabilityChecks");
    const ingredientSelect = document.querySelector("#sellableRecipeIngredient");
    const measureSelect = document.querySelector("#sellableRecipeMeasure");
    const recipeStationSelect = document.querySelector("#sellableRecipeStation");
    const appliesSelect = document.querySelector("#sellableRecipeAppliesTo");
    const draftPanel = document.querySelector("#sellableRecipeDraft");
    const addRecipeButton = document.querySelector("#addRecipeLineBtn");
    const createButton = document.querySelector("#createSellableProductBtn");
    if (!form || !categorySelect || !stationSelect || !vatSelect || !allergenChecks || !availabilityChecks || !ingredientSelect || !measureSelect || !recipeStationSelect || !appliesSelect || !draftPanel || !addRecipeButton || !createButton) return;
    const editable = can("canManageProducts");
  
    const selectedCategory = categorySelect.value || PRODUCT_CATEGORIES[0];
    categorySelect.innerHTML = PRODUCT_CATEGORIES
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join("");
    categorySelect.value = PRODUCT_CATEGORIES.includes(selectedCategory) ? selectedCategory : PRODUCT_CATEGORIES[0];
  
    const stations = [...new Set([...KITCHEN_STATIONS, ...state.products.map((product) => normalizeKitchenStation(product.station)).filter(Boolean)])];
    const selectedStation = normalizeKitchenStation(stationSelect.value || stations[0]);
    stationSelect.innerHTML = stations
      .map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`)
      .join("");
    stationSelect.value = stations.includes(selectedStation) ? selectedStation : stations[0];
  
    const selectedRecipeStation = normalizeKitchenStation(recipeStationSelect.value || stationSelect.value || stations[0]);
    recipeStationSelect.innerHTML = stations
      .map((station) => `<option value="${escapeHtml(station)}">${escapeHtml(station)}</option>`)
      .join("");
    recipeStationSelect.value = stations.includes(selectedRecipeStation) ? selectedRecipeStation : stationSelect.value || stations[0];
  
    const selectedVat = vatSelect.value || "reduced";
    vatSelect.innerHTML = VAT_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
      .join("");
    vatSelect.value = VAT_OPTIONS.some((option) => option.id === selectedVat) ? selectedVat : "reduced";

    const previousAllergens = [...allergenChecks.querySelectorAll("input[name='allergens']:checked")].map((input) => input.value);
    const selectedAllergens = new Set(previousAllergens);
    allergenChecks.innerHTML = PRODUCT_ALLERGENS
      .map((allergen) => `
        <label class="check-row">
          <input name="allergens" type="checkbox" value="${escapeHtml(allergen.id)}" ${selectedAllergens.has(allergen.id) ? "checked" : ""}>
          <span>${escapeHtml(allergen.label)}</span>
        </label>
      `)
      .join("");

    if (precautionaryAllergenStatusSelect) {
      const selectedStatus = precautionaryAllergenStatusSelect.value || "ask_staff";
      precautionaryAllergenStatusSelect.innerHTML = PRECAUTIONARY_ALLERGEN_STATUSES
        .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status === "none" ? "None" : status === "may_contain" ? "May contain traces" : "Ask staff")}</option>`)
        .join("");
      precautionaryAllergenStatusSelect.value = PRECAUTIONARY_ALLERGEN_STATUSES.includes(selectedStatus) ? selectedStatus : "ask_staff";
    }
  
    const previousChecks = [...availabilityChecks.querySelectorAll("input[name='availability']:checked")].map((input) => input.value);
    const selectedAvailability = new Set(previousChecks.length ? previousChecks : AVAILABILITY_OPTIONS
      .filter((option) => DEFAULT_PRODUCT_AVAILABILITY[option.id])
      .map((option) => option.id));
    availabilityChecks.innerHTML = AVAILABILITY_OPTIONS
      .map((option) => `
        <label class="check-row">
          <input name="availability" type="checkbox" value="${escapeHtml(option.id)}" ${selectedAvailability.has(option.id) ? "checked" : ""}>
          <span>${escapeHtml(option.label)}</span>
        </label>
      `)
      .join("");
  
    const activeIngredients = state.ingredients.filter((ingredient) => ingredient.active);
    const selectedIngredient = ingredientSelect.value || activeIngredients[0]?.id || "";
    ingredientSelect.innerHTML = activeIngredients
      .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(ingredient.supplier)}</option>`)
      .join("");
    ingredientSelect.value = activeIngredients.some((ingredient) => ingredient.id === selectedIngredient) ? selectedIngredient : activeIngredients[0]?.id || "";
  
    const selectedIngredientRecord = ingredientById(ingredientSelect.value);
    const measureOptions = getRecipeMeasureOptionsForIngredient(selectedIngredientRecord);
    const selectedMeasure = measureSelect.value || measureOptions[0]?.id || "units";
    measureSelect.innerHTML = measureOptions
      .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
      .join("");
    measureSelect.value = measureOptions.some((option) => option.id === selectedMeasure) ? selectedMeasure : measureOptions[0]?.id || "units";
  
    const selectedAppliesTo = appliesSelect.value || "all";
    appliesSelect.innerHTML = RECIPE_APPLIES_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`)
      .join("");
    appliesSelect.value = RECIPE_APPLIES_OPTIONS.some((option) => option.id === selectedAppliesTo) ? selectedAppliesTo : "all";
  
    draftPanel.innerHTML = state.productRecipeDraft.length
      ? `
        <div class="draft-summary">
          <strong>Recipe links</strong>
          <span class="draft-meta">${state.productRecipeDraft.length} lines</span>
        </div>
        <div class="draft-lines">
          ${state.productRecipeDraft.map((line, index) => {
            const ingredient = ingredientById(line.ingredientId);
            if (!ingredient) return "";
            return `
              <div class="draft-line">
                <div>
                  <strong>${escapeHtml(ingredient.name)}</strong>
                  <p>${escapeHtml(getRecipeUsageLabel(line))} · ${escapeHtml(money(getLineCost(line)))} cost</p>
                  <p class="line-detail">${escapeHtml(line.station || "Main kitchen")} · ${escapeHtml(RECIPE_APPLIES_OPTIONS.find((option) => option.id === line.appliesTo)?.label || "Every order")}${line.notes ? ` · ${escapeHtml(line.notes)}` : ""}</p>
                </div>
                <button class="mini-btn" type="button" data-remove-recipe-line="${index}" aria-label="Remove ${escapeHtml(ingredient.name)}">Remove</button>
              </div>
            `;
          }).join("")}
        </div>
      `
      : `<p class="draft-empty">No purchased products linked yet.</p>`;
  
    form.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !editable;
    });
    ingredientSelect.disabled = !editable || !activeIngredients.length;
    measureSelect.disabled = !editable || !activeIngredients.length;
    recipeStationSelect.disabled = !editable || !activeIngredients.length;
    appliesSelect.disabled = !editable || !activeIngredients.length;
    addRecipeButton.disabled = !editable || !activeIngredients.length;
    createButton.disabled = !editable || !state.productRecipeDraft.length;
    renderSellableRecipeCostPreview();
  }
  
  function renderPurchasedProductForm() {
    const form = document.querySelector("#purchasedProductForm");
    const unitSelect = document.querySelector("#purchasedUnitType");
    const locationSelect = document.querySelector("#purchasedLocation");
    if (!form || !unitSelect || !locationSelect) return;
  
    const selectedUnit = unitSelect.value || "kilograms";
    unitSelect.innerHTML = UNIT_TYPES
      .map((unitType) => `<option value="${escapeHtml(unitType.id)}">${escapeHtml(unitType.label)}</option>`)
      .join("");
    unitSelect.value = UNIT_TYPES.some((unitType) => unitType.id === selectedUnit) ? selectedUnit : "kilograms";
  
    const selectedLocation = locationSelect.value || "Fridge";
    const locations = getAllInventoryLocations();
    locationSelect.innerHTML = locations
      .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`)
      .join("");
    locationSelect.value = locations.includes(selectedLocation) ? selectedLocation : locations[0] || "Dry storage";
  
    form.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !can("canManageProducts");
    });
  }

  function supplierIntegrationOptionsHtml(selectedMethod = "manual") {
    const selected = SUPPLIER_INTEGRATION_METHODS.some((method) => method.id === selectedMethod) ? selectedMethod : "manual";
    return SUPPLIER_INTEGRATION_METHODS
      .map((method) => `<option value="${escapeHtml(method.id)}" ${method.id === selected ? "selected" : ""}>${escapeHtml(method.label)}</option>`)
      .join("");
  }

  function supplierProductsLabel(supplier) {
    const productNames = (supplier.productsSupplied || [])
      .map((ingredientId) => ingredientById(ingredientId)?.name)
      .filter(Boolean);
    return productNames.length ? productNames.join(", ") : "No products linked";
  }

  function supplierCard(supplier) {
    const integrationLabel = SUPPLIER_INTEGRATION_METHODS.find((method) => method.id === supplier.integrationMethod)?.label || "Manual order";
    const contactParts = [
      supplier.contactPerson,
      supplier.email,
      supplier.phone
    ].filter(Boolean);
    return `
      <article class="supplier-card">
        <header>
          <div>
            <strong>${escapeHtml(supplier.name)}</strong>
            <p>${escapeHtml(contactParts.join(" | ") || "No contact details")}</p>
          </div>
          <span class="pill info">${escapeHtml(integrationLabel)}</span>
        </header>
        <div class="supplier-detail-grid">
          <span>Delivery</span><strong>${supplier.deliveryDays ? `${supplier.deliveryDays} days` : "Not set"}</strong>
          <span>Minimum order</span><strong>${escapeHtml(money(supplier.minimumOrderAmount || 0))}</strong>
          <span>Products</span><strong>${escapeHtml(supplierProductsLabel(supplier))}</strong>
          <span>Auto-send</span><strong>${supplier.autoSendAfterApproval ? "After approval" : "Manual send"}</strong>
        </div>
        ${supplier.apiDetails ? `<p class="line-detail">${escapeHtml(supplier.apiDetails)}</p>` : ""}
        <div class="mini-actions">
          <button class="mini-btn" type="button" data-edit-supplier="${escapeHtml(supplier.id)}">Edit</button>
        </div>
      </article>
    `;
  }

  function renderSupplierManagement() {
    document.querySelectorAll(".supplier-management-panel").forEach((panel) => {
      panel.hidden = !can("canManageInventory");
    });

    const form = document.querySelector("#supplierForm");
    const methodSelect = document.querySelector("#supplierIntegrationMethod");
    const productChecks = document.querySelector("#supplierProductChecks");
    const supplierList = document.querySelector("#supplierList");
    if (!form || !methodSelect || !productChecks || !supplierList) return;

    const editable = can("canManageInventory");
    const selectedSupplier = supplierById(state.supplierFormSupplierId);
    const previousProductIds = [...productChecks.querySelectorAll("input[name='productsSupplied']:checked")].map((input) => input.value);
    const selectedProductIds = new Set(selectedSupplier ? selectedSupplier.productsSupplied || [] : previousProductIds);

    if (selectedSupplier) {
      form.elements.supplierId.value = selectedSupplier.id;
      form.elements.name.value = selectedSupplier.name;
      form.elements.contactPerson.value = selectedSupplier.contactPerson || "";
      form.elements.email.value = selectedSupplier.email || "";
      form.elements.phone.value = selectedSupplier.phone || "";
      form.elements.deliveryDays.value = selectedSupplier.deliveryDays || 0;
      form.elements.minimumOrderAmount.value = selectedSupplier.minimumOrderAmount || 0;
      form.elements.apiDetails.value = selectedSupplier.apiDetails || "";
      form.elements.autoSendAfterApproval.checked = Boolean(selectedSupplier.autoSendAfterApproval);
    } else if (!form.elements.supplierId.value) {
      form.elements.name.value = form.elements.name.value || "";
      form.elements.contactPerson.value = form.elements.contactPerson.value || "";
      form.elements.email.value = form.elements.email.value || "";
      form.elements.phone.value = form.elements.phone.value || "";
      form.elements.deliveryDays.value = form.elements.deliveryDays.value || 2;
      form.elements.minimumOrderAmount.value = form.elements.minimumOrderAmount.value || 0;
      form.elements.apiDetails.value = form.elements.apiDetails.value || "";
    }

    methodSelect.innerHTML = supplierIntegrationOptionsHtml(selectedSupplier?.integrationMethod || methodSelect.value || "manual");
    productChecks.innerHTML = state.ingredients.length
      ? state.ingredients.map((ingredient) => `
        <label class="check-row">
          <input name="productsSupplied" type="checkbox" value="${escapeHtml(ingredient.id)}" ${selectedProductIds.has(ingredient.id) ? "checked" : ""}>
          <span>${escapeHtml(ingredient.name)}</span>
        </label>
      `).join("")
      : `<p class="draft-empty">Create purchased products before linking suppliers.</p>`;

    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
      element.disabled = !editable;
    });

    supplierList.innerHTML = state.suppliers.length
      ? state.suppliers.map(supplierCard).join("")
      : emptyState("No suppliers saved yet.");
  }
  
  function getLocationSummaryText(ingredient) {
    const rows = getIngredientLocationRows(ingredient);
    return rows.length
      ? rows.map((row) => `${formatStockAmount(row.quantity, ingredient.unit)} ${row.location}`).join(", ")
      : "No stock recorded";
  }

  function renderScanTypePills() {
    const container = document.querySelector("#scanTypeList");
    if (!container) return;
    container.innerHTML = SCAN_TYPES
      .map((type) => `<span class="scan-type-pill">${escapeHtml(type.label)}</span>`)
      .join("");
  }

  function activeScanResultHtml() {
    const scan = state.activeScan;
    if (!scan) return emptyState("No scan yet.");

    if (scan.status === "error") {
      return `
        <article class="scan-result-card is-error">
          <header>
            <div>
              <strong>Scan not matched</strong>
              <p>${escapeHtml(scan.code || "No code")}</p>
            </div>
            <span class="pill danger">Unknown</span>
          </header>
          <p>${escapeHtml(scan.message || "No matching record found.")}</p>
        </article>
      `;
    }

    if (scan.targetKind === "ingredient") {
      const ingredient = ingredientById(scan.targetId);
      if (!ingredient) return emptyState("Scanned product is no longer available.");
      const status = getIngredientStatus(ingredient);
      const statusClass = status === "danger" ? "danger" : status === "over" || status === "warning" ? "warning" : "ok";
      const statusLabel = status === "danger" ? "Low stock" : status === "over" ? "Over stock" : status === "warning" ? "Watch" : "OK";
      return `
        <article class="scan-result-card">
          <header>
            <div>
              <strong>${escapeHtml(ingredient.name)}</strong>
              <p>${escapeHtml(scanTypeLabel(scan.scanType))} | ${escapeHtml(scan.code || ingredient.barcode || ingredient.id)}</p>
            </div>
            <span class="pill ${statusClass}">${escapeHtml(statusLabel)}</span>
          </header>
          <div class="scan-result-grid">
            <span>Stock</span><strong>${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</strong>
            <span>Location</span><strong>${escapeHtml(getLocationSummaryText(ingredient))}</strong>
            <span>Supplier</span><strong>${escapeHtml(supplierForIngredient(ingredient)?.name || ingredient.supplier)}</strong>
            <span>Last scan</span><strong>${escapeHtml(scan.scannedAt || "-")}</strong>
          </div>
          <div class="mini-actions scan-result-actions">
            <button class="mini-btn" type="button" data-scan-inventory-action="add">Add stock</button>
            <button class="mini-btn" type="button" data-scan-inventory-action="remove">Remove stock</button>
            <button class="mini-btn" type="button" data-scan-inventory-action="transfer">Transfer</button>
            <button class="mini-btn danger-action" type="button" data-scan-inventory-action="waste">Waste</button>
          </div>
        </article>
      `;
    }

    if (scan.targetKind === "product") {
      const product = productById(scan.targetId);
      if (!product) return emptyState("Scanned recipe is no longer available.");
      return `
        <article class="scan-result-card">
          <header>
            <div>
              <strong>${escapeHtml(product.name)}</strong>
              <p>${escapeHtml(scanTypeLabel(scan.scanType))} | ${escapeHtml(product.code || product.id)}</p>
            </div>
            <span class="pill info">Recipe</span>
          </header>
          <p>${escapeHtml(scan.message || "Recipe opened.")}</p>
        </article>
      `;
    }

    return `
      <article class="scan-result-card">
        <header>
          <div>
            <strong>${escapeHtml(scan.label || scan.code || "Scan")}</strong>
            <p>${escapeHtml(scanTypeLabel(scan.scanType))} | ${escapeHtml(scan.code || "")}</p>
          </div>
          <span class="pill info">Recognized</span>
        </header>
        <p>${escapeHtml(scan.message || "Scan recognized.")}</p>
      </article>
    `;
  }

  function renderScannerPanel() {
    renderScanTypePills();
    const resultPanel = document.querySelector("#staffScanResult");
    if (resultPanel) resultPanel.innerHTML = activeScanResultHtml();
  }
  
  function locationStockHtml(ingredient) {
    const rows = getIngredientLocationRows(ingredient);
    if (!rows.length) return `<span class="table-subtext">No stock recorded</span>`;
    return `
      <div class="location-stack">
        ${rows.map((row) => `
          <div class="location-line">
            <span>${escapeHtml(row.location)}</span>
            <strong>${escapeHtml(formatStockAmount(row.quantity, ingredient.unit))}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }
  
  function overStockCard(ingredient) {
    const overage = normalizeStockQuantity(ingredient.stock - ingredient.max);
    return `
      <article class="alert-card warning">
        <div class="card-title">
          <strong>${escapeHtml(ingredient.name)}</strong>
          <span class="pill warning">${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</span>
        </div>
        <p>Above ${ingredient.max} ${escapeHtml(ingredient.unit)} by ${escapeHtml(formatStockAmount(overage, ingredient.unit))}. ${escapeHtml(getLocationSummaryText(ingredient))}.</p>
      </article>
    `;
  }
  
  function inventoryHistoryCard(entry) {
    const ingredient = ingredientById(entry.ingredientId);
    const unit = ingredient?.unit || "";
    const route = entry.fromLocation && entry.toLocation
      ? `${entry.fromLocation} to ${entry.toLocation}`
      : entry.fromLocation || entry.toLocation || "Stock";
    return `
      <article class="log-card">
        <div class="card-title">
          <strong>${escapeHtml(entry.ingredientName || ingredient?.name || "Purchased product")}</strong>
          <span class="pill info">${escapeHtml(inventoryActionLabel(entry.type))}</span>
        </div>
        <p><strong>${escapeHtml(entry.time)}</strong> ${escapeHtml(formatStockAmount(entry.quantity, unit))} | ${escapeHtml(route)} | Total ${escapeHtml(formatStockAmount(entry.resultingStock, unit))}</p>
        ${entry.detail ? `<p>${escapeHtml(entry.detail)}</p>` : ""}
      </article>
    `;
  }
  
  function wasteReasonOptionsHtml(selectedReason = "Spoiled") {
    const selected = normalizeWasteReason(selectedReason || "Spoiled");
    return WASTE_REASONS
      .map((reason) => `<option value="${escapeHtml(reason.id)}" ${reason.id === selected ? "selected" : ""}>${escapeHtml(reason.label)}</option>`)
      .join("");
  }
  
  function wasteStaffOptionsHtml(selectedStaffId = "") {
    const currentStaff = currentUser();
    const staffOptions = can("canManageInventory")
      ? state.users.filter((user) => user.status === "Active")
      : [currentStaff].filter(Boolean);
    const selected = staffOptions.some((user) => user.id === selectedStaffId) ? selectedStaffId : currentStaff?.id || staffOptions[0]?.id || "";
    return staffOptions
      .map((user) => `<option value="${escapeHtml(user.id)}" ${user.id === selected ? "selected" : ""}>${escapeHtml(user.name)}</option>`)
      .join("");
  }
  
  function getWastePreviewHtml(ingredient, quantity, unitType) {
    if (!ingredient) return emptyState("Create a purchased product before recording waste.");
  
    const stockQuantity = convertWasteQuantityToStockUnits(ingredient, quantity, unitType);
    const cost = getWasteCost(ingredient, stockQuantity);
    const remaining = normalizeStockQuantity(ingredient.stock - stockQuantity);
    const className = stockQuantity > ingredient.stock ? "danger" : stockQuantity > 0 ? "" : "warning";
    const statusText = stockQuantity > ingredient.stock
      ? `Only ${formatStockAmount(ingredient.stock, ingredient.unit)} available`
      : `${formatStockAmount(Math.max(0, remaining), ingredient.unit)} after waste`;
  
    return `
      <div class="availability-card ${className}">
        <header>
          <strong>${escapeHtml(ingredient.name)}</strong>
          <span class="pill ${className === "danger" ? "danger" : "info"}">${escapeHtml(money(cost))}</span>
        </header>
        <p>${escapeHtml(formatStockAmount(stockQuantity, ingredient.unit))} will leave inventory. ${escapeHtml(statusText)}.</p>
      </div>
    `;
  }
  
  function renderWasteForms() {
    document.querySelectorAll(".staff-waste-panel").forEach((panel) => {
      panel.hidden = !can("canRecordWaste");
    });
  
    document.querySelectorAll("[data-waste-form]").forEach((form) => {
      const productSelect = form.querySelector("[data-waste-product]");
      const unitSelect = form.querySelector("[data-waste-unit]");
      const reasonSelect = form.querySelector("[data-waste-reason]");
      const staffSelect = form.querySelector("[data-waste-staff]");
      const dateTimeInput = form.querySelector("[data-waste-datetime]");
      const preview = form.querySelector("[data-waste-preview]");
      const quantityInput = form.querySelector("[name='quantity']");
      if (!productSelect || !unitSelect || !reasonSelect || !staffSelect || !dateTimeInput || !preview || !quantityInput) return;
  
      const products = state.ingredients.filter((ingredient) => ingredient.active);
      const selectedProductId = productSelect.value || (products.some((ingredient) => ingredient.id === "kefta") ? "kefta" : products[0]?.id || "");
      productSelect.innerHTML = products
        .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</option>`)
        .join("");
      productSelect.value = products.some((ingredient) => ingredient.id === selectedProductId) ? selectedProductId : products[0]?.id || "";
  
      const ingredient = ingredientById(productSelect.value);
      const unitOptions = getWasteUnitOptionsForIngredient(ingredient);
      const selectedUnit = normalizeWasteUnitType(unitSelect.value, ingredient);
      unitSelect.innerHTML = unitOptions
        .map((unitType) => `<option value="${escapeHtml(unitType.id)}">${escapeHtml(unitType.label)}</option>`)
        .join("");
      unitSelect.value = unitOptions.some((unitType) => unitType.id === selectedUnit) ? selectedUnit : unitOptions[0]?.id || "";
  
      reasonSelect.innerHTML = wasteReasonOptionsHtml(reasonSelect.value);
      staffSelect.innerHTML = wasteStaffOptionsHtml(staffSelect.value);
      if (!dateTimeInput.value) dateTimeInput.value = formatDateTimeLocalInput();
      preview.innerHTML = getWastePreviewHtml(ingredient, quantityInput.value, unitSelect.value);
  
      form.querySelectorAll("input, select, textarea, button").forEach((element) => {
        element.disabled = !can("canRecordWaste") || !products.length;
      });
    });
  }
  
  function wasteRecordCard(record) {
    const ingredient = ingredientById(record.ingredientId);
    const stockUnit = ingredient?.unit || record.stockUnit || "";
    return `
      <article class="log-card waste-card">
        <div class="card-title">
          <strong>${escapeHtml(record.ingredientName || ingredient?.name || "Product")}</strong>
          <span class="pill danger">${escapeHtml(record.reason)}</span>
          <span class="pill info">${escapeHtml(money(record.cost))}</span>
        </div>
        <div class="meta-line">
          <span>${escapeHtml(formatDateTime(record.occurredAtMs))}</span>
          <span>${escapeHtml(formatWasteQuantity(record))}</span>
          <span>${escapeHtml(formatStockAmount(record.stockQuantity, stockUnit))} inventory</span>
          <span>${escapeHtml(record.staffName || "Staff")}</span>
        </div>
        ${record.notes ? `<p>${escapeHtml(record.notes)}</p>` : ""}
      </article>
    `;
  }
  
  function renderWasteReport() {
    document.querySelectorAll(".admin-waste-only").forEach((panel) => {
      panel.hidden = !can("canManageInventory");
    });
  
    const summaryContainer = document.querySelector("#wasteReportSummary");
    const historyContainer = document.querySelector("#wasteHistory");
    if (!summaryContainer || !historyContainer) return;
  
    const summary = getWasteReportSummary();
    summaryContainer.innerHTML = `
      <article class="waste-summary-card">
        <span>Total cost</span>
        <strong>${escapeHtml(money(summary.totalCost))}</strong>
        <small>${summary.count} ${summary.count === 1 ? "record" : "records"}</small>
      </article>
      <article class="waste-summary-card">
        <span>Today</span>
        <strong>${escapeHtml(money(summary.todayCost))}</strong>
        <small>${summary.todayCount} ${summary.todayCount === 1 ? "item" : "items"}</small>
      </article>
      <article class="waste-summary-card">
        <span>Top reason</span>
        <strong>${escapeHtml(summary.topReason)}</strong>
        <small>${summary.count} ${summary.count === 1 ? "waste record" : "waste records"}</small>
      </article>
    `;
    historyContainer.innerHTML = state.wasteRecords.length
      ? state.wasteRecords.slice().reverse().map(wasteRecordCard).join("")
      : emptyState("No waste recorded yet.");
  }
  
  function renderWasteTracking() {
    renderWasteForms();
    renderWasteReport();
  }
  
  function renderInventoryActionForm() {
    const form = document.querySelector("#inventoryActionForm");
    const ingredientSelect = document.querySelector("#inventoryActionIngredient");
    const actionSelect = document.querySelector("#inventoryActionType");
    const quantityInput = document.querySelector("#inventoryActionQuantity");
    const fromSelect = document.querySelector("#inventoryFromLocation");
    const toSelect = document.querySelector("#inventoryToLocation");
    const fromLabel = document.querySelector("#inventoryFromLocationLabel");
    const toLabel = document.querySelector("#inventoryToLocationLabel");
    const customLabel = document.querySelector("#inventoryCustomLocationLabel");
    if (!form || !ingredientSelect || !actionSelect || !fromSelect || !toSelect || !fromLabel || !toLabel || !customLabel) return;
  
    const selectedIngredientId = ingredientSelect.value || state.ingredients[0]?.id || "";
    const selectedAction = actionSelect.value || "add";
    const selectedFrom = fromSelect.value;
    const selectedTo = toSelect.value;
  
    ingredientSelect.innerHTML = state.ingredients
      .map((ingredient) => `<option value="${escapeHtml(ingredient.id)}">${escapeHtml(ingredient.name)} - ${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</option>`)
      .join("");
    ingredientSelect.value = state.ingredients.some((ingredient) => ingredient.id === selectedIngredientId) ? selectedIngredientId : state.ingredients[0]?.id || "";
  
    actionSelect.innerHTML = INVENTORY_ACTIONS
      .filter((action) => action.id !== "waste")
      .map((action) => `<option value="${escapeHtml(action.id)}">${escapeHtml(action.label)}</option>`)
      .join("");
    actionSelect.value = INVENTORY_ACTIONS.some((action) => action.id === selectedAction && action.id !== "waste") ? selectedAction : "add";
  
    const ingredient = ingredientById(ingredientSelect.value);
    const locations = getAllInventoryLocations();
    fromSelect.innerHTML = locations
      .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(formatLocationOptionLabel(ingredient, location))}</option>`)
      .join("");
    toSelect.innerHTML = locations
      .map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(formatLocationOptionLabel(ingredient, location))}</option>`)
      .join("");
    fromSelect.value = locations.includes(selectedFrom) ? selectedFrom : getIngredientPrimaryLocation(ingredient);
    toSelect.value = locations.includes(selectedTo) ? selectedTo : getIngredientPrimaryLocation(ingredient);
  
    const action = actionSelect.value;
    fromLabel.hidden = action === "add" || action === "correct";
    toLabel.hidden = action === "remove" || action === "waste";
    customLabel.hidden = action === "remove" || action === "waste";
    quantityInput.min = action === "correct" ? "0" : "0.01";
  
    form.querySelectorAll("input, select, button").forEach((element) => {
      element.disabled = !can("canManageInventory") || !state.ingredients.length;
    });
  }
  
  function supplierOrderCard(order) {
    const supplier = supplierById(order.supplierId) || state.suppliers.find((item) => item.name === order.supplier);
    const statusClass = order.status === "Received" ? "ok" : order.status === "Draft" ? "warning" : "info";
    const itemCount = order.items.length;
    const total = getSupplierOrderTotal(order);
    const minimumGap = getSupplierMinimumOrderGap(order);
    const payload = getSupplierOrderPayload(order);
    const isAwaitingReceipt = order.status === "Sent" || order.status === "Ordered";
    const showPayload = order.status === "Approved" || isAwaitingReceipt;
    return `
      <article class="supplier-card ${isAwaitingReceipt ? "is-ordered" : ""}">
        <header>
          <div>
            <strong>${escapeHtml(order.supplier)}</strong>
            <p>${itemCount} ${itemCount === 1 ? "line" : "lines"} | ${escapeHtml(money(total))} estimated${supplier?.deliveryDays ? ` | ${supplier.deliveryDays} delivery days` : ""}</p>
          </div>
          <span class="pill ${statusClass}">${escapeHtml(order.status)}</span>
        </header>
        ${minimumGap > 0 ? `<p class="supplier-minimum warning">Below supplier minimum by ${escapeHtml(money(minimumGap))}.</p>` : ""}
        <div class="supplier-lines">
          ${order.items.map((item) => {
            const ingredient = ingredientById(item.ingredientId);
            if (!ingredient) return "";
            const quantityValue = Number(item.quantity || item.suggestedQuantity || 0).toFixed(3).replace(/\.?0+$/, "");
            const receivedValue = Number(item.receivedQuantity === "" || item.receivedQuantity === undefined ? item.quantity : item.receivedQuantity).toFixed(3).replace(/\.?0+$/, "");
            return `
              <div class="supplier-line">
                <div>
                  <strong>${escapeHtml(ingredient.name)}</strong>
                  <p>${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))} on hand | min ${escapeHtml(formatStockAmount(ingredient.min, ingredient.unit))} | suggested ${escapeHtml(formatStockAmount(item.suggestedQuantity || item.quantity, ingredient.unit))}</p>
                  <p>${escapeHtml(getLocationSummaryText(ingredient))}</p>
                </div>
                ${order.status === "Draft" ? `
                  <label class="supplier-quantity-field">
                    <span>Order</span>
                    <input data-supplier-order-quantity="${escapeHtml(`${order.id}::${ingredient.id}`)}" type="number" min="0.001" step="0.001" value="${escapeHtml(quantityValue)}" aria-label="Order quantity for ${escapeHtml(ingredient.name)}">
                    <small>${escapeHtml(ingredient.unit)}</small>
                  </label>
                ` : isAwaitingReceipt ? `
                  <label class="supplier-quantity-field">
                    <span>Received</span>
                    <input data-supplier-received-quantity="${escapeHtml(`${order.id}::${ingredient.id}`)}" type="number" min="0" step="0.001" value="${escapeHtml(receivedValue)}" aria-label="Received quantity for ${escapeHtml(ingredient.name)}">
                    <small>${escapeHtml(ingredient.unit)}</small>
                  </label>
                ` : `<span>${escapeHtml(formatStockAmount(item.quantity, ingredient.unit))}</span>`}
              </div>
            `;
          }).join("")}
        </div>
        ${showPayload ? `
          <div class="supplier-export">
            <div class="supplier-export-header">
              <strong>${escapeHtml(payload.label)}</strong>
              <span>${escapeHtml(payload.target || "Manual handoff")}</span>
            </div>
            <textarea readonly rows="6" aria-label="Supplier order ${escapeHtml(payload.label)} payload">${escapeHtml(payload.body)}</textarea>
          </div>
        ` : ""}
        <div class="supplier-total">
          <span>${escapeHtml(order.status === "Received"
            ? `Received ${order.receivedAt}`
            : isAwaitingReceipt
              ? `Sent ${order.sentAt || order.orderedAt}`
              : order.status === "Approved"
                ? "Approved and ready to send"
                : "Draft generated from low stock")}</span>
          <div class="mini-actions">
            ${order.status === "Draft" ? `<button class="mini-btn" type="button" data-supplier-approve="${escapeHtml(order.id)}">Approve</button>` : ""}
            ${order.status === "Approved" ? `<button class="mini-btn" type="button" data-supplier-send="${escapeHtml(order.id)}">Send order</button>` : ""}
            ${isAwaitingReceipt ? `<button class="mini-btn" type="button" data-supplier-received="${escapeHtml(order.id)}">Receive</button>` : ""}
          </div>
        </div>
      </article>
    `;
  }
  
  function renderInventory() {
    renderSupplierManagement();
    renderScannerPanel();
    renderInventoryActionForm();
    const inventoryAlerts = [
      ...getLowStockIngredients().map(alertCard),
      ...getOverStockIngredients().map(overStockCard)
    ];
    document.querySelector("#inventoryLowStockDashboard").innerHTML = inventoryAlerts.length
      ? inventoryAlerts.join("")
      : emptyState("No low-stock or over-stock alerts.");
  
    document.querySelector("#inventoryHistory").innerHTML = state.inventoryHistory.length
      ? state.inventoryHistory.slice().reverse().map(inventoryHistoryCard).join("")
      : emptyState("No stock actions yet.");
  
    document.querySelector("#ingredientRows").innerHTML = state.ingredients.map((ingredient) => {
      const status = getIngredientStatus(ingredient);
      const percent = Math.max(4, Math.min(100, ingredient.max ? (ingredient.stock / ingredient.max) * 100 : 4));
      const statusLabel = status === "inactive" ? "Inactive" : status === "danger" ? "Low stock" : status === "over" ? "Over stock" : status === "warning" ? "Watch" : "OK";
      const statusClass = status === "inactive" ? "warning" : status === "danger" ? "danger" : status === "over" || status === "warning" ? "warning" : "ok";
      const expiryText = ingredient.expiryDate || "No expiry";
      const barcodeText = ingredient.barcode || "No code";
      const supplier = supplierForIngredient(ingredient);
      return `
        <tr class="inventory-row ${status}">
          <td>
            <strong>${escapeHtml(ingredient.name)}</strong>
            <span class="table-subtext">${escapeHtml(unitTypeDefinition(ingredient.unitType).label)}</span>
          </td>
          <td>
            <div class="stock-meter ${status}">
              <span>${escapeHtml(formatStockAmount(ingredient.stock, ingredient.unit))}</span>
              <div class="progress-track"><div class="progress-bar" style="--value: ${percent}%"></div></div>
            </div>
          </td>
          <td>${ingredient.min} / ${ingredient.max} ${escapeHtml(ingredient.unit)}</td>
          <td>${locationStockHtml(ingredient)}</td>
          <td>
            <strong>${escapeHtml(supplier?.name || ingredient.supplier)}</strong>
            <span class="table-subtext">${escapeHtml(supplier?.deliveryDays ? `${supplier.deliveryDays} delivery days` : supplier?.contactPerson || "Supplier")}</span>
          </td>
          <td>
            ${can("canManageProducts") ? `
              <div class="price-editor">
                <input data-purchase-price-input="${escapeHtml(ingredient.id)}" type="number" min="0.01" step="0.01" value="${ingredient.purchasePrice.toFixed(2)}" aria-label="Purchase price for ${escapeHtml(ingredient.name)}">
                <button class="mini-btn" type="button" data-update-purchase-price="${escapeHtml(ingredient.id)}">Update</button>
              </div>
              <span class="table-subtext">per ${escapeHtml(ingredient.unit)}</span>
            ` : `${escapeHtml(money(ingredient.purchasePrice))} / ${escapeHtml(ingredient.unit)}`}
          </td>
          <td>
            <span>${escapeHtml(expiryText)}</span>
            <span class="table-subtext">${escapeHtml(barcodeText)}</span>
          </td>
          <td><span class="pill ${statusClass}">${statusLabel}</span></td>
          <td>
            ${can("canManageProducts") ? `<button class="mini-btn" type="button" data-toggle-purchased="${escapeHtml(ingredient.id)}">${ingredient.active ? "Deactivate" : "Activate"}</button>` : ""}
          </td>
        </tr>
      `;
    }).join("");
  
    document.querySelector("#recipeList").innerHTML = state.products.map((product) => {
      const baseCost = getProductCost(product, DEFAULT_RECIPE_ORDER_CONTEXT);
      const takeawayCost = getProductCost(product, TAKEAWAY_DELIVERY_RECIPE_CONTEXT);
      const hasConditionalLines = productHasConditionalRecipeLines(product);
      const marginProfile = getProductMarginProfile(product);
      const vatLabel = VAT_OPTIONS.find((option) => option.id === product.vatSetting)?.label || "Standard VAT";
      return `
        <article class="recipe-card ${product.active ? "" : "is-inactive"} ${marginProfile.className === "danger" ? "is-low-margin" : ""}">
          <header>
            <div>
              <strong>${escapeHtml(product.name)}</strong>
              <p>${escapeHtml(product.category)} | SKU ${escapeHtml(product.code)} | ${escapeHtml(product.station)}</p>
              ${product.description ? `<p class="line-detail">${escapeHtml(product.description)}</p>` : ""}
            </div>
            <div class="ticket-pills">
              <span class="pill ${product.active ? "ok" : "warning"}">${product.active ? "Active" : "Inactive"}</span>
              <span class="pill ${marginProfile.className}">${marginProfile.margin.toFixed(1)}%</span>
            </div>
          </header>
          <div class="recipe-cost-grid">
            <span>Selling price</span><strong>${escapeHtml(money(product.price))}</strong>
            <span>Base product cost</span><strong>${escapeHtml(money(baseCost))}</strong>
            <span>Gross margin</span><strong>${escapeHtml(money(getProductGrossMargin(product, DEFAULT_RECIPE_ORDER_CONTEXT)))}</strong>
            <span>Margin</span><strong>${marginProfile.baseMargin.toFixed(1)}%</strong>
            ${hasConditionalLines ? `
              <span>Takeaway/delivery cost</span><strong>${escapeHtml(money(takeawayCost))}</strong>
              <span>Takeaway/delivery margin</span><strong>${marginProfile.takeawayMargin.toFixed(1)}%</strong>
            ` : ""}
          </div>
          ${product.lastProductionAt ? `
            <p class="line-detail">Last batch actual cost ${escapeHtml(money(product.lastProductionCost))} (${escapeHtml(money(product.lastProductionCostDelta))} vs planned)${product.lastProductionMargin === null ? "" : ` · margin ${product.lastProductionMargin.toFixed(1)}%`} · ${escapeHtml(product.lastProductionAt)}</p>
          ` : ""}
          <p>Target ${product.targetMargin}% | Minimum ${product.minMargin}% | ${escapeHtml(marginProfile.label)} | ${escapeHtml(vatLabel)}</p>
          <p>${escapeHtml(productAvailabilityLabel(product))}</p>
          <div class="recipe-lines">
            ${(product.recipe || []).map((line) => {
              const ingredient = ingredientById(line.ingredientId);
              if (!ingredient) return "";
              const appliesLabel = RECIPE_APPLIES_OPTIONS.find((option) => option.id === line.appliesTo)?.label || "Every order";
              return `
                <div class="recipe-line">
                  <span>
                    <strong>${escapeHtml(ingredient.name)}</strong>
                    <small>${escapeHtml(line.station || "Main kitchen")} · ${escapeHtml(appliesLabel)}${line.notes ? ` · ${escapeHtml(line.notes)}` : ""}</small>
                  </span>
                  <strong>${escapeHtml(getRecipeUsageLabel(line))} · ${escapeHtml(money(getLineCost(line)))}</strong>
                </div>
              `;
            }).join("")}
          </div>
          ${can("canManageProducts") ? `
            <div class="mini-actions">
              <button class="mini-btn" type="button" data-toggle-sellable="${escapeHtml(product.id)}">${product.active ? "Deactivate" : "Activate"}</button>
            </div>
          ` : ""}
        </article>
      `;
    }).join("");
  
    const supplierOrders = getSupplierOrderDrafts();
    document.querySelector("#supplierOrders").innerHTML = supplierOrders.length
      ? supplierOrders.map(supplierOrderCard).join("")
      : emptyState("No supplier order needed.");
  }
  
  return {
    renderInventory,
    renderInventoryActionForm,
    renderProductManagement,
    renderPurchasedProductForm,
    renderSellableProductForm,
    renderSellableRecipeCostPreview,
    renderSupplierManagement,
    renderWasteForms,
    renderWasteReport,
    renderWasteTracking
  };
}
