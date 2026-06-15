import { state } from "../app/state.js";
import {
  LINE_MODIFIER_OPTIONS,
  ORDER_TYPE_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PHONE_MESSAGE_FULFILLMENT_OPTIONS
} from "../shared/constants.js";
import { isPhoneMessageOrder, normalizeOrderFulfillment, normalizeOrderType, orderTypeDefinition, productCanBeOrderedForOrderContext } from "../domain/orders.js";
import { normalizePaymentMethod } from "../domain/payments.js";
import { escapeHtml } from "../shared/html.js";

export function createOrderBuilderUi(deps) {
  const {
    can,
    customerById,
    emptyState,
    findCustomerByPhone,
    findCustomerBySearchValue,
    formatStockAmount,
    fulfillmentLabel,
    getAddressHistoryForCustomer,
    getCurrentOrderContext,
    getCustomerOptionLabel,
    getCustomerPrimaryAddress,
    getDefaultProductionProductId,
    getFavoriteItemsForCustomer,
    getItemCount,
    getItemsTotal,
    getOrderTotal,
    getOrderableProductsForContext,
    getOrdersForCustomer,
    getAssignableDrivers,
    getProductAvailability,
    getProductionProducts,
    getStockShortages,
    money,
    normalizeOrderItems,
    productById,
    renderProductionRecipeFields
  } = deps;

  function renderProductsInSelects() {
    const productSelect = document.querySelector("#productSelect");
    const productionProduct = document.querySelector("#productionProduct");
    const orderForm: any = document.querySelector("#orderForm");
    const orderTypeSelect: any = document.querySelector("#orderTypeSelect");
    const orderTableSelect: any = document.querySelector("#orderTableSelect");
    const orderPaymentMethodSelect: any = document.querySelector("#orderPaymentMethod");
    const fulfillmentInput: any = document.querySelector("#orderFulfillment");
    const selectedOrderType = normalizeOrderType(orderForm?.elements.channel.value || "Dine-in");
    const orderType = orderTypeDefinition(selectedOrderType);
    const channel = orderType.value;
    const fulfillment = normalizeOrderFulfillment(channel, fulfillmentInput?.value || orderType.fulfillment);

    if (orderTypeSelect) {
      orderTypeSelect.innerHTML = ORDER_TYPE_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
      orderTypeSelect.value = channel;
    }

    if (orderTableSelect) {
      const selectedTable = orderTableSelect.value || state.tables[0]?.id || "";
      orderTableSelect.innerHTML = state.tables
        .map((table) => `<option value="${escapeHtml(table.id)}">${escapeHtml(table.name)} - ${table.capacity} seats - ${escapeHtml(table.zone)}</option>`)
        .join("");
      orderTableSelect.value = state.tables.some((table) => table.id === selectedTable) ? selectedTable : state.tables[0]?.id || "";
      orderTableSelect.disabled = !orderType.requiresTable;
    }

    if (fulfillmentInput) {
      const fulfillmentOptions = isPhoneMessageOrder(channel)
        ? PHONE_MESSAGE_FULFILLMENT_OPTIONS
        : [{ value: orderType.fulfillment, label: fulfillmentLabel({ fulfillment: orderType.fulfillment }) }];
      fulfillmentInput.innerHTML = fulfillmentOptions
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
      fulfillmentInput.value = fulfillment;
      fulfillmentInput.disabled = !isPhoneMessageOrder(channel);
    }

    if (orderPaymentMethodSelect) {
      const selectedPaymentMethod = normalizePaymentMethod(orderPaymentMethodSelect.value);
      orderPaymentMethodSelect.innerHTML = PAYMENT_METHOD_OPTIONS
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
      orderPaymentMethodSelect.value = selectedPaymentMethod;
    }

    const orderableProducts = getOrderableProductsForContext({ channel, fulfillment });
    const orderOptions = orderableProducts
      .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} - ${escapeHtml(money(product.price))}</option>`)
      .join("");
    const productionProducts = getProductionProducts();
    const productionOptions = productionProducts
      .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}${product.batchOutput ? " - prepared batch" : ` - ${escapeHtml(money(product.price))}`}</option>`)
      .join("");
    const selectedProduct = (productSelect as HTMLSelectElement | null)?.value || orderableProducts[0]?.id;
    const selectedProductionProduct = getDefaultProductionProductId((productionProduct as HTMLSelectElement | null)?.value);

    if (productSelect) {
      productSelect.innerHTML = orderOptions;
      (productSelect as HTMLSelectElement).disabled = !orderableProducts.length || !can("canCreateOrders");
      (productSelect as HTMLSelectElement).value = orderableProducts.some((product) => product.id === selectedProduct) ? selectedProduct : orderableProducts[0]?.id || "";
    }
    if (productionProduct) {
      productionProduct.innerHTML = productionOptions;
      (productionProduct as HTMLSelectElement).value = getDefaultProductionProductId(selectedProductionProduct);
      (productionProduct as HTMLSelectElement).disabled = !productionProducts.length || !can("canManageProcedures");
    }
    renderProductionRecipeFields();
  }

  function getManualCustomerFromForm(form: any = document.querySelector("#orderForm")) {
    if (!form) return null;
    return customerById(form.elements.customerId?.value)
      || findCustomerBySearchValue(form.elements.customerSearch?.value)
      || findCustomerByPhone(form.elements.customerPhone?.value);
  }

  function customerHistoryHtml(customer) {
    if (!customer) return emptyState("Search a customer or enter a saved phone number to show history.");
    const orders = getOrdersForCustomer(customer);
    const favorites = getFavoriteItemsForCustomer(customer);
    const addresses = getAddressHistoryForCustomer(customer);
    const latestOrders = orders.slice(0, 4);

    return `
      <div class="customer-history-card">
        <div class="customer-history-head">
          <div>
            <strong>${escapeHtml(customer.name)}</strong>
            <p>${escapeHtml(customer.phone || "No phone on file")}</p>
          </div>
          <span class="pill info">${orders.length} previous</span>
        </div>
        <div class="customer-history-grid">
          <section>
            <span>Favorites</span>
            <p>${favorites.length ? escapeHtml(favorites.map((item) => `${item.quantity}x ${item.product.name}`).join(", ")) : "No favorites yet"}</p>
          </section>
          <section>
            <span>Addresses</span>
            <p>${addresses.length ? escapeHtml(addresses.join(" | ")) : "No address saved"}</p>
          </section>
          <section>
            <span>Notes</span>
            <p>${customer.notes ? escapeHtml(customer.notes) : "No customer notes"}</p>
          </section>
          <section>
            <span>Previous orders</span>
            <p>${latestOrders.length ? escapeHtml(latestOrders.map((order) => `#${order.number} ${money(getOrderTotal(order))}`).join(", ")) : "No orders yet"}</p>
          </section>
        </div>
      </div>
    `;
  }

  function renderManualOrderControls() {
    const form: any = document.querySelector("#orderForm");
    const panel = document.querySelector("#manualOrderPanel");
    const customerLabel = document.querySelector("#orderCustomerLabel");
    const fulfillmentLabelElement = document.querySelector("#manualFulfillmentLabel");
    const customerSelect: any = document.querySelector("#customerSelect");
    const customerSearchOptions = document.querySelector("#customerSearchOptions");
    const historyPanel = document.querySelector("#customerHistoryPanel");
    const addressLabel = document.querySelector("#manualAddressLabel");
    const driverLabel = document.querySelector("#manualDriverLabel");
    const driverSelect: any = document.querySelector("#manualDriverSelect");
    if (!form || !panel) return;

    const channel = normalizeOrderType(form.elements.channel?.value || "Dine-in");
    const manual = isPhoneMessageOrder(channel);
    const editable = can("canCreateOrders");
    const fulfillment = normalizeOrderFulfillment(channel, form.elements.fulfillment?.value || "Pickup");
    const isDelivery = manual && fulfillment === "Delivery";

    (panel as HTMLElement).hidden = !manual;
    if (customerLabel) (customerLabel as HTMLElement).hidden = manual;
    if (fulfillmentLabelElement) (fulfillmentLabelElement as HTMLElement).hidden = !manual;
    if (addressLabel) {
      const addressText = addressLabel.querySelector("span");
      const addressInput = addressLabel.querySelector("textarea");
      if (addressText) addressText.textContent = isDelivery ? "Delivery address" : "Address history";
      if (addressInput) addressInput.placeholder = isDelivery ? "Street, number, city" : "Optional saved address";
    }
    if (driverLabel) (driverLabel as HTMLElement).hidden = !isDelivery;

    if (form.elements.customer) form.elements.customer.disabled = manual;
    panel.querySelectorAll("input, select, textarea").forEach((element: any) => {
      element.disabled = !manual || !editable;
    });
    if (form.elements.fulfillment) form.elements.fulfillment.disabled = !manual || !editable;

    if (!manual) return;

    const selectedCustomerId = customerSelect?.value || "";
    const sortedCustomers = state.customers
      .slice()
      .sort((first, second) => first.name.localeCompare(second.name) || first.phone.localeCompare(second.phone));

    if (customerSearchOptions) {
      customerSearchOptions.innerHTML = sortedCustomers
        .map((customer) => `<option value="${escapeHtml(getCustomerOptionLabel(customer))}"></option>`)
        .join("");
    }

    if (customerSelect) {
      customerSelect.innerHTML = `
        <option value="">New customer</option>
        ${sortedCustomers.map((customer) => `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)}${customer.phone ? ` - ${escapeHtml(customer.phone)}` : ""}</option>`).join("")}
      `;
      customerSelect.value = sortedCustomers.some((customer) => customer.id === selectedCustomerId) ? selectedCustomerId : "";
    }

    if (driverSelect) {
      const selectedDriver = driverSelect.value;
      const assignableDrivers = getAssignableDrivers?.() || [];
      const driverOptions = assignableDrivers
        .map((driver) => {
          return `<option value="${escapeHtml(driver.id)}">${escapeHtml(driver.name)} - ${escapeHtml(driver.status)}</option>`;
        })
        .join("");
      driverSelect.innerHTML = `<option value="">Auto assign available driver</option>${driverOptions}`;
      driverSelect.value = assignableDrivers.some((driver) => driver.id === selectedDriver) ? selectedDriver : "";
      driverSelect.disabled = !isDelivery || !editable;
    }

    if (historyPanel) historyPanel.innerHTML = customerHistoryHtml(getManualCustomerFromForm(form));
  }

  function loadCustomerIntoManualOrder(customerId) {
    const form: any = document.querySelector("#orderForm");
    const customer = customerById(customerId);
    if (!form || !customer) return;
    form.elements.customerId.value = customer.id;
    form.elements.customerSearch.value = getCustomerOptionLabel(customer);
    form.elements.customerName.value = customer.name;
    form.elements.customerPhone.value = customer.phone || "";
    form.elements.customerEmail.value = customer.email || "";
    form.elements.deliveryAddress.value = getCustomerPrimaryAddress(customer);
    form.elements.customerNotes.value = customer.notes || "";
    renderManualOrderControls();
  }

  function renderOrderBuilder() {
    const orderForm: any = document.querySelector("#orderForm");
    const productSelect: any = document.querySelector("#productSelect");
    const quantityInput: any = document.querySelector("#orderQuantity");
    const availabilityPanel = document.querySelector("#orderAvailability");
    const draftPanel = document.querySelector("#orderDraft");
    const addLineButton: any = document.querySelector("#addOrderLineBtn");
    const clearDraftButton: any = document.querySelector("#clearOrderDraftBtn");
    const sendOrderButton: any = document.querySelector("#sendOrderBtn");
    const saveOrderButton: any = document.querySelector("#saveOrderBtn");
    const modifierChecks = document.querySelector("#orderModifierChecks");
    const channel = normalizeOrderType(orderForm?.elements.channel.value || "Dine-in");
    const orderType = orderTypeDefinition(channel);
    const fulfillment = normalizeOrderFulfillment(channel, orderForm?.elements.fulfillment?.value || orderType.fulfillment);
    if (orderForm?.elements.channel) orderForm.elements.channel.value = channel;
    if (orderForm?.elements.fulfillment) orderForm.elements.fulfillment.value = fulfillment;
    if (modifierChecks && !modifierChecks.children.length) {
      modifierChecks.innerHTML = LINE_MODIFIER_OPTIONS
        .map((modifier) => `
          <label class="modifier-chip">
            <input name="lineModifier" type="checkbox" value="${escapeHtml(modifier)}">
            <span>${escapeHtml(modifier)}</span>
          </label>
        `)
        .join("");
    }
    const orderContext = getCurrentOrderContext();
    state.orderDraft = normalizeOrderItems(state.orderDraft).filter((item) => productCanBeOrderedForOrderContext(productById(item.productId), orderContext));
    renderManualOrderControls();

    const product = productById(productSelect?.value);
    const requestedQuantity = Math.max(1, Math.floor(Number(quantityInput.value) || 1));
    const availability = getProductAvailability(product, state.orderDraft, orderContext);
    const canAddLine = Boolean(productCanBeOrderedForOrderContext(product, orderContext) && requestedQuantity <= availability.maxQuantity);
    const availabilityClass = availability.maxQuantity === 0 ? "danger" : requestedQuantity > availability.maxQuantity ? "warning" : "";
    const limiting = availability.limiting;
    const routeLabel = fulfillmentLabel({ fulfillment: orderContext.fulfillment });
    const limitingText = limiting
      ? `${limiting.ingredient.name} limits this item; ${formatStockAmount(limiting.remaining, limiting.ingredient.unit)} left after basket.`
      : product
        ? `Route: ${routeLabel}. No stock rule is attached to this product.`
        : "No active sellable product is available for this channel.";

    availabilityPanel.className = `availability-card ${availabilityClass}`.trim();
    availabilityPanel.innerHTML = `
      <header>
        <strong>${escapeHtml(product?.name || "Select product")}</strong>
        <span class="pill ${availability.maxQuantity ? "ok" : "danger"}">${availability.maxQuantity} available</span>
      </header>
      <p>${escapeHtml(limiting ? `${limitingText} Route: ${routeLabel}.` : limitingText)}</p>
    `;

    const draftItems = state.orderDraft;
    const pendingItems = draftItems.length ? draftItems : product ? [{ productId: product.id, quantity: requestedQuantity }] : [];
    const shortages = getStockShortages(pendingItems, orderContext);
    const itemCount = getItemCount(pendingItems);
    const orderTotal = getItemsTotal(pendingItems);
    const selectedLineBlocked = !draftItems.length && (!productCanBeOrderedForOrderContext(product, orderContext) || requestedQuantity > availability.maxQuantity);

    addLineButton.disabled = !can("canCreateOrders") || !canAddLine;
    clearDraftButton.disabled = !draftItems.length;
    if (saveOrderButton) saveOrderButton.disabled = !can("canCreateOrders") || !itemCount || shortages.length > 0 || selectedLineBlocked;
    sendOrderButton.disabled = !can("canCreateOrders") || !itemCount || shortages.length > 0 || selectedLineBlocked;
    sendOrderButton.innerHTML = `<span aria-hidden="true">+</span>${itemCount > 1 ? `Send ${itemCount} Items` : "Send to Kitchen"} · ${escapeHtml(money(orderTotal))}`;

    if (!draftItems.length) {
      draftPanel.innerHTML = `<p class="draft-empty">Basket is empty.</p>`;
      return;
    }

    const shortageText = shortages.length
      ? `<p class="draft-empty">Missing ${escapeHtml(shortages.map((item) => formatStockAmount(item.shortage, item.ingredient.unit)).join(", "))} before this can be sent.</p>`
      : "";

    draftPanel.innerHTML = `
      <div class="draft-summary">
        <strong>Basket</strong>
        <span class="draft-meta">${getItemCount(draftItems)} items</span>
      </div>
      <div class="draft-lines">
        ${draftItems.map((item, index) => {
          const lineProduct = productById(item.productId);
          if (!lineProduct) return "";
          const lineDetails = [
            item.modifiers?.length ? `Modifiers: ${item.modifiers.join(", ")}` : "",
            item.note ? `Note: ${item.note}` : ""
          ].filter(Boolean).join(" · ");
          return `
            <div class="draft-line">
              <div>
                <strong>${item.quantity}x ${escapeHtml(lineProduct.name)}</strong>
                <p>${escapeHtml(lineProduct.station)} · ${escapeHtml(money(lineProduct.price * item.quantity))}</p>
                ${lineDetails ? `<p class="line-detail">${escapeHtml(lineDetails)}</p>` : ""}
              </div>
              <button class="mini-btn" type="button" data-remove-draft-index="${index}" aria-label="Remove ${escapeHtml(lineProduct.name)}">Remove</button>
            </div>
          `;
        }).join("")}
      </div>
      ${shortageText}
      <div class="draft-summary draft-total">
        <span>Total</span>
        <strong>${escapeHtml(money(getItemsTotal(draftItems)))}</strong>
      </div>
    `;
  }

  return {
    loadCustomerIntoManualOrder,
    renderManualOrderControls,
    renderOrderBuilder,
    renderProductsInSelects
  };
}
