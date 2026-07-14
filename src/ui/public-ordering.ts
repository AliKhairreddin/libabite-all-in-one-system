import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { state } from "../app/state.js";
import { CUSTOMER_QR_ORDER_CONTEXT, ONLINE_PAYMENT_PROVIDER_OPTIONS, PRODUCT_CATEGORIES, WEBSITE_FULFILLMENT_OPTIONS, WEBSITE_ORDER_CHANNEL } from "../shared/constants.js";
import { formatCustomerDeliveryEta, formatDeliveryDistance, getDeliveryStatus, RESTAURANT_COORDINATES } from "../domain/delivery.js";
import {
  addReservationCalendarDays,
  formatReservationMinutes,
  getReservationDateBounds,
  getReservationDateLabel,
  getReservationMinutes,
  getReservationPolicyValidation,
  getRestaurantLocalDate,
  isReservationDate,
  isReservationTime
} from "../domain/reservations.js";
import { escapeHtml } from "../shared/html.js";
import { normalizeWebsiteFulfillment, productCanBeOrderedForOrderContext, websiteFulfillmentOption } from "../domain/orders.js";
import { productAllergenSummary } from "../domain/commerce.js";
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
    getReservationRequestValidation,
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
  const CUSTOMER_UPSELL_FLOW_STEPS = [
    {
      category: "Extra voor erbij",
      kicker: "Make it a meal",
      title: "Add rice, bread, or an extra side?",
      detail: "Small extras are easy wins with this item.",
      nextLabel: "sauces"
    },
    {
      category: "Sauzen",
      kicker: "Sauce",
      title: "Want a sauce with it?",
      detail: "A quick sauce add-on makes the order feel complete.",
      nextLabel: "drinks"
    },
    {
      category: "Frisdrank",
      kicker: "Drinks",
      title: "Add a drink?",
      detail: "Cold drinks are the easiest final add-on.",
      nextLabel: "sweets"
    },
    {
      category: "LibaSweets",
      kicker: "Sweet finish",
      title: "Something sweet after?",
      detail: "Offer dessert last so the flow stays light.",
      nextLabel: ""
    }
  ];
  const INLINE_UPSELL_CATEGORIES = CUSTOMER_UPSELL_FLOW_STEPS.map((step) => step.category);
  const INLINE_UPSELL_CATEGORY_LIMITS = {
    Frisdrank: 6,
    "Extra voor erbij": 5,
    Sauzen: 4,
    LibaSweets: 4
  };
  const INLINE_UPSELL_LIMIT = 8;
  const CART_DRINK_UPSELL_LIMIT = 6;
  const LIBABITE_LOGO_URL = "https://inch-digital.com/libabiteimg/logo.webp";

  function enabledOnlinePaymentProviders() {
    const configured = String(import.meta.env.VITE_ONLINE_PAYMENT_PROVIDERS || "stripe")
      .split(",")
      .map((provider) => provider.trim().toLowerCase())
      .filter((provider, index, providers) => ONLINE_PAYMENT_PROVIDER_OPTIONS.includes(provider) && providers.indexOf(provider) === index);
    return configured.length ? configured : ["stripe"];
  }

  function onlinePaymentProviderOptionsHtml() {
    return enabledOnlinePaymentProviders().map((provider, index) => `
      <label class="check-row">
        <input name="paymentProvider" type="radio" value="${escapeHtml(provider)}" ${index === 0 ? "checked" : ""}>
        <span>${provider === "mollie" ? "Mollie" : "Stripe"} checkout</span>
      </label>
    `).join("");
  }

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

  function deliveryMapPoint(value) {
    const lat = Number(value?.lat);
    const lng = Number(value?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function customerDeliveryMetricText(order) {
    if (Number(order.deliveryDistanceRemainingMeters) > 0) return `${formatDeliveryDistance(order.deliveryDistanceRemainingMeters)} away`;
    if (Number(order.deliveryRoute?.distanceMeters) > 0) return `${formatDeliveryDistance(order.deliveryRoute.distanceMeters)} route`;
    return formatCustomerDeliveryEta(order);
  }

  function customerDeliveryTrackingText(order) {
    const status = getDeliveryStatus(order) || "Received";
    if (status === "On the way" && order.deliveryLastLocation) return "Driver is on the way";
    if (status === "On the way") return "Driver route started";
    if (status === "Delivered") return "Delivered";
    if (status === "Assigned" || status === "At restaurant" || status === "Picked up") return status;
    return order.deliveryTrackingStatus || "Preparing your delivery";
  }

  function liveMapIcon(label, className) {
    return L.divIcon({
      className: `live-map-marker ${className}`,
      html: `<span>${escapeHtml(label)}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }

  function renderCustomerDeliveryMaps() {
    window.requestAnimationFrame(() => {
      document.querySelectorAll("[data-customer-delivery-map]").forEach((mapNode: any) => {
        if (mapNode._leaflet_id) return;
        const order = orderById(mapNode.dataset.customerDeliveryMap);
        if (!order) return;
        const routePoints = (order.deliveryRoute?.geometry || [])
          .map(deliveryMapPoint)
          .filter(Boolean)
          .map((point) => [point.lat, point.lng] as [number, number]);
        const current = deliveryMapPoint(order.deliveryLastLocation);
        const destination = deliveryMapPoint(order.deliveryRoute?.destination || order.deliveryAddressLocation);
        const origin = deliveryMapPoint(order.deliveryRoute?.origin) || RESTAURANT_COORDINATES;
        const map = L.map(mapNode, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          dragging: false,
          touchZoom: false,
          doubleClickZoom: false
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "&copy; OpenStreetMap"
        }).addTo(map);

        const bounds: Array<[number, number]> = [];
        if (routePoints.length > 1) {
          L.polyline(routePoints, { color: "#1f6f4a", weight: 6, opacity: 0.84 }).addTo(map);
          bounds.push(...routePoints);
        }
        if (origin?.lat && origin?.lng) {
          const point: [number, number] = [Number(origin.lat), Number(origin.lng)];
          L.marker(point, { icon: liveMapIcon("R", "restaurant") }).addTo(map);
          bounds.push(point);
        }
        if (destination?.lat && destination?.lng) {
          const point: [number, number] = [Number(destination.lat), Number(destination.lng)];
          L.marker(point, { icon: liveMapIcon("C", "customer") }).addTo(map);
          bounds.push(point);
        }
        if (current) {
          const point: [number, number] = [current.lat, current.lng];
          L.marker(point, { icon: liveMapIcon("D", "driver") }).addTo(map);
          bounds.push(point);
        }
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
        else map.setView([Number(origin.lat), Number(origin.lng)], 14);
      });
    });
  }

  function customerDeliveryTrackingHtml(order) {
    if (!order || normalizeWebsiteFulfillment(order.fulfillment) !== "Delivery") return "";
    const progress = Math.max(0, Math.min(100, Math.round(Number(order.deliveryRouteProgress) || 0)));
    return `
      <section class="customer-delivery-tracking" aria-label="Delivery tracking">
        <div class="customer-delivery-map" data-customer-delivery-map="${escapeHtml(order.id)}"></div>
        <div class="customer-delivery-tracking-content">
          <div>
            <p class="eyebrow">Live tracking</p>
            <h3>${escapeHtml(customerDeliveryTrackingText(order))}</h3>
            <p>${escapeHtml(order.deliveryAddress || "Delivery address")}</p>
          </div>
          <div class="customer-delivery-progress">
            <span>${escapeHtml(customerDeliveryMetricText(order))}</span>
            <strong>${escapeHtml(formatCustomerDeliveryEta(order))}</strong>
          </div>
          <div class="driver-route-progress" aria-label="Delivery progress">
            <span style="width: ${progress}%"></span>
          </div>
        </div>
      </section>
    `;
  }

  function websiteOrderConfirmationNoteHtml(order) {
    const paymentSummary = getOrderPaymentSummary(order);
    const message = paymentSummary.paid
      ? "Payment received. We are preparing your order."
      : paymentSummary.statusLabel === "Pending"
        ? "Payment is not confirmed yet. You can safely resume payment below."
        : paymentSummary.statusLabel === "Pay later"
          ? "Order received. You can pay when you collect or receive it."
          : "Payment is required before the restaurant can start this order.";
    return `<p class="customer-confirmation-note">${escapeHtml(message)}</p>`;
  }

  function websiteOrderTimingText(order) {
    const fulfillment = normalizeWebsiteFulfillment(order.fulfillment);
    if (fulfillment === "Delivery") {
      const eta = formatCustomerDeliveryEta(order);
      return eta === "ETA after confirmation" ? "Delivery ETA after confirmation" : `Delivery ETA ${eta}`;
    }
    const status = String(order.fulfillmentStatus || order.status || "").trim();
    if (status === "Ready") return "Ready for pickup";
    if (["Sent to kitchen", "Preparing", "Scheduled"].includes(status)) return "Pickup estimate updating";
    return "Pickup estimate after confirmation";
  }

  function customerFulfillmentPromiseHtml(fulfillment) {
    const deliverySelected = normalizeWebsiteFulfillment(fulfillment) === "Delivery";
    return `
      <section class="customer-fulfillment-promise" aria-label="${deliverySelected ? "Delivery estimate" : "Pickup estimate"}">
        <div>
          <span>${deliverySelected ? "Delivery estimate" : "Pickup estimate"}</span>
          <strong>${deliverySelected ? "Shown after confirmation" : "Confirmed after ordering"}</strong>
        </div>
        <p>${deliverySelected
          ? "We prepare the order ASAP, assign a driver, and update the ETA here."
          : "We prepare the order ASAP and show the pickup status after confirmation."}</p>
      </section>
    `;
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

  function snapshotCustomerFormValues(form, options: any = {}) {
    const values: Record<string, any> = {};
    const activeElement = document.activeElement;
    let focus: any = null;
    form.querySelectorAll("[name]").forEach((control: any) => {
      if (
        control.type === "hidden"
        && !options.includeHidden
        && !String(control.name || "").startsWith("deliveryAddress")
      ) return;
      if (control.type === "radio" || control.type === "checkbox") {
        values[`${control.name}:${control.value}`] = control.checked;
        return;
      }
      values[control.name] = control.value;
      if (control === activeElement) {
        focus = {
          name: control.name,
          selectionStart: typeof control.selectionStart === "number" ? control.selectionStart : null,
          selectionEnd: typeof control.selectionEnd === "number" ? control.selectionEnd : null
        };
      }
    });
    return {
      focus,
      scrollTop: Number(form.scrollTop) || 0,
      values
    };
  }

  function restoreCustomerFormValues(form, snapshot, options: any = {}) {
    const values = snapshot?.values || {};
    form.querySelectorAll("[name]").forEach((control: any) => {
      if (
        control.type === "hidden"
        && !options.includeHidden
        && !String(control.name || "").startsWith("deliveryAddress")
      ) return;
      if (control.type === "radio" || control.type === "checkbox") {
        const key = `${control.name}:${control.value}`;
        if (Object.prototype.hasOwnProperty.call(values, key)) control.checked = values[key];
        return;
      }
      if (Object.prototype.hasOwnProperty.call(values, control.name)) control.value = values[control.name];
    });

    const addressInput: any = form.querySelector("[data-address-input]");
    if (addressInput) {
      const selectedAddress = String(values.deliveryAddressLabel || values.deliveryAddress || "").trim();
      const hasSelectedMetadata = Boolean(values.deliveryAddressLat || values.deliveryAddressLng || values.deliveryAddressPlaceId || values.deliveryAddressSource);
      if (selectedAddress && hasSelectedMetadata && addressInput.value === selectedAddress) addressInput.dataset.addressSelected = "true";
      else delete addressInput.dataset.addressSelected;
    }

    if (Number(snapshot?.scrollTop) > 0) form.scrollTop = snapshot.scrollTop;
    if (snapshot?.focus?.name) {
      const focusControl: any = form.querySelector(`[name="${CSS.escape(snapshot.focus.name)}"]`);
      if (focusControl) {
        focusControl.focus({ preventScroll: true });
        if (snapshot.focus.selectionStart !== null && typeof focusControl.setSelectionRange === "function") {
          focusControl.setSelectionRange(snapshot.focus.selectionStart, snapshot.focus.selectionEnd ?? snapshot.focus.selectionStart);
        }
      }
    }
  }

  function updateWebsiteFulfillmentSurfaces(orderContext) {
    if (orderContext.channel !== WEBSITE_ORDER_CHANNEL) return;
    document.querySelectorAll("[data-website-fulfillment]").forEach((button: any) => {
      const selected = button.dataset.websiteFulfillment === state.websiteFulfillment;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  function updateCustomerProductSurfaces(cartItems, orderContext) {
    getOrderableProductsForContext(orderContext).forEach((product) => {
      const card: any = customerProductCardElement(product.id);
      if (!card) return;
      const availability = getProductAvailability(product, cartItems, orderContext);
      const disabled = availability.maxQuantity < 1 || !productCanBeOrderedForOrderContext(product, orderContext);
      const addButton: any = card.querySelector(".customer-add-btn");
      const status = card.querySelector("[data-customer-product-status]");
      const isUpsellOpen = state.customerUpsellProductId === product.id;

      card.classList.toggle("is-upsell-open", isUpsellOpen);
      if (status) status.innerHTML = customerProductStatusHtml(product, cartItems, orderContext);
      if (addButton) addButton.disabled = disabled;
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

  function renderCustomerUpsellFlowSurface(cartItems, orderContext) {
    const host = document.querySelector("#customerUpsellFlow");
    if (!host) return false;
    const html = customerUpsellFlowHtml(cartItems, orderContext);
    host.innerHTML = html;
    document.body.classList.toggle("has-customer-upsell-flow", Boolean(html));
    updateUpsellActionSurfaces(host, cartItems);
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
    const upsellFlowRendered = renderCustomerUpsellFlowSurface(surface.cartItems, surface.orderContext);
    document.body.classList.toggle("is-customer-ordering", true);
    window.scrollTo(scrollX, scrollY);
    return cartRendered && mobileRendered && upsellFlowRendered;
  }

  function getUpsellFlowSteps(cartItems, orderContext, sourceProductId) {
    return CUSTOMER_UPSELL_FLOW_STEPS
      .map((step, index) => ({
        ...step,
        index,
        products: getUpsellProducts(
          cartItems,
          orderContext,
          sourceProductId,
          [step.category],
          INLINE_UPSELL_CATEGORY_LIMITS[step.category] || 4
        )
      }))
      .filter((step) => step.products.length);
  }

  function getActiveUpsellFlow(cartItems, orderContext) {
    const sourceProduct = productById(state.customerUpsellProductId);
    if (!sourceProduct || !customerCartProductQuantity(cartItems, sourceProduct.id)) return null;
    const steps = getUpsellFlowSteps(cartItems, orderContext, sourceProduct.id);
    if (!steps.length) return null;
    const requestedStep = Math.max(0, Math.floor(Number(state.customerUpsellStep) || 0));
    const activePosition = steps.findIndex((step) => step.index >= requestedStep);
    if (activePosition < 0) return null;
    return {
      sourceProduct,
      steps,
      activePosition,
      activeStep: steps[activePosition],
      nextStep: steps[activePosition + 1] || null
    };
  }

  function upsellFlowDotsHtml(steps, activePosition) {
    return `
      <div class="customer-upsell-flow-dots" aria-hidden="true">
        ${steps.map((_, index) => `
          <span class="${index === activePosition ? "is-active" : index < activePosition ? "is-complete" : ""}"></span>
        `).join("")}
      </div>
    `;
  }

  function customerUpsellFlowHtml(cartItems, orderContext) {
    const flow = getActiveUpsellFlow(cartItems, orderContext);
    if (!flow) return "";
    const { sourceProduct, steps, activePosition, activeStep, nextStep } = flow;
    const nextAction = nextStep
      ? `data-customer-upsell-step="${escapeHtml(nextStep.index)}"`
      : "data-customer-upsell-close";
    const nextLabel = nextStep ? `Next: ${activeStep.nextLabel || nextStep.category}` : "Done";
    return `
      <div class="customer-upsell-flow" role="presentation">
        <button class="customer-upsell-flow-backdrop" type="button" data-customer-upsell-close aria-label="Close add-on suggestions"></button>
        <section class="customer-upsell-flow-card" role="dialog" aria-modal="true" aria-label="Add-ons for ${escapeHtml(sourceProduct.name)}">
          <header>
            <div>
              <span class="customer-product-kicker">${escapeHtml(activeStep.kicker)}</span>
              <h2>${escapeHtml(activeStep.title)}</h2>
              <p>${escapeHtml(activeStep.detail)}</p>
            </div>
            <button class="icon-btn customer-upsell-close" type="button" data-customer-upsell-close aria-label="Close add-on suggestions">×</button>
          </header>
          <div class="customer-upsell-flow-source">
            ${sourceProduct.imageUrl ? `<img src="${escapeHtml(sourceProduct.imageUrl)}" alt="" loading="lazy">` : `<span class="customer-upsell-thumb placeholder" aria-hidden="true">+</span>`}
            <span>
              <small>Added</small>
              <strong>${escapeHtml(sourceProduct.name)}</strong>
            </span>
          </div>
          <div class="customer-upsell-flow-progress" aria-label="Step ${escapeHtml(activePosition + 1)} of ${escapeHtml(steps.length)}">
            <span>${escapeHtml(activePosition + 1)} of ${escapeHtml(steps.length)}</span>
            ${upsellFlowDotsHtml(steps, activePosition)}
          </div>
          <div class="customer-upsell-list customer-upsell-flow-list">
            ${upsellItemsHtml(activeStep.products, cartItems)}
          </div>
          <footer class="customer-upsell-flow-actions">
            <button class="ghost-btn" type="button" ${nextAction}>No thanks</button>
            <button class="primary-btn" type="button" ${nextAction}>${escapeHtml(nextLabel)}</button>
          </footer>
        </section>
      </div>
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
  
  const WEBSITE_RESERVATION_SLOT_MINUTES = 15;

  function getWebsiteReservationDateBounds(nowMs = Date.now()) {
    return getReservationDateBounds({ ...state.restaurantSettings, nowMs });
  }

  function getWebsiteReservationTimeSlots() {
    const opensAt = isReservationTime(state.restaurantSettings.opensAt) ? state.restaurantSettings.opensAt : "11:00";
    const closesAt = isReservationTime(state.restaurantSettings.closesAt) ? state.restaurantSettings.closesAt : "22:00";
    const openMinutes = getReservationMinutes(opensAt);
    const closeMinutes = getReservationMinutes(closesAt);
    if (openMinutes === closeMinutes) return [];

    const slots = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += WEBSITE_RESERVATION_SLOT_MINUTES) {
      const withinHours = closeMinutes > openMinutes
        ? minutes >= openMinutes && minutes < closeMinutes
        : minutes >= openMinutes || minutes < closeMinutes;
      if (withinHours) slots.push(formatReservationMinutes(minutes));
    }
    return slots;
  }

  function getDefaultReservationSlot() {
    const nowMs = Date.now();
    const bounds = getWebsiteReservationDateBounds(nowMs);
    const leadMinutes = Math.max(0, Math.floor(Number(state.restaurantSettings.reservationLeadMinutes) || 0));
    const leadDate = getRestaurantLocalDate(
      nowMs + leadMinutes * 60 * 1000,
      state.restaurantSettings.timeZone
    );
    const startDate = leadDate < bounds.min ? bounds.min : leadDate > bounds.max ? bounds.max : leadDate;
    const timeSlots = getWebsiteReservationTimeSlots();
    const fallbackTime = timeSlots[0]
      || (isReservationTime(state.restaurantSettings.opensAt) ? state.restaurantSettings.opensAt : "11:00");
    const fallback = { date: startDate, time: fallbackTime };
    if (state.restaurantSettings.reservationsEnabled === false || !timeSlots.length) return fallback;

    const guests = Math.min(2, Math.max(1, Math.floor(Number(state.restaurantSettings.reservationMaxGuests) || 12)));
    let firstPolicyValidSlot = null;
    for (let date = startDate; date <= bounds.max; date = addReservationCalendarDays(date, 1)) {
      for (const time of timeSlots) {
        const candidate = { date, guests, time, status: "Pending" };
        const policyValidation = getReservationPolicyValidation(candidate, {
          ...state.restaurantSettings,
          nowMs
        });
        if (!policyValidation.ok) continue;
        firstPolicyValidSlot ||= { date, time };

        const suggestedTable = getAvailableReservationTable(candidate);
        if (suggestedTable && getReservationValidation({
          ...candidate,
          tableId: suggestedTable.id
        }).ok) return { date, time };
      }
    }
    return firstPolicyValidSlot || fallback;
  }

  function reservationAvailabilityError(title, detail, pillText) {
    return {
      ok: false,
      className: "danger",
      pillClass: "danger",
      pillText,
      title,
      detail
    };
  }

  function getWebsiteReservationFieldValidation(values) {
    if (!isReservationDate(values.date)) {
      return reservationAvailabilityError("Choose a date", "Choose a valid reservation date to see available tables.", "Date needed");
    }
    if (!isReservationTime(values.time)) {
      return reservationAvailabilityError("Choose a time", "Choose an arrival time to see available tables.", "Time needed");
    }

    const guests = Number(values.guests);
    if (!Number.isInteger(guests) || guests < 1) {
      return reservationAvailabilityError("Enter party size", "Enter the number of guests to see tables that fit your party.", "Guests needed");
    }
    return null;
  }

  function getWebsiteReservationAvailability(values, preferredTableId = "") {
    const candidate = {
      date: String(values.date || ""),
      guests: Number(values.guests),
      time: String(values.time || ""),
      status: "Pending"
    };
    const inputValidation = getWebsiteReservationFieldValidation(values);
    const policyValidation = inputValidation || getReservationPolicyValidation(candidate, state.restaurantSettings);
    const tableValidations = new Map();

    state.tables.forEach((table) => {
      tableValidations.set(table.id, policyValidation.ok
        ? getReservationValidation({ ...candidate, tableId: table.id })
        : policyValidation);
    });

    const availableTables = policyValidation.ok
      ? state.tables.filter((table) => tableValidations.get(table.id)?.ok)
      : [];
    const suggestedTable = availableTables.length
      ? getAvailableReservationTable(candidate, availableTables) || availableTables[0]
      : null;
    const preferredTable = availableTables.find((table) => table.id === preferredTableId) || null;
    const selectedTable = preferredTable || suggestedTable;
    const overallValidation = selectedTable
      ? tableValidations.get(selectedTable.id)
      : policyValidation.ok
        ? getReservationRequestValidation({
            ...candidate,
            name: "Availability check",
            phone: "Availability check",
            tableId: ""
          })
        : policyValidation;

    return {
      overallValidation,
      recommendedTableIds: suggestedTable ? [suggestedTable.id] : [],
      selectedTableId: selectedTable?.id || "",
      tableValidations
    };
  }

  function websiteReservationAvailabilityHtml(model) {
    const validation = model.overallValidation;
    return `
      <div class="stacked-form" data-customer-reservation-availability>
        ${reservationTableMapHtml({
          tables: state.tables,
          selectedTableId: model.selectedTableId,
          recommendedTableIds: model.recommendedTableIds,
          disableUnavailable: true,
          title: "Pick your table",
          getTableValidation: (table) => model.tableValidations.get(table.id)
        })}
        <article
          class="availability-card ${escapeHtml(validation.className || "")}"
          data-customer-reservation-availability-feedback
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <header>
            <strong>${escapeHtml(validation.title || "Check availability")}</strong>
            <span class="pill ${escapeHtml(validation.pillClass || (validation.ok ? "ok" : "danger"))}">${escapeHtml(validation.pillText || (validation.ok ? "Available" : "Unavailable"))}</span>
          </header>
          <p>${escapeHtml(validation.detail || "Choose a date, time, and party size.")}</p>
        </article>
      </div>
    `;
  }

  function refreshWebsiteReservationAvailability(form: any = document.querySelector("#customerReservationForm")) {
    if (!form?.matches?.("#customerReservationForm")) return null;
    const elements: any = form.elements;
    const tableControl: any = elements.tableId;
    const model = getWebsiteReservationAvailability({
      date: elements.date?.value,
      guests: elements.guests?.value,
      time: elements.time?.value
    }, tableControl?.value);

    if (tableControl) tableControl.value = model.selectedTableId;
    const availability = form.querySelector("[data-customer-reservation-availability]");
    if (availability) availability.outerHTML = websiteReservationAvailabilityHtml(model);
    const submitButton: any = form.querySelector("[data-customer-reservation-submit]");
    if (submitButton) submitButton.disabled = !model.selectedTableId;
    return model;
  }
  
  function websiteFulfillmentControlsHtml() {
    return `
      <div class="customer-service-toggle" role="group" aria-label="Order type">
        ${WEBSITE_FULFILLMENT_OPTIONS.map((option) => `
          <button class="${state.websiteFulfillment === option.value ? "is-selected" : ""}" type="button" data-website-fulfillment="${escapeHtml(option.value)}" aria-pressed="${state.websiteFulfillment === option.value ? "true" : "false"}">
            ${escapeHtml(option.label)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function customerDeliveryAddressHtml(deliverySelected) {
    return `
      <div class="customer-delivery-address" data-address-combobox ${deliverySelected ? "" : "hidden"}>
        <label for="websiteDeliveryAddress">Address</label>
        <div class="customer-address-combobox">
          <input
            id="websiteDeliveryAddress"
            name="deliveryAddress"
            type="text"
            autocomplete="street-address"
            inputmode="text"
            placeholder="Street and house number"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="false"
            aria-controls="websiteDeliveryAddressSuggestions"
            data-address-input
            ${deliverySelected ? "required" : ""}
          >
          <div
            id="websiteDeliveryAddressSuggestions"
            class="customer-address-suggestions"
            role="listbox"
            data-address-suggestions
            hidden
          ></div>
        </div>
        <p class="customer-address-helper" data-address-helper aria-live="polite"></p>
        <input name="deliveryAddressLabel" type="hidden">
        <input name="deliveryAddressLat" type="hidden">
        <input name="deliveryAddressLng" type="hidden">
        <input name="deliveryAddressSource" type="hidden">
        <input name="deliveryAddressPlaceId" type="hidden">
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
        </div>
        <p class="customer-cart-note">If you provide an email, we use it for your receipt and order updates.</p>
        <label class="check-row customer-marketing-consent">
          <input name="marketingConsent" type="checkbox" value="true">
          <span>Email me occasional news and offers. This is optional and separate from order updates.</span>
        </label>
        ${customerFulfillmentPromiseHtml(fulfillment)}
        ${customerDeliveryAddressHtml(deliverySelected)}
        <fieldset class="customer-payment-options customer-payment-card">
          <legend>Online payment</legend>
          ${onlinePaymentProviderOptionsHtml()}
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
    const existingForm: any = document.querySelector("#customerOrderForm");
    const formSnapshot = existingForm?.dataset.customerMode === "qr" ? snapshotCustomerFormValues(existingForm) : null;
  
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
      <div id="customerUpsellFlow">
        ${customerUpsellFlowHtml(cartItems, CUSTOMER_QR_ORDER_CONTEXT)}
      </div>
    `;
    const nextForm = document.querySelector("#customerOrderForm");
    if (formSnapshot && nextForm) restoreCustomerFormValues(nextForm, formSnapshot);
  }
  
  function renderWebsiteOrderScreen() {
    const screen = document.querySelector("#customerQrScreen");
    const session = getWebsiteOrderSession();
    if (!screen || !session) return;
    const existingForm: any = document.querySelector("#customerOrderForm");
    const formSnapshot = existingForm?.dataset.customerMode === "website" ? snapshotCustomerFormValues(existingForm) : null;
  
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
    const lastOrderPayment = lastOrder ? getOrderPaymentSummary(lastOrder) : null;
    const canResumePayment = Boolean(
      lastOrder
      && lastOrder.status === "New"
      && ["Unpaid", "Pending", "Failed", "Cancelled"].includes(lastOrderPayment?.statusLabel)
    );
    const confirmationEyebrow = lastOrderPayment?.paid
      ? "Payment confirmed"
      : lastOrderPayment?.statusLabel === "Pending"
        ? "Payment pending"
        : "Payment required";
    const confirmation = lastOrder ? `
      <section class="customer-confirmation">
        <div>
          <p class="eyebrow">${escapeHtml(confirmationEyebrow)}</p>
          <h2>Order #${escapeHtml(lastOrder.number)} ${lastOrderPayment?.paid ? "received" : "saved"}</h2>
          <p>${escapeHtml(websiteOrderTimingText(lastOrder))} · ${escapeHtml(lastOrderPayment?.statusLabel || "Unpaid")} · ${escapeHtml(money(getOrderTotal(lastOrder)))}</p>
          ${websiteOrderConfirmationNoteHtml(lastOrder)}
        </div>
        <div class="customer-home-actions">
          ${canResumePayment ? `<button class="primary-btn" type="button" data-customer-resume-payment="${escapeHtml(lastOrder.id)}">Resume secure payment</button>` : ""}
          <button class="ghost-btn" type="button" data-customer-new-order>New Order</button>
        </div>
      </section>
    ` : "";
  
    screen.innerHTML = `
      <header class="customer-topbar">
        ${publicBrandHtml()}
      </header>
      <main class="customer-shell">
        ${confirmation}
        ${customerDeliveryTrackingHtml(lastOrder)}
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
      <div id="customerUpsellFlow">
        ${customerUpsellFlowHtml(cartItems, orderContext)}
      </div>
    `;
    const nextForm = document.querySelector("#customerOrderForm");
    if (formSnapshot && nextForm) restoreCustomerFormValues(nextForm, formSnapshot);
    renderCustomerDeliveryMaps();
  }

  function renderPublicHomeScreen() {
    const screen = document.querySelector("#customerQrScreen");
    if (!screen) return;

    const orderContext = getCustomerOrderContext("website");
    const orderableProducts = getOrderableProductsForContext(orderContext).slice(0, 4);

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
          <p>Table availability depends on the date, time, and party size.</p>
          <a class="ghost-btn" href="${escapeHtml(getWebsiteReservationUrl())}">Check table availability</a>
        </aside>
      </main>
    `;
  }

  function renderWebsiteReservationScreen() {
    const screen = document.querySelector("#customerQrScreen");
    const session = getWebsiteReservationSession();
    if (!screen || !session) return;

    const existingForm: any = document.querySelector("#customerReservationForm");
    const currentLastReservationId = String(state.websiteLastReservationId || "");
    const formSnapshot = existingForm?.dataset.lastReservationId === currentLastReservationId
      ? snapshotCustomerFormValues(existingForm, { includeHidden: true })
      : null;
    const dateBounds = getWebsiteReservationDateBounds();
    const defaultGuests = Math.min(2, Math.max(1, Math.floor(Number(state.restaurantSettings.reservationMaxGuests) || 12)));
    const defaultSlot = formSnapshot ? null : getDefaultReservationSlot();
    const reservationDate = formSnapshot ? String(formSnapshot.values.date ?? "") : defaultSlot.date;
    const reservationTime = formSnapshot ? String(formSnapshot.values.time ?? "") : defaultSlot.time;
    const reservationGuests = formSnapshot ? String(formSnapshot.values.guests ?? "") : String(defaultGuests);
    const availabilityModel = getWebsiteReservationAvailability({
      date: reservationDate,
      guests: reservationGuests,
      time: reservationTime
    }, formSnapshot ? String(formSnapshot.values.tableId || "") : "");
    if (formSnapshot) formSnapshot.values.tableId = availabilityModel.selectedTableId;
    const lastReservation = state.reservations.find((reservation) => reservation.id === state.websiteLastReservationId);
    const confirmation = lastReservation ? `
      <section class="customer-confirmation">
        <div>
          <p class="eyebrow">Request received</p>
          <h2>${escapeHtml(getReservationDateLabel(lastReservation.date))} at ${escapeHtml(lastReservation.time)}</h2>
          <p>${escapeHtml(lastReservation.name)} · ${lastReservation.guests} guests</p>
          <p>This is not yet confirmed. The restaurant will review your request and contact you.</p>
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
              <p class="eyebrow">Table request</p>
              <h1>Request a reservation</h1>
            </div>
          </div>
          <form id="customerReservationForm" class="stacked-form" data-last-reservation-id="${escapeHtml(currentLastReservationId)}">
            <input name="tableId" id="customerReservationTable" type="hidden" value="${escapeHtml(availabilityModel.selectedTableId)}">
            <div class="customer-checkout-grid">
              <label>
                Date
                <input name="date" type="date" min="${escapeHtml(dateBounds.min)}" max="${escapeHtml(dateBounds.max)}" value="${escapeHtml(reservationDate)}" required>
              </label>
              <label>
                Time
                <input name="time" type="time" step="900" value="${escapeHtml(reservationTime)}" required>
              </label>
              <label>
                Guests
                <input name="guests" type="number" min="1" max="${escapeHtml(state.restaurantSettings.reservationMaxGuests)}" step="1" value="${escapeHtml(reservationGuests)}" required>
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
            <p class="customer-cart-note">If you provide an email, we use it for updates about this reservation request.</p>
            <label class="check-row customer-marketing-consent">
              <input name="marketingConsent" type="checkbox" value="true">
              <span>Email me occasional news and offers. This is optional and separate from reservation messages.</span>
            </label>
            ${websiteReservationAvailabilityHtml(availabilityModel)}
            <label>
              Notes
              <textarea name="notes" rows="4" placeholder="Occasion, high chair, accessibility, allergies"></textarea>
            </label>
            <button class="primary-btn" type="submit" data-customer-reservation-submit ${availabilityModel.selectedTableId ? "" : "disabled"}>Request a reservation</button>
          </form>
        </section>
        <aside class="customer-cart-panel reservation-info-panel">
          <div class="panel-header compact">
            <div>
              <p class="eyebrow">How it works</p>
              <h2>Request, then confirmation</h2>
            </div>
          </div>
          <div class="reservation-channel-list">
            <span class="pill ok">Choose a time</span>
            <span class="pill info">Restaurant review</span>
            <span class="pill info">Confirmation by email or phone</span>
          </div>
          <p>Your table is reserved only after the restaurant confirms the request.</p>
        </aside>
      </main>
    `;
    const nextForm = document.querySelector("#customerReservationForm");
    if (formSnapshot && nextForm) restoreCustomerFormValues(nextForm, formSnapshot, { includeHidden: true });
  }
  
  return {
    renderCustomerQrScreen,
    renderCustomerOrderingSurfaces,
    renderPublicHomeScreen,
    renderWebsiteOrderScreen,
    renderWebsiteReservationScreen,
    refreshWebsiteReservationAvailability
  };
}
