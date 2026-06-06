import { state } from "../app/state.js";
import {
  EXTERNAL_DELIVERY_IMPORT_METHODS,
  EXTERNAL_DELIVERY_PLATFORM_STATUSES
} from "../shared/constants.js";
import {
  externalImportMethodLabel,
  externalPlatformName,
  normalizeExternalPlatformId
} from "../domain/external-delivery.js";
import { getExternalPlatformReadiness } from "../domain/external-platform-adapters.js";
import { escapeHtml } from "../shared/html.js";

export function createExternalDeliveryUi(deps) {
  const document: any = window.document;
  const {
    can,
    emptyState,
    formatDateTime,
    getOrderTotal,
    money,
    orderById,
    productById
  } = deps;

  function platformOptionsHtml(selectedPlatformId = "") {
    return state.externalPlatforms
      .map((platform) => `<option value="${escapeHtml(platform.id)}" ${platform.id === selectedPlatformId ? "selected" : ""}>${escapeHtml(platform.name)}</option>`)
      .join("");
  }

  function integrationMethodOptionsHtml(selectedMethod = "manual") {
    return EXTERNAL_DELIVERY_IMPORT_METHODS
      .map((method) => `<option value="${escapeHtml(method.id)}" ${method.id === selectedMethod ? "selected" : ""}>${escapeHtml(method.label)}</option>`)
      .join("");
  }

  function productOptionsHtml(selectedProductId = "") {
    const products = state.products.filter((product) => product.active && product.availability?.externalDeliveryApps);
    return products
      .map((product) => `<option value="${escapeHtml(product.id)}" ${product.id === selectedProductId ? "selected" : ""}>${escapeHtml(product.name)} - ${escapeHtml(product.code)} - ${escapeHtml(product.station)}</option>`)
      .join("");
  }

  function statusOptionsHtml(selectedStatus = "Approval pending") {
    return EXTERNAL_DELIVERY_PLATFORM_STATUSES
      .map((status) => `<option value="${escapeHtml(status)}" ${status === selectedStatus ? "selected" : ""}>${escapeHtml(status)}</option>`)
      .join("");
  }

  function renderExternalPlatformForm() {
    const form = document.querySelector("#externalPlatformForm");
    const platformSelect = document.querySelector("#externalPlatformType");
    const statusSelect = document.querySelector("#externalPlatformStatus");
    const methodSelect = document.querySelector("#externalPlatformMethod");
    if (!form || !platformSelect || !statusSelect || !methodSelect) return;

    const selectedPlatformId = normalizeExternalPlatformId(platformSelect.value || state.externalPlatforms[0]?.id);
    const platform = state.externalPlatforms.find((item) => item.id === selectedPlatformId) || state.externalPlatforms[0];
    const editable = can("canEditSettings");
    platformSelect.innerHTML = platformOptionsHtml(platform?.id || "");
    platformSelect.value = platform?.id || "";
    statusSelect.innerHTML = statusOptionsHtml(platform?.status || "Approval pending");
    methodSelect.innerHTML = integrationMethodOptionsHtml(platform?.integrationMethod || "manual");
    form.elements.commissionRate.value = platform?.commissionRate ?? 0;
    form.elements.apiDetails.value = platform?.apiDetails || "";
    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
      element.disabled = !editable;
    });
  }

  function renderExternalMappingForm() {
    const form = document.querySelector("#externalMappingForm");
    const platformSelect = document.querySelector("#externalMappingPlatform");
    const productSelect = document.querySelector("#externalMappingProduct");
    if (!form || !platformSelect || !productSelect) return;

    const editable = can("canEditSettings");
    platformSelect.innerHTML = platformOptionsHtml(platformSelect.value || state.externalPlatforms[0]?.id);
    productSelect.innerHTML = productOptionsHtml(productSelect.value);
    if (!form.elements.externalName.value) form.elements.externalName.value = "Sandwich Kefta";
    if (!form.elements.externalCode.value) form.elements.externalCode.value = "99301";
    if (!form.elements.commissionRate.value) form.elements.commissionRate.value = "";
    form.elements.active.checked = true;
    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
      element.disabled = !editable;
    });
  }

  function renderExternalOrderImportForm() {
    const form = document.querySelector("#externalOrderImportForm");
    const platformSelect = document.querySelector("#externalOrderPlatform");
    const methodSelect = document.querySelector("#externalOrderImportMethod");
    if (!form || !platformSelect || !methodSelect) return;

    const editable = can("canCreateOrders");
    const selectedPlatformId = normalizeExternalPlatformId(platformSelect.value || state.externalPlatforms[0]?.id);
    const platform = state.externalPlatforms.find((item) => item.id === selectedPlatformId) || state.externalPlatforms[0];
    platformSelect.innerHTML = platformOptionsHtml(platform?.id || "");
    platformSelect.value = platform?.id || "";
    methodSelect.innerHTML = integrationMethodOptionsHtml(methodSelect.value || platform?.integrationMethod || "manual");
    if (!form.elements.commissionRate.value) form.elements.commissionRate.value = platform?.commissionRate ?? 0;
    if (!form.elements.rawOrder.value) form.elements.rawOrder.value = "99301,1";
    form.querySelectorAll("input, select, textarea, button").forEach((element) => {
      element.disabled = !editable;
    });
  }

  function platformCard(platform) {
    const payload = platform.lastMenuPayload;
    const mappedItems = state.externalProductMappings.filter((mapping) => mapping.platformId === platform.id && mapping.active !== false).length;
    const readiness = getExternalPlatformReadiness(platform);
    const payloadText = payload?.items?.length
      ? payload.items.map((item) => `${item.externalCode || item.externalName} -> ${item.internalProductName} (${item.kitchenStation})`).join("\n")
      : "";
    return `
      <article class="supplier-card">
        <header>
          <div>
            <strong>${escapeHtml(platform.name)}</strong>
            <p>${escapeHtml(externalImportMethodLabel(platform.integrationMethod))} | ${mappedItems} mapped menu items</p>
          </div>
          <span class="pill ${platform.status === "Connected" ? "ok" : platform.status === "Paused" ? "warning" : "info"}">${escapeHtml(platform.status)}</span>
        </header>
        <div class="supplier-detail-grid">
          <span>Commission</span><strong>${platform.commissionRate}%</strong>
          <span>Last menu push</span><strong>${escapeHtml(platform.lastMenuPushedAt || "Not pushed")}</strong>
          <span>Fallback</span><strong>${escapeHtml(platform.integrationMethod === "api" ? "Manual, email, CSV, staff entry ready" : externalImportMethodLabel(platform.integrationMethod))}</strong>
          <span>Adapter</span><strong>${escapeHtml(readiness.apiReady ? "API ready" : readiness.missing.length ? readiness.missing.join(", ") : "Manual ready")}</strong>
        </div>
        ${platform.apiDetails ? `<p class="line-detail">${escapeHtml(platform.apiDetails)}</p>` : ""}
        ${payloadText ? `<textarea readonly aria-label="${escapeHtml(platform.name)} menu payload preview">${escapeHtml(payloadText)}</textarea>` : ""}
        <div class="mini-actions">
          <button class="mini-btn" type="button" data-external-menu-push="${escapeHtml(platform.id)}" ${!can("canEditSettings") ? "disabled" : ""}>Push menu</button>
        </div>
      </article>
    `;
  }

  function mappingCard(mapping) {
    const platform = state.externalPlatforms.find((item) => item.id === mapping.platformId);
    const product = productById(mapping.productId);
    return `
      <article class="supplier-card ${mapping.active === false ? "is-disabled" : ""}">
        <header>
          <div>
            <strong>${escapeHtml(mapping.externalName || mapping.externalCode)}</strong>
            <p>${escapeHtml(platform?.name || externalPlatformName(mapping.platformId))} | Code ${escapeHtml(mapping.externalCode || "-")}</p>
          </div>
          <span class="pill ${mapping.active === false ? "warning" : "ok"}">${mapping.active === false ? "Paused" : "Active"}</span>
        </header>
        <div class="supplier-detail-grid">
          <span>Internal product</span><strong>${escapeHtml(product?.name || "Missing product")}</strong>
          <span>Internal recipe</span><strong>${escapeHtml(product ? `${product.name} recipe` : "-")}</strong>
          <span>Kitchen station</span><strong>${escapeHtml(product?.station || "-")}</strong>
          <span>Commission</span><strong>${mapping.commissionRate === "" ? "Platform default" : `${mapping.commissionRate}%`}</strong>
          <span>Last pushed</span><strong>${escapeHtml(mapping.lastPushedAt || "Not pushed")}</strong>
        </div>
        <div class="mini-actions">
          <button class="mini-btn ${mapping.active === false ? "" : "danger-action"}" type="button" data-toggle-external-mapping="${escapeHtml(mapping.id)}" ${!can("canEditSettings") ? "disabled" : ""}>${mapping.active === false ? "Enable" : "Pause"}</button>
        </div>
      </article>
    `;
  }

  function externalImportCard(record) {
    const order = orderById(record.orderId);
    const platform = state.externalPlatforms.find((item) => item.id === record.platformId);
    const orderTotal = order ? getOrderTotal(order) : 0;
    const matchedItems = (record.matchedItems || [])
      .map((item) => {
        const product = productById(item.productId);
        return `${item.quantity}x ${product?.name || item.productId}`;
      })
      .join(", ");
    return `
      <article class="supplier-card">
        <header>
          <div>
            <strong>${escapeHtml(platform?.name || record.platformName || externalPlatformName(record.platformId))} ${escapeHtml(record.externalOrderId)}</strong>
            <p>${escapeHtml(externalImportMethodLabel(record.importMethod))} | ${escapeHtml(record.importedAt || "")}</p>
          </div>
          <span class="pill ${record.status === "Status pushed" ? "ok" : "info"}">${escapeHtml(record.status || "Imported")}</span>
        </header>
        <div class="supplier-detail-grid">
          <span>Internal order</span><strong>${escapeHtml(order ? `#${order.number}` : record.orderId || "-")}</strong>
          <span>Mapped items</span><strong>${escapeHtml(matchedItems || "No matched items")}</strong>
          <span>Total</span><strong>${escapeHtml(order ? money(orderTotal) : "-")}</strong>
          <span>Commission</span><strong>${escapeHtml(order ? `${money(order.externalCommissionAmount || 0)} (${order.externalCommissionRate || 0}%)` : "-")}</strong>
          <span>Last status push</span><strong>${escapeHtml(record.lastPushedStatus ? `${record.lastPushedStatus} at ${formatDateTime(record.statusPushedAtMs, record.statusPushedAt)}` : "Not pushed")}</strong>
        </div>
        <div class="mini-actions">
          ${order ? `<button class="mini-btn" type="button" data-external-push-status="${escapeHtml(order.id)}">Update platform status</button>` : ""}
        </div>
      </article>
    `;
  }

  function renderExternalDeliveryIntegrations() {
    const platformList = document.querySelector("#externalPlatformList");
    const mappingList = document.querySelector("#externalMappingList");
    const importList = document.querySelector("#externalImportList");
    if (!platformList || !mappingList || !importList) return;

    renderExternalPlatformForm();
    renderExternalMappingForm();
    renderExternalOrderImportForm();

    platformList.innerHTML = state.externalPlatforms.length
      ? state.externalPlatforms.map(platformCard).join("")
      : emptyState("Add delivery platforms before pushing menus.");

    mappingList.innerHTML = state.externalProductMappings.length
      ? state.externalProductMappings.map(mappingCard).join("")
      : emptyState("Map external product names or codes to internal products.");

    importList.innerHTML = state.externalOrderImports.length
      ? state.externalOrderImports.slice().reverse().map(externalImportCard).join("")
      : emptyState("Imported external orders will appear here.");
  }

  return {
    renderExternalDeliveryIntegrations
  };
}
