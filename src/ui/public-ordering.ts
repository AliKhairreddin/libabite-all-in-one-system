import { state } from "../app/state.js";
import { CUSTOMER_QR_ORDER_CONTEXT, PRODUCT_CATEGORIES, WEBSITE_FULFILLMENT_OPTIONS, WEBSITE_ORDER_CHANNEL } from "../shared/constants.js";
import { getReservationDateLabel } from "../domain/reservations.js";
import { escapeHtml } from "../shared/html.js";
import { normalizeWebsiteFulfillment, productCanBeOrderedForOrderContext, websiteFulfillmentOption } from "../domain/orders.js";
import { productAllergenSummary } from "../domain/commerce.js";
import { toDateInputString } from "../domain/scheduling.js";
import { reservationTableMapHtml } from "./table-map.js";

export function createPublicOrderingUi(deps) {
  const {
    emptyState,
    fulfillmentLabel,
    getCustomerCartItems,
    getCustomerOrderContext,
    getItemCount,
    getItemsTotal,
    getAvailableReservationTable,
    getOrderPaymentSummary,
    getOrderTotal,
    getOrderableProductsForContext,
    getProductAvailability,
    getReservationValidation,
    getWebsiteOrderingUrl,
    getStockShortages,
    getCustomerQrSession,
    getWebsiteOrderSession,
    getWebsiteReservationSession,
    getWebsiteReservationUrl,
    money,
    orderById,
    orderLocationLabel,
    productById
  } = deps;
  const INLINE_UPSELL_CATEGORIES = ["Frisdrank", "Extra voor erbij", "Sauzen", "LibaSweets"];
  const INLINE_UPSELL_CATEGORY_LIMITS = {
    Frisdrank: 4,
    "Extra voor erbij": 2,
    Sauzen: 1,
    LibaSweets: 1
  };
  const INLINE_UPSELL_LIMIT = 8;
  const CART_DRINK_UPSELL_LIMIT = 6;
  const LIBABITE_LOGO_URL = "https://inch-digital.com/libabiteimg/logo.webp";

  function getRestaurantDisplayName() {
    const name = String(state.restaurantSettings.restaurantName || "").trim();
    return !name || name.toLowerCase() === "libabite" ? "LibaBite" : name;
  }

  function libabiteLogoHtml() {
    return `<img class="brand-logo" src="${LIBABITE_LOGO_URL}" alt="" loading="lazy" decoding="async">`;
  }

  function publicBrandHtml() {
    return `
      <div class="brand customer-brand">
        ${libabiteLogoHtml()}
        <div>
          <strong>${escapeHtml(getRestaurantDisplayName())}</strong>
        </div>
      </div>
    `;
  }

  function websiteOrderConfirmationNoteHtml(order) {
    const paymentSummary = getOrderPaymentSummary(order);
    const message = paymentSummary.paid
      ? "Payment received. We are preparing your order."
      : paymentSummary.statusLabel === "Pending"
        ? "Payment is being confirmed. We will update your order shortly."
        : paymentSummary.statusLabel === "Pay later"
          ? "Order received. You can pay when you collect or receive it."
          : "Order received. We will confirm payment with you soon.";
    return `<p class="customer-confirmation-note">${escapeHtml(message)}</p>`;
  }

  function customerAnchorId(value) {
    return `menu-${String(value || "category")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"}`;
  }

  function categoryRailHtml(productsByCategory) {
    return `
      <nav class="customer-category-rail" aria-label="Menu categories">
        ${productsByCategory.map((group) => {
          const product = group.products[0] || {};
          return `
            <a href="#${escapeHtml(customerAnchorId(group.category))}">
              ${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy">` : ""}
              <span>${escapeHtml(group.category)}</span>
            </a>
          `;
        }).join("")}
      </nav>
    `;
  }

  function upsellThumbHtml(product) {
    return product.imageUrl
      ? `<img src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy">`
      : `<span class="customer-upsell-thumb placeholder" aria-hidden="true">+</span>`;
  }

  function customerCartProductQuantity(cartItems, productId) {
    return cartItems
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  function customerCartProductEntry(cartItems, productId) {
    const index = cartItems.findIndex((item) => item.productId === productId);
    return {
      index,
      quantity: customerCartProductQuantity(cartItems, productId)
    };
  }

  function upsellActionHtml(product, cartItems) {
    const entry = customerCartProductEntry(cartItems, product.id);
    if (entry.quantity > 0 && entry.index > -1) {
      return `
        <div class="customer-upsell-quantity" aria-label="${escapeHtml(product.name)} quantity">
          <button class="mini-btn" type="button" data-customer-decrease="${entry.index}" aria-label="Decrease ${escapeHtml(product.name)}">-</button>
          <span>${escapeHtml(entry.quantity)}</span>
          <button class="mini-btn" type="button" data-customer-increase="${entry.index}" aria-label="Increase ${escapeHtml(product.name)}">+</button>
        </div>
      `;
    }
    return `
      <button class="customer-upsell-add" type="button" data-customer-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)}">+</button>
    `;
  }

  function upsellItemsHtml(products, cartItems = []) {
    return products.map((product) => `
      <div class="customer-upsell-item ${customerCartProductQuantity(cartItems, product.id) ? "is-in-cart" : ""}" data-customer-upsell-product="${escapeHtml(product.id)}">
        ${upsellThumbHtml(product)}
        <span>
          <strong>${escapeHtml(product.name)}</strong>
          <small>${escapeHtml(product.category)} · ${escapeHtml(money(product.price))}</small>
        </span>
        <div class="customer-upsell-action" data-customer-upsell-action="${escapeHtml(product.id)}">
          ${upsellActionHtml(product, cartItems)}
        </div>
      </div>
    `).join("");
  }

  function getUpsellProducts(cartItems, orderContext, sourceProductId, categories = INLINE_UPSELL_CATEGORIES, limit = INLINE_UPSELL_LIMIT) {
    const candidates = getOrderableProductsForContext(orderContext)
      .filter((product) => categories.includes(product.category))
      .filter((product) => product.id !== sourceProductId)
      .sort((first, second) => categories.indexOf(first.category) - categories.indexOf(second.category));
    const selected = [];
    categories.forEach((category) => {
      const categoryLimit = Math.min(limit - selected.length, INLINE_UPSELL_CATEGORY_LIMITS[category] || limit);
      if (categoryLimit < 1) return;
      selected.push(...candidates
        .filter((product) => product.category === category && !selected.some((item) => item.id === product.id))
        .slice(0, categoryLimit));
    });
    if (selected.length < limit) {
      selected.push(...candidates
        .filter((product) => !selected.some((item) => item.id === product.id))
        .slice(0, limit - selected.length));
    }
    return selected.slice(0, limit);
  }

  function customerProductCardElement(productId) {
    return [...document.querySelectorAll("[data-customer-product-card]")]
      .find((element: any) => element.dataset.customerProductCard === productId);
  }

  function customerUpsellSlotElement(productId) {
    return [...document.querySelectorAll("[data-customer-upsell-slot]")]
      .find((element: any) => element.dataset.customerUpsellSlot === productId);
  }

  function updateUpsellActionSurfaces(root, cartItems) {
    root.querySelectorAll("[data-customer-upsell-action]").forEach((action: any) => {
      const product = productById(action.dataset.customerUpsellAction);
      if (!product) return;
      const entry = customerCartProductEntry(cartItems, product.id);
      action.innerHTML = upsellActionHtml(product, cartItems);
      action.closest(".customer-upsell-item")?.classList.toggle("is-in-cart", entry.quantity > 0);
    });
  }

  function activeCustomerOrderingSurface() {
    const form: any = document.querySelector("#customerOrderForm");
    const mode = form?.dataset.customerMode || (getWebsiteOrderSession() ? "website" : getCustomerQrSession() ? "qr" : "");
    if (!["website", "qr"].includes(mode)) return null;
    const orderContext = mode === "website" ? getCustomerOrderContext("website") : CUSTOMER_QR_ORDER_CONTEXT;
    const cartItems = getCustomerCartItems(orderContext);
    return { mode, orderContext, cartItems };
  }

  function hasPatchableCustomerMenu(orderContext) {
    const expectedProductIds = getOrderableProductsForContext(orderContext).map((product) => product.id);
    const renderedProductIds = [...document.querySelectorAll("[data-customer-product-card]")]
      .map((element: any) => element.dataset.customerProductCard)
      .filter(Boolean);
    return renderedProductIds.length > 0
      && renderedProductIds.length === expectedProductIds.length
      && expectedProductIds.every((productId, index) => renderedProductIds[index] === productId);
  }

  function snapshotCustomerFormValues(form) {
    const values = {};
    form.querySelectorAll("[name]").forEach((control: any) => {
      if (control.type === "hidden") return;
      if (control.type === "radio" || control.type === "checkbox") {
        values[`${control.name}:${control.value}`] = control.checked;
        return;
      }
      values[control.name] = control.value;
    });
    return values;
  }

  function restoreCustomerFormValues(form, values) {
    form.querySelectorAll("[name]").forEach((control: any) => {
      if (control.type === "hidden") return;
      if (control.type === "radio" || control.type === "checkbox") {
        const key = `${control.name}:${control.value}`;
        if (Object.prototype.hasOwnProperty.call(values, key)) control.checked = values[key];
        return;
      }
      if (Object.prototype.hasOwnProperty.call(values, control.name)) control.value = values[control.name];
    });
  }

  function updateWebsiteFulfillmentSurfaces(orderContext) {
    if (orderContext.channel !== WEBSITE_ORDER_CHANNEL) return;
    document.querySelectorAll("[data-website-fulfillment]").forEach((button: any) => {
      button.classList.toggle("is-selected", button.dataset.websiteFulfillment === state.websiteFulfillment);
    });
  }

  function updateCustomerProductSurfaces(cartItems, orderContext) {
    getOrderableProductsForContext(orderContext).forEach((product) => {
      const card: any = customerProductCardElement(product.id);
      const slot: any = customerUpsellSlotElement(product.id);
      if (!card || !slot) return;
      const availability = getProductAvailability(product, cartItems, orderContext);
      const disabled = availability.maxQuantity < 1 || !productCanBeOrderedForOrderContext(product, orderContext);
      const addButton: any = card.querySelector(".customer-add-btn");
      const status = card.querySelector("[data-customer-product-status]");
      const isUpsellOpen = state.customerUpsellProductId === product.id;

      card.classList.toggle("is-upsell-open", isUpsellOpen);
      if (status) status.innerHTML = customerProductStatusHtml(product, cartItems, orderContext);
      if (addButton) addButton.disabled = disabled;

      if (!isUpsellOpen) {
        slot.innerHTML = "";
        return;
      }

      if (!slot.querySelector(".customer-inline-upsell")) {
        slot.innerHTML = instantUpsellHtml(product, cartItems, orderContext);
        return;
      }

      updateUpsellActionSurfaces(slot, cartItems);
    });
  }

  function renderCustomerCartPanelSurface(cartItems, mode, orderContext) {
    const form: any = document.querySelector("#customerOrderForm");
    if (!form) return false;
    const values = snapshotCustomerFormValues(form);
    form.outerHTML = customerCartHtml(cartItems, { mode, orderContext });
    const nextForm = document.querySelector("#customerOrderForm");
    if (nextForm) restoreCustomerFormValues(nextForm, values);
    return true;
  }

  function renderCustomerMobileControlsSurface(cartItems, mode) {
    const controls = document.querySelector("#customerCartMobileControls");
    if (!controls) return false;
    controls.innerHTML = customerCartMobileControlsHtml(cartItems, mode);
    return true;
  }

  function renderCustomerOrderingSurfaces() {
    const surface = activeCustomerOrderingSurface();
    if (!surface || !hasPatchableCustomerMenu(surface.orderContext)) return false;
    const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    updateWebsiteFulfillmentSurfaces(surface.orderContext);
    updateCustomerProductSurfaces(surface.cartItems, surface.orderContext);
    const cartRendered = renderCustomerCartPanelSurface(surface.cartItems, surface.mode, surface.orderContext);
    const mobileRendered = renderCustomerMobileControlsSurface(surface.cartItems, surface.mode);
    document.body.classList.toggle("is-customer-ordering", true);
    window.scrollTo(scrollX, scrollY);
    return cartRendered && mobileRendered;
  }

  function instantUpsellHtml(product, cartItems, orderContext) {
    if (state.customerUpsellProductId !== product.id) return "";
    const upsellProducts = getUpsellProducts(cartItems, orderContext, product.id);
    if (!upsellProducts.length) return "";
    return `
      <section class="customer-inline-upsell" aria-label="Add-ons for ${escapeHtml(product.name)}">
        <div class="customer-upsell-header">
          <span class="customer-product-kicker">Added to cart</span>
          <strong>Add a drink or extra?</strong>
          <button class="icon-btn customer-upsell-close" type="button" data-customer-upsell-close aria-label="Hide suggestions">×</button>
        </div>
        <div class="customer-upsell-list compact">
          ${upsellItemsHtml(upsellProducts, cartItems)}
        </div>
      </section>
    `;
  }

  function customerProductStatusHtml(product, cartItems, orderContext = CUSTOMER_QR_ORDER_CONTEXT) {
    const availability = getProductAvailability(product, cartItems, orderContext);
    const cartQuantity = customerCartProductQuantity(cartItems, product.id);
    const disabled = availability.maxQuantity < 1 || !productCanBeOrderedForOrderContext(product, orderContext);
    const stockLabel = disabled
      ? "Unavailable"
      : cartQuantity
        ? `${cartQuantity} in cart`
        : "";
    const stockClass = disabled ? "danger" : cartQuantity ? "info" : "ok";
    return stockLabel ? `<span class="pill ${stockClass}">${escapeHtml(stockLabel)}</span>` : "";
  }

  function customerProductCard(product, cartItems, orderContext = CUSTOMER_QR_ORDER_CONTEXT) {
    const availability = getProductAvailability(product, cartItems, orderContext);
    const disabled = availability.maxQuantity < 1 || !productCanBeOrderedForOrderContext(product, orderContext);
    const allergenSummary = Array.isArray(product.allergens) && product.allergens.length ? productAllergenSummary(product) : "";
    const hasInlineUpsell = state.customerUpsellProductId === product.id;
    return `
      <article class="customer-product-card ${hasInlineUpsell ? "is-upsell-open" : ""}" data-customer-product-card="${escapeHtml(product.id)}">
        ${product.imageUrl ? `<img class="customer-product-image" src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy">` : `<div class="customer-product-image placeholder" aria-hidden="true">L</div>`}
        <div class="customer-product-content">
          <span class="customer-product-kicker">${escapeHtml(product.category)}${product.isNew ? " · New" : ""}</span>
          <strong>${escapeHtml(product.name)}</strong>
          ${product.description ? `<p class="customer-product-description">${escapeHtml(product.description)}</p>` : ""}
          <p>${escapeHtml(money(product.price))}</p>
          ${allergenSummary ? `<p>${escapeHtml(allergenSummary)}</p>` : ""}
        </div>
        <div class="customer-product-actions">
          <span class="customer-product-status" data-customer-product-status="${escapeHtml(product.id)}">${customerProductStatusHtml(product, cartItems, orderContext)}</span>
          <button class="icon-btn customer-add-btn" type="button" data-customer-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)}" ${disabled ? "disabled" : ""}>+</button>
        </div>
        <div class="customer-inline-upsell-slot" data-customer-upsell-slot="${escapeHtml(product.id)}">
          ${instantUpsellHtml(product, cartItems, orderContext)}
        </div>
      </article>
    `;
  }
  
  function customerCartLine(item, index) {
    const product = productById(item.productId);
    if (!product) return "";
    return `
      <div class="customer-cart-line">
        <div>
          <strong>${item.quantity}x ${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(money(product.price * item.quantity))}</span>
        </div>
        <div class="customer-quantity-controls">
          <button class="mini-btn" type="button" data-customer-decrease="${index}" aria-label="Decrease ${escapeHtml(product.name)}">-</button>
          <button class="mini-btn" type="button" data-customer-increase="${index}" aria-label="Increase ${escapeHtml(product.name)}">+</button>
          <button class="mini-btn danger-action" type="button" data-customer-remove="${index}">Remove</button>
        </div>
      </div>
    `;
  }

  function drinkUpsellHtml(cartItems, orderContext) {
    if (!cartItems.length) return "";
    const drinks = getUpsellProducts(cartItems, orderContext, "", ["Frisdrank"], CART_DRINK_UPSELL_LIMIT);
    if (!drinks.length) return "";
    return `
      <section class="customer-upsell-panel" aria-label="Drinks with your order">
        <div class="customer-upsell-header">
          <span class="customer-product-kicker">Drinks</span>
          <strong>Complete your order</strong>
        </div>
        <div class="customer-upsell-list">
          ${upsellItemsHtml(drinks, cartItems)}
        </div>
      </section>
    `;
  }
  
  function getDefaultWebsiteRequestedTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const minutes = now.getMinutes();
    now.setMinutes(Math.ceil(minutes / 5) * 5, 0, 0);
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function getDefaultReservationTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 120);
    const minutes = now.getMinutes();
    now.setMinutes(Math.ceil(minutes / 15) * 15, 0, 0);
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }
  
  function websiteFulfillmentControlsHtml() {
    return `
      <div class="customer-service-toggle" role="group" aria-label="Order type">
        ${WEBSITE_FULFILLMENT_OPTIONS.map((option) => `
          <button class="${state.websiteFulfillment === option.value ? "is-selected" : ""}" type="button" data-website-fulfillment="${escapeHtml(option.value)}">
            ${escapeHtml(option.label)}
          </button>
        `).join("")}
      </div>
    `;
  }
  
  function customerCartHtml(cartItems, options: any = {}) {
    const mode = options.mode || "qr";
    const orderContext = options.orderContext || getCustomerOrderContext(mode);
    const total = getItemsTotal(cartItems);
    const itemCount = getItemCount(cartItems);
    const shortages = getStockShortages(cartItems, orderContext);
    const blocked = !cartItems.length || shortages.length > 0;
    const shortageText = shortages.length
      ? `<p class="customer-cart-note">Some items in your cart are unavailable right now.</p>`
      : "";
    const fulfillment = normalizeWebsiteFulfillment(state.websiteFulfillment);
    const deliverySelected = fulfillment === "Delivery";
    const websiteFields = mode === "website" ? `
        <input name="fulfillment" type="hidden" value="${escapeHtml(fulfillment)}">
        ${websiteFulfillmentControlsHtml()}
        <div class="customer-checkout-grid">
          <label>
            Name
            <input name="customerName" type="text" autocomplete="name" required>
          </label>
          <label>
            Phone
            <input name="customerPhone" type="tel" autocomplete="tel" required>
          </label>
          <label>
            Email
            <input name="customerEmail" type="email" autocomplete="email">
          </label>
          <label>
            ${deliverySelected ? "Delivery time" : "Pickup time"}
            <input name="requestedTime" type="time" value="${escapeHtml(getDefaultWebsiteRequestedTime())}" required>
          </label>
        </div>
        <label class="customer-delivery-address" ${deliverySelected ? "" : "hidden"}>
          Address
          <textarea name="deliveryAddress" rows="3" autocomplete="street-address" ${deliverySelected ? "required" : ""}></textarea>
        </label>
        <fieldset class="customer-payment-options customer-payment-card">
          <legend>Online payment</legend>
          <div class="check-row">
            <input name="paymentProvider" type="radio" value="stripe" checked>
            <span>Stripe checkout</span>
          </div>
          <div class="check-row">
            <input name="paymentProvider" type="radio" value="mollie">
            <span>Mollie checkout</span>
          </div>
        </fieldset>
    ` : `
        <fieldset class="customer-payment-options">
          <legend>Payment</legend>
          <label class="check-row">
            <input name="paymentOption" type="radio" value="later" checked>
            <span>Order now, pay at the table</span>
          </label>
        </fieldset>
    `;
  
    return `
      <form id="customerOrderForm" class="customer-cart-panel ${state.customerCartOpen ? "is-open" : ""}" data-customer-mode="${escapeHtml(mode)}">
        <div class="panel-header compact">
          <div>
            <p class="eyebrow">Cart</p>
            <h2>${itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Your order"}</h2>
          </div>
          <button class="icon-btn customer-cart-close" type="button" data-customer-cart-close aria-label="Minimize cart">-</button>
        </div>
        <div class="customer-cart-lines">
          ${cartItems.length ? cartItems.map(customerCartLine).join("") : emptyState("Choose items from the menu.")}
        </div>
        ${drinkUpsellHtml(cartItems, orderContext)}
        ${shortageText}
        <label>
          Notes
          <textarea name="notes" rows="3" placeholder="Allergy, no onion, extra sauce"></textarea>
        </label>
        ${websiteFields}
        <div class="customer-cart-total">
          <span>Total</span>
          <strong>${escapeHtml(money(total))}</strong>
        </div>
        <button class="primary-btn" type="submit" ${blocked ? "disabled" : ""}>${mode === "website" ? "Continue to payment" : "Place Order"} · ${escapeHtml(money(total))}</button>
      </form>
    `;
  }

  function customerCartMobileControlsHtml(cartItems, mode = "website") {
    const total = getItemsTotal(cartItems);
    const itemCount = getItemCount(cartItems);
    const isOpen = Boolean(state.customerCartOpen);
    return `
      <button class="customer-cart-backdrop ${isOpen ? "is-open" : ""}" type="button" data-customer-cart-close aria-label="Close cart"></button>
      ${itemCount ? `
        <div class="customer-cart-mobile-bar ${isOpen ? "is-hidden" : ""}">
          <button class="customer-cart-mobile-button" type="button" data-customer-cart-open aria-label="Open cart">
            <span>${itemCount} item${itemCount === 1 ? "" : "s"}</span>
            <strong>${escapeHtml(money(total))}</strong>
          </button>
          <button class="primary-btn" type="button" data-customer-cart-open>${mode === "website" ? "Checkout" : "View cart"}</button>
        </div>
      ` : ""}
    `;
  }
  
  function renderCustomerQrScreen() {
    const screen = document.querySelector("#customerQrScreen");
    const session = getCustomerQrSession();
    if (!screen || !session) return;
  
    if (session.error) {
      screen.innerHTML = `
        <main class="customer-shell customer-error-shell">
          <section class="customer-error-card">
            ${publicBrandHtml()}
            <h1>QR ordering unavailable</h1>
            <p>${escapeHtml(session.error)}</p>
          </section>
        </main>
      `;
      return;
    }
  
    const table = session.table;
    const code = session.code;
    const cartItems = getCustomerCartItems(CUSTOMER_QR_ORDER_CONTEXT);
    const products = getOrderableProductsForContext(CUSTOMER_QR_ORDER_CONTEXT);
    const productsByCategory = PRODUCT_CATEGORIES
      .map((category) => ({
        category,
        products: products.filter((product) => product.category === category)
      }))
      .filter((group) => group.products.length);
    const lastOrder = orderById(state.customerLastOrderId);
    const confirmation = lastOrder ? `
      <section class="customer-confirmation">
        <div>
          <p class="eyebrow">Sent to kitchen</p>
          <h2>Order #${escapeHtml(lastOrder.number)} received</h2>
          <p>${escapeHtml(orderLocationLabel(lastOrder))} · ${escapeHtml(getOrderPaymentSummary(lastOrder).statusLabel)} · ${escapeHtml(money(getOrderTotal(lastOrder)))}</p>
        </div>
        <button class="ghost-btn" type="button" data-customer-new-order>New Order</button>
      </section>
    ` : "";
  
    screen.innerHTML = `
      <header class="customer-topbar">
        ${publicBrandHtml()}
        <div class="customer-table-badge">
          <span>${escapeHtml(code.area || table.zone)}</span>
          <strong>${escapeHtml(table.name)}</strong>
        </div>
      </header>
      <main class="customer-shell">
        ${confirmation}
        <section class="customer-menu-panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">Menu</p>
              <h1>${escapeHtml(table.name)} ordering</h1>
            </div>
          </div>
          <div class="customer-menu-groups">
            ${categoryRailHtml(productsByCategory)}
            ${productsByCategory.length ? productsByCategory.map((group) => `
              <section class="customer-menu-group" id="${escapeHtml(customerAnchorId(group.category))}">
                <h2>${escapeHtml(group.category)}</h2>
                <div class="customer-product-grid">
                  ${group.products.map((product) => customerProductCard(product, cartItems, CUSTOMER_QR_ORDER_CONTEXT)).join("")}
                </div>
              </section>
            `).join("") : emptyState("No QR menu items are active.")}
          </div>
        </section>
        ${customerCartHtml(cartItems, { mode: "qr", orderContext: CUSTOMER_QR_ORDER_CONTEXT })}
      </main>
      <div id="customerCartMobileControls">
        ${customerCartMobileControlsHtml(cartItems, "qr")}
      </div>
    `;
  }
  
  function renderWebsiteOrderScreen() {
    const screen = document.querySelector("#customerQrScreen");
    const session = getWebsiteOrderSession();
    if (!screen || !session) return;
  
    const orderContext = getCustomerOrderContext("website");
    const fulfillmentOption = websiteFulfillmentOption(orderContext.fulfillment);
    const cartItems = getCustomerCartItems(orderContext);
    const products = getOrderableProductsForContext(orderContext);
    const productsByCategory = PRODUCT_CATEGORIES
      .map((category) => ({
        category,
        products: products.filter((product) => product.category === category)
      }))
      .filter((group) => group.products.length);
    const lastOrder = orderById(state.websiteLastOrderId);
    const confirmation = lastOrder ? `
      <section class="customer-confirmation">
        <div>
          <p class="eyebrow">Confirmed</p>
          <h2>Order #${escapeHtml(lastOrder.number)} received</h2>
          <p>${escapeHtml(fulfillmentLabel(lastOrder))} ${escapeHtml(lastOrder.requestedTime || "as soon as possible")} · ${escapeHtml(getOrderPaymentSummary(lastOrder).statusLabel)} · ${escapeHtml(money(getOrderTotal(lastOrder)))}</p>
          ${websiteOrderConfirmationNoteHtml(lastOrder)}
        </div>
        <button class="ghost-btn" type="button" data-customer-new-order>New Order</button>
      </section>
    ` : "";
  
    screen.innerHTML = `
      <header class="customer-topbar">
        ${publicBrandHtml()}
      </header>
      <main class="customer-shell">
        ${confirmation}
        <section class="customer-menu-panel">
          <div class="panel-header compact customer-order-header">
            <div>
              <p class="eyebrow">Online order</p>
              <h1>Order ${escapeHtml(getRestaurantDisplayName())}</h1>
            </div>
            ${websiteFulfillmentControlsHtml()}
          </div>
          <div class="customer-menu-groups">
            ${categoryRailHtml(productsByCategory)}
            ${productsByCategory.length ? productsByCategory.map((group) => `
              <section class="customer-menu-group" id="${escapeHtml(customerAnchorId(group.category))}">
                <h2>${escapeHtml(group.category)}</h2>
                <div class="customer-product-grid">
                  ${group.products.map((product) => customerProductCard(product, cartItems, orderContext)).join("")}
                </div>
              </section>
            `).join("") : emptyState(`No ${fulfillmentOption.label.toLowerCase()} menu items are active.`)}
          </div>
        </section>
        ${customerCartHtml(cartItems, { mode: "website", orderContext })}
      </main>
      <div id="customerCartMobileControls">
        ${customerCartMobileControlsHtml(cartItems, "website")}
      </div>
    `;
  }

  function renderPublicHomeScreen() {
    const screen = document.querySelector("#customerQrScreen");
    if (!screen) return;

    const orderContext = getCustomerOrderContext("website");
    const orderableProducts = getOrderableProductsForContext(orderContext).slice(0, 4);
    const activeReservations = state.reservations
      .filter((reservation) => ["Pending", "Confirmed", "Arrived"].includes(reservation.status))
      .sort((first, second) => `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`));
    const nextReservation = activeReservations[0];

    screen.innerHTML = `
      <header class="customer-topbar">
        ${publicBrandHtml()}
      </header>
      <main class="customer-shell customer-home-shell">
        <section class="customer-menu-panel customer-home-panel">
          <div>
            <p class="eyebrow">${escapeHtml(getRestaurantDisplayName())}</p>
            <h1>Order online or book a table</h1>
            <p>Fresh grill plates, sandwiches, sweets, and drinks for pickup, delivery, or dine-in planning.</p>
          </div>
          <div class="customer-home-actions">
            <a class="primary-btn" href="${escapeHtml(getWebsiteOrderingUrl())}">Order Online</a>
            <a class="ghost-btn" href="${escapeHtml(getWebsiteReservationUrl())}">Reserve Table</a>
          </div>
          <div class="customer-home-menu">
            ${orderableProducts.length ? orderableProducts.map((product) => `
              <article class="customer-product-card">
                ${product.imageUrl ? `<img class="customer-product-image" src="${escapeHtml(product.imageUrl)}" alt="" loading="lazy">` : `<div class="customer-product-image placeholder" aria-hidden="true">L</div>`}
                <div class="customer-product-content">
                  <span class="customer-product-kicker">${escapeHtml(product.category)}${product.isNew ? " · New" : ""}</span>
                  <strong>${escapeHtml(product.name)}</strong>
                  ${product.description ? `<p class="customer-product-description">${escapeHtml(product.description)}</p>` : ""}
                  <p>${escapeHtml(money(product.price))}</p>
                </div>
              </article>
            `).join("") : emptyState("Online ordering opens soon.")}
          </div>
        </section>
        <aside class="customer-cart-panel customer-home-info">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">Today</p>
              <h2>${escapeHtml(state.restaurantSettings.opensAt)}-${escapeHtml(state.restaurantSettings.closesAt)}</h2>
            </div>
          </div>
          <div class="reservation-channel-list">
            <span class="pill ok">Pickup</span>
            <span class="pill ok">Delivery</span>
            <span class="pill info">Table booking</span>
          </div>
          <p>${nextReservation ? `Next table: ${escapeHtml(getReservationDateLabel(nextReservation.date))} ${escapeHtml(nextReservation.time)}` : "Tables are open for website booking."}</p>
        </aside>
      </main>
    `;
  }

  function renderWebsiteReservationScreen() {
    const screen = document.querySelector("#customerQrScreen");
    const session = getWebsiteReservationSession();
    if (!screen || !session) return;

    const reservationDate = toDateInputString();
    const reservationTime = getDefaultReservationTime();
    const reservationGuests = 2;
    const suggestedTable = getAvailableReservationTable({
      date: reservationDate,
      guests: reservationGuests,
      time: reservationTime
    }) || state.tables[0];
    const lastReservation = state.reservations.find((reservation) => reservation.id === state.websiteLastReservationId);
    const confirmation = lastReservation ? `
      <section class="customer-confirmation">
        <div>
          <p class="eyebrow">Reservation received</p>
          <h2>${escapeHtml(getReservationDateLabel(lastReservation.date))} at ${escapeHtml(lastReservation.time)}</h2>
          <p>${escapeHtml(lastReservation.name)} · ${lastReservation.guests} guests · ${escapeHtml(lastReservation.status)}</p>
        </div>
      </section>
    ` : "";

    screen.innerHTML = `
      <header class="customer-topbar">
        ${publicBrandHtml()}
        <div class="customer-topbar-actions">
          <div class="customer-table-badge">
            <span>Website</span>
            <strong>Table reservation</strong>
          </div>
        </div>
      </header>
      <main class="customer-shell reservation-customer-shell">
        ${confirmation}
        <section class="customer-menu-panel website-reservation-panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">Reserve</p>
              <h1>Book a table</h1>
            </div>
          </div>
          <form id="customerReservationForm" class="stacked-form">
            <input name="tableId" id="customerReservationTable" type="hidden" value="${escapeHtml(suggestedTable?.id || "")}">
            <div class="customer-checkout-grid">
              <label>
                Date
                <input name="date" type="date" min="${escapeHtml(reservationDate)}" value="${escapeHtml(reservationDate)}" required>
              </label>
              <label>
                Time
                <input name="time" type="time" value="${escapeHtml(reservationTime)}" required>
              </label>
              <label>
                Guests
                <input name="guests" type="number" min="1" max="30" value="2" required>
              </label>
              <label>
                Name
                <input name="name" type="text" autocomplete="name" required>
              </label>
              <label>
                Phone
                <input name="phone" type="tel" autocomplete="tel">
              </label>
              <label>
                Email
                <input name="email" type="email" autocomplete="email">
              </label>
            </div>
            ${reservationTableMapHtml({
              tables: state.tables,
              selectedTableId: suggestedTable?.id || "",
              title: "Pick your table",
              getTableValidation: (table) => getReservationValidation({
                date: reservationDate,
                guests: reservationGuests,
                time: reservationTime,
                tableId: table.id,
                status: "Pending"
              })
            })}
            <label>
              Notes
              <textarea name="notes" rows="4" placeholder="Occasion, high chair, accessibility, allergies"></textarea>
            </label>
            <button class="primary-btn" type="submit">Confirm Reservation</button>
          </form>
        </section>
        <aside class="customer-cart-panel reservation-info-panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">Channels</p>
              <h2>Website booking</h2>
            </div>
          </div>
          <div class="reservation-channel-list">
            <span class="pill ok">Website</span>
            <span class="pill warning">Google later</span>
            <span class="pill warning">Facebook/Instagram later</span>
            <span class="pill info">Manual staff entry</span>
          </div>
        </aside>
      </main>
    `;
  }
  
  return {
    renderCustomerQrScreen,
    renderCustomerOrderingSurfaces,
    renderPublicHomeScreen,
    renderWebsiteOrderScreen,
    renderWebsiteReservationScreen
  };
}
