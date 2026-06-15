import {
  CUSTOMER_QR_CHANNEL,
  CUSTOMER_QR_ORDER_CONTEXT,
  UNPAID_PAYMENT_METHOD,
  WEBSITE_ORDER_CHANNEL,
  WEBSITE_PAYMENT_PROCESSOR
} from "../shared/constants.js";
import { getPaymentStatusForMethod } from "../domain/payments.js";
import { normalizeWebsiteFulfillment, productCanBeOrderedForOrderContext } from "../domain/orders.js";
import { isReservationTime } from "../domain/reservations.js";
import { flushRemoteState, saveState, state } from "./state.js";
import { recordPendingOnlinePayment } from "./payment-ledger.js";
import { timeNow } from "../shared/dates.js";

const CUSTOMER_UPSELL_FLOW_CATEGORIES = ["Extra voor erbij", "Sauzen", "Frisdrank", "LibaSweets"];

export function createCustomerOrderingRuntime(deps) {
  const {
    getCustomerOrderingSession,
    getCustomerQrSession,
    getWebsiteOrderSession,
    getProductAvailability,
    getStockShortages,
    getItemsTotal,
    createWebsiteCheckoutSession,
    normalizeOrderItems,
    productById,
    render,
    renderCustomerQrScreen,
    renderCustomerOrderingSurfaces,
    renderWebsiteOrderScreen,
    sendOrderToKitchen,
    showToast,
    upsertCustomerFromOrderDetails,
    validateOrderForKitchen
  } = deps;

  function getCustomerModeFromContext(orderContext = CUSTOMER_QR_ORDER_CONTEXT) {
    return orderContext.channel === WEBSITE_ORDER_CHANNEL ? "website" : "qr";
  }

  function getCustomerCartStateKey(mode = getCustomerOrderingSession()?.mode || "qr") {
    return mode === "website" ? "websiteCart" : "customerCart";
  }

  function getCustomerLastOrderStateKey(mode = getCustomerOrderingSession()?.mode || "qr") {
    return mode === "website" ? "websiteLastOrderId" : "customerLastOrderId";
  }

  function getCustomerOrderContext(mode = getCustomerOrderingSession()?.mode || "qr") {
    if (mode === "website") {
      return {
        channel: WEBSITE_ORDER_CHANNEL,
        fulfillment: normalizeWebsiteFulfillment(state.websiteFulfillment)
      };
    }
    return CUSTOMER_QR_ORDER_CONTEXT;
  }

  function getCustomerCartItems(orderContext = getCustomerOrderContext()) {
    const key = getCustomerCartStateKey(getCustomerModeFromContext(orderContext));
    state[key] = normalizeOrderItems(state[key] || [])
      .filter((item) => productCanBeOrderedForOrderContext(productById(item.productId), orderContext));
    return state[key];
  }

  function getCustomerCartTotal(orderContext = getCustomerOrderContext()) {
    return getItemsTotal(getCustomerCartItems(orderContext));
  }

  function shouldOpenCustomerUpsell(product) {
    return product && !CUSTOMER_UPSELL_FLOW_CATEGORIES.includes(product.category);
  }

  function renderCustomerOrderingUpdate() {
    if (!renderCustomerOrderingSurfaces?.()) render();
  }

  function addCustomerCartItem(productId, options: any = {}) {
    const session = getCustomerOrderingSession();
    if (!session || session.error) return;
    const orderContext = getCustomerOrderContext(session.mode);
    const product = productById(productId);
    if (!product || !productCanBeOrderedForOrderContext(product, orderContext)) {
      showToast("That item is not available for this order type.");
      return;
    }

    const cartItems = getCustomerCartItems(orderContext);
    const availability = getProductAvailability(product, cartItems, orderContext);
    if (availability.maxQuantity < 1) {
      showToast(`${product.name} is not available right now.`);
      renderCustomerOrderingUpdate();
      return;
    }

    const shouldOpenUpsell = shouldOpenCustomerUpsell(product);
    state[getCustomerCartStateKey(session.mode)] = normalizeOrderItems([...cartItems, { productId: product.id, quantity: 1, note: "", modifiers: [] }]);
    state.customerUpsellProductId = options.keepUpsellOpen ? state.customerUpsellProductId : shouldOpenUpsell ? product.id : "";
    state.customerUpsellStep = options.keepUpsellOpen ? state.customerUpsellStep : 0;
    state[getCustomerLastOrderStateKey(session.mode)] = "";
    saveState();
    renderCustomerOrderingUpdate();
    showToast(`${product.name} added.`);
  }

  function adjustCustomerCartItem(index, delta) {
    const session = getCustomerOrderingSession();
    const orderContext = getCustomerOrderContext(session?.mode || "qr");
    const cartItems = getCustomerCartItems(orderContext);
    const item = cartItems[Number(index)];
    if (!item) return;
    const product = productById(item.productId);
    if (!product) return;

    if (delta > 0) {
      const otherItems = cartItems.filter((_, itemIndex) => itemIndex !== Number(index));
      const availability = getProductAvailability(product, otherItems, orderContext);
      if (item.quantity + 1 > availability.maxQuantity) {
        showToast("That quantity is not available right now.");
        return;
      }
    }

    item.quantity += delta;
    const nextCartItems = normalizeOrderItems(cartItems.filter((line) => line.quantity > 0));
    if (state.customerUpsellProductId === product.id && !nextCartItems.some((line) => line.productId === product.id)) {
      state.customerUpsellProductId = "";
      state.customerUpsellStep = 0;
    }
    state[getCustomerCartStateKey(getCustomerModeFromContext(orderContext))] = nextCartItems;
    saveState();
    renderCustomerOrderingUpdate();
  }

  function removeCustomerCartItem(index) {
    const session = getCustomerOrderingSession();
    const orderContext = getCustomerOrderContext(session?.mode || "qr");
    const removedItem = getCustomerCartItems(orderContext)[Number(index)];
    const nextCartItems = getCustomerCartItems(orderContext).filter((_, itemIndex) => itemIndex !== Number(index));
    if (removedItem?.productId === state.customerUpsellProductId && !nextCartItems.some((line) => line.productId === state.customerUpsellProductId)) {
      state.customerUpsellProductId = "";
      state.customerUpsellStep = 0;
    }
    state[getCustomerCartStateKey(getCustomerModeFromContext(orderContext))] = nextCartItems;
    saveState();
    renderCustomerOrderingUpdate();
  }

  function startNewCustomerOrder() {
    const session = getCustomerOrderingSession();
    const mode = session?.mode || "qr";
    state[getCustomerCartStateKey(mode)] = [];
    state.customerCartOpen = false;
    state.customerUpsellProductId = "";
    state.customerUpsellStep = 0;
    state[getCustomerLastOrderStateKey(mode)] = "";
    saveState();
    render();
  }

  function closeCustomerUpsell() {
    state.customerUpsellProductId = "";
    state.customerUpsellStep = 0;
    saveState();
    renderCustomerOrderingUpdate();
  }

  function setCustomerUpsellStep(step = 0) {
    const nextStep = Math.max(0, Math.floor(Number(step) || 0));
    if (!state.customerUpsellProductId || nextStep >= CUSTOMER_UPSELL_FLOW_CATEGORIES.length) {
      state.customerUpsellProductId = "";
      state.customerUpsellStep = 0;
    } else {
      state.customerUpsellStep = nextStep;
    }
    saveState();
    renderCustomerOrderingUpdate();
  }

  function setCustomerCartOpen(open = true) {
    state.customerCartOpen = Boolean(open);
    saveState();
    renderCustomerOrderingUpdate();
  }

  function setWebsiteFulfillment(value) {
    state.websiteFulfillment = normalizeWebsiteFulfillment(value);
    state.websiteCart = getCustomerCartItems(getCustomerOrderContext("website"));
    state.websiteLastOrderId = "";
    state.customerUpsellProductId = "";
    state.customerUpsellStep = 0;
    saveState();
    renderCustomerOrderingUpdate();
  }

  function submitCustomerQrOrder(formData) {
    const session = getCustomerQrSession();
    if (!session || session.error || !session.table) {
      showToast("Ask staff for an active table QR code.");
      renderCustomerQrScreen();
      return;
    }

    const items = getCustomerCartItems(CUSTOMER_QR_ORDER_CONTEXT);
    if (!items.length) {
      showToast("Add an item before placing the order.");
      return;
    }

    const paymentOption = String(formData.get("paymentOption") || "later");
    const paymentMethod = UNPAID_PAYMENT_METHOD;
    const paymentStatus = getPaymentStatusForMethod(paymentMethod, paymentOption === "later" ? "Pay later" : "Unpaid");
    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const order: any = {
      id: orderId,
      number,
      channel: CUSTOMER_QR_CHANNEL,
      orderType: CUSTOMER_QR_CHANNEL,
      tableId: session.table.id,
      customer: session.table.name,
      paymentStatus,
      paymentMethod,
      fulfillment: "Kitchen",
      status: "New",
      operationalStatus: "New",
      fulfillmentStatus: "Not started",
      createdAt,
      createdAtMs,
      sentAt: "",
      paidAt: paymentStatus === "Paid" ? createdAt : "",
      paidAtMs: paymentStatus === "Paid" ? createdAtMs : "",
      staffId: "",
      staffName: "QR guest",
      paidByUserId: "",
      paidByName: "",
      inventoryDeducted: false,
      notes: String(formData.get("notes") || "").trim(),
      qrCodeId: session.code?.id || "",
      items: items.map((item) => ({ ...item }))
    };
    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
      showToast(validation.message);
      renderCustomerQrScreen();
      return;
    }

    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.customerCart = [];
    state.customerLastOrderId = order.id;
    state.receiptOrderId = order.id;
    sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
    showToast(`Order #${number} sent to the kitchen.`);
  }

  async function submitWebsiteOrder(formData) {
    if (!getWebsiteOrderSession()) return;

    const fulfillment = normalizeWebsiteFulfillment(formData.get("fulfillment") || state.websiteFulfillment);
    state.websiteFulfillment = fulfillment;
    const orderContext = getCustomerOrderContext("website");
    const items = getCustomerCartItems(orderContext);
    if (!items.length) {
      showToast("Add an item before checkout.");
      return;
    }

    const customerName = String(formData.get("customerName") || "").trim();
    const customerPhone = String(formData.get("customerPhone") || "").trim();
    const customerEmail = String(formData.get("customerEmail") || "").trim();
    const requestedTime = String(formData.get("requestedTime") || "").trim();
    const paymentProvider = String(formData.get("paymentProvider") || "stripe").trim().toLowerCase() === "mollie" ? "mollie" : "stripe";
    const deliveryAddress = fulfillment === "Delivery" ? String(formData.get("deliveryAddress") || "").trim() : "";

    if (!customerName || !customerPhone) {
      showToast("Enter your name and phone number.");
      return;
    }
    if (!isReservationTime(requestedTime)) {
      showToast("Choose a valid pickup or delivery time.");
      return;
    }
    if (fulfillment === "Delivery" && !deliveryAddress) {
      showToast("Enter a delivery address.");
      return;
    }

    const total = getItemsTotal(items);
    if (total <= 0) {
      showToast("Add a paid item before checkout.");
      return;
    }
    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const order: any = {
      id: orderId,
      number,
      channel: WEBSITE_ORDER_CHANNEL,
      orderType: WEBSITE_ORDER_CHANNEL,
      tableId: "",
      customer: customerName,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      requestedTime,
      paymentStatus: "Unpaid",
      paymentMethod: "Online payment",
      paymentReference: "",
      paymentProcessor: paymentProvider === "mollie" ? "Mollie" : WEBSITE_PAYMENT_PROCESSOR,
      fulfillment,
      status: "New",
      operationalStatus: "New",
      fulfillmentStatus: "Not started",
      createdAt,
      createdAtMs,
      sentAt: "",
      paidAt: "",
      paidAtMs: "",
      staffId: "",
      staffName: "Website checkout",
      paidByUserId: "",
      paidByName: "",
      inventoryDeducted: false,
      assignedDriver: "",
      pickupStatus: "",
      deliveryStatus: "",
      deliveryAssignedAtMs: "",
      deliveryStatusUpdatedAtMs: "",
      deliveredAt: "",
      deliveredAtMs: "",
      failedAt: "",
      failedAtMs: "",
      returnedAt: "",
      returnedAtMs: "",
      deliveryWasLate: false,
      deliveryNotes: [],
      deliveryProofPhotoName: "",
      deliveryProofAtMs: "",
      deliveryProofByName: "",
      cashCollected: false,
      cashCollectedAt: "",
      cashCollectedAtMs: "",
      cashCollectedByName: "",
      notes: String(formData.get("notes") || "").trim(),
      items: items.map((item) => ({ ...item }))
    };
    const validation = validateOrderForKitchen(order);
    if (!validation.ok) {
      showToast(validation.message);
      renderWebsiteOrderScreen();
      return;
    }

    const customerRecord = upsertCustomerFromOrderDetails({
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      deliveryAddress
    });
    if (customerRecord) order.customerId = customerRecord.id;
    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.websiteCart = [];
    state.websiteLastOrderId = order.id;
    state.receiptOrderId = order.id;
    saveState();
    await flushRemoteState();

    const checkout = await createWebsiteCheckoutSession(order, Math.round(total * 100), paymentProvider);
    if (!checkout?.ok || !checkout.checkoutUrl) {
      showToast(checkout?.message || "Online checkout is not ready yet.");
      return;
    }

    recordPendingOnlinePayment(order, {
      provider: paymentProvider,
      paymentMethod: "Online payment",
      paymentProcessor: paymentProvider === "mollie" ? "Mollie" : WEBSITE_PAYMENT_PROCESSOR,
      paymentReference: checkout.checkoutSessionId,
      checkoutSessionId: checkout.checkoutSessionId,
      paymentIntentId: checkout.paymentIntentId,
      amountCents: Math.round(total * 100),
      captureMode: "online_checkout"
    });
    saveState();
    await flushRemoteState();

    window.location.assign(checkout.checkoutUrl);
  }

  return {
    addCustomerCartItem,
    adjustCustomerCartItem,
    closeCustomerUpsell,
    getCustomerCartItems,
    getCustomerCartTotal,
    getCustomerOrderContext,
    removeCustomerCartItem,
    setCustomerCartOpen,
    setCustomerUpsellStep,
    setWebsiteFulfillment,
    startNewCustomerOrder,
    submitCustomerQrOrder,
    submitWebsiteOrder
  };
}
