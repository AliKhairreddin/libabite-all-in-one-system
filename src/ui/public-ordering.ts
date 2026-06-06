import { state } from "../app/state.js";
import { CUSTOMER_QR_ORDER_CONTEXT, PRODUCT_CATEGORIES, WEBSITE_FULFILLMENT_OPTIONS } from "../shared/constants.js";
import { getReservationDateLabel } from "../domain/reservations.js";
import { escapeHtml } from "../shared/html.js";
import { normalizeWebsiteFulfillment, productCanBeOrderedForOrderContext, websiteFulfillmentOption } from "../domain/orders.js";
import { productAllergenSummary } from "../domain/commerce.js";
import { toDateInputString } from "../domain/scheduling.js";

export function createPublicOrderingUi(deps) {
  const {
    emptyState,
    fulfillmentLabel,
    formatStockAmount,
    getCustomerCartItems,
    getCustomerOrderContext,
    getItemCount,
    getItemsTotal,
    getOrderPaymentSummary,
    getOrderTotal,
    getOrderableProductsForContext,
    getProductAvailability,
    getStaffUrl,
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

  function customerProductCard(product, cartItems, orderContext = CUSTOMER_QR_ORDER_CONTEXT) {
    const availability = getProductAvailability(product, cartItems, orderContext);
    const cartQuantity = cartItems
      .filter((item) => item.productId === product.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    const disabled = availability.maxQuantity < 1 || !productCanBeOrderedForOrderContext(product, orderContext);
    const stockLabel = disabled
      ? "Unavailable"
      : cartQuantity
        ? `${cartQuantity} in cart`
        : `${availability.maxQuantity} available`;
    const stockClass = disabled ? "danger" : cartQuantity ? "info" : "ok";
    const allergenSummary = productAllergenSummary(product);
    return `
      <article class="customer-product-card">
        <div>
          <span class="customer-product-kicker">${escapeHtml(product.category)}</span>
          <strong>${escapeHtml(product.name)}</strong>
          <p>${escapeHtml(product.station)} · ${escapeHtml(money(product.price))}</p>
          ${allergenSummary ? `<p>${escapeHtml(allergenSummary)}</p>` : ""}
        </div>
        <div class="customer-product-actions">
          <span class="pill ${stockClass}">${escapeHtml(stockLabel)}</span>
          <button class="icon-btn customer-add-btn" type="button" data-customer-add="${escapeHtml(product.id)}" aria-label="Add ${escapeHtml(product.name)}" ${disabled ? "disabled" : ""}>+</button>
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
      ? `<p class="customer-cart-note">Missing ${escapeHtml(shortages.map((item) => `${formatStockAmount(item.shortage, item.ingredient.unit)} ${item.ingredient.name}`).join(", "))}.</p>`
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
      <form id="customerOrderForm" class="customer-cart-panel" data-customer-mode="${escapeHtml(mode)}">
        <div class="panel-header compact">
          <div>
            <p class="eyebrow">Cart</p>
            <h2>${itemCount ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Your order"}</h2>
          </div>
        </div>
        <div class="customer-cart-lines">
          ${cartItems.length ? cartItems.map(customerCartLine).join("") : emptyState("Choose items from the menu.")}
        </div>
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
  
  function renderCustomerQrScreen() {
    const screen = document.querySelector("#customerQrScreen");
    const session = getCustomerQrSession();
    if (!screen || !session) return;
  
    if (session.error) {
      screen.innerHTML = `
        <main class="customer-shell customer-error-shell">
          <section class="customer-error-card">
            <div class="brand">
              <span class="brand-mark" aria-hidden="true">L</span>
              <div>
                <strong>Libabite</strong>
                <span>QR ordering</span>
              </div>
            </div>
            <h1>QR ordering unavailable</h1>
            <p>${escapeHtml(session.error)}</p>
            <a class="ghost-btn" href="${escapeHtml(getStaffUrl())}">Staff Login</a>
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
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">L</span>
          <div>
            <strong>${escapeHtml(state.restaurantSettings.restaurantName)}</strong>
            <span>${escapeHtml(state.restaurantSettings.location)}</span>
          </div>
        </div>
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
            ${productsByCategory.length ? productsByCategory.map((group) => `
              <section class="customer-menu-group">
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
          ${lastOrder.paymentReference ? `<p class="customer-confirmation-code">Payment ${escapeHtml(lastOrder.paymentReference)}</p>` : ""}
        </div>
        <button class="ghost-btn" type="button" data-customer-new-order>New Order</button>
      </section>
    ` : "";
  
    screen.innerHTML = `
      <header class="customer-topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">L</span>
          <div>
            <strong>${escapeHtml(state.restaurantSettings.restaurantName)}</strong>
            <span>${escapeHtml(state.restaurantSettings.location)}</span>
          </div>
        </div>
        <div class="customer-topbar-actions">
          <div class="customer-table-badge">
            <span>Online order</span>
            <strong>${escapeHtml(fulfillmentOption.label)}</strong>
          </div>
          <a class="ghost-btn" href="${escapeHtml(getStaffUrl())}">Staff Login</a>
        </div>
      </header>
      <main class="customer-shell">
        ${confirmation}
        <section class="customer-menu-panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">Online menu</p>
              <h1>Order Libabite</h1>
            </div>
            ${websiteFulfillmentControlsHtml()}
          </div>
          <div class="customer-menu-groups">
            ${productsByCategory.length ? productsByCategory.map((group) => `
              <section class="customer-menu-group">
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
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">L</span>
          <div>
            <strong>${escapeHtml(state.restaurantSettings.restaurantName)}</strong>
            <span>${escapeHtml(state.restaurantSettings.location)}</span>
          </div>
        </div>
        <div class="customer-topbar-actions">
          <a class="ghost-btn" href="${escapeHtml(getStaffUrl())}">Staff Login</a>
        </div>
      </header>
      <main class="customer-shell customer-home-shell">
        <section class="customer-menu-panel customer-home-panel">
          <div>
            <p class="eyebrow">Libabite Roermond</p>
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
                <div>
                  <span class="customer-product-kicker">${escapeHtml(product.category)}</span>
                  <strong>${escapeHtml(product.name)}</strong>
                  <p>${escapeHtml(product.station)} · ${escapeHtml(money(product.price))}</p>
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

    const lastReservation = state.reservations.find((reservation) => reservation.id === state.websiteLastReservationId);
    const confirmation = lastReservation ? `
      <section class="customer-confirmation">
        <div>
          <p class="eyebrow">Reservation received</p>
          <h2>${escapeHtml(getReservationDateLabel(lastReservation.date))} at ${escapeHtml(lastReservation.time)}</h2>
          <p>${escapeHtml(lastReservation.name)} · ${lastReservation.guests} guests · ${escapeHtml(lastReservation.status)}</p>
        </div>
        <a class="ghost-btn" href="${escapeHtml(getStaffUrl())}">Staff Login</a>
      </section>
    ` : "";

    screen.innerHTML = `
      <header class="customer-topbar">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">L</span>
          <div>
            <strong>${escapeHtml(state.restaurantSettings.restaurantName)}</strong>
            <span>${escapeHtml(state.restaurantSettings.location)}</span>
          </div>
        </div>
        <div class="customer-topbar-actions">
          <div class="customer-table-badge">
            <span>Website</span>
            <strong>Table reservation</strong>
          </div>
          <a class="ghost-btn" href="${escapeHtml(getStaffUrl())}">Staff Login</a>
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
            <div class="customer-checkout-grid">
              <label>
                Date
                <input name="date" type="date" min="${escapeHtml(toDateInputString())}" value="${escapeHtml(toDateInputString())}" required>
              </label>
              <label>
                Time
                <input name="time" type="time" value="${escapeHtml(getDefaultReservationTime())}" required>
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
    renderPublicHomeScreen,
    renderWebsiteOrderScreen,
    renderWebsiteReservationScreen
  };
}
