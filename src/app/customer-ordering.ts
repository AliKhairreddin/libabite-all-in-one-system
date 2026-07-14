import {
  CUSTOMER_QR_CHANNEL,
  CUSTOMER_QR_ORDER_CONTEXT,
  UNPAID_PAYMENT_METHOD,
  WEBSITE_ORDER_CHANNEL,
  WEBSITE_PAYMENT_PROCESSOR
} from "../shared/constants.js";
import { getPaymentStatusForMethod, paymentRequiresReconciliation } from "../domain/payments.js";
import {
  captureWebsiteCheckoutDraft,
  restoreWebsiteCheckoutDraftControls
} from "../domain/checkout-draft.js";
import {
  calculateItemsTotal,
  normalizeWebsiteFulfillment,
  productCanBeOrderedForOrderContext,
  snapshotOrderItems
} from "../domain/orders.js";
import { flushRemoteState, saveState, state } from "./state.js";
import { applyPaidPaymentToOrder, recordPendingOnlinePayment } from "./payment-ledger.js";
import { enqueueReceiptPrintJob } from "./receipt-printing.js";
import { refreshReconciliationOrderLocally } from "./payment-actions.js";
import { timeNow } from "../shared/dates.js";
import {
  MARKETING_CONSENT_POLICY_VERSION,
  queueRecordCommunication
} from "./communication-actions.js";

const CUSTOMER_UPSELL_FLOW_CATEGORIES = ["Extra voor erbij", "Sauzen", "Frisdrank", "LibaSweets"];
const WEBSITE_MARKETING_CONSENT_SOURCE = "website-order-form";
const WEBSITE_RESUMABLE_PAYMENT_STATUSES = new Set(["Unpaid", "Pending", "Failed", "Cancelled"]);

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

  async function queueWebsiteOrderReceived(orderId) {
    await queueRecordCommunication({
      recordType: "order",
      recordId: orderId,
      eventType: "order.received"
    });
  }

  function websitePaymentProvider(order) {
    return String(order?.paymentProcessor || "").trim().toLowerCase() === "mollie" ? "mollie" : "stripe";
  }

  function restoreWebsiteCheckoutDraft(draft) {
    const form: any = document.querySelector("#customerOrderForm");
    if (!form || form.dataset.customerMode !== "website") return;
    restoreWebsiteCheckoutDraftControls(form.querySelectorAll("[name]"), draft);

    const addressInput: any = form.querySelector("[data-address-input]");
    if (!addressInput) return;
    const selectedAddress = String(
      draft?.values?.deliveryAddressLabel?.at(-1)
      || draft?.values?.deliveryAddress?.at(-1)
      || ""
    ).trim();
    const hasSelectedMetadata = [
      "deliveryAddressLat",
      "deliveryAddressLng",
      "deliveryAddressPlaceId",
      "deliveryAddressSource"
    ].some((name) => String(draft?.values?.[name]?.at(-1) || "").trim());
    if (selectedAddress && hasSelectedMetadata && addressInput.value === selectedAddress) {
      addressInput.dataset.addressSelected = "true";
    } else {
      delete addressInput.dataset.addressSelected;
    }
  }

  function reconcilePaidWebsiteOrder(order, checkout, paymentProvider, options: any = {}) {
    const confirmedOrderId = String(checkout?.orderId || "").trim();
    if (!confirmedOrderId || confirmedOrderId !== order.id) {
      renderWebsiteOrderScreen();
      showToast("Payment was verified for a different order. No local order was changed; contact the restaurant before trying another payment.");
      return false;
    }
    if (paymentRequiresReconciliation(checkout)) {
      refreshReconciliationOrderLocally(confirmedOrderId, checkout.reconciliationOrder);
      renderWebsiteOrderScreen();
      showToast("Payment was received after this order changed. The restaurant must review it and will contact you about fulfillment or a refund.");
      return false;
    }
    const paidAtMs = Date.now();
    applyPaidPaymentToOrder(order, {
      provider: paymentProvider,
      paymentMethod: "Online payment",
      paymentReference: checkout.checkoutSessionId || order.paymentReference,
      paymentProcessor: paymentProvider === "mollie" ? "Mollie" : WEBSITE_PAYMENT_PROCESSOR,
      checkoutSessionId: checkout.checkoutSessionId || order.stripeCheckoutSessionId,
      paymentIntentId: checkout.paymentIntentId,
      paidAt: order.paidAt || timeNow(),
      paidAtMs,
      paidByUserId: "",
      paidByName: paymentProvider === "mollie" ? "Mollie checkout" : "Stripe checkout",
      captureMode: "online_checkout"
    });
    if (options.clearCart) state.websiteCart = [];
    enqueueReceiptPrintJob(order, "website_payment_paid");
    state.websiteLastOrderId = order.id;
    state.receiptOrderId = order.id;
    if (order.status === "New") sendOrderToKitchen(order.id, { silent: true, skipPermission: true });
    else {
      saveState();
      renderWebsiteOrderScreen();
    }
    showToast(`Payment confirmed for order #${order.number}.`);
    return true;
  }

  async function rollbackFailedWebsiteCheckout(orderId, rollbackState, message) {
    const failedOrder = state.orders.find((order) => order.id === orderId);
    if (failedOrder) {
      failedOrder.status = "Cancelled";
      failedOrder.operationalStatus = "Cancelled";
      failedOrder.fulfillmentStatus = "Cancelled";
      failedOrder.paymentStatus = "Failed";
      failedOrder.paymentFailureReason = message;
      failedOrder.failedAt = timeNow();
      failedOrder.failedAtMs = Date.now();
      failedOrder.needsKitchenDispatch = false;
    }
    state.websiteCart = rollbackState.websiteCart;
    if (state.websiteLastOrderId === orderId) state.websiteLastOrderId = rollbackState.websiteLastOrderId;
    if (state.receiptOrderId === orderId) state.receiptOrderId = rollbackState.receiptOrderId;
    saveState();
    try {
      await flushRemoteState();
    } catch (error) {
      console.warn("Failed website checkout was rolled back locally but could not be mirrored remotely yet.", {
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    renderWebsiteOrderScreen();
    restoreWebsiteCheckoutDraft(rollbackState.checkoutDraft);
    showToast(message);
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
    const acceptedItems = snapshotOrderItems(items, productById);
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
      items: acceptedItems
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
    sendOrderToKitchen(order.id, { silent: true, skipPermission: true, receiptPrintTrigger: "qr_order_sent" });
    showToast(`Order #${number} sent to the kitchen.`);
  }

  async function submitWebsiteOrder(formData) {
    if (!getWebsiteOrderSession()) return;

    const checkoutDraft = captureWebsiteCheckoutDraft(formData);
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
    const marketingConsent = Boolean(customerEmail) && formData.get("marketingConsent") === "true";
    const paymentProvider = String(formData.get("paymentProvider") || "stripe").trim().toLowerCase() === "mollie" ? "mollie" : "stripe";
    const deliveryAddress = fulfillment === "Delivery" ? String(formData.get("deliveryAddress") || "").trim() : "";
    const deliveryAddressLabel = fulfillment === "Delivery" ? String(formData.get("deliveryAddressLabel") || deliveryAddress).trim() : "";
    const deliveryAddressLat = Number(formData.get("deliveryAddressLat"));
    const deliveryAddressLng = Number(formData.get("deliveryAddressLng"));
    const deliveryAddressLocation = fulfillment === "Delivery" && Number.isFinite(deliveryAddressLat) && Number.isFinite(deliveryAddressLng)
      ? { lat: deliveryAddressLat, lng: deliveryAddressLng }
      : null;

    if (!customerName || !customerPhone) {
      showToast("Enter your name and phone number.");
      return;
    }
    if (fulfillment === "Delivery" && !deliveryAddress) {
      showToast("Enter a delivery address.");
      return;
    }

    const acceptedItems = snapshotOrderItems(items, productById);
    const total = calculateItemsTotal(acceptedItems, productById);
    if (total <= 0) {
      showToast("Add a paid item before checkout.");
      return;
    }
    const number = state.nextOrderNumber;
    const orderId = `ORD-${number}`;
    const createdAt = timeNow();
    const createdAtMs = Date.now();
    const marketingConsentAtMs = marketingConsent ? createdAtMs : "";
    const marketingConsentPolicyVersion = marketingConsent ? MARKETING_CONSENT_POLICY_VERSION : "";
    const marketingConsentSource = marketingConsent ? WEBSITE_MARKETING_CONSENT_SOURCE : "";
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
      marketingConsent,
      marketingConsentAtMs,
      marketingConsentPolicyVersion,
      marketingConsentSource,
      deliveryAddress,
      deliveryAddressLabel,
      deliveryAddressLocation,
      deliveryAddressSource: fulfillment === "Delivery" ? String(formData.get("deliveryAddressSource") || "").trim() : "",
      deliveryAddressPlaceId: fulfillment === "Delivery" ? String(formData.get("deliveryAddressPlaceId") || "").trim() : "",
      requestedTime: "",
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
      items: acceptedItems
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
      deliveryAddress,
      marketingConsent,
      marketingConsentAtMs,
      marketingConsentPolicyVersion,
      marketingConsentSource
    });
    if (customerRecord) order.customerId = customerRecord.id;
    const rollbackState = {
      websiteLastOrderId: state.websiteLastOrderId,
      receiptOrderId: state.receiptOrderId,
      checkoutDraft,
      websiteCart: items.map((item) => ({
        ...item,
        modifiers: Array.isArray(item.modifiers) ? [...item.modifiers] : []
      }))
    };
    state.orders.push(order);
    state.nextOrderNumber += 1;
    state.websiteLastOrderId = order.id;
    state.receiptOrderId = order.id;
    saveState();
    try {
      await flushRemoteState();
    } catch {
      await rollbackFailedWebsiteCheckout(order.id, rollbackState, "Could not securely start checkout. Your cart is still here; please try again.");
      return;
    }

    let checkout;
    try {
      checkout = await createWebsiteCheckoutSession(order, Math.round(total * 100), paymentProvider);
    } catch (error) {
      console.warn("Website checkout session creation failed.", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    if (!checkout?.ok || (!checkout.checkoutUrl && !checkout.paid)) {
      await rollbackFailedWebsiteCheckout(
        order.id,
        rollbackState,
        checkout?.message || "Online checkout is not ready yet. Your cart has been preserved."
      );
      return;
    }

    if (checkout.paid) {
      reconcilePaidWebsiteOrder(order, checkout, paymentProvider, { clearCart: true });
      return;
    }

    state.websiteCart = [];
    recordPendingOnlinePayment(order, {
      provider: paymentProvider,
      paymentMethod: "Online payment",
      paymentProcessor: paymentProvider === "mollie" ? "Mollie" : WEBSITE_PAYMENT_PROCESSOR,
      paymentReference: checkout.checkoutSessionId,
      checkoutSessionId: checkout.checkoutSessionId,
      paymentIntentId: checkout.paymentIntentId,
      checkoutAttempt: checkout.checkoutAttempt,
      amountCents: Math.round(total * 100),
      captureMode: "online_checkout"
    });
    saveState();
    try {
      await flushRemoteState();
    } catch (error) {
      console.warn("Checkout was created but its pending state could not be mirrored remotely.", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
      renderWebsiteOrderScreen();
      showToast("Checkout was created, but the order could not be synced yet. Use Resume secure payment to try again.");
      return;
    }
    await queueWebsiteOrderReceived(order.id);

    window.location.assign(checkout.checkoutUrl);
  }

  async function resumeWebsitePayment(orderId) {
    if (!getWebsiteOrderSession()) return;
    const order = state.orders.find((item) => item.id === String(orderId || "").trim());
    const paymentStatus = String(order?.paymentStatus || "").trim();
    if (
      !order
      || (order.channel || order.orderType) !== WEBSITE_ORDER_CHANNEL
      || order.status !== "New"
      || !WEBSITE_RESUMABLE_PAYMENT_STATUSES.has(paymentStatus)
    ) {
      showToast("This order no longer needs a new payment session.");
      renderWebsiteOrderScreen();
      return;
    }

    const total = calculateItemsTotal(order.items || [], productById);
    if (total <= 0) {
      showToast("This order does not have a payable total.");
      return;
    }

    const paymentProvider = websitePaymentProvider(order);
    let checkout;
    try {
      checkout = await createWebsiteCheckoutSession(order, Math.round(total * 100), paymentProvider);
    } catch (error) {
      console.warn("Resumed website checkout session creation failed.", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
    if (!checkout?.ok || (!checkout.checkoutUrl && !checkout.paid)) {
      showToast(checkout?.message || "Secure payment could not be restarted yet. Please try again.");
      renderWebsiteOrderScreen();
      return;
    }

    if (checkout.paid) {
      reconcilePaidWebsiteOrder(order, checkout, paymentProvider);
      return;
    }

    recordPendingOnlinePayment(order, {
      provider: paymentProvider,
      paymentMethod: "Online payment",
      paymentProcessor: paymentProvider === "mollie" ? "Mollie" : WEBSITE_PAYMENT_PROCESSOR,
      paymentReference: checkout.checkoutSessionId,
      checkoutSessionId: checkout.checkoutSessionId,
      paymentIntentId: checkout.paymentIntentId,
      checkoutAttempt: checkout.checkoutAttempt,
      amountCents: Math.round(total * 100),
      captureMode: "online_checkout"
    });
    state.websiteLastOrderId = order.id;
    state.receiptOrderId = order.id;
    saveState();
    try {
      await flushRemoteState();
    } catch (error) {
      console.warn("Resumed checkout was created but its pending state could not be mirrored remotely.", {
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
      renderWebsiteOrderScreen();
      showToast("The new payment session could not be synced. Please try again.");
      return;
    }
    await queueWebsiteOrderReceived(order.id);
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
    resumeWebsitePayment,
    setCustomerCartOpen,
    setCustomerUpsellStep,
    setWebsiteFulfillment,
    startNewCustomerOrder,
    submitCustomerQrOrder,
    submitWebsiteOrder
  };
}
